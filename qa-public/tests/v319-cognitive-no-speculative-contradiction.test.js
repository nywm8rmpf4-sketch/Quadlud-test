'use strict';
const assert=require('assert');
const CognitiveBridge=require('../../tango-cognitive-pedagogy-bridge.js');
let contradictionSearches=0;
global.QuadludTangoHumanCostBridge={_test:{
  causalContradictionCandidate(){contradictionSearches++;return {deduction:{rule:'ASSUMPTION_CONTRADICTION',signature:'forbidden',premises:[],focusCells:[[0,0]],conclusions:[{type:'VALUE',cell:[0,0],value:1}],explanationData:{assumption:{cell:[0,0],value:0},causalTrace:[],witness:{kind:'TEST'}}}}}
}};
const current={rule:'TRIPLE_CONSTRAINT',signature:'triple|0,0=1',premises:[{kind:'VALUE',cell:[0,1],value:0},{kind:'VALUE',cell:[0,2],value:0}],focusCells:[[0,0],[0,1],[0,2]],focusUnits:[{family:'row',id:0}],conclusions:[{type:'VALUE',cell:[0,0],value:1}],explanationData:{family:'row',id:0}};
const source={_test:{humanProofCost(){return [0,1,2,3,1,1,0]},minimalDisplayDeduction:d=>JSON.parse(JSON.stringify(d))}};
const session={directDeductions(){return []}};
const plan={status:'move',tierIndex:3,target:[0,0],value:1,deduction:current,startingDeduction:current};
const proof=CognitiveBridge._test.selectCognitiveProof(source,session,plan,{schema:3,kind:'engine-proof',deduction:current,displayDeductions:[current],costVector:[0,1,2,3,1,1,0]});
assert(proof&&proof.deduction,'proof ranking must keep a demonstrated proof');
assert.strictEqual(proof.deduction.rule,'TRIPLE_CONSTRAINT');
assert.strictEqual(contradictionSearches,0,'proof ranking must not launch a new contradiction search');
console.log('PASS v319-cognitive-no-speculative-contradiction',JSON.stringify({contradictionSearches,rule:proof.deduction.rule}));
