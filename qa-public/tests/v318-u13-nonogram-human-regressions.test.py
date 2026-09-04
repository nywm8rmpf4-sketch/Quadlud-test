from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
index_html=(ROOT/'index.html').read_text()
service_worker=(ROOT/'sw.js').read_text()
css=runtime_styles(ROOT)
scripts=runtime_sources(ROOT)

TOKEN='3.1.8-u13-nonogram'
for asset in ['styles-nonogram.css','ui-mobile-coach-fixes.css','nonogram-ui.js','nonogram-pedagogy.js','nonogram-pedagogy-atomic.js']:
    assert f'{asset}?v={TOKEN}' in index_html,(asset,'U13 page cache-bust missing')
    assert f"'./{asset}?v={TOKEN}'" in service_worker,(asset,'U13 precache mismatch')
bridge_match=re.search(r'coach-presentation-bridge\.js\?v=(3\.1\.8-[^"\']+)',index_html)
assert bridge_match,'Coach bridge v3.1.8 cache-bust token missing'
bridge_token=bridge_match.group(1)
assert f"'./coach-presentation-bridge.js?v={bridge_token}'" in service_worker,'current Coach bridge token must be precached exactly'
cache_match=re.search(r"const CACHE='([^']+)'",service_worker)
assert cache_match and cache_match.group(1).startswith('quadlud-v3.1.8-'),'v3.1.8 PWA cache identity missing'

html=index_html
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    html=re.sub(pat,'',html)

FIXTURE="""()=>{
  stopTimer(false);paused=false;closeHintNotice();document.body.classList.remove('tutor-active');
  const A=QuadludGameSessionAdapters.nonogram;
  const puzzle={game:'nonogram',rows:5,cols:5,rowClues:[[5],[],[5],[],[5]],colClues:[[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1]]};
  current=A.createGeneratedSession('easy',{game:'nonogram',puzzle,unique:true,generated:true,seed:'u13-human',generatorVersion:1,fingerprint:'qfp1-u13-human',generationStats:{},difficultyProfile:{difficulty:'easy'},validationState:{solutionGrid:Array.from({length:5},(_,r)=>Array(5).fill(r%2===0?1:0))}});
  historyInit(true);renderGameUi(current);startTimer(true,0,false);updateHistoryButtons();
}"""

def load(page):
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    page.evaluate("""()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}""")
    for src in scripts: page.add_script_tag(content=src)
    page.wait_for_selector('.cards')

def install_fixture(page):
    page.evaluate(FIXTURE)
    page.wait_for_selector('#ngboard .ng-cell')

def tutor_metrics(page):
    return page.evaluate("""()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}};const root=document.documentElement;return {innerWidth,innerHeight,scrollWidth:root.scrollWidth,scrollHeight:root.scrollHeight,panel:rect('#app>.panel'),game:rect('.nonogram-game'),layout:rect('.nonogram-layout'),tools:rect('.nonogram-tools'),board:rect('.nonogram-board'),walkthrough:rect('.walkthrough-panel'),walkBoard:rect('.nonogram-tutor-board .nonogram-board'),walkScroll:rect('.walkthrough-scroll'),walkActions:rect('.walkthrough-actions-top')}}""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    # 1. Real toolbar Coach trigger on phone portrait: the first human press must
    # visibly activate the pedagogical surface and focus a real deduction entity.
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    page.click('#hintBtn');page.wait_for_selector('#hintNotice .coach-progress')
    assert page.locator('#hintNotice .coach-progress').inner_text().strip()=='1/4'
    assert page.locator('#hintNotice [data-persona="guide"]').count()==1
    focus=page.locator('.nonogram-game .ng-focus-premise,.nonogram-game .ng-focus-context,.nonogram-game .ng-focus-target,.nonogram-game .ng-focus-contradiction')
    assert focus.count()>=1,'canonical Nonogram Coach focus missing'
    assert focus.first.evaluate("e=>{const s=getComputedStyle(e);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0}"),'Nonogram Coach focus must be visibly outlined'
    assert page.locator('#hintNotice').inner_text().strip()
    assert not errors,errors
    ctx.close()

    # 2. Tutor uses the same visible FILLED state, coordinates and clues as game.
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    page.click('#walkthroughBtn');page.wait_for_selector('#walkthroughNext')
    page.click('#walkthroughNext');page.wait_for_timeout(30)
    filled=page.locator('.nonogram-tutor-board .ng-cell.ng-filled')
    assert filled.count()==1,filled.count()
    filled_bg=filled.first.evaluate("e=>getComputedStyle(e).backgroundColor")
    unknown_bg=page.locator('.nonogram-tutor-board .ng-cell:not(.ng-filled):not(.ng-empty)').first.evaluate("e=>getComputedStyle(e).backgroundColor")
    assert filled_bg!=unknown_bg,(filled_bg,unknown_bg)
    assert page.locator('.nonogram-tutor-board .ng-grid-row-coordinates span').count()==5
    assert page.locator('.nonogram-tutor-board .ng-grid-column-coordinates span').count()==5
    assert page.locator('.nonogram-tutor-board .ng-row-clues .ng-row-clue').count()==5
    assert page.locator('.nonogram-tutor-board .ng-col-clues .ng-col-clue').count()==5
    m=tutor_metrics(page);assert m['scrollWidth']<=m['innerWidth']+1,m
    assert not errors,errors
    ctx.close()

    # 3. Phone landscape: tools occupy the left rail and the 5x5 board remains usable.
    ctx=browser.new_context(viewport={'width':844,'height':390},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    m=tutor_metrics(page)
    assert m['scrollWidth']<=m['innerWidth']+1,m
    assert m['scrollHeight']<=m['innerHeight']+1,m
    assert m['panel']['l']>=-1 and m['panel']['r']<=m['innerWidth']+1,m
    assert m['game']['l']>=m['panel']['l']-1 and m['game']['r']<=m['panel']['r']+1,m
    assert m['layout']['l']>=m['game']['l']-1 and m['layout']['r']<=m['game']['r']+1,m
    assert m['tools']['r']<=m['layout']['l']+2,m
    assert m['board']['w']>=210 and m['board']['h']>=210,m
    assert not errors,errors
    ctx.close()

    # 4. iPad landscape Tutor: use the complete landscape surface instead of a narrow
    # phone-shaped modal. The board, controls and explanation must all stay visible.
    ctx=browser.new_context(viewport={'width':1366,'height':900},locale='fr-FR')
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    page.click('#walkthroughBtn');page.wait_for_selector('#walkthroughNext')
    page.click('#walkthroughNext');page.wait_for_timeout(30)
    m=tutor_metrics(page)
    assert m['scrollWidth']<=m['innerWidth']+1,m
    assert m['walkthrough']['w']>=0.82*m['innerWidth'],m
    assert m['walkBoard']['w']>=500 and m['walkBoard']['h']>=500,m
    assert m['walkActions']['r']+12<=m['walkBoard']['l'],m
    assert m['walkScroll']['r']+12<=m['walkBoard']['l'],m
    assert m['walkthrough']['l']>=-1 and m['walkthrough']['r']<=m['innerWidth']+1,m
    assert page.locator('.nonogram-tutor-board .ng-cell.ng-filled').count()==1
    assert not errors,errors
    ctx.close()
    browser.close()

print('v3.1.8-U13 Mosaïque human regressions PASS — Coach trigger + canonical visible focus + Tutor FILLED state + phone landscape + iPad landscape + PWA delivery')
