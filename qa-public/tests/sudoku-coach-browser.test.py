from pathlib import Path
from qa_runtime_loader import runtime_sources, runtime_styles
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'GitHub';html=(ROOT/'index.html').read_text()
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:html=re.sub(pat,'',html)
css=runtime_styles(ROOT);scripts=runtime_sources(ROOT,exclude=('difficulty-rating.js','queens-difficulty.js','tango-difficulty.js','patches-difficulty.js','sudoku-difficulty.js','nonogram-difficulty.js','nonogram-generator.js'))
def load(page):
    page.set_content(html,wait_until='domcontentloaded');page.add_style_tag(content=css)
    for src in scripts:page.add_script_tag(content=src)
    page.wait_for_selector('.cards')
def set_sudoku(page,state,sol=None):
    if sol is None:sol=[[6,5,4,3,2,1] for _ in range(6)]
    page.evaluate("""([state,sol])=>{const empty=[];for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(state[r][c]===0)empty.push(r*6+c);current={game:'sudoku',diff:'hard',n:6,state:state.map(r=>[...r]),sol:sol.map(r=>[...r]),empty:new Set(empty),sel:null,training:false,completed:false,coachModeOverride:'minimal'};renderGameUi(current);historyInit(false);}""",[state,sol])
def filled(page):return page.evaluate("current.state.flat().filter(Boolean).length")
def coach_persona(page):return page.evaluate("""()=>{const el=document.querySelector('#hintNotice .pedagogy-persona-coach');if(!el)return null;return {count:document.querySelectorAll('#hintNotice .pedagogy-persona-coach').length,persona:el.dataset.persona,hidden:el.getAttribute('aria-hidden')}}""")
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)));page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None);load(page)
    assert page.evaluate("typeof QuadludCoachPresentationRuntime==='object' && QuadludCoachPresentationRuntime.VERSION===1");assert page.evaluate("coachStageBlock.__quadludD2Bridge===true");assert page.evaluate("hintStage.__quadludCoachWindowUi===true")
    direct=[[1,2,3,4,5,0],[4,5,6,1,2,0],[2,3,4,5,6,1],[5,6,1,2,3,4],[3,4,5,6,1,2],[6,1,2,3,4,5]];fake=[row[:] for row in direct];fake[0][5]=1;fake[1][5]=6;set_sudoku(page,direct,fake);before=page.evaluate('JSON.stringify(current.state)');n0=filled(page)
    page.click('#hintBtn');t1=page.locator('#hintNotice .hint-notice-text').inner_text();assert '1/3' in t1 and 'A6' in t1 and filled(page)==n0,t1;persona=coach_persona(page);assert persona and persona['count']==1 and persona['persona']=='guide' and persona['hidden']=='true',persona
    page.click('#hintBtn');t2=page.locator('#hintNotice .hint-notice-text').inner_text();assert '2/3' in t2 and 'Candidat unique' in t2 and '6' in t2 and filled(page)==n0,t2;assert coach_persona(page)['count']==1
    page.click('#hintBtn');t3=page.locator('#hintNotice .hint-notice-text').inner_text();assert '3/3' in t3 and '6' in t3 and filled(page)==n0+1,t3;assert page.evaluate('current.state[0][5]')==6 and page.evaluate('current.sol[0][5]')==1;assert coach_persona(page)['count']==1
    diff=page.evaluate("""before=>{const a=JSON.parse(before),out=[];for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(a[r][c]!==current.state[r][c])out.push([r,c,a[r][c],current.state[r][c]]);return out}""",before);assert diff==[[0,5,0,6]],diff;reasoning=page.evaluate('current.lastReasoning');assert reasoning['source']=='sudoku-inference-engine' and len([c for c in reasoning['conclusions'] if c['type']=='VALUE'])==1,reasoning
    assert not errors,errors;ctx.close();browser.close()
print('sudoku coach browser tests: OK')
