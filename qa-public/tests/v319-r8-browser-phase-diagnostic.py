from __future__ import annotations
import os,time
from playwright.sync_api import sync_playwright
BASE=os.environ.get('QUADLUD_R8_BASE_URL','http://127.0.0.1:8765/')
VIEWPORT={'width':390,'height':844}
def mark(x,data=None): print(f'R8_PHASE {x}'+(f' {data}' if data is not None else ''),flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    c=b.new_context(viewport=VIEWPORT,locale='fr-FR',has_touch=True,is_mobile=True)
    page=c.new_page(); mark('01-goto-before'); page.goto(BASE,wait_until='networkidle'); page.wait_for_selector('.cards'); mark('01-goto-after')
    loaded=page.evaluate("()=>({pool:QuadludTangoPrecomputedPoolRuntime?.info?.(),cache:QuadludTangoTutorPrecomputedCache?.info?.(),token:QuadludTangoTutorSinglePlannerR5?.TOKEN})")
    mark('02-loaded',{'pool':loaded['pool']['exactRegistered'],'cache':loaded['cache']['registered'],'token':loaded['token']})
    mark('03-diversity-before')
    diversity=page.evaluate("""()=>Object.fromEntries(['easy','medium','hard','expert'].map(d=>{const ids=[];for(let i=0;i<120;i++){const q=QuadludTangoPrecomputedPoolRuntime.takePuzzle(d,Math.random);if(!q)throw new Error('missing '+d+' '+i);ids.push(q.generationStats.poolEntryId)}return [d,{count:ids.length,unique:new Set(ids).size}]}))""")
    mark('03-diversity-after',diversity)
    page.evaluate("QuadludTangoPrecomputedPoolRuntime._test.resetForTests()"); mark('04-launch-before'); page.evaluate("launch('tango','expert')"); page.wait_for_selector('#walkthroughBtn'); page.wait_for_timeout(100); mark('04-launch-after',page.evaluate("()=>({diff:current?.diff,hits:QuadludTangoPrecomputedPoolRuntime.info().stats.exactHits})"))
    page.evaluate("QuadludTangoTutorPrecomputedCache._test.resetStats()"); page.locator('#walkthroughBtn').click(); page.wait_for_selector('.walkthrough-panel'); page.wait_for_timeout(100); mark('05-tutor-before'); t=time.perf_counter(); page.locator('#walkthroughNext').click(timeout=15000); page.wait_for_timeout(300); mark('05-tutor-after',{'ms':round((time.perf_counter()-t)*1000,2),'cache':page.evaluate("()=>QuadludTangoTutorPrecomputedCache.info().stats")})
    mark('06-divergence-prepare-before')
    prep=page.evaluate("""()=>{const P=QuadludTangoPlayedMovePlanner,C=QuadludTangoTutorPrecomputedCache;const pub={n:current.n,state:current.state.map(r=>r.slice()),edges:(current.edges||[]).map(e=>e.slice())};const base=P.sessionFromPublicBoard(pub,pub.state);const canonical=C.tryPlan(base,current.diff);const avoid=canonical?.target?.join(',');for(let r=0;r<current.n;r++)for(let c=0;c<current.n;c++){if(current.state[r][c]!==-1||`${r},${c}`===avoid)continue;const value=Number(current.sol?.[r]?.[c]);if(value!==0&&value!==1)continue;const state=current.state.map(row=>row.slice());state[r][c]=value;const e=P.sessionFromPublicBoard({n:current.n,state,edges:(current.edges||[]).map(x=>x.slice())},state);if(C.lookup(e,current.diff)===null){globalThis.__r8DiagEngine=e;return {ok:true,r,c,value}}}return {ok:false}}""")
    mark('06-divergence-prepare-after',prep)
    mark('07-cache-miss-before'); miss=page.evaluate("()=>{const C=QuadludTangoTutorPrecomputedCache;C._test.resetStats();return {plan:C.tryPlan(globalThis.__r8DiagEngine,current.diff),stats:C.info().stats}}") ; mark('07-cache-miss-after',miss['stats'])
    mark('08-live-fallback-before'); t=time.perf_counter(); live=page.evaluate("()=>{const x=QuadludTangoTutorSinglePlannerR5.humanizeTutorPlan(globalThis.__r8DiagEngine,current.diff);return {status:x?.status,mode:x?.tutorPlannerMode,target:x?.target}}") ; mark('08-live-fallback-after',{'ms':round((time.perf_counter()-t)*1000,2),'live':live})
    mark('09-sw-state-before')
    sw=page.evaluate("""async()=>{let registerError=null;try{await navigator.serviceWorker.register('./sw.js')}catch(e){registerError=String(e)}await new Promise(r=>setTimeout(r,2000));const regs=await navigator.serviceWorker.getRegistrations();return {supported:!!navigator.serviceWorker,controller:!!navigator.serviceWorker.controller,registerError,caches:await caches.keys(),registrations:regs.map(x=>({scope:x.scope,installing:x.installing?.state||null,waiting:x.waiting?.state||null,active:x.active?.state||null}))}}""")
    mark('09-sw-state-after',sw)
    if not sw['controller'] and not any(r.get('active')=='activated' for r in sw['registrations']):
        assets=page.evaluate("""async()=>{const text=await fetch('./sw.js',{cache:'no-store'}).then(r=>r.text()),m=text.match(/const ASSETS=\[(.*?)\];/s);if(!m)return {parse:false,bad:[['sw-assets','parse-failed']]};const urls=Function('return ['+m[1]+']')(),bad=[];for(const u of urls){try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)bad.push([u,r.status])}catch(e){bad.push([u,String(e)])}}return {parse:true,count:urls.length,bad}}""")
        mark('09-sw-assets',assets)
        raise AssertionError(f"service worker did not activate: {sw}; assets={assets}")
    mark('10-sw-active')
    page.reload(wait_until='networkidle'); page.wait_for_selector('.cards'); mark('11-reload-after')
    c.set_offline(True); page.reload(wait_until='domcontentloaded',timeout=15000); page.wait_for_selector('.cards',timeout=10000); mark('12-offline-after')
    c.close(); b.close(); mark('DONE')
