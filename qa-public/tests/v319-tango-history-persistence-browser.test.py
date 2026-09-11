from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT = Path(__file__).resolve().parents[2]
index_html = (ROOT / 'index.html').read_text(encoding='utf-8')
html = index_html
for pat in [r'<link rel="stylesheet"[^>]+>', r'<link rel="manifest"[^>]+>', r'<link rel="apple-touch-icon"[^>]+>', r'<script src="[^"]+"></script>']:
    html = re.sub(pat, '', html)
css = runtime_styles(ROOT)
scripts = runtime_sources(ROOT)


def load(page):
    page.set_content(html, wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    page.evaluate("""()=>{
      const data=new Map();
      const storage={
        getItem:k=>data.has(String(k))?data.get(String(k)):null,
        setItem:(k,v)=>data.set(String(k),String(v)),
        removeItem:k=>data.delete(String(k)),
        clear:()=>data.clear(),
        key:i=>[...data.keys()][i]??null,
        get length(){return data.size}
      };
      Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
    }""")
    for src in scripts:
        page.add_script_tag(content=src)
    page.wait_for_selector('.cards')


def open_tango(page):
    page.evaluate("""()=>withSeed('v319-history-persistence-tango',()=>{
      const g=generateRegisteredCandidate('tango','easy');
      installGeneratedSession('tango','easy',g,{context:'normal'});
      historyInit(true);
      startTimer(true,0,false);
      drawGameUi();
      saveCurrent();
    })""")
    page.wait_for_selector('#undoBtn')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width':390,'height':844}, locale='fr-FR', has_touch=True, is_mobile=True)
    page = ctx.new_page(); errors=[]
    page.on('pageerror', lambda e: errors.append('pageerror:'+str(e)))
    page.on('console', lambda m: errors.append('console:'+m.text) if m.type=='error' else None)
    load(page); open_tango(page)

    result = page.evaluate("""()=>{
      const baseline=historySnapshotKey();
      let target=null;
      for(let r=0;r<current.n&&!target;r++)for(let c=0;c<current.n;c++){
        if(current.state[r][c]===-1){target=[r,c];break}
      }
      if(!target)throw new Error('no editable Tango cell');
      const [r,c]=target, legal=current.sol[r][c], alternate=1-legal;

      const before=historySnapshotKey();
      current.state[r][c]=legal;
      current.tangoDerivedRelations=[];
      if(!historyRecord({type:'MOVE'},before))throw new Error('initial move not recorded');
      const afterMove=historySnapshotKey();
      if(afterMove===baseline)throw new Error('move did not change snapshot');
      if(!historyCanUndo())throw new Error('undo unavailable after move');

      const undo1=undoMoves(1), afterUndo=historySnapshotKey();
      if(undo1!==1||afterUndo!==baseline)throw new Error('undo did not restore baseline');
      if(!historyCanRedo())throw new Error('redo unavailable after undo');

      const redo1=redoMoves(1), afterRedo=historySnapshotKey();
      if(redo1!==1||afterRedo!==afterMove)throw new Error('redo did not restore move');

      saveCurrent();
      const savedRaw=[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).map(k=>[k,localStorage.getItem(k)]);
      if(!savedRaw.some(([,v])=>String(v||'').includes('tango')))throw new Error('Tango session not persisted');
      current=null;
      resumeSaved();
      const afterResume=historySnapshotKey();
      if(afterResume!==afterMove)throw new Error('resume did not restore exact puzzle/history state');
      if(!historyCanUndo())throw new Error('history lost across persistence resume');

      resetCurrent();
      const afterReset=historySnapshotKey();
      if(afterReset!==baseline)throw new Error('reset did not restore initial puzzle state');
      if(!historyCanUndo())throw new Error('reset is not undoable');

      const undoReset=undoMoves(1), afterUndoReset=historySnapshotKey();
      if(undoReset!==1||afterUndoReset!==afterMove)throw new Error('undo reset did not restore pre-reset move');
      const redoReset=redoMoves(1), afterRedoReset=historySnapshotKey();
      if(redoReset!==1||afterRedoReset!==baseline)throw new Error('redo reset did not restore reset state');

      if(undoMoves(1)!==1||historySnapshotKey()!==afterMove)throw new Error('second undo reset failed');
      if(undoMoves(1)!==1||historySnapshotKey()!==baseline)throw new Error('undo move before branch failed');
      const branchBefore=historySnapshotKey();
      current.state[r][c]=alternate;
      current.tangoDerivedRelations=[];
      if(!historyRecord({type:'MOVE',qaBranch:true},branchBefore))throw new Error('alternate branch move not recorded');
      const branchKey=historySnapshotKey();
      if(branchKey===afterMove||branchKey===baseline)throw new Error('alternate branch snapshot invalid');
      const branchStats={...(current.moveHistory?.stats||{})};
      if((branchStats.branches||0)<1)throw new Error('history branch not counted');

      saveCurrent();
      current=null;
      resumeSaved();
      const resumedBranch=historySnapshotKey();
      if(resumedBranch!==branchKey)throw new Error('branch state not preserved by persistence');
      const historyValid=!!current?.moveHistory?.cursor&&historyCanUndo();
      return {target,baseline,afterMove,branchKey,undo1,redo1,undoReset,redoReset,branchStats,historyValid,persistedKeys:savedRaw.map(x=>x[0])};
    }""")

    assert result['historyValid'] is True, result
    assert result['branchStats']['undos'] >= 3, result
    assert result['branchStats']['redos'] >= 2, result
    assert result['branchStats']['branches'] >= 1, result
    assert not errors, errors
    ctx.close(); browser.close()

print('PASS v319-tango-history-persistence-browser', {
    'undoRedo': 'exact',
    'resetUndoRedo': 'exact',
    'persistenceResume': 'exact',
    'branchChange': 'exact'
})
