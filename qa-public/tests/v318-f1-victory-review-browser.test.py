from pathlib import Path
from qa_runtime_loader import runtime_sources, runtime_styles
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent/'GitHub'
html=(ROOT/'index.html').read_text()
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    html=re.sub(pat,'',html)
css=runtime_styles(ROOT)
scripts=runtime_sources(ROOT)

def load(page):
    page.set_content(html)
    page.add_style_tag(content=css)
    page.add_script_tag(content="""
      (()=>{const data=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:k=>data.has(String(k))?data.get(String(k)):null,
        setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),
        key:i=>[...data.keys()][i]??null,get length(){return data.size}
      }});})();
    """)
    for src in scripts: page.add_script_tag(content=src)
    page.evaluate("""()=>{
      window.__f1Raf=window.requestAnimationFrame;window.__f1Timeout=window.setTimeout;
      window.requestAnimationFrame=fn=>{fn();return 1};window.cancelAnimationFrame=()=>{};
      window.setTimeout=(fn,ms,...args)=>{if(ms<=20)fn(...args);return 1};window.clearTimeout=()=>{};
      const p=prefs();p.sound=false;savePrefs(p)
    }""")

def launch_sync(page,game):
    page.evaluate("""game=>withSeed(`v318-f1:${game}`,()=>{launch(game,'easy')})""",game)

