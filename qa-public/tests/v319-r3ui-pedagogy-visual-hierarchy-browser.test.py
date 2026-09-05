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

    # The late compatibility bridge must own the active Tango generator. This
    # protects against falling back to one monolithic advanced explanation.
    page.wait_for_function("()=>window.QuadludTangoProgressiveProofBridge && window.walkthroughGenerateTangoNext && window.walkthroughGenerateTangoNext.__quadludProgressiveProofBridge===true")

    # Six-cell column context, but only strict causal cells are selected.
    # B4 is deliberately unit-only and carries the legacy walkthrough-context
    # class to verify that R3UI visually neutralizes its selected-cell frame.
    page.evaluate("""()=>{
      const cell=(r,c)=>`<div class="cell walkthrough-cell ${c===3?'walkthrough-context':''} ${r===1&&c===2?'walkthrough-context legacy-accent-control':''}" data-r="${r}" data-c="${c}">${r},${c}</div>`;
      app.innerHTML=`<section class="panel walkthrough-panel"><div class="walkthrough-board-wrap"><div class="board walkthrough-board" style="grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(6,1fr)">${Array.from({length:36},(_,i)=>cell(Math.floor(i/6),i%6)).join('')}</div></div><div data-entity-kind="clue" data-entity-id="clue-a">3/3</div></section>`;
      const nav=i=>({schema:1,logicalMoveIndex:0,proofStepIndex:i});
      const presentation=(focus,showTutorMove=false)=>({focus,metadata:{showTutorMove}});
      const unit=[{family:'column',id:3}];
      const blank=()=>Array.from({length:6},()=>Array(6).fill(-1));
      walkthroughSession={base:{game:'tango',n:6},initial:{state:blank()},moves:[
        {target:[0,3],deduction:{focusCells:[[0,3],[5,3]],focusUnits:unit,conclusions:[]},presentation:presentation([{entity:{kind:'clue',id:'clue-a'},role:'premise'}]),proofStage:{kind:'where'},snapshot:{state:blank()}},
        {target:[0,3],deduction:{focusCells:[[2,3],[3,3],[4,3]],focusRelations:[],focusUnits:unit,conclusions:[]},presentation:presentation([{entity:{kind:'clue',id:'clue-a'},role:'premise'}]),proofStage:{kind:'consequence'},snapshot:{state:blank()}},
        {target:[0,3],deduction:{focusCells:[],focusUnits:unit,conclusions:[{type:'VALUE',cell:[0,3],value:1}]},presentation:presentation([{entity:{kind:'cell',id:'r0c3'},role:'target'}],true),proofStage:{kind:'action',apply:true},snapshot:{state:Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>r===0&&c===3?1:-1))}}
      ],pedagogyNavigationByMove:[nav(0),nav(1),nav(2)],navigation:nav(1),atStart:false,index:2,done:false,stalled:false};
      QuadludTutorActionFirstNavigation.decorateCurrentAction();
    }""")

    result=page.evaluate("""()=>{
      const q=(r,c)=>document.querySelector(`.walkthrough-board [data-r="${r}"][data-c="${c}"]`),style=el=>({outlineStyle:getComputedStyle(el).outlineStyle,outlineWidth:getComputedStyle(el).outlineWidth,boxShadow:getComputedStyle(el).boxShadow,classes:[...el.classList]});
      return {hierarchy:document.querySelector('.walkthrough-board').dataset.pedagogyHierarchy,unitOnly:style(q(1,3)),legacyAccent:style(q(1,2)),prior:style(q(5,3)),current:style(q(2,3)),action:style(q(0,3)),outside:style(q(1,1)),clue:style(document.querySelector('[data-entity-kind="clue"]')),proofControls:typeof walkthroughProofControls==='function'?walkthroughProofControls():''};
    }""")
    assert result['hierarchy']=='unit-context-premise-focus-action',result
    assert 'walkthrough-unit-context' in result['unitOnly']['classes'],result
    assert 'walkthrough-reasoning-context' not in result['unitOnly']['classes'],result
    assert 'walkthrough-current-focus' not in result['unitOnly']['classes'],result
    assert result['unitOnly']['outlineStyle']=='none',result
    assert result['unitOnly']['boxShadow']!='none',result
    assert result['unitOnly']['boxShadow']!=result['legacyAccent']['boxShadow'],result
    assert 'walkthrough-reasoning-context' in result['prior']['classes'],result
    assert result['prior']['outlineStyle']=='dashed',result
    assert 'walkthrough-current-focus' in result['current']['classes'],result
    assert result['current']['outlineStyle']=='solid',result
    # While explaining a non-action proof step, the final advised move must not
    # be highlighted yet. It may remain part of the accumulated premise context.
    assert 'walkthrough-current-action' not in result['action']['classes'],result
    assert result['action']['outlineStyle']!='double',result
    assert 'walkthrough-reasoning-context' in result['action']['classes'],result
    assert 'walkthrough-unit-context' not in result['outside']['classes'],result
    assert 'walkthrough-reasoning-context' in result['clue']['classes'],result
    assert 'walkthroughProofPrev' in result['proofControls'] and 'walkthroughProofNext' in result['proofControls'] and '2/3' in result['proofControls'],result

    # Move proof cursor backward: focus moves and the final action remains hidden.
    page.evaluate("""()=>{walkthroughSession.navigation={schema:1,logicalMoveIndex:0,proofStepIndex:0};walkthroughSession.index=1;QuadludTutorActionFirstNavigation.decorateCurrentAction()}""")
    moved=page.evaluate("""()=>({first:[...document.querySelector('[data-r="5"][data-c="3"]').classList],later:[...document.querySelector('[data-r="2"][data-c="3"]').classList],unitOnly:[...document.querySelector('[data-r="1"][data-c="3"]').classList],action:[...document.querySelector('[data-r="0"][data-c="3"]').classList]})""")
    assert 'walkthrough-current-focus' in moved['first'],moved
    assert 'walkthrough-current-focus' not in moved['later'],moved
    assert 'walkthrough-reasoning-context' in moved['later'],moved
    assert 'walkthrough-unit-context' in moved['unitOnly'],moved
    assert 'walkthrough-current-focus' not in moved['unitOnly'],moved
    assert 'walkthrough-current-action' not in moved['action'],moved

    # Only the actual action stage may expose the strongest action treatment.
    page.evaluate("""()=>{walkthroughSession.navigation={schema:1,logicalMoveIndex:0,proofStepIndex:2};walkthroughSession.index=3;QuadludTutorActionFirstNavigation.decorateCurrentAction()}""")
    final_action=page.evaluate("""()=>{const el=document.querySelector('[data-r="0"][data-c="3"]');return {classes:[...el.classList],outlineStyle:getComputedStyle(el).outlineStyle,outlineWidth:getComputedStyle(el).outlineWidth}}""")
    assert 'walkthrough-current-action' in final_action['classes'],final_action
    assert final_action['outlineStyle']=='double',final_action
    assert int(float(final_action['outlineWidth'].replace('px',''))) >= 4,final_action

    assert not errors,errors
    ctx.close();browser.close()

print('v3.1.9-R3UI strict unit context + progressive proof navigation browser: PASS')
