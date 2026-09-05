#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Runtime=require(path.join(ROOT,'GitHub','tango-played-move-runtime.js'));
const T=Runtime._test;

const target=[1,4],value=0;
const direct={
  schema:1,id:'direct-b5',signature:'RELATION_PROPAGATION|1,4=0',rule:'RELATION_PROPAGATION',
  rank:0,techniqueLevel:0,priority:0,clarity:5,
  premises:[
    {kind:'VALUE',cell:[1,3],value:1,rank:0,source:'board'},
    {kind:'RELATION',a:[1,3],b:[1,4],relation:'OPPOSITE',rank:0,source:'explicit',explicit:true}
  ],
  focusCells:[[1,3],[1,4]],focusRelations:[{a:[1,3],b:[1,4],parity:1,relation:'OPPOSITE'}],focusUnits:[],
  conclusions:[{type:'VALUE',cell:target,value,rank:0}],
  explanationData:{source:[1,3],target:target,sourceValue:1,parity:1,relation:'OPPOSITE'}
};
const unrelated={...direct,id:'other',signature:'RELATION_PROPAGATION|0,0=1',conclusions:[{type:'VALUE',cell:[0,0],value:1}],explanationData:{source:[0,1],target:[0,0],sourceValue:0,parity:1,relation:'OPPOSITE'}};
const lineSupport={
  schema:1,id:'line',signature:'LINE_DOMAIN_SUPPORT|relations',rule:'LINE_DOMAIN_SUPPORT',rank:1,techniqueLevel:2,priority:60,clarity:28,
  premises:[
    {kind:'VALUE',cell:[0,4],value:0},{kind:'VALUE',cell:[5,4],value:1},
    {kind:'RELATION',a:[2,4],b:[3,4],relation:'SAME',explicit:true}
  ],focusCells:[[0,4],[1,4],[2,4],[3,4],[4,4],[5,4]],focusUnits:[{family:'column',id:4}],
  conclusions:[{type:'RELATION',a:[1,4],b:[4,4],parity:0}],explanationData:{family:'column',id:4,quota:3,domainCount:2}
};
const intermediate={
  schema:1,id:'middle',signature:'BALANCE_RELATION|middle',rule:'BALANCE_RELATION',rank:1,techniqueLevel:1,priority:30,clarity:10,
  premises:[{kind:'RELATION',a:[2,4],b:[3,4],relation:'SAME'}],focusCells:[[2,4],[3,4]],focusUnits:[{family:'column',id:4}],conclusions:[{type:'RELATION',a:[1,4],b:[4,4],parity:0}]
};
const downstream={
  schema:1,id:'downstream',signature:'RELATION_PROPAGATION|4,4=0',rule:'RELATION_PROPAGATION',rank:1,techniqueLevel:0,priority:0,clarity:5,
  premises:[{kind:'VALUE',cell:[4,3],value:1},{kind:'RELATION',a:[4,3],b:[4,4],relation:'OPPOSITE'}],focusCells:[[4,3],[4,4]],conclusions:[{type:'VALUE',cell:[4,4],value:0}],explanationData:{source:[4,3],target:[4,4],sourceValue:1,parity:1}
};
const finalComplex={
  schema:1,id:'final',signature:'BALANCE_QUOTA|1,4=0',rule:'BALANCE_QUOTA',rank:1,techniqueLevel:1,priority:20,clarity:8,
  premises:[{kind:'VALUE',cell:[0,4],value:0},{kind:'VALUE',cell:[4,4],value:0},{kind:'VALUE',cell:[5,4],value:1}],focusCells:[[0,4],[1,4],[4,4],[5,4]],focusUnits:[{family:'column',id:4}],conclusions:[{type:'VALUE',cell:target,value,rank:1}],explanationData:{family:'column',id:4,quota:3}
};

const session={
  directDeductions:()=>[unrelated,lineSupport,direct],
  relationBetween:(a,b)=>JSON.stringify(a)===JSON.stringify([1,3])&&JSON.stringify(b)===JSON.stringify([1,4])?{path:[{a:[1,3],b:[1,4],parity:1,explicit:true}]}:null
};
const plan={status:'move',target,value,deduction:finalComplex,proofChain:[lineSupport,intermediate,downstream,finalComplex]};
const original=JSON.parse(JSON.stringify(plan));
const proof=Runtime.selectDisplayProof(session,plan);

