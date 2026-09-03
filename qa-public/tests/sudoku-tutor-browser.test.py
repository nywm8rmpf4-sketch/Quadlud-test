from pathlib import Path
from qa_runtime_loader import runtime_sources, runtime_styles
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'GitHub'
app_source=(ROOT/'app.js').read_text()
sudoku_pedagogy_source=(ROOT/'sudoku-pedagogy.js').read_text()
html=(ROOT/'index.html').read_text()
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    html=re.sub(pat,'',html)
css=runtime_styles(ROOT)
scripts = runtime_sources(ROOT, exclude=('queens-difficulty.js', 'tango-difficulty.js', 'tango-played-move-planner.js', 'tango-played-move-runtime.js', 'patches-difficulty.js'))

for legacy in ['walkthroughExhaustiveHint','walkthroughFindHint','walkthroughWhyText','walkthroughMoveText','walkthroughApplyHint']:
    assert f'function {legacy}(' not in app_source, legacy
assert "gamePedagogy(s.base.game).walkthrough.generateNext(s)" in app_source
assert "if(s.base.game==='sudoku')" not in app_source
assert "walkthroughGenerateNext:()=>need('walkthroughGenerateSudokuNext')()" in sudoku_pedagogy_source
for forbidden in ['current.sol','hiddenSolution','solutionGrid','answerGrid']:
    assert forbidden not in sudoku_pedagogy_source, forbidden

def load(page):
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    for src in scripts: page.add_script_tag(content=src)
    page.wait_for_selector('.cards')

def set_sudoku(page,state,sol=None,diff='hard'):
    if sol is None: sol=[row[:] for row in state]
    page.evaluate("""([state,sol,diff])=>{
      const empty=[];for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(state[r][c]===0)empty.push(r*6+c);
      current={game:'sudoku',diff,n:6,state:state.map(r=>[...r]),sol:sol.map(r=>[...r]),empty:new Set(empty),sel:null,training:false,completed:false};
      renderGameUi(current);historyInit(false);
    }""",[state,sol,diff])

