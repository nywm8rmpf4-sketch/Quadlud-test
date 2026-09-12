from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources,runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
for pattern in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    HTML=re.sub(pattern,'',HTML)
CSS=runtime_styles(ROOT);SCRIPTS=runtime_sources(ROOT)

def load(page,game):
    page.set_content(HTML);page.add_style_tag(content=CSS)
    page.add_script_tag(content="""(()=>{const d=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>d.get(String(k))??null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear()}})})()""")
    for source in SCRIPTS:page.add_script_tag(content=source)
    page.evaluate("""game=>withSeed(`v319-f-${game}`,()=>{const p=prefs();p.sound=false;savePrefs(p);const g=generateRegisteredCandidate(game,'easy');installGeneratedSession(game,'easy',g,{context:'normal'});historyInit(true);statsStart(current);const before=historySnapshotKey();if(game==='patches')current.paint=current.reg.map(row=>[...row]);else current.state=current.validationState.solutionGrid.map(row=>row.map(v=>v?NonogramLogic.FILLED:NonogramLogic.EMPTY));drawGameUi(current);historyRecord({type:'QA_F_WIN'},before);window.__fVisible=game==='patches'?JSON.stringify(current.paint):JSON.stringify(current.state);finish('QA F')})""",game)
    page.wait_for_timeout(80)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    cases=[({'width':390,'height':844},'light'),({'width':844,'height':390},'dark'),({'width':768,'height':1024},'dark')]
    for game in ('patches','nonogram'):
        for viewport,scheme in cases:
            context=browser.new_context(viewport=viewport,color_scheme=scheme,reduced_motion='no-preference');page=context.new_page();load(page,game)
            result=page.evaluate("""game=>{const board=document.querySelector(game==='patches'?'#pboard':'#ngboard'),cells=[...board.children],state=game==='patches'?current.paint:current.state;return{active:board.classList.contains(game==='patches'?'patches-victory-active':'nonogram-victory-active'),cells:cells.length,marked:board.querySelectorAll(game==='patches'?'.patches-victory-cell':'.nonogram-victory-cell').length,filled:board.querySelectorAll('.nonogram-victory-filled').length,semanticFilled:board.querySelectorAll('.ng-filled').length,delays:cells.map(x=>getComputedStyle(x).getPropertyValue('--victory-delay').trim()),clues:game==='patches'?board.querySelectorAll('.patch-clue').length:document.querySelectorAll('.ng-row-clue,.ng-col-clue').length,same:window.__fVisible===JSON.stringify(state),overflow:document.documentElement.scrollWidth<=innerWidth}}""",game)
            assert result['active'] and result['cells']>0 and result['marked']==result['cells'],(game,result)
            assert result['clues']>0 and result['same'] and result['overflow'] and all(result['delays']),(game,result)
            if game=='nonogram':assert result['filled']==result['semanticFilled'] and result['filled']>0,(game,result)
            context.close()
        context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=context.new_page();load(page,game)
        reduced=page.evaluate("""game=>{const board=document.querySelector(game==='patches'?'#pboard':'#ngboard');return{reduced:board.classList.contains('sensorial-victory-reduced'),cellAnimation:[...board.children].every(x=>getComputedStyle(x).animationName==='none')}}""",game)
        assert reduced['reduced'] and reduced['cellAnimation'],(game,reduced);context.close()
    browser.close()
print('v3.1.9-F browser: Rectangles + Mosaïque light/dark, portrait/landscape/iPad, clues, reduced motion and visible-state parity PASS')
