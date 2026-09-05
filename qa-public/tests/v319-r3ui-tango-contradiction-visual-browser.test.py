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

def load(page):
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    page.evaluate("""()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}""")
    for src in scripts: page.add_script_tag(content=src)
    page.wait_for_selector('.cards')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)
    page.wait_for_function("()=>window.QuadludTangoContradictionVisuals && window.QuadludTutorActionFirstNavigation")

    page.evaluate("""()=>{
      const cell=(r,c)=>`<div class="cell walkthrough-cell" data-r="${r}" data-c="${c}" aria-label="${String.fromCharCode(65+r)}${c+1}"></div>`;
      app.innerHTML=`<section class="panel walkthrough-panel"><div class="walkthrough-board-wrap"><div class="board walkthrough-board" style="grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(6,1fr)">${Array.from({length:36},(_,i)=>cell(Math.floor(i/6),i%6)).join('')}</div></div></section>`;
      const blank=()=>Array.from({length:6},()=>Array(6).fill(-1));
      const nav=i=>({schema:1,logicalMoveIndex:0,proofStepIndex:i});
      const move=(kind,deduction)=>({target:[0,2],deduction,presentation:{metadata:{showTutorMove:kind==='action'},explanation:{title:kind,where:'',why:'',move:''}},pedagogyStageKind:kind,proofStage:{kind,apply:kind==='action'},snapshot:{state:blank()}});
      const moves=[
        move('hypothesis',{premises:[{kind:'ASSUMPTION',cell:[0,2],value:0,hypothesis:true}],focusCells:[[0,2]],conclusions:[]}),
        move('reasoning',{premises:[{kind:'VALUE',cell:[0,2],value:0,hypothesis:true}],focusCells:[[0,2],[1,2]],conclusions:[{type:'VALUE',cell:[1,2],value:1}]}),
        move('reasoning',{premises:[{kind:'VALUE',cell:[1,2],value:1,hypothesis:true}],focusCells:[[1,2],[2,2]],conclusions:[{type:'RELATION',a:[1,2],b:[2,2],parity:1}]}),
        move('reasoning',{premises:[{kind:'VALUE',cell:[1,2],value:1,hypothesis:true}],focusCells:[[2,2],[3,2]],conclusions:[{type:'VALUE',cell:[2,2],value:0},{type:'VALUE',cell:[3,2],value:1}]}),
        move('contradiction',{premises:[],focusCells:[[2,2],[3,2]],focusUnits:[{family:'column',id:2}],explanationData:{witness:{cells:[[2,2],[3,2]],family:'column',id:2}},conclusions:[]}),
        move('action',{premises:[],focusCells:[[0,2]],conclusions:[{type:'VALUE',cell:[0,2],value:1}]})
      ];
      walkthroughSession={base:{game:'tango',n:6},initial:{state:blank()},moves,pedagogyNavigationByMove:moves.map((_,i)=>nav(i)),navigation:nav(0),atStart:false,index:1,done:false,stalled:false};
      window.__setProofStep=i=>{walkthroughSession.navigation=nav(i);walkthroughSession.index=i+1;QuadludTutorActionFirstNavigation.decorateCurrentAction();QuadludTangoContradictionVisuals.decorate()};
      window.__setProofStep(0);
    }""")

    hypothesis=page.evaluate("""()=>{const cell=document.querySelector('[data-r="0"][data-c="2"]'),symbol=cell.querySelector('.walkthrough-hypothetical-symbol'),badge=cell.querySelector('.walkthrough-hypothetical-badge');return {badge:badge?.textContent,symbol:symbol?.textContent,opacity:symbol?getComputedStyle(symbol).opacity:null,action:cell.classList.contains('walkthrough-current-action'),a11y:cell.getAttribute('aria-label')||''}}""")
    assert hypothesis['badge']=='H',hypothesis
    assert hypothesis['symbol']=='☾',hypothesis
    assert float(hypothesis['opacity'])==0.5,hypothesis
    assert not hypothesis['action'],hypothesis
    assert 'Hypothèse' in hypothesis['a11y'],hypothesis

    page.evaluate("__setProofStep(1)")
    first=page.evaluate("""()=>({badges:[...document.querySelectorAll('.walkthrough-hypothetical-badge')].map(x=>x.textContent),symbols:[...document.querySelectorAll('.walkthrough-hypothetical-symbol')].map(x=>x.textContent),opacities:[...document.querySelectorAll('.walkthrough-hypothetical-symbol')].map(x=>getComputedStyle(x).opacity),finalAction:document.querySelector('[data-r="0"][data-c="2"]').classList.contains('walkthrough-current-action')})""")
    assert first['badges']==['H','1'],first
    assert first['symbols']==['☾','☀'],first
    assert all(float(x)==0.5 for x in first['opacities']),first
    assert not first['finalAction'],first

    page.evaluate("__setProofStep(2)")
    relation_only=page.evaluate("()=>[...document.querySelectorAll('.walkthrough-hypothetical-badge')].map(x=>x.textContent)")
    assert relation_only==['H','1'],relation_only

    page.evaluate("__setProofStep(3)")
    chain=page.evaluate("()=>[...document.querySelectorAll('.walkthrough-hypothetical-badge')].map(x=>x.textContent)")
    assert chain==['H','1','2','3'],chain

    page.evaluate("__setProofStep(4)")
    contradiction=page.evaluate("""()=>{const cells=[...document.querySelectorAll('.walkthrough-contradiction-cell')];return {badges:[...document.querySelectorAll('.walkthrough-hypothetical-badge')].map(x=>x.textContent),coords:cells.map(x=>[Number(x.dataset.r),Number(x.dataset.c)]),styles:cells.map(x=>({outlineStyle:getComputedStyle(x).outlineStyle,outlineWidth:getComputedStyle(x).outlineWidth,boxShadow:getComputedStyle(x).boxShadow})),dataset:document.querySelector('.walkthrough-board').dataset.contradictionVisual}}""")
    assert contradiction['badges']==['H','1','2','3'],contradiction
    assert contradiction['coords']==[[2,2],[3,2]],contradiction
    assert contradiction['dataset']=='contradiction',contradiction
    assert all(s['outlineStyle']=='solid' and float(s['outlineWidth'].replace('px',''))>=4 and s['boxShadow']!='none' for s in contradiction['styles']),contradiction

    page.evaluate("__setProofStep(5)")
    action=page.evaluate("""()=>({hypothetical:document.querySelectorAll('.walkthrough-hypothetical-piece').length,contradiction:document.querySelectorAll('.walkthrough-contradiction-cell').length,action:document.querySelector('[data-r="0"][data-c="2"]').classList.contains('walkthrough-current-action'),a11y:[...document.querySelectorAll('.walkthrough-board [aria-label]')].map(x=>x.getAttribute('aria-label'))})""")
    assert action['hypothetical']==0,action
    assert action['contradiction']==0,action
    assert action['action'],action
    assert not any(('Hypothèse' in label or 'Conséquence' in label or 'Contradiction' in label) for label in action['a11y']),action
    assert 'A3' in action['a11y'],action

    assert not errors,errors
    ctx.close();browser.close()

print('v319-r3ui-tango-contradiction-visual-browser.test.py: PASS')
