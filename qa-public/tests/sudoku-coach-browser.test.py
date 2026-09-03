from pathlib import Path
from qa_runtime_loader import runtime_sources, runtime_styles
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'GitHub'
html=(ROOT/'index.html').read_text()
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    html=re.sub(pat,'',html)
css=runtime_styles(ROOT)
scripts = runtime_sources(ROOT, exclude=('difficulty-rating.js', 'queens-difficulty.js', 'tango-difficulty.js', 'tango-played-move-planner.js', 'tango-played-move-runtime.js', 'patches-difficulty.js', 'sudoku-difficulty.js', 'nonogram-difficulty.js', 'nonogram-generator.js'))

def load(page):
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    for src in scripts: page.add_script_tag(content=src)
    page.wait_for_selector('.cards')

def set_sudoku(page,state,sol=None):
    if sol is None: sol=[[6,5,4,3,2,1] for _ in range(6)]
    page.evaluate("""([state,sol])=>{
      const empty=[];for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(state[r][c]===0)empty.push(r*6+c);
      current={game:'sudoku',diff:'hard',n:6,state:state.map(r=>[...r]),sol:sol.map(r=>[...r]),empty:new Set(empty),sel:null,training:false,completed:false,coachModeOverride:'minimal'};
      renderGameUi(current);historyInit(false);
    }""",[state,sol])

def filled(page):
    return page.evaluate("current.state.flat().filter(Boolean).length")

def coach_persona(page):
    return page.evaluate("""()=>{const el=document.querySelector('#hintNotice .pedagogy-persona-coach');if(!el)return null;const r=el.getBoundingClientRect();return {count:document.querySelectorAll('#hintNotice .pedagogy-persona-coach').length,persona:el.dataset.persona,hidden:el.getAttribute('aria-hidden'),width:r.width,height:r.height}}""")

def progressive_text(page):
    return page.locator('#hintNotice .hint-notice-text').inner_text()

def next_progressive_stage(page):
    button=page.locator('#hintNotice .coach-window-more')
    assert button.count()==1 and button.is_visible()
    button.click()
    return progressive_text(page)

def apply_progressive_move(page):
    button=page.locator('#coachWindowApply')
    assert button.count()==1 and button.is_visible()
    button.click()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR')
    page=ctx.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)

    assert page.evaluate("typeof QuadludCoachPresentationRuntime==='object' && QuadludCoachPresentationRuntime.VERSION===1")
    assert page.evaluate("coachStageBlock.__quadludD2Bridge===true")
    assert page.evaluate("hintStage.__quadludCoachWindowUi===true")

    direct=[
      [1,2,3,4,5,0],
      [4,5,6,1,2,0],
      [2,3,4,5,6,1],
      [5,6,1,2,3,4],
      [3,4,5,6,1,2],
      [6,1,2,3,4,5],
    ]
    fake=[row[:] for row in direct];fake[0][5]=1;fake[1][5]=6
    set_sudoku(page,direct,fake)
    before=page.evaluate('JSON.stringify(current.state)');n0=filled(page)

    page.click('#hintBtn')
    t1=progressive_text(page)
    assert 'A6' in t1 and filled(page)==n0,t1
    assert page.locator('#sboard .hint-context').count()>0
    persona=coach_persona(page)
    assert persona and persona['count']==1 and persona['persona']=='guide' and persona['hidden']=='true',persona
    assert 32<=persona['width']<=40 and 32<=persona['height']<=40,persona

    t2=next_progressive_stage(page)
    assert 'Candidat unique' in t2 and '6' in t2,t2
    assert filled(page)==n0
    assert t2.count(':')>=2,t2
    assert coach_persona(page)['count']==1

    t3=next_progressive_stage(page)
    assert '6' in t3 and ('A6' in t3 or 'colonne 6' in t3.lower()),t3
    assert filled(page)==n0
    assert page.locator('#coachWindowApply').count()==1
    assert coach_persona(page)['count']==1

    apply_progressive_move(page)
    assert filled(page)==n0+1
    assert page.evaluate('current.state[0][5]')==6
    assert page.evaluate('current.sol[0][5]')==1
    diff=page.evaluate("""before=>{const a=JSON.parse(before),out=[];for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(a[r][c]!==current.state[r][c])out.push([r,c,a[r][c],current.state[r][c]]);return out}""",before)
    assert diff==[[0,5,0,6]],diff
    reasoning=page.evaluate('current.lastReasoning')
    assert reasoning['source']=='sudoku-inference-engine',reasoning
    assert len([c for c in reasoning['conclusions'] if c['type']=='VALUE'])==1

    page.evaluate('closeHintNotice(); current.hintFlow=null')
    page.click('#hintBtn')
    next_reason=page.evaluate('current.lastReasoning')
    assert next_reason['target']=={'row':1,'column':5},next_reason
    assert next_reason['action']=={'type':'PLACE_DIGIT','value':3},next_reason
    assert coach_persona(page)['persona']=='guide'
    page.evaluate('closeHintNotice(); current.hintFlow=null')

    r5=[
      [1,2,0,0,0,6],
      [0,0,6,0,2,0],
      [2,0,0,0,6,0],
      [5,6,0,2,0,0],
      [0,0,0,6,0,2],
      [6,0,2,3,4,0],
    ]
    fake2=[[1]*6 for _ in range(6)]
    set_sudoku(page,r5,fake2);n1=filled(page)
    page.click('#hintBtn');a1=progressive_text(page)
    assert 'A4' in a1,a1
    a2=next_progressive_stage(page)
    assert 'Contradiction' in a2 and '5' in a2,a2
    advanced_reason=page.evaluate('current.lastReasoning')
    assert advanced_reason['source']=='sudoku-inference-engine'
    assert advanced_reason['rule']=='CONTRADICTION_L1'
    assert advanced_reason['technique']=='S_CONTRADICTION_R1'
    assert advanced_reason['finalDeduction']['conclusions'][0]['value']==4
    assert coach_persona(page)['persona']=='guide'
    a3=next_progressive_stage(page)
    assert '4' in a3,a3
    assert filled(page)==n1
    apply_progressive_move(page)
    assert filled(page)==n1+1
    assert page.evaluate('current.state[0][3]')==4
    assert page.evaluate('current.sol[0][3]')==1

    page.evaluate('closeHintNotice(); current.hintFlow=null')
    bad=[row[:] for row in direct];bad[0][0]=2
    set_sudoku(page,bad,fake);nbad=filled(page)
    page.click('#hintBtn')
    bad_text=progressive_text(page)
    assert any(x in bad_text.lower() for x in ['contradiction','doublon','double','conflit']),bad_text
    assert filled(page)==nbad
    assert page.locator('#hintNotice .pedagogy-persona-coach').count()==0

    assert not errors,errors
    ctx.close();browser.close()
print('sudoku coach browser tests: OK (persistent progressive Coach + visible-state proof + behavioral persona)')