def state_diff(a,b):
    out=[]
    for r in range(6):
        for c in range(6):
            if a[r][c]!=b[r][c]: out.append([r,c,a[r][c],b[r][c]])
    return out

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR')
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)

    direct=[[1,2,3,4,5,0],[4,5,6,1,2,0],[2,3,4,5,6,1],[5,6,1,2,3,4],[3,4,5,6,1,2],[6,1,2,3,4,5]]
    solution=[[1,2,3,4,5,6],[4,5,6,1,2,3],[2,3,4,5,6,1],[5,6,1,2,3,4],[3,4,5,6,1,2],[6,1,2,3,4,5]]
    set_sudoku(page,direct,solution,'easy')
    original=page.evaluate('current.state.map(r=>[...r])')
    page.click('#walkthroughBtn');page.wait_for_selector('#walkthroughNext')
    assert page.evaluate("walkthroughSession.base.game")=='sudoku'
    assert page.evaluate("walkthroughSession.sudokuLogic===undefined")
    before=page.evaluate('walkthroughSession.work.state.map(r=>[...r])')
    page.click('#walkthroughNext')
    after=page.evaluate('walkthroughSession.work.state.map(r=>[...r])')
    d=state_diff(before,after);assert d==[[0,5,0,6]],d
    assert page.evaluate('walkthroughSession.moves.length')==1
    move=page.evaluate('walkthroughSession.moves[0]')
    assert move['deduction']['source']=='sudoku-inference-engine',move
    assert len([c for c in move['finalDeduction']['conclusions'] if c['type']=='VALUE'])==1
    assert not move.get('exhaustive',False)
    assert page.locator('.walkthrough-explanation').inner_text().strip()
    assert page.locator('.walkthrough-target').count()==1
    assert page.evaluate('current.state.map(r=>[...r])')==original

    before2=after
    page.click('#walkthroughNext')
    after2=page.evaluate('walkthroughSession.work.state.map(r=>[...r])')
    d2=state_diff(before2,after2);assert d2==[[1,5,0,3]],d2
    assert page.evaluate('walkthroughSession.done') is True
    assert page.evaluate('walkthroughSession.moves.length')==2
    assert page.evaluate('walkthroughSession.sudokuLogic===undefined')
    assert page.evaluate('current.state.map(r=>[...r])')==original
    page.click('#walkthroughClose')

    r5=[[1,2,0,0,0,6],[0,0,6,0,2,0],[2,0,0,0,6,0],[5,6,0,2,0,0],[0,0,0,6,0,2],[6,0,2,3,4,0]]
    set_sudoku(page,r5,[[1]*6 for _ in range(6)],'hard')
    page.evaluate('openWalkthrough()')
    before=page.evaluate('walkthroughSession.work.state.map(r=>[...r])')
    assert page.evaluate('walkthroughGenerateSudokuNext()') is True
    after=page.evaluate('walkthroughSession.work.state.map(r=>[...r])')
    d=state_diff(before,after);assert len(d)==1,d
    adv=page.evaluate('walkthroughSession.moves.at(-1)')
    assert adv['rule']=='CONTRADICTION_L1',adv['rule']
    assert len([c for c in adv['finalDeduction']['conclusions'] if c['type']=='VALUE'])==1
    page.evaluate('closeWalkthrough()')

    generated=page.evaluate("""()=>{
      let x=123456789;Math.random=()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296};
      installGeneratedSession('sudoku','hard',generateRegisteredCandidate('sudoku','hard'),{context:'normal'});historyInit(false);
      return {state:current.state.map(r=>[...r]),sol:current.sol.map(r=>[...r]),holes:current.state.flat().filter(v=>v===0).length};
    }""")
    assert generated['holes']>=20,generated['holes']
    assert page.evaluate('state=>countMiniSudoku(state.map(r=>[...r]),2)',generated['state'])==1
    original_hard=page.evaluate('current.state.map(r=>[...r])')
    page.evaluate('openWalkthrough()')
    page.evaluate("""()=>{
      window.__sudokuCreateCount=0;const createOriginal=SudokuLogic.createSession;SudokuLogic.createSession=function(...args){window.__sudokuCreateCount++;return createOriginal.apply(this,args)};
      window.__opaqueTutorCalls=0;const countOriginal=countMiniSudoku;countMiniSudoku=function(...args){window.__opaqueTutorCalls++;return countOriginal.apply(this,args)};
      window.__legacyTutorCalls=0;for(const name of ['findSudokuLogicalHint','findSudokuRank1Hint','findSudokuRank2Hint']){const original=window[name];window[name]=function(...args){window.__legacyTutorCalls++;return original.apply(this,args)}}
    }""")
    for _ in range(40):
        status=page.evaluate('({done:walkthroughSession.done,stalled:walkthroughSession.stalled})')
        if status['done'] or status['stalled']: break
        before=page.evaluate('walkthroughSession.work.state.map(r=>[...r])')
        ok=page.evaluate('walkthroughGenerateSudokuNext()')
        after=page.evaluate('walkthroughSession.work.state.map(r=>[...r])')
        d=state_diff(before,after)
        assert ok is True and len(d)==1 and d[0][2]==0 and 1<=d[0][3]<=6,(ok,d)
        last=page.evaluate('walkthroughSession.moves.at(-1)')
        assert len([c for c in last['finalDeduction']['conclusions'] if c['type']=='VALUE'])==1
        assert last['deduction']['source']=='sudoku-inference-engine'
        assert not last.get('exhaustive',False)
        assert page.evaluate('walkthroughSession.sudokuLogic===undefined')
    final=page.evaluate('({done:walkthroughSession.done,stalled:walkthroughSession.stalled,moves:walkthroughSession.moves.length,work:walkthroughSession.work.state,current:current.state,creates:window.__sudokuCreateCount,opaqueCalls:window.__opaqueTutorCalls,legacyCalls:window.__legacyTutorCalls})')
    assert final['done'] and not final['stalled'],final
    assert final['moves']==generated['holes'],(final['moves'],generated['holes'])
    assert final['work']==generated['sol'] and final['current']==original_hard
    assert final['creates']>=final['moves'] and final['opaqueCalls']==0 and final['legacyCalls']==0,final
    page.evaluate('closeWalkthrough()')
    assert not errors,errors
    ctx.close();browser.close()
print('sudoku tutor browser tests: OK')
