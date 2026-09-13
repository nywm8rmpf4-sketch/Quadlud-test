from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources,runtime_styles
ROOT=Path(__file__).resolve().parents[1]/'GitHub'
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
for pattern in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:HTML=re.sub(pattern,'',HTML)
CSS=runtime_styles(ROOT);SCRIPTS=runtime_sources(ROOT)

def load(page):
    page.set_content(HTML,wait_until='domcontentloaded');page.add_style_tag(content=CSS)
    page.evaluate("""()=>{const fail=()=>{throw new Error('storage unavailable')};const s={getItem:fail,setItem:fail,removeItem:fail,clear:fail,key:fail,get length(){throw new Error('storage unavailable')}};Object.defineProperty(window,'localStorage',{configurable:true,value:s})}""")
    for src in SCRIPTS:page.add_script_tag(content=src)
    page.wait_for_selector('.cards')

def ux1(page):
    page.evaluate("""()=>{const game='tango',tech=Object.keys(PEDAGOGY_TECHNIQUES)[0],nodes={h0:{id:'h0',parent:null,children:['h1'],preferred:'h1',action:{type:'START'},snapshot:{game}}};let parent='h0';for(let i=1;i<=5;i++){const id='h'+i,next=i<5?'h'+(i+1):null;nodes[id]={id,parent,children:next?[next]:[],preferred:next,action:{type:'MOVE',changes:[]},snapshot:{game},justification:{status:'justified',technique:tech,rank:i===4?3:1}};parent=id}current={game,diff:'hard',completed:true,statsClosed:true,hintUsed:false,walkthroughUsed:false,backtrackUsed:false,reasoningAudit:{justified:5,unjustified:0,unknown:0,hypotheses:0},postVictoryReview:{schema:1,active:false,outcome:'solved',officialSeconds:42,closedAt:Date.now(),replayCount:0},moveHistory:{schema:1,cursor:'h5',nodes,stats:{undos:0,redos:0,branches:0}}};victoryOverlay(current,42)}""")
    page.wait_for_selector('.victory-insight');return page.evaluate("""()=>({key:!!document.querySelector('.victory-insight-key'),steps:document.querySelectorAll('.victory-insight-step').length,overflow:document.documentElement.scrollWidth>innerWidth+1})""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True);page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)));page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page);r=ux1(page);assert r['key'] and 1<=r['steps']<=6 and not r['overflow'],r
    page.evaluate("document.querySelector('#victory')?.remove();statsView()");page.wait_for_selector('.progression-profile');profile=page.evaluate("""()=>({schema:document.querySelector('.progression-profile').dataset.profileSchema,kpis:[...document.querySelectorAll('.progression-kpis strong')].map(x=>x.textContent.trim())})""");assert profile['schema']=='1' and profile['kpis'][0].startswith('0/'),profile
    exported=page.evaluate('createUserDataExport()');assert exported['schema']==2 and exported['policy']=={'mode':'replace','merge':False},exported
    import_failed=page.evaluate("""p=>{try{importUserDataPackage(p);return false}catch(_){return true}}""",exported);assert import_failed
    page.evaluate('home()');page.wait_for_selector('.cards');assert not errors,errors
    ctx.close();browser.close()
print('v3.2.0 local-unavailable PASS',json.dumps({'ux1SessionOnly':True,'ux2FailSoft':True,'ux3ExportAvailable':True,'ux3ImportFailsCleanly':True},ensure_ascii=False))
