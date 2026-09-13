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
    page.set_content(HTML,wait_until='domcontentloaded')
    page.add_style_tag(content=CSS)
    page.evaluate("""()=>{const d=new Map();const s={getItem:k=>d.get(String(k))??null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>[...d.keys()][i]??null,get length(){return d.size}};Object.defineProperty(window,'localStorage',{configurable:true,value:s})}""")
    for source in SCRIPTS: page.add_script_tag(content=source)
    page.wait_for_selector('.cards')

def open_fixture(page,game,with_proofs=True):
    return page.evaluate("""({game,withProofs})=>{
      const technique=(typeof PEDAGOGY_TECHNIQUES!=='undefined'&&Object.keys(PEDAGOGY_TECHNIQUES)[0])||null;
      const nodes={h0:{id:'h0',parent:null,children:[],preferred:null,action:{type:'START',game},snapshot:{game}}};
      let parent='h0',last='h0',justified=0;
      for(let i=1;i<=8;i++){
        const id='h'+i,status=withProofs?(i===3?'unjustified':'justified'):null;
        nodes[parent].children=[id];nodes[parent].preferred=id;
        nodes[id]={id,parent,children:[],preferred:null,action:{type:'MOVE',game,changes:[]},snapshot:{game},justification:status?{status,...(status==='justified'&&technique?{technique}:{}),rank:i===6?4:1}:null};
        if(status==='justified')justified++;parent=id;last=id;
      }
      current={game,diff:'hard',completed:true,statsClosed:true,hintUsed:true,walkthroughUsed:false,backtrackUsed:true,reasoningAudit:{justified,unjustified:withProofs?1:0,unknown:0,hypotheses:0},postVictoryReview:{schema:1,active:false,outcome:'solved',officialSeconds:87,closedAt:Date.now(),replayCount:0},moveHistory:{schema:1,cursor:last,nodes,stats:{undos:2,redos:1,branches:0}}};
      victoryOverlay(current,87);
      return {technique,justified};
    }""",{'game':game,'withProofs':with_proofs})

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    errors=[]
    for viewport in [{'width':390,'height':844},{'width':844,'height':390}]:
        context=browser.new_context(viewport=viewport,locale='fr-FR',has_touch=True,is_mobile=True,color_scheme='light')
        page=context.new_page();page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)));page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
        load(page)
        page.evaluate("""()=>{const raw=localStorage.setItem.bind(localStorage);window.__ux1Writes=0;localStorage.setItem=(k,v)=>{window.__ux1Writes++;return raw(k,v)}}""")
        for game in page.evaluate('()=>[...QuadludGameRegistry.IDS]'):
            page.evaluate("()=>{const v=document.querySelector('#victory');if(v)v.remove()} ")
            fixture=open_fixture(page,game,True)
            page.wait_for_selector('#victory .victory-insight')
            report=page.evaluate("""()=>{const card=document.querySelector('#victory .victory-card'),box=document.querySelector('.victory-insight'),steps=[...document.querySelectorAll('.victory-insight-step')];return{facts:document.querySelectorAll('.victory-insight-chip').length,key:!!document.querySelector('.victory-insight-key'),steps:steps.length,keySteps:steps.filter(x=>x.dataset.key==='true').length,docOverflowX:document.documentElement.scrollWidth>innerWidth+1,cardHeight:card.getBoundingClientRect().height,viewport:innerHeight,writes:window.__ux1Writes,aria:box.getAttribute('aria-label')}}""")
            assert report['facts']>=2,(game,viewport,report)
            assert report['key'] and 1<=report['steps']<=6,(game,viewport,report)
            assert report['keySteps']==1,(game,viewport,report)
            assert not report['docOverflowX'],(game,viewport,report)
            assert report['cardHeight']<=report['viewport']+1,(game,viewport,report)
            assert report['writes']==0,(game,viewport,report)
            assert report['aria'],(game,viewport,report)
        page.evaluate("()=>{const v=document.querySelector('#victory');if(v)v.remove()}")
        open_fixture(page,'tango',False);page.wait_for_selector('#victory .victory-insight')
        no_proof=page.evaluate("""()=>({key:!!document.querySelector('.victory-insight-key'),steps:document.querySelectorAll('.victory-insight-step').length,text:document.querySelector('.victory-insight').textContent,writes:window.__ux1Writes})""")
        assert no_proof['key'] is False and no_proof['steps']==0,no_proof
        assert no_proof['writes']==0,no_proof
        context.close()

    reduced=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True,reduced_motion='reduce')
    page=reduced.new_page();load(page);open_fixture(page,'tango',True);page.wait_for_selector('.victory-insight')
    reduced_report=page.evaluate("""()=>({animations:[...document.querySelectorAll('.victory-insight,.victory-insight *')].map(x=>getComputedStyle(x).animationName).filter(x=>x&&x!=='none'),overflow:document.documentElement.scrollWidth>innerWidth+1})""")
    assert reduced_report['animations']==[] and not reduced_report['overflow'],reduced_report
    reduced.close();browser.close()

assert not errors,errors
print('v3.2-A UX-1 browser PASS',json.dumps({'games':5,'viewports':['iPhone portrait','iPhone landscape'],'proofOnly':True,'boundedReplay':6,'noPersistentWrites':True,'reducedMotion':True},ensure_ascii=False))
