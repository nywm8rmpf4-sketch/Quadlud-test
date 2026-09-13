from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources,runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
for pattern in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    HTML=re.sub(pattern,'',HTML)
CSS=runtime_styles(ROOT);SCRIPTS=runtime_sources(ROOT)

def load(page,seed=None,storage_ok=True):
    page.set_content(HTML,wait_until='domcontentloaded')
    page.add_style_tag(content=CSS)
    if storage_ok:
        page.evaluate("""seed=>{const d=new Map(Object.entries(seed||{}));const s={getItem:k=>d.get(String(k))??null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>[...d.keys()][i]??null,get length(){return d.size}};Object.defineProperty(window,'localStorage',{configurable:true,value:s})}""",seed or {})
    else:
        page.evaluate("""()=>{const fail=()=>{throw new Error('storage unavailable')};const s={getItem:fail,setItem:fail,removeItem:fail,clear:fail,key:fail,get length(){throw new Error('storage unavailable')}};Object.defineProperty(window,'localStorage',{configurable:true,value:s})}""")
    for source in SCRIPTS: page.add_script_tag(content=source)
    page.wait_for_selector('.cards')

def seed_progress(page):
    return page.evaluate("""()=>{
      const s=blankStats();s.started=8;s.solved=6;s.totalSolvedSeconds=420;
      const games=[...GAME_IDS];
      for(let i=0;i<games.length;i++){
        const g=games[i];s.byGame[g]={};const d=i===0?'easy':i===1?'medium':i===2?'hard':'expert';s.byGame[g][d]={started:2,solved:i<4?1:0,revealed:0,totalSeconds:i<4?60+i*10:0,best:i<4?60+i*10:null};
      }
      s.history=[{id:'a',ts:Date.now(),day:localDay(),game:games[0],diff:'easy',seconds:60,outcome:'solved',hintUsed:false,walkthroughUsed:false,masteryMerged:true},{id:'b',ts:Date.now()-1000,day:localDay(),game:games[1],diff:'medium',seconds:70,outcome:'solved',hintUsed:true,walkthroughUsed:false,masteryMerged:true},{id:'c',ts:Date.now()-2000,day:localDay(),game:games[2],diff:'hard',seconds:80,outcome:'solved',hintUsed:false,walkthroughUsed:false,masteryMerged:true}];
      const ids=activeTechniqueIds(),advanced=ids.find(id=>(PEDAGOGY_TECHNIQUES[id]?.rank||0)>=2)||ids[0],basic=ids[0];
      if(basic)s.mastery.byTechnique[basic]={encountered:6,solo:6,where:0,rule:0,why:0,reveal:0,where3:0,why3:0,reveal3:0,errors:0};
      if(advanced)s.mastery.byTechnique[advanced]={encountered:5,solo:5,where:0,rule:0,why:0,reveal:0,where3:0,why3:0,reveal3:0,errors:0};
      writeStats(s);statsView();return {key:STATS_KEY,raw:localStorage.getItem(STATS_KEY),advanced};
    }""")

def report(page):
    page.wait_for_selector('.progression-profile')
    return page.evaluate("""()=>{const p=document.querySelector('.progression-profile'),k=[...p.querySelectorAll('.progression-kpis strong')].map(x=>x.textContent.trim());return{schema:p.dataset.profileSchema,kpis:k,unlocked:p.querySelectorAll('.progress-achievement.unlocked').length,locked:p.querySelectorAll('.progress-achievement.locked').length,overflow:document.documentElement.scrollWidth>innerWidth+1,height:p.getBoundingClientRect().height,viewport:innerHeight,aria:p.getAttribute('aria-label'),text:p.textContent.replace(/\s+/g,' ').trim()}}""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    errors=[];persisted=None
    for viewport in [{'width':390,'height':844},{'width':844,'height':390}]:
        ctx=browser.new_context(viewport=viewport,locale='fr-FR',has_touch=True,is_mobile=True)
        page=ctx.new_page();page.on('pageerror',lambda e,errors=errors:errors.append('pageerror:'+str(e)));page.on('console',lambda m,errors=errors:errors.append('console:'+m.text) if m.type=='error' else None)
        load(page);seed=seed_progress(page);r=report(page)
        assert r['schema']=='1',r;assert len(r['kpis'])==4,r;assert r['unlocked']>=5,r;assert not r['overflow'],(viewport,r);assert r['aria'],r
        page.evaluate('home();statsView()');r2=report(page);assert r2['kpis']==r['kpis'],(r,r2)
        persisted={seed['key']:seed['raw']};ctx.close()

    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();load(page,persisted);page.evaluate('statsView()');rr=report(page);assert int(rr['kpis'][0].split('/')[0])>=3,rr;ctx.close()

    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();load(page,storage_ok=False);page.evaluate('statsView()');degraded=report(page);assert degraded['schema']=='1';assert degraded['kpis'][0].startswith('0/'),degraded;assert not degraded['overflow'],degraded;ctx.close()
    browser.close()

assert not errors,errors
print('v3.2-B UX-2 browser PASS',json.dumps({'viewports':['iPhone portrait','iPhone landscape'],'derivedFromExistingStats':True,'persistsAcrossReload':True,'storageUnavailableFailSoft':True,'newProfileWrites':False},ensure_ascii=False))
