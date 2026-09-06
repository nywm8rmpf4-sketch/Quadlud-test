'use strict';
const assert=require('assert');
require('../../pedagogy-next-move-policy.js');

const simplePlan={status:'move',target:[2,2],value:0,engineStepCount:1,advancedStart:false,deduction:{rule:'TRIPLE',premises:[{cell:[2,1]}],conclusions:[{type:'VALUE',cell:[2,2],value:0}]},proofChain:[{rule:'TRIPLE',premises:[{cell:[2,1]}],conclusions:[{type:'VALUE',cell:[2,2],value:0}]}]};
const elsewherePlan={status:'move',target:[3,5],value:1,engineStepCount:1,advancedStart:false,deduction:{rule:'BALANCE',premises:[{cell:[3,4]}],conclusions:[{type:'VALUE',cell:[3,5],value:1}]},proofChain:[{rule:'BALANCE',premises:[{cell:[3,4]}],conclusions:[{type:'VALUE',cell:[3,5],value:1}]}]};
const complexPlan={status:'move',target:[2,3],value:1,engineStepCount:2,advancedStart:false,deduction:{rule:'RELATION_PROPAGATION',premises:[{cell:[2,1]}],conclusions:[{type:'VALUE',cell:[2,3],value:1}]},proofChain:[{rule:'RELATION',premises:[{cell:[2,1]}]},{rule:'RELATION_PROPAGATION',premises:[{cell:[2,1]}],conclusions:[{type:'VALUE',cell:[2,3],value:1}]}]};

function cost(plan){
  const depth=Math.max(1,plan.proofChain?.length||1);
  return [plan.advancedStart?2:(plan.engineStepCount===1?0:1),Math.max(1,plan.engineStepCount||1),depth,1,2,0,0];
}
function id(plan){return `p:${plan.target.join(':')}`}

global.QuadludTangoPlayedMovePlanner={
  nextPlayedMove(){return {status:'move',target:[5,5],value:0,baseline:true}},
  _test:{
    allowedDirectDeductions(){return [{id:'seed'}]},
    evaluateStartingDeductions(){return {plans:[elsewherePlan,complexPlan,simplePlan],truncated:false,branchBudgetHit:false}},
    buildSelectorCandidates(plans){return plans.map(plan=>({id:id(plan),stableKey:id(plan),plan,blockedBy:[]}))},
    planCostVector:cost
  }
};
require('../../tango-attention-continuity-bridge.js');
const api=global.QuadludTangoPlayedMovePlanner;
const t=api._attentionTest;
assert.strictEqual(api.attentionContinuityVersion,2);

const context=[[2,1]];
function candidate(plan,premiseCells,baseCost=cost(plan)){return {baseCost,target:plan.target,premiseCells,focusCells:[],payload:plan}}
assert.strictEqual(t.simpleDirectContinuationCandidate(candidate(simplePlan,[[2,1]]),context),true,'direct consequence reusing demonstrated premise must be eligible');
assert.strictEqual(t.simpleDirectContinuationCandidate(candidate(simplePlan,[[4,4]]),context),false,'unrelated premise must not gain continuity priority');
assert.strictEqual(t.simpleDirectContinuationCandidate(candidate(simplePlan,[[2,1],[4,4]]),context),false,'new premise must disqualify continuity');
assert.strictEqual(t.simpleDirectContinuationCandidate(candidate(complexPlan,[[2,1]]),context),false,'multi-step reasoning must not be triggered by continuity');
const contradiction={...simplePlan,deduction:{...simplePlan.deduction,rule:'ASSUMPTION_CONTRADICTION'}};
assert.strictEqual(t.simpleDirectContinuationCandidate(candidate(contradiction,[[2,1]]),context),false,'branching contradiction reasoning must not be triggered by continuity');

const selected=t.contextualDirectPlan({},'easy',{},context);
assert(selected,'a simple causal continuation should be found');
assert.deepStrictEqual(selected.target,[2,2],'causal continuation must beat unrelated attention shift');
assert.strictEqual(selected.simpleCausalContinuation,true);
assert.strictEqual(selected.selectionStatus,'PROVEN_MINIMUM_SIMPLE_CAUSAL_CONTINUATION');
assert.strictEqual(selected.causalContinuationCandidateCount,1);

const grouped=t.currentMoveGroup({moves:[
  {target:[0,0],beforeSnapshot:{state:[[ -1 ]]}},
  {target:[1,1],beforeSnapshot:{state:[[ 0 ]]}},
  {target:[1,2],beforeSnapshot:{state:[[ 0 ]]}}
]});
assert.deepStrictEqual(grouped.map(x=>x.target),[[1,1],[1,2]],'continuity context must be limited to the immediately preceding analysis group');

console.log('PASS v319-r3ui-tango-simple-causal-continuity');
