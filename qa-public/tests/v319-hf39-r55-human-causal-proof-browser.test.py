from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

HUMAN_TEST = Path(__file__).with_name("v319-hf39-r54-human-regression-browser.test.py")
spec = importlib.util.spec_from_file_location("quadlud_r54_human", HUMAN_TEST)
assert spec and spec.loader
human = importlib.util.module_from_spec(spec)
spec.loader.exec_module(human)
EVIDENCE = Path(os.environ.get("QUADLUD_A3_R55_EVIDENCE_DIR", "/tmp/quadlud-a3-r55-evidence"))


def install_exact_a3_fixture(page):
    return page.evaluate(r"""()=>{
      const cp=v=>JSON.parse(JSON.stringify(v));
      const state=Array.from({length:6},()=>Array(6).fill(-1)); state[2][0]=0; state[5][1]=0; state[5][2]=1;
      const initial={state:cp(state)};
      const support=(a,b,parity,family,id,count=2)=>({rule:'LINE_DOMAIN_SUPPORT',premises:[],conclusions:[{type:'RELATION',a:cp(a),b:cp(b),parity}],explanationData:{family,id,domainCount:count}});
      const rel=(source,target,value,sourceValue,path)=>({rule:'RELATION_PROPAGATION',premises:[{kind:'VALUE',cell:cp(source),value:sourceValue,hypothesis:true},{kind:'RELATION',a:cp(source),b:cp(target),parity:sourceValue===value?0:1,path:cp(path)}],focusCells:[cp(source),cp(target)],conclusions:[{type:'VALUE',cell:cp(target),value}],explanationData:{source:cp(source),target:cp(target),sourceValue,parity:sourceValue===value?0:1}});
      const presentation=d=>{try{return tangoReasoningPresenter().presentation(d)}catch(_){return {metadata:{showTutorMove:false},explanation:{where:'',why:'',move:''},evidence:{primary:cp(d)}}}};
      const move=(kind,d,extra={})=>({pedagogyStageKind:kind,proofStage:{kind,temporary:false,apply:kind==='action'},deduction:cp(d),presentation:presentation(d),snapshot:cp(initial),beforeSnapshot:cp(initial),proofSnapshot:cp(initial),...extra});
      const A3=[0,2],B3=[1,2],B4=[1,3],A4=[0,3],B5=[1,4],E3=[4,2],E5=[4,4],F5=[5,4],A5=[0,4];
      const sA3B3=support(A3,B3,1,'column',2,2),sA3E3=support(A3,E3,1,'column',2,2),sE3E5=support(E3,E5,1,'row',4,2);
      const hypothesisD={rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:A3,value:1,hypothesis:true}],focusCells:[A3],conclusions:[],explanationData:{assumption:{cell:A3,value:1}}};
      const b3=rel(A3,B3,0,1,[{a:A3,b:B3,parity:1,explicit:false,support:sA3B3}]);
      const a4=rel(B3,A4,1,0,[{a:B3,b:B4,parity:1,explicit:true},{a:B4,b:A4,parity:0,explicit:true}]);
      const b5=rel(B3,B5,0,0,[{a:B3,b:B4,parity:1,explicit:true},{a:B4,b:B5,parity:1,explicit:true}]);
      const e5=rel(A3,E5,1,1,[{a:A3,b:E3,parity:1,explicit:false,support:sA3E3},{a:E3,b:E5,parity:1,explicit:false,support:sE3E5}]);
      const f5=rel(A3,F5,0,1,[{a:A3,b:E3,parity:1,explicit:false,support:sA3E3},{a:E3,b:E5,parity:1,explicit:false,support:sE3E5},{a:E5,b:F5,parity:1,explicit:true}]);
      const a5={rule:'TRIPLE_CONSTRAINT',premises:[{kind:'VALUE',cell:A3,value:1,hypothesis:true},{kind:'VALUE',cell:A4,value:1,hypothesis:true}],focusCells:[A3,A4,A5],focusUnits:[{family:'row',id:0}],conclusions:[{type:'VALUE',cell:A5,value:0}],explanationData:{family:'row',id:0,target:A5}};
      const contradiction={rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:A3,value:1,hypothesis:true}],focusCells:[[0,4],[1,4],[2,4],[3,4],[4,4],[5,4]],focusUnits:[{family:'column',id:4}],conclusions:[],explanationData:{assumption:{cell:A3,value:1},contradiction:{family:'column',id:4}}};
      const rollback={rule:'ROLLBACK',premises:[],focusCells:[A3],conclusions:[],explanationData:{assumption:{cell:A3,value:1}}};
      const finalD={rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:A3,value:1,hypothesis:true}],focusCells:[A3],conclusions:[{type:'VALUE',cell:A3,value:0}],explanationData:{assumption:{cell:A3,value:1}}};
      const raw=[
        move('hypothesis',hypothesisD,{where:'Regarde A3.',why:'Hypothèse : A3 = soleil ☀.'}),
        move('reasoning',b3),move('reasoning',a4),move('reasoning',b5),move('reasoning',e5),move('reasoning',f5),move('reasoning',a5),
        move('contradiction',contradiction,{where:"Regarde maintenant l’impasse obtenue.",why:'Impasse : la colonne 5 ne peut plus être complétée.'}),
        move('rollback',rollback,{where:"Reviens à l’hypothèse de départ.",why:'La contradiction vient d’être établie.'}),
        move('action',finalD,{target:A3})
      ];
      raw[0].presentation.explanation={where:raw[0].where,why:raw[0].why,move:''};
      raw[7].presentation.explanation={where:raw[7].where,why:raw[7].why,move:''};
      raw[8].presentation.explanation={where:raw[8].where,why:raw[8].why,move:''};
      const finalState=cp(state); finalState[0][2]=0; raw[9].snapshot={state:finalState}; raw[9].presentation.explanation={where:'',why:"L’hypothèse est impossible. Donc A3 = lune ☾.",move:'A3 = lune ☾'}; raw[9].move='A3 = lune ☾';
      walkthroughSession.base.edges=[[1,2,'r','×'],[0,3,'d','='],[1,3,'r','×'],[4,4,'d','×']];
      walkthroughSession.base.n=6; walkthroughSession.base.game='tango'; walkthroughSession.base.diff='expert'; walkthroughSession.initial=cp(initial); walkthroughSession.moves=raw; walkthroughSession.pedagogyNavigationByMove=[]; walkthroughSession.done=true; walkthroughSession.stalled=false; walkthroughSession.atStart=false;
      const ok=QuadludTangoTutorCausalAtomicR55.atomizeGeneratedMoves(walkthroughSession,0); if(!ok)throw new Error('A3 atomization failed');
      const api=QuadludTutorActionFirstNavigation;
      walkthroughSession.pedagogyNavigationByMove=walkthroughSession.moves.map((_,i)=>({kind:'pedagogy-navigation',schema:1,logicalMoveIndex:1,proofStepIndex:i}));
      walkthroughSession.navigation={kind:'pedagogy-navigation',schema:1,logicalMoveIndex:1,proofStepIndex:0}; walkthroughSession.index=1;
      renderWalkthrough();
      return {count:walkthroughSession.moves.length,kinds:walkthroughSession.moves.map(m=>String(m.pedagogyStageKind||m.proofStage?.kind||'')),produced:walkthroughSession.moves.map(m=>((m.deduction?.conclusions||[]).find(c=>c.type==='VALUE')||{}).cell||null)};
    }""")


