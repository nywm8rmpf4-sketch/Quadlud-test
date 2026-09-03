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
assert f'styles-nonogram.css?v={TOKEN}' in index_html,'Mosaïque stylesheet cache-bust missing'
assert f'ui-mobile-coach-fixes.css?v={TOKEN}' in index_html,'Mosaïque landscape cache-bust missing'
assert f'nonogram-ui.js?v={TOKEN}' in index_html,'Mosaïque UI cache-bust missing'
assert f'nonogram-pedagogy.js?v={TOKEN}' in index_html,'Mosaïque pedagogy cache-bust missing'
assert f'nonogram-pedagogy-atomic.js?v={TOKEN}' in index_html,'Mosaïque atomic Tutor cache-bust missing'
assert f'coach-presentation-bridge.js?v={TOKEN}' in index_html,'Coach bridge cache-bust missing'
assert "const CACHE='quadlud-v3.1.8-u13-nonogram-human-fixes'" in service_worker,'U13 PWA cache identity missing'
for asset in ['styles-nonogram.css','ui-mobile-coach-fixes.css','nonogram-ui.js','nonogram-pedagogy.js','nonogram-pedagogy-atomic.js','coach-presentation-bridge.js']:
    assert f"'./{asset}?v={TOKEN}'" in service_worker,(asset,'U13 precache mismatch')

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

    # Human regression 1: the real in-game Coach button must open the staged
    # Mosaïque Coach and the fourth request must apply the visible deduction.
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',is_mobile=True,has_touch=True)
    page=ctx.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    page.locator('#hintBtn').tap()
    page.wait_for_selector('#hintNotice .coach-progress')
    coach1=page.evaluate("""()=>({progress:document.querySelector('#hintNotice .coach-progress')?.textContent?.trim(),persona:document.querySelector('#hintNotice .pedagogy-persona-coach')?.dataset?.persona,focus:document.querySelectorAll('.ng-focus-premise,.ng-focus-context,.ng-focus-target').length})""")
    assert coach1['progress']=='1/4',coach1
    assert coach1['persona']=='guide',coach1
    assert coach1['focus']>0,coach1
    for expected in ['2/4','3/4','4/4']:
        page.evaluate("document.querySelector('#hintBtn').click()")
        page.wait_for_function("expected=>document.querySelector('#hintNotice .coach-progress')?.textContent?.trim()===expected",arg=expected)
    coach4=page.evaluate("""()=>({progress:document.querySelector('#hintNotice .coach-progress')?.textContent?.trim(),filled:current.state[0].filter(v=>v===NonogramLogic.FILLED).length,history:Object.keys(current.moveHistory?.nodes||{}).length,hidden:document.querySelector('#hintNotice')?.textContent?.includes('solutionGrid')||false})""")
    assert coach4['progress']=='4/4',coach4
    assert coach4['filled']==5,coach4
    assert coach4['history']>=2,coach4
    assert not coach4['hidden'],coach4

    # Human regression 2: the real Tutor renderer must preserve black FILLED
    # cells together with the exact gameplay coordinates and row/column clues.
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
    ctx.close()

    # Human regression 3: reference iPhone landscape must keep the full
    # Mosaïque surface inside the panel without scrolling/clipping. Tools are
    # beside the clue/grid composite so the board keeps a playable size.
    land=browser.new_context(viewport={'width':844,'height':390},locale='fr-FR',is_mobile=True,has_touch=True)
    page=land.new_page(); land_errors=[]
    page.on('pageerror',lambda e:land_errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:land_errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);install_fixture(page)
    geom=page.evaluate("""()=>{const rect=s=>document.querySelector(s).getBoundingClientRect(),panel=rect('.panel'),game=rect('.nonogram-game'),tools=rect('.nonogram-tools'),layout=rect('.nonogram-layout'),board=rect('.nonogram-board');return {innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,panel:{l:panel.left,r:panel.right,t:panel.top,b:panel.bottom},game:{l:game.left,r:game.right,t:game.top,b:game.bottom},tools:{l:tools.left,r:tools.right,t:tools.top,b:tools.bottom},layout:{l:layout.left,r:layout.right,t:layout.top,b:layout.bottom},board:{w:board.width,h:board.height,t:board.top,b:board.bottom}}}""")
    assert geom['scrollWidth']<=geom['innerWidth']+1,geom
    assert geom['scrollHeight']<=geom['innerHeight']+1,geom
    assert geom['panel']['l']>=-1 and geom['panel']['r']<=geom['innerWidth']+1,geom
    assert geom['game']['l']>=geom['panel']['l']-1 and geom['game']['r']<=geom['panel']['r']+1,geom
    assert geom['game']['t']>=geom['panel']['t']-1 and geom['game']['b']<=geom['panel']['b']+1,geom
    assert geom['layout']['t']>=geom['panel']['t']-1 and geom['layout']['b']<=geom['panel']['b']+1,geom
    assert geom['tools']['t']>=geom['panel']['t']-1 and geom['tools']['b']<=geom['panel']['b']+1,geom
    assert geom['tools']['r']<=geom['layout']['l']+1,geom
    assert geom['board']['w']>=210 and geom['board']['h']>=210,geom
    assert not land_errors,land_errors
    land.close();browser.close()

print('v3.1.8-U13 Mosaïque human regressions PASS — Coach + Tutor FILLED state + iPhone landscape + PWA delivery')
