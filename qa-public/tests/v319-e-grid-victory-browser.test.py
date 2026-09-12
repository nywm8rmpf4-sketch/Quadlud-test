from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
for pattern in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    HTML=re.sub(pattern,'',HTML)
CSS=runtime_styles(ROOT);SCRIPTS=runtime_sources(ROOT)

def load(page,game):
    page.set_content(HTML);page.add_style_tag(content=CSS)
    page.add_script_tag(content="""(()=>{const d=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>d.get(String(k))??null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear()}})})()""")
    for source in SCRIPTS: page.add_script_tag(content=source)
    page.evaluate("""game=>withSeed(`v319-e-${game}`,()=>{const p=prefs();p.sound=false;savePrefs(p);const g=generateRegisteredCandidate(game,'easy');installGeneratedSession(game,'easy',g,{context:'normal'});historyInit(true);statsStart(current);const before=historySnapshotKey();current.state=current.sol.map(row=>[...row]);drawGameUi(current);historyRecord({type:'QA_E_GRID_WIN'},before);window.__stateAfterWin=JSON.stringify(current.state);finish('QA E')})""",game)
    page.wait_for_timeout(80)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    cases=[({'width':390,'height':844},'light'),({'width':844,'height':390},'dark'),({'width':768,'height':1024},'dark')]
    for game in ('tango','sudoku'):
        for viewport,scheme in cases:
            context=browser.new_context(viewport=viewport,color_scheme=scheme,reduced_motion='no-preference');page=context.new_page();load(page,game)
            result=page.evaluate("""game=>{const board=document.querySelector(game==='tango'?'#tboard':'#sboard'),cells=[...board.children],wrap=board.closest('.grid-coordinate-wrap');return {active:board.classList.contains(game==='tango'?'tango-victory-active':'sudoku-victory-active'),cells:cells.length,marked:board.querySelectorAll(game==='tango'?'.tango-victory-cell':'.sudoku-victory-cell').length,warm:board.querySelectorAll('.tango-victory-sun').length,cold:board.querySelectorAll('.tango-victory-moon').length,delays:cells.map(x=>getComputedStyle(x).getPropertyValue('--victory-delay').trim()),coords:!!wrap?.querySelector('[class*="column-coordinates"]')&&!!wrap?.querySelector('[class*="row-coordinates"]'),same:window.__stateAfterWin===JSON.stringify(current.state),overflow:document.documentElement.scrollWidth<=innerWidth}}""",game)
            assert result['active'] and result['cells']==36 and result['marked']==36,result
            assert result['coords'] and result['same'] and result['overflow'],result
            assert all(result['delays']),result
            if game=='tango': assert result['warm']>0 and result['cold']>0 and result['warm']+result['cold']==36,result
            context.close()
        context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=context.new_page();load(page,game)
        reduced=page.evaluate("""game=>{const board=document.querySelector(game==='tango'?'#tboard':'#sboard');return {reduced:board.classList.contains('sensorial-victory-reduced'),cellAnimation:[...board.children].every(x=>getComputedStyle(x).animationName==='none')}}""",game)
        assert reduced['reduced'] and reduced['cellAnimation'],reduced
        context.close()
    browser.close()
print('v3.1.9-E browser: Soleil-Lune + Grille 6 light/dark, portrait/landscape/iPad, coordinates, reduced motion and state parity PASS')
