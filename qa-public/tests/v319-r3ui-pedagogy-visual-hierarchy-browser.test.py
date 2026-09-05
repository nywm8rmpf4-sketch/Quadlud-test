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

    page.evaluate("""()=>{
      const cell=(r,c)=>`<div class="cell walkthrough-cell" data-r="${r}" data-c="${c}">${r},${c}</div>`;
      app.innerHTML=`<section class="panel walkthrough-panel"><div class="walkthrough-board-wrap"><div class="board walkthrough-board" style="grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr)">${Array.from({length:16},(_,i)=>cell(Math.floor(i/4),i%4)).join('')}</div></div><div data-entity-kind="clue" data-entity-id="clue-a">2</div></section>`;
      const nav=i=>({schema:1,logicalMoveIndex:0,proofStepIndex:i});
      const presentation=(focus,showTutorMove=false)=>({focus,metadata:{showTutorMove}});
      walkthroughSession={base:{game:'tango',n:4,reg:[[0,0,1,1],[0,0,1,1],[2,2,3,3],[2,2,3,3]]},initial:{state:Array.from({length:4},()=>Array(4).fill(-1))},moves:[
        {target:[0,3],deduction:{focusCells:[[0,0],[0,1]],conclusions:[]},presentation:presentation([{entity:{kind:'clue',id:'clue-a'},role:'premise'}]),proofStage:{kind:'where'},snapshot:{state:Array.from({length:4},()=>Array(4).fill(-1))}},
        {target:[0,3],deduction:{focusCells:[[0,1],[0,2]],focusRelations:[{a:[0,2],b:[1,2]}],conclusions:[]},presentation:presentation([{entity:{kind:'clue',id:'clue-a'},role:'premise'}]),proofStage:{kind:'consequence'},snapshot:{state:Array.from({length:4},()=>Array(4).fill(-1))}},
        {target:[0,3],deduction:{focusCells:[[0,2]],conclusions:[{type:'VALUE',cell:[0,3],value:1}]},presentation:presentation([{entity:{kind:'cell',id:'r0c3'},role:'target'}],true),proofStage:{kind:'action',apply:true},snapshot:{state:Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>r===0&&c===3?1:-1))}}
      ],pedagogyNavigationByMove:[nav(0),nav(1),nav(2)],navigation:nav(1),atStart:false,index:2,done:false,stalled:false};
      QuadludTutorActionFirstNavigation.decorateCurrentAction();
    }""")

    result=page.evaluate("""()=>{
      const q=(r,c)=>document.querySelector(`.walkthrough-board [data-r="${r}"][data-c="${c}"]`),style=el=>({outlineStyle:getComputedStyle(el).outlineStyle,outlineWidth:getComputedStyle(el).outlineWidth,classes:[...el.classList]});
      return {hierarchy:document.querySelector('.walkthrough-board').dataset.pedagogyHierarchy,prior:style(q(0,0)),current:style(q(0,1)),relation:style(q(1,2)),action:style(q(0,3)),clue:style(document.querySelector('[data-entity-kind="clue"]'))};
    }""")
    assert result['hierarchy']=='context-focus-action',result
    assert 'walkthrough-reasoning-context' in result['prior']['classes'],result
    assert 'walkthrough-current-focus' not in result['prior']['classes'],result
    assert result['prior']['outlineStyle']=='dashed',result
    assert 'walkthrough-current-focus' in result['current']['classes'],result
    assert result['current']['outlineStyle']=='solid',result
    assert 'walkthrough-current-focus' in result['relation']['classes'],result
    assert result['relation']['outlineStyle']=='solid',result
    assert 'walkthrough-current-action' in result['action']['classes'],result
    assert result['action']['outlineStyle']=='double',result
    assert float(result['action']['outlineWidth'].replace('px',''))>=4,result
    assert 'walkthrough-reasoning-context' in result['clue']['classes'],result

    page.evaluate("""()=>{walkthroughSession.navigation={schema:1,logicalMoveIndex:0,proofStepIndex:0};walkthroughSession.index=1;QuadludTutorActionFirstNavigation.decorateCurrentAction()}""")
    moved=page.evaluate("""()=>({first:[...document.querySelector('[data-r="0"][data-c="0"]').classList],later:[...document.querySelector('[data-r="1"][data-c="2"]').classList],action:[...document.querySelector('[data-r="0"][data-c="3"]').classList]})""")
    assert 'walkthrough-current-focus' in moved['first'],moved
    assert 'walkthrough-current-focus' not in moved['later'],moved
    assert 'walkthrough-reasoning-context' in moved['later'],moved
    assert 'walkthrough-current-action' in moved['action'],moved
    assert not errors,errors
    ctx.close();browser.close()

print('v3.1.9-R3UI pedagogical visual hierarchy browser: PASS')