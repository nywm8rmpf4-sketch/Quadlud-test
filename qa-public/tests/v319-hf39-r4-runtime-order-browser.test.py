from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
html=(ROOT/'index.html').read_text(encoding='utf-8')
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    html=re.sub(pat,'',html)
css=runtime_styles(ROOT)
scripts=runtime_sources(ROOT)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    page.evaluate("""()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}""")
    for src in scripts: page.add_script_tag(content=src)
    page.wait_for_selector('.cards')
    page.wait_for_function("()=>window.QuadludTangoSemanticStabilizerHF39R4 && typeof walkthroughNavigateProof==='function' && typeof renderWalkthrough==='function'")

    chains=page.evaluate("""()=>{
      const chain=fn=>{const out=[];let cur=fn,guard=0;while(typeof cur==='function'&&guard++<16){out.push({r4:cur.__quadludSemanticStabilizerHF39R4===true,causal:cur.__quadludCausalProofProjection===true,hf39:cur.__quadludSemanticCoherenceHF39===true});cur=cur.__quadludPrevious}return out};
      return {navigation:chain(walkthroughNavigateProof),render:chain(renderWalkthrough)};
    }""")
    nav=chains['navigation'];render=chains['render']
    assert nav and nav[0]['r4'],nav
    causal_indexes=[i for i,x in enumerate(nav) if x['causal']]
    assert causal_indexes and causal_indexes[0]>0,nav
    assert render and render[0]['r4'],render
    hf39_indexes=[i for i,x in enumerate(render) if x['hf39']]
    assert hf39_indexes and hf39_indexes[0]>0,render
    assert not errors,errors
    ctx.close();browser.close()

print('v319-hf39-r4-runtime-order-browser.test.py: PASS — R4 is final navigation/render stabilizer')
