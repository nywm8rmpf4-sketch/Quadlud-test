from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources,runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
for pattern in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    HTML=re.sub(pattern,'',HTML)
CSS=runtime_styles(ROOT);SCRIPTS=runtime_sources(ROOT)

def load(page):
    page.set_content(HTML,wait_until='domcontentloaded');page.add_style_tag(content=CSS)
    page.evaluate("""()=>{const d=new Map();const s={getItem:k=>d.get(String(k))??null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>[...d.keys()][i]??null,get length(){return d.size}};Object.defineProperty(window,'localStorage',{configurable:true,value:s})}""")
    for source in SCRIPTS: page.add_script_tag(content=source)
    page.wait_for_selector('.cards')

def seed(page):
    return page.evaluate("""()=>{
      const s=blankStats();s.started=5;s.solved=3;s.totalSolvedSeconds=180;
      const g=GAME_IDS[0];s.byGame[g]={easy:{started:3,solved:3,revealed:0,totalSeconds:180,best:45}};
      const tech=activeTechniqueIds()[0];if(tech)s.mastery.byTechnique[tech]={encountered:4,solo:3,where:0,rule:0,why:0,reveal:0,where3:0,why3:0,reveal3:0,errors:0};
      s.history=[{id:'ux3-a',ts:Date.now(),day:localDay(),game:g,diff:'easy',seconds:45,outcome:'solved',hintUsed:false,walkthroughUsed:false,masteryMerged:true}];
      writeStats(s);let p=prefs();p.theme='dark';p.lang='fr';PersistentData.preferences.write(p);return {solved:s.solved,game:g}
    }""")

def storage_snapshot(page):
    return page.evaluate("""()=>{const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);out[k]=localStorage.getItem(k)}return out}""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)));page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url) if not r.url.startswith('data:') else None)
    load(page);base=seed(page)
    pkg=page.evaluate('createUserDataExport()')
    assert pkg['format']=='quadlud-user-data' and pkg['schema']==2,pkg
    assert pkg['policy']=={'mode':'replace','merge':False},pkg
    assert pkg['sections']['progression']['data']['model']=='derived-existing-persistence',pkg
    assert pkg['sections']['progression']['data']['profileSchema']==1,pkg
    assert 'achievements' not in json.dumps(pkg['sections']['progression']),pkg

    page.evaluate('eraseAllUserData()');assert page.evaluate('safeStats().solved')==0
    page.evaluate('(p)=>importUserDataPackage(p)',pkg);assert page.evaluate('safeStats().solved')==base['solved']
    page.evaluate('statsView()');page.wait_for_selector('.progression-profile');assert page.locator('.progression-profile').get_attribute('data-profile-schema')=='1'

    legacy=json.loads(json.dumps(pkg));legacy['schema']=1;legacy.pop('policy',None);legacy['sections'].pop('progression',None)
    page.evaluate('eraseAllUserData()');page.evaluate('(p)=>importUserDataPackage(p)',legacy);assert page.evaluate('safeStats().solved')==base['solved']

    before=storage_snapshot(page);bad=json.loads(json.dumps(pkg));bad['sections']['progression']['data']['profileSchema']=999
    rejected=page.evaluate("""p=>{try{importUserDataPackage(p);return false}catch(_){return true}}""",bad);assert rejected
    assert storage_snapshot(page)==before,'invalid package mutated local data'

    incoming=json.loads(json.dumps(pkg));incoming['sections']['stats']['data']['solved']=99
    rollback=page.evaluate("""p=>{
      const old=window.localStorage,d=new Map();for(let i=0;i<old.length;i++){const k=old.key(i);d.set(k,old.getItem(k))}
      let writes=0;const flaky={getItem:k=>d.get(String(k))??null,setItem:(k,v)=>{writes++;if(writes===3)throw new Error('injected write failure');d.set(String(k),String(v))},removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>[...d.keys()][i]??null,get length(){return d.size}};
      Object.defineProperty(window,'localStorage',{configurable:true,value:flaky});let failed=false;try{importUserDataPackage(p)}catch(_){failed=true}return{failed,writes,solved:safeStats().solved,snapshot:Object.fromEntries(d)}}""",incoming)
    assert rollback['failed'] and rollback['writes']>=3,rollback
    assert rollback['solved']==base['solved'],rollback
    assert rollback['snapshot']==before,(rollback,before)

    assert not errors,errors
    external=[u for u in requests if u.startswith(('http://','https://'))];assert not external,external
    ctx.close();browser.close()

print('v3.2-C UX-3 portability PASS',json.dumps({'schema':2,'legacySchema1Migration':True,'replaceOnly':True,'invalidPackageNoMutation':True,'writeFailureRollback':True,'manualLocalOnly':True},ensure_ascii=False))