def force_win_and_record(page,game):
    return page.evaluate("""game=>{
      const before=historySnapshotKey();
      if(game==='queens'){current.state=Array.from({length:current.n},()=>Array(current.n).fill(0));for(let r=0;r<current.n;r++)current.state[r][current.sol[r]]=2}
      else if(game==='tango'||game==='sudoku')current.state=current.sol.map(row=>[...row]);
      else if(game==='patches')current.paint=current.reg.map(row=>[...row]);
      else if(game==='nonogram')current.state=current.validationState.solutionGrid.map(row=>row.map(v=>v?NonogramLogic.FILLED:NonogramLogic.EMPTY));
      drawGameUi(current);const recorded=historyRecord({type:'QA_F1_FORCE_WIN'},before),solved=validateRegisteredVictory(current,{strictGeneratedSolution:true}).solved;
      return {recorded,solved,cursor:current.moveHistory.cursor}
    }""",game)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={"width":390,"height":844})
    load(page)
    games=page.evaluate("()=>[...GameRegistry.IDS]")
    assert games,games
    for game in games:
        page.evaluate("()=>{PersistentData.stats.clear();PersistentData.daily.clear();clearSaved()}")
        launch_sync(page,game)
        page.evaluate("()=>{PersistentData.stats.clear();current.attemptId=null;current.statsClosed=false;statsStart(current)}")
        forced=force_win_and_record(page,game);assert forced['recorded'] and forced['solved'],(game,forced)
        first=page.evaluate("""()=>{finish('QA F1');return {completed:current.completed,closed:current.statsClosed,review:current.postVictoryReview,canUndo:historyCanUndo(),paused,statsOfficial:JSON.stringify(safeStats())}}""")
        assert first['completed'] and first['closed'] and first['canUndo'],(game,first)
        assert first['review']['schema']==1 and first['review']['active'] is False,(game,first)
        undone=page.evaluate("""()=>{const moved=undoMoves(1),saved=getSaved();return {moved,completed:current.completed,closed:current.statsClosed,review:current.postVictoryReview,canRedo:historyCanRedo(),saved,startedAt,paused,statsNow:JSON.stringify(safeStats())}}""")
        assert undone['moved']==1 and undone['completed'] is False and undone['closed'] and undone['review']['active'] and undone['canRedo'],(game,undone)
        assert undone['saved'] and undone['saved']['current']['postVictoryReview']['active'] and undone['saved']['paused'] is False,(game,undone)
        assert undone['startedAt']==0 and undone['paused'] is False,(game,undone)
        assert undone['statsNow']==first['statsOfficial'],(game,first,undone)
        assert page.evaluate("()=>persistencePayloadValid(getSaved())") is True,game
        redone=page.evaluate("""()=>{const moved=redoMoves(1);return {moved,completed:current.completed,closed:current.statsClosed,review:current.postVictoryReview,saved:getSaved(),statsNow:JSON.stringify(safeStats())}}""")
        assert redone['moved']==1 and redone['completed'] and redone['closed'],(game,redone)
        assert redone['statsNow']==first['statsOfficial'] and redone['review']['active'] is False and redone['review']['replayCount']==1,(game,redone)
        assert redone['saved'] is None,(game,redone)

    daily=page.evaluate("""()=>{
      PersistentData.stats.clear();PersistentData.daily.clear();clearSaved();
      const day='2026-08-31',game='queens',g=dailyBuildCandidate(day,game);dailyInstallCandidate(game,g,day);historyInit(true);statsStart(current);startTimer(true,0,false);
      const before=historySnapshotKey();current.state=Array.from({length:current.n},()=>Array(current.n).fill(0));for(let r=0;r<current.n;r++)current.state[r][current.sol[r]]=2;drawGameUi(current);historyRecord({type:'QA_F1_DAILY_WIN'},before);finish('QA F1 Daily');
      const official=JSON.stringify(dailyRecord(day,game)),statsOfficial=JSON.stringify(safeStats());undoMoves(1);const saved=getSaved(),afterUndo=JSON.stringify(dailyRecord(day,game)),statsAfterUndo=JSON.stringify(safeStats());redoMoves(1);const afterRedo=JSON.stringify(dailyRecord(day,game)),statsAfterRedo=JSON.stringify(safeStats());
      return {official,afterUndo,afterRedo,savedValid:persistencePayloadValid(saved),statsOfficial,statsAfterUndo,statsAfterRedo,replayCount:current.postVictoryReview.replayCount}
    }""")
    assert daily['official']==daily['afterUndo']==daily['afterRedo'],daily
    assert daily['statsOfficial']==daily['statsAfterUndo']==daily['statsAfterRedo'],daily
    assert daily['savedValid'] is True and daily['replayCount']==1,daily

    reveal_review=page.evaluate("""()=>{
      PersistentData.stats.clear();PersistentData.daily.clear();clearSaved();
      const day='2026-08-31',game='queens',g=dailyBuildCandidate(day,game);dailyInstallCandidate(game,g,day);historyInit(true);statsStart(current);startTimer(true,0,false);
      const before=historySnapshotKey();current.state=Array.from({length:current.n},()=>Array(current.n).fill(0));for(let r=0;r<current.n;r++)current.state[r][current.sol[r]]=2;drawGameUi(current);historyRecord({type:'QA_F1_DAILY_REVIEW_WIN'},before);finish('QA F1 Daily Review');
      const official=JSON.stringify(dailyRecord(day,game)),statsOfficial=JSON.stringify(safeStats());undoMoves(1);finish('QA F1 Review Reveal','revealed');
      return {official,afterReveal:JSON.stringify(dailyRecord(day,game)),statsOfficial,statsAfterReveal:JSON.stringify(safeStats()),review:current.postVictoryReview,completed:current.completed};
    }""")
    assert reveal_review['official']==reveal_review['afterReveal'],reveal_review
    assert reveal_review['statsOfficial']==reveal_review['statsAfterReveal'],reveal_review
    assert reveal_review['completed'] is True and reveal_review['review']['outcome']=='solved' and reveal_review['review']['active'] is False,reveal_review

    branch=page.evaluate("""()=>{
      PersistentData.stats.clear();clearSaved();launch('queens','easy');
      const before=historySnapshotKey();current.state=Array.from({length:current.n},()=>Array(current.n).fill(0));for(let r=0;r<current.n;r++)current.state[r][current.sol[r]]=2;drawGameUi(current);historyRecord({type:'QA_F1_BRANCH_WIN'},before);finish('QA F1 Branch');
      undoMoves(1);const root=current.moveHistory.cursor,statsBefore=safeStats().history.length;
      const b=historySnapshotKey();current.state[0][0]=current.state[0][0]===1?0:1;drawGameUi(current);historyRecord({type:'QA_F1_REVIEW_BRANCH',primaryTarget:[0,0]},b);closePreviousAttempt();
      return {root,cursor:current.moveHistory.cursor,branches:current.moveHistory.stats.branches,statsBefore,statsAfter:safeStats().history.length,closed:current.statsClosed,active:current.postVictoryReview.active}
    }""")
    assert branch['cursor']!=branch['root'] and branch['statsAfter']==branch['statsBefore'] and branch['closed'] and branch['active'],branch

    lh=page.evaluate("""()=>{
      PersistentData.stats.clear();PersistentData.daily.clear();clearSaved();launch('queens','easy');current.attemptId=null;current.statsClosed=false;statsStart(current);
      const before=historySnapshotKey();current.state=Array.from({length:current.n},()=>Array(current.n).fill(0));for(let r=0;r<current.n;r++)current.state[r][current.sol[r]]=2;drawGameUi(current);historyRecord({type:'QA_F2_LIGHTHOUSES_WIN'},before);finish('QA F2');
      const official=JSON.stringify(safeStats()),first={layer:document.querySelectorAll('.lighthouses-victory-layer').length,beams:document.querySelectorAll('.lighthouses-victory-beam').length,n:current.n,final:document.querySelector('#qboard').classList.contains('queens-win')};
      undoMoves(1);const afterUndo={layer:document.querySelectorAll('.lighthouses-victory-layer').length,beams:document.querySelectorAll('.lighthouses-victory-beam').length,final:document.querySelector('#qboard').classList.contains('queens-win'),stats:JSON.stringify(safeStats())};
      redoMoves(1);const afterRedo={layer:document.querySelectorAll('.lighthouses-victory-layer').length,beams:document.querySelectorAll('.lighthouses-victory-beam').length,final:document.querySelector('#qboard').classList.contains('queens-win'),stats:JSON.stringify(safeStats()),replayCount:current.postVictoryReview.replayCount};
      return {official,first,afterUndo,afterRedo};
    }""")
    assert lh['first']['layer']==1 and lh['first']['beams']==4*lh['first']['n'] and lh['first']['final'],lh
    assert lh['afterUndo']['layer']==0 and lh['afterUndo']['beams']==0 and not lh['afterUndo']['final'] and lh['afterUndo']['stats']==lh['official'],lh
    assert lh['afterRedo']['layer']==1 and lh['afterRedo']['beams']==4*lh['first']['n'] and lh['afterRedo']['final'] and lh['afterRedo']['stats']==lh['official'] and lh['afterRedo']['replayCount']==1,lh
    browser.close()
print('v3.1.8-F1 browser: 5-game Undo/Redo review + Daily no-drift + review branch PASS')