assert.strictEqual(Runtime.VERSION,6);
assert.strictEqual(Runtime.HUMAN_PROOF_POLICY,'tango-human-proof-minimal-v3');
assert.strictEqual(proof.replaced,true,'a simpler direct proof must replace the longer engine proof');
assert.strictEqual(proof.kind,'simpler-direct-proof');
assert.strictEqual(proof.displayDeductions.length,1,'only one top-level proof may be displayed for one selected move');
assert.strictEqual(proof.deduction.rule,'RELATION_PROPAGATION');
assert.deepStrictEqual(proof.deduction.conclusions,[{type:'VALUE',cell:target,value,rank:0}]);
assert.strictEqual(proof.traceCollapsed,true,'the engine trace must be recognized as wider than the displayed proof');
assert.strictEqual(proof.discardedAlternativeCount,3,'three non-selected engine proof entries must not become Tutor pages');
assert.deepStrictEqual(plan,original,'proof minimization must not mutate the selected engine plan');
assert(!JSON.stringify(proof).match(/hidden|solution|backtrack/i),'display proof must remain visible-state only');

const transitiveSession={
  directDeductions:()=>[direct],
  relationBetween:()=>({path:[{a:[1,3],b:[1,2],parity:1,explicit:true},{a:[1,2],b:[1,4],parity:0,explicit:true}]})
};
assert.strictEqual(T.relationHumanPathLength(transitiveSession,direct),2);
assert(T.humanProofCost(transitiveSession,[direct])[0]>T.humanProofCost(session,[direct])[0],'two visible relation edges must cost more human steps than one');

const noDirect={directDeductions:()=>[unrelated]};
const single=Runtime.selectDisplayProof(noDirect,{status:'move',target,value,deduction:finalComplex,proofChain:[lineSupport,intermediate,downstream,finalComplex]});
assert.strictEqual(single.replaced,false);
assert.strictEqual(single.deduction.rule,'BALANCE_QUOTA');
assert.strictEqual(single.displayDeductions.length,1,'one engine proof must not expand into alternative proof pages');
assert.strictEqual(single.traceCollapsed,true);
assert.strictEqual(single.discardedAlternativeCount,3);

const neededStep={id:'D2',signature:'TRIPLE_CONSTRAINT|needed',rule:'TRIPLE_CONSTRAINT',premises:[],focusCells:[[2,3],[3,3],[4,3]],conclusions:[{type:'VALUE',cell:[3,3],value:0}]};
const irrelevantStep={id:'D1',signature:'BALANCE_RELATION|irrelevant',rule:'BALANCE_RELATION',premises:[],focusCells:[[0,0],[0,1]],conclusions:[{type:'RELATION',a:[0,0],b:[0,1],parity:1}]};
const contradiction={
  id:'contradiction',signature:'ASSUMPTION_CONTRADICTION|1,4=0',rule:'ASSUMPTION_CONTRADICTION',rank:3,techniqueLevel:3,
  premises:[{kind:'ASSUMPTION',cell:target,value:1,hypothesis:true}],focusCells:[target,[2,3],[3,3],[4,3]],focusUnits:[{family:'column',id:3}],
  conclusions:[{type:'VALUE',cell:target,value}],
  explanationData:{assumption:{cell:target,value:1},witness:{kind:'TRIPLE_OVERFLOW',family:'column',id:3,cells:[[2,3],[3,3],[4,3]]},trace:[irrelevantStep,neededStep],causalTrace:[neededStep]}
};
const advancedPlan={status:'move',target,value,deduction:contradiction,proofChain:[lineSupport,intermediate,contradiction]};
const advancedOriginal=JSON.parse(JSON.stringify(advancedPlan));
const advanced=Runtime.selectDisplayProof({directDeductions:()=>[]},advancedPlan);
assert.strictEqual(advanced.displayDeductions.length,1,'alternative top-level engine proofs must not be listed beside an advanced proof');
assert.strictEqual(advanced.deduction.rule,'ASSUMPTION_CONTRADICTION');
assert.deepStrictEqual(advanced.deduction.explanationData.trace,[neededStep],'display clone must replace broad trace with causalTrace');
assert.deepStrictEqual(advanced.deduction.explanationData.causalTrace,[neededStep]);
assert(!JSON.stringify(advanced.deduction).includes('irrelevant'),'irrelevant exploration step must not leak into displayed proof');
assert.deepStrictEqual(advancedPlan,advancedOriginal,'advanced display minimization must not mutate engine evidence');

console.log('v319-r3ui-tango-same-move-proof-minimization.test.js: PASS');