def state(page):
    return page.evaluate(r"""()=>{const s=walkthroughSession,g=walkthroughCurrentGroup(),i=Number(s.navigation?.proofStepIndex)||0,m=g?.entries?.[i]?.move||{},d=m.deduction||m.presentation?.evidence?.primary||null,cell=x=>Array.isArray(x)?`${String.fromCharCode(65+Number(x[0]))}${Number(x[1])+1}`:null,markers=[...document.querySelectorAll('.hf39-marker-badge')].map(b=>{const c=b.closest('[data-r][data-c]');return{label:String(b.textContent||'').trim(),cell:c?cell([+c.dataset.r,+c.dataset.c]):null}});return{index:i,count:g?.entries?.length||0,kind:String(m.pedagogyStageKind||m.proofStage?.kind||''),rule:String(d?.rule||''),produced:cell((d?.conclusions||[]).find(c=>c.type==='VALUE')?.cell),text:String(document.querySelector('.walkthrough-scroll')?.innerText||'').replace(/\s+/g,' ').trim(),markers,actionVisible:!!document.querySelector('.walkthrough-move')};}""")


def main():
    EVIDENCE.mkdir(parents=True,exist_ok=True); errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']); context=browser.new_context(viewport=human.VIEWPORT,locale='fr-FR',has_touch=True,is_mobile=True); page=context.new_page(); page.set_default_timeout(45000)
        page.on('pageerror',lambda exc: errors.append('pageerror:'+str(exc))); page.on('console',lambda msg: errors.append('console:'+msg.text) if msg.type=='error' else None)
        human.load_runtime(page); human.install_human_fixture(page); page.locator('#walkthroughBtn').click(); page.wait_for_selector('.walkthrough-panel'); page.wait_for_timeout(100)
        fixture=install_exact_a3_fixture(page); assert fixture['count']==12,fixture
        assert fixture['kinds']==['hypothesis','reasoning','reasoning','reasoning','reasoning','reasoning','reasoning','reasoning','reasoning','contradiction','rollback','action'],fixture
        states=[]
        for i in range(fixture['count']):
            if i:
                page.evaluate('(i)=>{walkthroughSetPosition(1,i);renderWalkthrough();}',i); page.wait_for_timeout(80)
            s=state(page); states.append(s); page.screenshot(path=str(EVIDENCE/f'a3-proof-{i+1:02d}-of-12.png'),full_page=False); (EVIDENCE/f'a3-proof-{i+1:02d}-of-12.json').write_text(json.dumps(s,ensure_ascii=False,indent=2),encoding='utf-8')
        assert not errors,errors
        assert states[0]['markers']==[{'label':'H','cell':'A3'}],states[0]
        expected=['B3','B4','A4','B5','E3','E5','F5','A5']
        reasoning=[s for s in states if s['kind']=='reasoning']; assert [s['produced'] for s in reasoning]==expected,[(s['produced'],s['text']) for s in reasoning]
        for n,s in enumerate(reasoning,1):
            assert s['produced'] in s['text'],s
            nums={m['label']:m['cell'] for m in s['markers'] if m['label'].isdigit()}; assert nums.get(str(n))==s['produced'],(n,s['produced'],s['markers'])
            assert 'conduit à une contradiction' not in s['text'].lower(),s['text']; assert not s['actionVisible'],s
        assert 'B3' in states[2]['text'] and 'B4' in states[2]['text'],states[2]['text']
        assert 'E3' in states[5]['text'],states[5]['text']; assert 'E3' in states[6]['text'] and 'E5' in states[6]['text'],states[6]['text']
        assert states[9]['kind']=='contradiction' and 'colonne 5' in states[9]['text'].lower(),states[9]
        assert states[10]['kind']=='rollback' and 'contradiction vient d’être établie' in states[10]['text'],states[10]
        assert states[11]['kind']=='action' and states[11]['actionVisible'] and 'conclusion réelle' in states[11]['text'].lower() and 'A3' in states[11]['text'],states[11]
        context.close(); browser.close()
    (EVIDENCE/'summary.json').write_text(json.dumps({'fixture':fixture,'states':states,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
    print('PASS HF3.9-R5.5 exact A3 browser proof: 12 atomic screens H,B3,B4,A4,B5,E3,E5,F5,A5,contradiction,rollback,action; mobile evidence captured.')

if __name__=='__main__': main()
