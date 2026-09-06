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
    ctx=browser.new_context(viewport={'width':820,'height':1180},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)

    page.evaluate("""()=>{
      const cell=(r,c)=>`<div class="cell walkthrough-cell" data-r="${r}" data-c="${c}">${r},${c}</div>`;
      app.innerHTML=`<section class="panel walkthrough-panel">
        <div class="board walkthrough-board" style="grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(6,1fr)">${Array.from({length:36},(_,i)=>cell(Math.floor(i/6),i%6)).join('')}</div>
        <div class="walkthrough-explanation"><div class="walkthrough-tech"><b>Propagation relationnelle</b><span>R1</span></div><p><b>Où regarder :</b> ancien</p><p><b>Pourquoi ce coup ?</b><br>ancien</p></div>
      </section>`;
      const support={
        id:'D7',rule:'TRIPLE_CONSTRAINT',
        premises:[{kind:'RELATION',a:[0,5],b:[1,5],parity:0,explicit:true,path:[{a:[0,5],b:[1,5],parity:0,explicit:true}]}],
        conclusions:[{type:'RELATION',a:[2,5],b:[0,5],parity:1}],
        explanationData:{family:'column',id:5,window:[[0,5],[1,5],[2,5]],pair:[[0,5],[1,5]],target:[2,5],mode:'RELATION'}
      };
      const deduction={
        rule:'RELATION_PROPAGATION',
        premises:[
          {kind:'VALUE',cell:[0,5],value:0},
          {kind:'RELATION',a:[0,5],b:[2,5],parity:1,explicit:false,path:[{a:[0,5],b:[2,5],parity:1,explicit:false,deductionId:'D7',support}]}
        ],
        focusCells:[[0,5],[2,5]],
        focusRelations:[{a:[0,5],b:[2,5],parity:1}],
        conclusions:[{type:'VALUE',cell:[2,5],value:1}],
        explanationData:{source:[0,5],target:[2,5],sourceValue:0,parity:1}
      };
      window.__clarityDeduction=deduction;
      window.__clarityGroup={logicalMoveIndex:0,entries:[{move:{deduction,pedagogyStageKind:'reasoning',proofStage:{kind:'reasoning'}}}]};
      window.walkthroughCurrentGroup=()=>window.__clarityGroup;
      walkthroughSession={base:{game:'tango',n:6},navigation:{proofStepIndex:0},atStart:false};
      window.walkthroughSession=walkthroughSession;
      const board=document.querySelector('.walkthrough-board');
      board.querySelector('[data-r="0"][data-c="5"]').classList.add('walkthrough-current-focus');
      board.querySelector('[data-r="2"][data-c="5"]').classList.add('walkthrough-current-focus');
      QuadludTangoTutorClarity.decorate();
    }""")

    focus=set(page.evaluate("""()=>[...document.querySelectorAll('.walkthrough-current-focus')].map(el=>`${el.dataset.r},${el.dataset.c}`)"""))
    assert focus=={'0,5'},focus
    conclusion=page.evaluate("""()=>{const el=document.querySelector('[data-r="2"][data-c="5"]');return {classes:[...el.classList],badge:el.querySelector('.walkthrough-substep-conclusion-badge')?.textContent||''}}""")
    assert 'walkthrough-substep-conclusion' in conclusion['classes'],conclusion
    assert 'walkthrough-current-focus' not in conclusion['classes'],conclusion
    assert 'walkthrough-current-action' not in conclusion['classes'],conclusion
    assert conclusion['badge']=='⇒',conclusion

    explanation=page.evaluate("""()=>document.querySelector('.walkthrough-explanation').innerText""")
    lower=explanation.lower()
    assert 'Raisonnement :' in explanation,explanation
    assert 'Pourquoi ce coup ?' not in explanation,explanation
    assert 'Vérifie A6 → C6.' in explanation,explanation
    assert 'L’indice visible A6 = B6' in explanation,explanation
    assert 'A6–B6–C6' in explanation,explanation
    assert 'règle des trois' in lower,explanation
    assert 'A6 = lune' in explanation,explanation
    assert 'C6 = soleil' in explanation,explanation
    for banned in ['déjà démontr','déjà déduit','comme vu précédemment','résultat précédent']:
        assert banned not in lower,explanation

    # Same locally self-contained explanation must also reach the shared presenter
    # used by Logic Coach, not only the Tutor DOM decoration.
    coach=page.evaluate("""()=>{const p=tangoReasoningPresenter().presentation(window.__clarityDeduction);return {where:p.explanation.where,why:p.explanation.why,meta:p.metadata}}""")
    coach_text=(coach['where']+' '+coach['why']).lower()
    assert 'a6 = b6' in coach_text,coach
    assert 'règle des trois' in coach_text,coach
    assert 'a6 = lune' in coach_text,coach
    assert 'c6 = soleil' in coach_text,coach
    assert coach['meta'].get('localSelfContained') is True,coach
    for banned in ['déjà démontr','déjà déduit','comme vu précédemment','résultat précédent']:
        assert banned not in coach_text,coach

    assert not errors,errors
    ctx.close();browser.close()

print('v3.1.9-R3UI Tango Tutor/Coach local self-contained relation regression: PASS')
