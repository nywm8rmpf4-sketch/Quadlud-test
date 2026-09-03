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
for asset in ['styles-nonogram.css','ui-mobile-coach-fixes.css','nonogram-ui.js','nonogram-pedagogy.js','nonogram-pedagogy-atomic.js','coach-presentation-bridge.js']:
    assert f'{asset}?v={TOKEN}' in index_html,(asset,'U13 page cache-bust missing')
    assert f"'./{asset}?v={TOKEN}'" in service_worker,(asset,'U13 precache mismatch')
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
    page.wait_for_selector('.panel .nonogram-game .nonogram-board')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    # U13-1 — exact reported defect: a real tap on Logic Coach must react.
    # The existing stage32 Coach test separately validates all four semantic
    # levels; this UI-path regression owns only delivery/binding/focus.
    phone=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',is_mobile=True,has_touch=True)
    page=phone.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    page.locator('#hintBtn').tap()
    page.wait_for_selector('#hintNotice .coach-progress')
    coach=page.evaluate("""()=>({progress:document.querySelector('#hintNotice .coach-progress')?.textContent?.trim(),persona:document.querySelector('#hintNotice .pedagogy-persona-coach')?.dataset?.persona,focus:document.querySelectorAll('.ng-focus-premise,.ng-focus-context,.ng-focus-target').length,flow:current.hintFlow?.kind,stage:current.hintFlow?.stage,hidden:document.querySelector('#hintNotice')?.textContent?.includes('solutionGrid')||false})""")
    assert coach['progress']=='1/4',coach
    assert coach['persona']=='guide' and coach['focus']>0,coach
    assert coach['flow']=='nonogram-proof' and coach['stage']==1,coach
    assert not coach['hidden'],coach

    # U13-2 — exact Tutor renderer must preserve a newly FILLED cell in black,
    # plus the same coordinates and clues as gameplay.
    install_fixture(page)
    page.locator('#walkthroughBtn').tap()
    page.wait_for_selector('.walkthrough-panel .nonogram-tutor-board')
    page.locator('#walkthroughNext').tap()
    page.wait_for_function("()=>document.querySelectorAll('.walkthrough-panel .nonogram-board .ng-filled').length>0")
    tutor=page.evaluate("""()=>{const filled=document.querySelector('.walkthrough-panel .nonogram-board .ng-filled'),unknown=document.querySelector('.walkthrough-panel .nonogram-board .ng-cell:not(.ng-filled):not(.ng-empty)'),fs=getComputedStyle(filled),us=unknown?getComputedStyle(unknown):null;return {filledCount:document.querySelectorAll('.walkthrough-panel .nonogram-board .ng-filled').length,filledBackground:fs.backgroundColor,unknownBackground:us?.backgroundColor||null,rowCoords:document.querySelectorAll('.walkthrough-panel .ng-grid-row-coordinates>span').length,colCoords:document.querySelectorAll('.walkthrough-panel .ng-grid-column-coordinates>span').length,rowClues:document.querySelectorAll('.walkthrough-panel .ng-row-clue').length,colClues:document.querySelectorAll('.walkthrough-panel .ng-col-clue').length,scrollWidth:document.documentElement.scrollWidth,innerWidth}}""")
    assert tutor['filledCount']==1,tutor
    assert tutor['filledBackground'] and tutor['filledBackground']!=tutor['unknownBackground'],tutor
    assert tutor['rowCoords']==5 and tutor['colCoords']==5,tutor
    assert tutor['rowClues']==5 and tutor['colClues']==5,tutor
    assert tutor['scrollWidth']<=tutor['innerWidth']+1,tutor
    assert not errors,errors
    phone.close()

    # U13-3a — tight iPhone landscape gameplay remains wholly inside viewport.
    land=browser.new_context(viewport={'width':844,'height':390},locale='fr-FR',is_mobile=True,has_touch=True)
    page=land.new_page(); land_errors=[]
    page.on('pageerror',lambda e:land_errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:land_errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    geom=page.evaluate("""()=>{const rect=s=>document.querySelector(s).getBoundingClientRect(),panel=rect('.panel'),game=rect('.nonogram-game'),tools=rect('.nonogram-tools'),layout=rect('.nonogram-layout'),board=rect('.nonogram-board');return {innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,panel:{l:panel.left,r:panel.right,t:panel.top,b:panel.bottom},game:{l:game.left,r:game.right,t:game.top,b:game.bottom},tools:{l:tools.left,r:tools.right,t:tools.top,b:tools.bottom},layout:{l:layout.left,r:layout.right,t:layout.top,b:layout.bottom},board:{w:board.width,h:board.height}}}""")
    assert geom['scrollWidth']<=geom['innerWidth']+1 and geom['scrollHeight']<=geom['innerHeight']+1,geom
    assert geom['panel']['l']>=-1 and geom['panel']['r']<=geom['innerWidth']+1,geom
    assert geom['game']['l']>=geom['panel']['l']-1 and geom['game']['r']<=geom['panel']['r']+1,geom
    assert geom['game']['t']>=geom['panel']['t']-1 and geom['game']['b']<=geom['panel']['b']+1,geom
    assert geom['tools']['r']<=geom['layout']['l']+1,geom
    assert geom['board']['w']>=210 and geom['board']['h']>=210,geom
    assert not land_errors,land_errors
    land.close()

    # U13-3b — user's iPad landscape Tutor case: consume available width and
    # keep board, navigation and pedagogical rail inside the panel.
    ipad=browser.new_context(viewport={'width':1366,'height':900},locale='fr-FR',has_touch=True)
    page=ipad.new_page(); ipad_errors=[]
    page.on('pageerror',lambda e:ipad_errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:ipad_errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    page.locator('#walkthroughBtn').tap()
    page.wait_for_selector('.walkthrough-panel .nonogram-tutor-board')
    ipad_geom=page.evaluate("""()=>{const r=s=>document.querySelector(s)?.getBoundingClientRect(),app=r('main#app'),panel=r('.walkthrough-panel'),wrap=r('.walkthrough-board-wrap'),layout=r('.walkthrough-panel .nonogram-layout'),nav=r('.walkthrough-actions-top'),scroll=r('.walkthrough-scroll');return {innerWidth,scrollWidth:document.documentElement.scrollWidth,app:{w:app?.width,l:app?.left,r:app?.right},panel:{w:panel?.width,l:panel?.left,r:panel?.right},wrap:{w:wrap?.width,l:wrap?.left,r:wrap?.right},layout:{w:layout?.width,l:layout?.left,r:layout?.right},nav:{l:nav?.left,r:nav?.right},scroll:{l:scroll?.left,r:scroll?.right},display:getComputedStyle(document.querySelector('.walkthrough-panel')).display}}""")
    assert ipad_geom['display']=='grid',ipad_geom
    assert ipad_geom['app']['w']>=ipad_geom['innerWidth']*.88,ipad_geom
    assert ipad_geom['panel']['w']>=ipad_geom['innerWidth']*.82,ipad_geom
    assert ipad_geom['wrap']['w']>=559,ipad_geom
    assert ipad_geom['panel']['l']>=-1 and ipad_geom['panel']['r']<=ipad_geom['innerWidth']+1,ipad_geom
    for key in ['wrap','layout','nav','scroll']:
        assert ipad_geom[key]['l']>=ipad_geom['panel']['l']-1 and ipad_geom[key]['r']<=ipad_geom['panel']['r']+1,(key,ipad_geom)
    assert ipad_geom['scrollWidth']<=ipad_geom['innerWidth']+1,ipad_geom
    assert not ipad_errors,ipad_errors
    ipad.close();browser.close()

print('v3.1.8-U13 Mosaïque human regressions PASS — Coach trigger + Tutor FILLED state + phone landscape + iPad landscape + PWA delivery')
