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
    ctx=browser.new_context(viewport={'width':1024,'height':768},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)

    page.evaluate("""()=>{
      const column=2;
      const cell=(r,c)=>`<div class="cell walkthrough-cell ${c===column?'walkthrough-context walkthrough-reasoning-context walkthrough-current-focus':''}" data-r="${r}" data-c="${c}">${r},${c}</div>`;
      app.innerHTML=`<section class="panel walkthrough-panel"><div class="board walkthrough-board" style="grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(6,1fr)">${Array.from({length:36},(_,i)=>cell(Math.floor(i/6),i%6)).join('')}</div></section>`;
      const unit=[{family:'column',id:column}];
      const move=(focusCells,focusRelations,conclusions,kind='reasoning')=>({deduction:{rule:'LINE_DOMAIN_SUPPORT',focusUnits:unit,focusCells,focusRelations,premises:[{kind:'VALUE',cell:[0,column],value:0},{kind:'VALUE',cell:[5,column],value:1}],conclusions,explanationData:{family:'column',id:column,domainCount:2}},proofStage:{kind}});
      window.__r3uiGroup={logicalMoveIndex:0,entries:[
        {move:move([[1,column]],[],[{type:'VALUE',cell:[1,column],value:1}])},
        {move:move([[0,column],[1,column]],[{a:[0,column],b:[1,column],parity:1}],[{type:'RELATION',a:[0,column],b:[1,column],parity:1}])},
        {move:move([[0,column],[4,column]],[{a:[0,column],b:[4,column],parity:1}],[{type:'RELATION',a:[0,column],b:[4,column],parity:1}])},
        {move:move([[4,column],[5,column]],[{a:[4,column],b:[5,column],parity:1}],[{type:'RELATION',a:[4,column],b:[5,column],parity:1}])},
        {move:{deduction:{rule:'ASSUMPTION_CONTRADICTION',focusCells:[],focusUnits:unit,conclusions:[{type:'VALUE',cell:[2,column],value:1}]},proofStage:{kind:'action',apply:true},presentation:{metadata:{showTutorMove:true}}}}
      ]};
      window.walkthroughCurrentGroup=()=>window.__r3uiGroup;
      walkthroughSession={base:{game:'tango',n:6},navigation:{proofStepIndex:0},atStart:false};
      window.walkthroughSession=walkthroughSession;
    }""")

    expected=[
      {'1,2'},
      {'0,2','1,2'},
      {'0,2','4,2'},
      {'4,2','5,2'}
    ]
    for index,want in enumerate(expected):
        page.evaluate("""i=>{
          walkthroughSession.navigation={proofStepIndex:i};
          const board=document.querySelector('.walkthrough-board');
          board.querySelectorAll('[data-c="2"]').forEach(el=>el.classList.add('walkthrough-current-focus'));
          QuadludTangoPedagogyUnitFocus.pruneWalkthrough();
        }""",index)
        got=set(page.evaluate("""()=>[...document.querySelectorAll('.walkthrough-board .walkthrough-current-focus')].map(el=>`${el.dataset.r},${el.dataset.c}`)"""))
        assert got==want,(index,got,want)
        unit_count=page.evaluate("""()=>document.querySelectorAll('.walkthrough-board .walkthrough-unit-context-column').length""")
        assert unit_count==6,(index,unit_count)

    # The final action stage must not be converted back into a normal current-focus frame.
    page.evaluate("""()=>{
      walkthroughSession.navigation={proofStepIndex:4};
      const action=document.querySelector('[data-r="2"][data-c="2"]');
      action.classList.add('walkthrough-current-action');
      QuadludTangoPedagogyUnitFocus.pruneWalkthrough();
    }""")
    final=page.evaluate("""()=>[...document.querySelector('[data-r="2"][data-c="2"]').classList]""")
    assert 'walkthrough-current-action' in final,final
    assert 'walkthrough-current-focus' not in final,final

    assert not errors,errors
    ctx.close();browser.close()

print('v3.1.9-R3UI atomic relation focus browser regression: PASS')
