/* QUADLUD — R5.1 recent demonstrated dependency continuity
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);
const Policy=require(runtime('pedagogy-next-move-policy.js'));

global.QuadludPedagogyNextMovePolicy=Policy;
global.QuadludTangoPlayedMovePlanner={
  nextPlayedMove(){return null},
  _test:{
    selectPlans(plans,{frontierComplete=true}={}){
      const plan=plans?.[0]||null;
      if(!plan)return {plan:null,selection:{status:'empty',selected:null},candidates:[]};
      return {
        plan,
        selection:{status:frontierComplete?'human-proof-global-minimum':'best-available',selected:{costVector:[0,1,1,2,2,0,0]}},
        candidates:[{plan}]
      };
    }
  }
};
global.walkthroughSession={
  base:{game:'tango'},
  work:{state:Array.from({length:6},()=>Array(6).fill(-1))},
  moves:[
    {target:[1,3],proofStage:{kind:'action'},beforeSnapshot:{state:[[0]]}},
    {target:[2,5],proofStage:{kind:'action'},beforeSnapshot:{state:[[1]]}}
  ]
};
require(runtime('tango-attention-continuity-bridge.js'));
const T=global.QuadludTangoPlayedMovePlanner._attentionTest;
const Orchestrator=require(runtime('tango-tutor-attention-orchestrator-r5.js'));

assert.deepStrictEqual(T.recentPlayedTargets(global.walkthroughSession),[[2,5],[1,3]],'two most recent demonstrated action targets must remain available');

const context={recentCells:[[2,5],[2,4]],recentActionCells:[[2,5],[1,3]],pendingConclusions:[]};
const local={...context,recentCells:[[2,5],[2,4],[2,3],[2,2]],localExpansionApplied:true,localAxis:{family:'row',id:2}};
const candidate=(rule,target,premises,baseCost=[0,1,1,3,2,0,0])=>({
  target,value:1,baseCost,premiseCells:premises,focusCells:premises,payload:{deduction:{rule,rank:0},target,value:1}
});

const c3=candidate('RELATION_PROPAGATION',[2,2],[[1,3],[2,2]]);
assert.equal(T.localDependencyContinuationCandidate(c3,context,local),true,'C3 must reuse B4 while staying inside the local C-row attention zone');
assert.equal(Orchestrator._test.needsDependencyProbe(context,local),true,'C6/C5 context must probe because demonstrated B4 has just fallen outside the local context');

const d5Context={recentCells:[[3,4],[3,2],[3,3]],recentActionCells:[[3,4],[3,3]],pendingConclusions:[]};
const d5Local={...d5Context,recentCells:[[3,4],[3,2],[3,3],[3,1]],localExpansionApplied:true,localAxis:{family:'row',id:3}};
assert.equal(Orchestrator._test.needsDependencyProbe(d5Context,d5Local),false,'D5/D4 are already in current context: R5 must not launch a redundant planner before delegating to the baseline selector');
assert.equal(Orchestrator._test.needsDependencyProbe(context,{...local,localExpansionApplied:false}),false,'without a local attention extension there is no R5 dependency probe');

const distant=candidate('RELATION_PROPAGATION',[0,0],[[1,3],[0,0]]);
assert.equal(T.localDependencyContinuationCandidate(distant,context,local),false,'recent dependency must not pull attention to a distant target');

const missingDependency=candidate('RELATION_PROPAGATION',[2,2],[[1,4],[2,2]]);
assert.equal(T.localDependencyContinuationCandidate(missingDependency,context,local),false,'an undemonstrated source must not become a continuation');

const rank1=candidate('RELATION_BALANCE',[2,0],[[2,3],[2,4],[2,5],[2,0]],[0,1,1,5,6,1,1]);
assert.equal(T.localDependencyContinuationCandidate(rank1,context,local),false,'R1/multi-premise relation balance must not be promoted by recent-action memory');

const abstract=candidate('LINE_DOMAIN_SUPPORT',[2,2],[[2,3],[2,4],[2,5],[2,2]],[0,1,1,5,6,2,1]);
assert.equal(T.localDependencyContinuationCandidate(abstract,context,local),false,'abstract line-domain support must remain excluded');

const baselineFixture={status:'move',target:[3,4],value:0,deduction:{rule:'TRIPLE_CONSTRAINT'}};
const reused=T.baselineDirectPlan({evaluation:{plans:[baselineFixture],truncated:false,branchBudgetHit:false}});
assert.deepStrictEqual(reused.target,[3,4],'cached direct frontier must preserve the baseline-selected target');
assert.equal(reused.selectionStatus,'human-proof-global-minimum','cached direct frontier must preserve baseline selector status');
assert.equal(reused.candidateCount,1,'cached direct frontier must preserve baseline candidate count');
assert.equal(reused.frontierComplete,true,'cached direct frontier must preserve completeness');

const bridgeSource=fs.readFileSync(runtime('tango-attention-continuity-bridge.js'),'utf8');
const nextStart=bridgeSource.indexOf('function nextPlayedMove('),nextEnd=bridgeSource.indexOf('\n\nroot.QuadludTangoPlayedMovePlanner=',nextStart);
assert.ok(nextStart>=0&&nextEnd>nextStart,'attention bridge nextPlayedMove source must remain structurally identifiable');
const nextSource=bridgeSource.slice(nextStart,nextEnd);
assert.equal(nextSource.includes('contextualDependencyPlan('),false,'baseline attention bridge must not run the specialized recent-dependency planner; R5 owns that probe');
assert.equal((nextSource.match(/directFrontierCandidates\(/g)||[]).length,1,'one Tutor move must build the reusable direct frontier at most once in the attention bridge');
assert.equal(nextSource.includes('baselineDirectPlan(frontierData)'),true,'baseline direct fallback must reuse the already computed frontier instead of replanning it');
assert.equal(typeof T.contextualDependencyPlan,'function','specialized recent-dependency selector must remain exported for R5 orchestration');

global.walkthroughGenerateTangoNext=function baselineGenerate(){return 'baseline'};
assert.equal(Orchestrator.install(),true,'R5 orchestrator must install on the Tango Tutor generation hook');
assert.equal(global.walkthroughGenerateTangoNext.__quadludTutorAttentionOrchestratorR5,true,'installed Tango Tutor hook must carry the R5 marker');

console.log('v319-r3ui-tango-attention-dependency.test.js: PASS — R5 dependency probe single-owner; direct Tutor frontier reused without changing baseline selection');
