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
        <div class="walkthrough-explanation"><div class="walkthrough-tech"><b>Propagation relationnelle</b><span>R2</span></div><p><b>Où regarder :</b> ancien</p><p><b>Pourquoi ce coup ?</b><br>ancien</p></div>
      </section>`;
      const deduction={
        rule:'RELATION_PROPAGATION',
        premises:[
          {kind:'VALUE',cell:[2,2],value:1},
          {kind:'RELATION',a:[2,2],b:[3,3],parity:0,explicit:false,path:[
            {a:[2,2],b:[3,2],parity:1},
            {a:[3,2],b:[3,3],parity:1}
          ]}
        ],
        focusCells:[[2,2],[3,3]],
        focusRelations:[{a:[2,2],b:[3,3],parity:0}],
        conclusions:[{type:'VALUE',cell:[3,3],value:1}],
        explanationData:{source:[2,2],target:[3,3],sourceValue:1,parity:0}
      };
      window.__clarityGroup={logicalMoveIndex:0,entries:[{move:{deduction,pedagogyStageKind:'reasoning',proofStage:{kind:'reasoning'}}}]};
      window.walkthroughCurrentGroup=()=>window.__clarityGroup;
      walkthroughSession={base:{game:'tango',n:6},navigation:{proofStepIndex:0},atStart:false};
      window.walkthroughSession=walkthroughSession;
      const board=document.querySelector('.walkthrough-board');
      board.querySelector('[data-r="2"][data-c="2"]').classList.add('walkthrough-current-focus');
      board.querySelector('[data-r="3"][data-c="3"]').classList.add('walkthrough-current-focus');
      QuadludTangoTutorClarity.decorate();
    }""")

    focus=set(page.evaluate("""()=>[...document.querySelectorAll('.walkthrough-current-focus')].map(el=>`${el.dataset.r},${el.dataset.c}`)"""))
    assert focus=={'2,2','3,2'},focus
    conclusion=page.evaluate("""()=>{const el=document.querySelector('[data-r="3"][data-c="3"]');return {classes:[...el.classList],badge:el.querySelector('.walkthrough-substep-conclusion-badge')?.textContent||''}}""")
    assert 'walkthrough-substep-conclusion' in conclusion['classes'],conclusion
    assert 'walkthrough-current-focus' not in conclusion['classes'],conclusion
    assert 'walkthrough-current-action' not in conclusion['classes'],conclusion
    assert conclusion['badge']=='⇒',conclusion

    explanation=page.evaluate("""()=>document.querySelector('.walkthrough-explanation').innerText""")
    assert 'Raisonnement :' in explanation,explanation
    assert 'Pourquoi ce coup ?' not in explanation,explanation
    assert 'Suis le chemin C3 → D3 → D4.' in explanation,explanation
    assert 'C3 × D3 : C3 et D3 sont opposées.' in explanation,explanation
    assert 'D3 × D4 : D3 et D4 sont opposées.' in explanation,explanation
    assert "Deux oppositions successives s’annulent" in explanation,explanation
    assert 'Conclusion intermédiaire : D4 est donc un soleil' in explanation,explanation
    assert 'sun' not in explanation.lower(),explanation

    assert not errors,errors
    ctx.close();browser.close()

print('v3.1.9-R3UI Tango Tutor clarity browser regression: PASS')
