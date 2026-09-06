/* QUADLUD HF3.6-B — causal pedagogical proof model regression */
'use strict';
const assert=require('assert');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);
const Model=require(runtime('tango-causal-proof-model.js'));
globalThis.QuadludTangoCausalProofModel=Model;
const Bridge=require(runtime('tango-progressive-proof-bridge.js'));

assert.strictEqual(Model.SCHEMA,'quadlud-pedagogical-proof-v1');
assert.deepStrictEqual([...Model.KINDS],['premise','hypothesis','deduction','contradiction','rollback','conclusion']);

const directDeduction={
  rule:'TRIPLE_CONSTRAINT',rank:0,
  premises:[{kind:'VALUE',cell:[1,1],value:1},{kind:'VALUE',cell:[1,2],value:1}],
  focusCells:[[1,1],[1,2],[1,3]],
  conclusions:[{type:'VALUE',cell:[1,3],value:0}]
};
const direct=Model.fromEntries([{pedagogyStageKind:'action',deduction:directDeduction}]);
assert.strictEqual(direct.complete,true);
assert.deepStrictEqual(direct.steps.map(s=>s.kind),['premise','premise','deduction','conclusion']);
assert.deepStrictEqual(direct.steps.at(-1).cellRoles.conclusionCells,[[1,3]]);
assert.deepStrictEqual(direct.steps.at(-1).producedCells,[[1,3]]);
assert.strictEqual(direct.steps.at(-1).hypothetical,false);

const hypothesis={
  rule:'ASSUMPTION_CONTRADICTION',
  premises:[{kind:'ASSUMPTION',cell:[3,2],value:1,hypothesis:true}],
  focusCells:[[3,2]],conclusions:[]
};
const consequence={
  rule:'RELATION_PROPAGATION',
  premises:[{kind:'ASSUMPTION',cell:[3,2],value:1,hypothesis:true},{kind:'RELATION',a:[3,2],b:[4,2],parity:1}],
  focusCells:[[3,2],[4,2]],conclusions:[{type:'VALUE',cell:[4,2],value:0}]
};
const contradiction={
  rule:'ASSUMPTION_CONTRADICTION',focusCells:[[4,2],[5,2]],
  explanationData:{witness:{cells:[[4,2],[5,2]]}},premises:[],conclusions:[]
};
const conclusion={
  rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'VALUE',cell:[0,2],value:1}],
  focusCells:[[3,2]],conclusions:[{type:'VALUE',cell:[3,2],value:0}]
};
const advancedEntries=[
  {pedagogyStageKind:'hypothesis',deduction:hypothesis},
  {pedagogyStageKind:'reasoning',deduction:consequence},
  {pedagogyStageKind:'contradiction',deduction:contradiction},
  {pedagogyStageKind:'action',deduction:conclusion}
];
const advanced=Model.fromEntries(advancedEntries);
const kinds=advanced.steps.map(s=>s.kind);
assert(kinds.includes('hypothesis'));
assert(kinds.includes('deduction'));
assert(kinds.includes('contradiction'));
assert(kinds.includes('rollback'));
assert(kinds.includes('conclusion'));
assert(kinds.indexOf('hypothesis')<kinds.indexOf('contradiction'));
assert(kinds.indexOf('contradiction')<kinds.indexOf('rollback'));
assert(kinds.indexOf('rollback')<kinds.indexOf('conclusion'));
const h=advanced.steps.find(s=>s.kind==='hypothesis');
const d=advanced.steps.find(s=>s.kind==='deduction');
const c=advanced.steps.find(s=>s.kind==='contradiction');
const final=advanced.steps.find(s=>s.kind==='conclusion');
assert.strictEqual(h.hypothetical,true);
assert.strictEqual(d.hypothetical,true);
assert.strictEqual(c.hypothetical,true);
assert.strictEqual(final.hypothetical,false);
assert.deepStrictEqual(h.cellRoles.hypothesisCells,[[3,2]]);
assert.deepStrictEqual(c.cellRoles.contradictionCells,[[4,2],[5,2]]);
assert.deepStrictEqual(final.cellRoles.conclusionCells,[[3,2]]);
assert.strictEqual(advanced.premises.some(p=>String(p.kind).toUpperCase()==='ASSUMPTION'),false,'hypotheses must not become visible premises');

const attached=Bridge._test.attachCausalProof(advancedEntries);
assert.strictEqual(attached.length,advancedEntries.length);
for(const entry of attached){
  assert(entry.causalProof,'bridge must attach structured causal proof');
  assert(entry.causalStepId,'bridge must map rendered entry to one causal step');
  assert.strictEqual(entry.causalProof.schema,Model.SCHEMA);
}
assert.strictEqual(attached[0].causalProof.steps.some(s=>s.kind==='rollback'),true);
console.log('PASS HF3.6-B causal proof model: semantic roles, hypothetical sequence, rollback and bridge attachment are structured without renderer changes.');
