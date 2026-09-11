'use strict';
const assert=require('assert'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js',
  'tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js','tango-played-move-runtime.js','tango-human-cost-bridge.js',
  'cognitive-cost.js','tango-cognitive-patterns.js','tango-cognitive-pedagogy-bridge.js','tango-human-pedagogy-r4.js',
  'tango-cognitive-proof-stages-bridge.js','tango-direct-visible-priority-bridge.js'
])require(path.join(ROOT,file));
const P=global.QuadludTangoPlayedMovePlanner,H=global.QuadludTangoHumanPedagogyR4,A=P._attentionTest||{};
const state=[[0,-1,-1,-1,-1,-1],[1,-1,-1,-1,-1,-1],[1,-1,-1,-1,-1,-1],[0,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1]],Pool=require(path.join(ROOT,'tango-runtime-pool-data.js')),entry=Pool.pools.expert[0],edges=entry.edges.map(e=>e.slice());
const session=P.sessionFromPublicBoard({game:'tango',n:6,state:state.map(r=>r.slice()),edges},state),tier=P.tierIndexForDifficulty('expert'),starts=P._test.allowedDirectDeductions(session,tier);
function cheapPlan(first){
  const fork=session.clone(),proof=[];let deduction=copy(first);
  for(let step=1;step<=24;step++){
    const visible=A.visibleValueConclusion(fork,deduction);
    if(visible)return {status:'move',tierIndex:tier,target:visible.target,value:visible.value,deduction:copy(deduction),proofChain:[...proof,copy(deduction)],engineStepCount:step,advancedStart:false,startingDeduction:copy(first),relationLightweight:true};
    if(!A.relationOnlyDeduction(deduction)||!A.lightApplyRelationDeduction(fork,deduction))return null;
    const applied=fork.appliedDeductions?.[fork.appliedDeductions.length-1]||deduction;proof.push(copy(applied));
    const direct=P._test.allowedDirectDeductions(fork,tier)||[];
    if(!direct.length)return null;
    deduction=copy(direct.find(d=>A.visibleValueConclusion(fork,d))||direct.find(d=>A.relationOnlyDeduction(d))||direct[0]);
  }
  return null;
}
const t0=performance.now(),plans=starts.map(cheapPlan).filter(Boolean),planningMs=performance.now()-t0;
assert(plans.length>0,'lightweight relation planner must produce a move');
const scored=plans.map(plan=>H._test.evaluatePlanHumanProof(session,plan)).filter(Boolean).sort(H._test.compareHumanCandidate),chosen=scored[0],totalMs=performance.now()-t0;
assert(chosen?.plan?.status==='move');
assert(planningMs<1000,`light relation planning too slow: ${planningMs.toFixed(1)} ms`);
assert(totalMs<1500,`light relation planning+scoring too slow: ${totalMs.toFixed(1)} ms`);
assert(!JSON.stringify(chosen.displayProof||{}).match(/hiddenSolution|current\.sol|backtrack/i),'display proof must stay visible-state only');
console.log('PASS v319-r8-relation-lightweight-planner',JSON.stringify({planningMs:Number(planningMs.toFixed(3)),totalMs:Number(totalMs.toFixed(3)),starts:starts.length,plans:plans.length,target:chosen.plan.target,value:chosen.plan.value,rule:(chosen.plan.startingDeduction||chosen.plan.deduction)?.rule,engineSteps:chosen.plan.engineStepCount,cost:chosen.cost,proofRule:chosen.displayProof?.deduction?.rule||null}));
