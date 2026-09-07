#!/usr/bin/env node
/* QUADLUD — R5.1b relation-frontier pruning regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);

const relation=(id,a,b,parity=1)=>({id,signature:id,rule:'LINE_DOMAIN_SUPPORT',rank:1,techniqueLevel:2,premises:[],focusCells:[a,b],conclusions:[{type:'RELATION',a:a.slice(),b:b.slice(),parity}]});
const starts=[
  relation('fast-a',[0,0],[0,1]),
  relation('slow-b',[1,0],[1,1]),
  relation('fast-c',[2,0],[2,1])
];
const slowSecond=relation('slow-b-2',[1,1],[1,2]);
const key=(a,b)=>`${a[0]}:${a[1]}|${b[0]}:${b[1]}`;

class FakeSession{
  constructor(source=null){
    this.n=3;this.state=source?source.state.map(r=>r.slice()):Array.from({length:3},()=>Array(3).fill(-1));
    this.dedSeq=source?.dedSeq||0;this.appliedDeductions=(source?.appliedDeductions||[]).map(x=>JSON.parse(JSON.stringify(x)));
    this.relationClosure=new Map(source?[...source.relationClosure].map(([k,v])=>[k,JSON.parse(JSON.stringify(v))]):[]);
    this.relationConflict=null;
  }
  clone(){return new FakeSession(this)}
  diagnose(){return null}
  relationBetween(a,b){return this.relationClosure.get(key(a,b))||this.relationClosure.get(key(b,a))||null}
  addBaseRelation(a,b,parity,meta={}){const fact={a:a.slice(),b:b.slice(),parity:Number(parity),rank:Number(meta.rank)||0};this.relationClosure.set(key(a,b),fact);return fact}
  rebuildRelationClosure(){}
}

let previousCalls=0,pending=false;const hydrated=[];
global.TangoDifficulty={
  nextAllowedDeduction(){return {deduction:{id:'advanced',rule:'ASSUMPTION_CONTRADICTION',rank:3,techniqueLevel:3,conclusions:[{type:'VALUE',cell:[0,0],value:1}]},budgetHit:false}}
};
global.QuadludTangoPlayedMovePlanner={
  VERSION:4,
  nextPlayedMove(){previousCalls++;return {status:'legacy-baseline'}},
  _attentionTest:{
    candidateLimitFor(){return 20},
    tutorRecentContext(){return {recentCells:[[0,0]],pendingConclusions:pending?[{cell:[0,0],value:1}]:[]}}
  },
  _test:{
    allowedDirectDeductions(session){
      if(session.relationClosure.size===0)return starts;
      if(session.relationClosure.has(key([1,0],[1,1]))&&!session.relationClosure.has(key([1,1],[1,2])))return [slowSecond];
      return [];
    },
    planFromFirstDeduction(_session,_tier,deduction){
      hydrated.push(deduction.id);
      if(deduction.id==='slow-b')return {status:'move',target:[1,1],value:1,engineStepCount:3,tierIndex:3,deduction:{id:'full-b',rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[1,1],value:1}]},proofChain:[{id:'full-b-proof'}],startingDeduction:deduction};
      if(deduction.id==='fast-c')return {status:'move',target:[2,2],value:0,engineStepCount:2,tierIndex:3,deduction:{id:'full-c',rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[2,2],value:0}]},proofChain:[{id:'full-c-proof'}],startingDeduction:deduction};
      return {status:'move',target:[0,0],value:1,engineStepCount:2,tierIndex:3,deduction:{id:'full-a',rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:1}]},proofChain:[{id:'full-a-proof'}],startingDeduction:deduction};
    },
    selectPlans(plans,{frontierComplete=true}={}){
      const candidates=plans.map((plan,index)=>({plan,id:`c${index}`})),plan=plans[0]||null;
      return {plan,candidates,selection:{status:frontierComplete?'PROVEN_MINIMUM':'BEST_AVAILABLE_BUDGET_LIMITED',selected:plan?{plan,costVector:[1,plan.engineStepCount,1,1,1,3,3]}:null}};
    }
  }
};

require(runtime('tango-tutor-frontier-pruner-r5.js'));
const P=global.QuadludTangoPlayedMovePlanner,T=P._attentionTest;
assert.strictEqual(P.VERSION,4,'certified planner version must remain unchanged through the wrapper');
assert.strictEqual(P.attentionContinuityVersion,11);
assert.strictEqual(P.relationFrontierPrunerVersion,1);
assert.strictEqual(typeof T.relationChainLowerBound,'function');
assert.strictEqual(typeof T.evaluateRelationFrontier,'function');

const session=new FakeSession();
const selected=P.nextPlayedMove(session,'expert',{});
assert.strictEqual(selected.status,'move');
assert.deepStrictEqual(selected.target,[0,0]);
assert.strictEqual(selected.value,1);
assert.strictEqual(selected.relationFrontierPruned,true);
assert.strictEqual(selected.relationFrontierEstimatedCandidateCount,3);
assert.strictEqual(selected.relationFrontierHydratedCandidateCount,2,'only candidates whose lower bound can tie the proven best may be fully hydrated');
assert.strictEqual(selected.relationFrontierPrunedCandidateCount,1);
assert.strictEqual(selected.relationFrontierMinimumEngineStepCount,2);
assert.deepStrictEqual(hydrated.sort(),['fast-a','fast-c'],'the strictly longer lower-bound branch must never invoke the certified full planner');
assert.strictEqual(previousCalls,0,'successful exact pruning must not restart the v10 baseline path');
assert.deepStrictEqual(selected.proofChain,[{id:'full-a-proof'}],'the returned proof must come from a fully hydrated certified plan, never from the lightweight estimate');

pending=true;
const fallback=P.nextPlayedMove(new FakeSession(),'expert',{});
assert.strictEqual(fallback.status,'legacy-baseline','pending-conclusion Tutor states must bypass relation pruning');
assert.strictEqual(previousCalls,1);

console.log('v319-r3ui-tango-relation-frontier-pruner.test.js: PASS — relation-only Tutor lower bounds prune only provably longer branches; every surviving proof is fully hydrated by planner VERSION 4');
