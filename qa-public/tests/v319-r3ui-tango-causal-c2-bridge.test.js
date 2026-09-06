/* QUADLUD HF3.6-C2 — causal Coach projection + rollback navigation regression */
'use strict';
const assert=require('assert');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);
globalThis.QuadludTangoCausalProofModel=require(runtime('tango-causal-proof-model.js'));
globalThis.QuadludTangoCausalProofProjection=require(runtime('tango-causal-proof-projection.js'));
const Bridge=require(runtime('tango-causal-proof-c2-bridge.js'));

const hypothesis={rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:[3,2],value:1,hypothesis:true}],focusCells:[[3,2]],conclusions:[]};
const consequence={rule:'RELATION_PROPAGATION',premises:[{kind:'ASSUMPTION',cell:[3,2],value:1,hypothesis:true}],focusCells:[[3,2],[4,2]],conclusions:[{type:'VALUE',cell:[4,2],value:0}]};
const contradiction={rule:'ASSUMPTION_CONTRADICTION',premises:[],focusCells:[[4,2],[5,2]],explanationData:{witness:{cells:[[4,2],[5,2]]}},conclusions:[]};
const conclusion={rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'VALUE',cell:[0,2],value:1}],focusCells:[[3,2]],conclusions:[{type:'VALUE',cell:[3,2],value:0}]};
const stages=[
  {kind:'hypothesis',deduction:hypothesis},
  {kind:'reasoning',deduction:consequence},
  {kind:'contradiction',deduction:contradiction},
  {kind:'action',deduction:conclusion}
];
const flow={kind:'tango-proof',proofChain:[]};
const first=Bridge.coachProjection(flow,conclusion,false,stages);
assert(first,'Coach causal projection must exist');
assert.strictEqual(first.step.kind,'hypothesis');
assert.deepStrictEqual(first.projection.hypothesisCells,[[3,2]]);
assert.deepStrictEqual(first.projection.conclusionCells,[]);
const reveal=Bridge.coachProjection(flow,conclusion,true,stages);
assert.strictEqual(reveal.step.kind,'conclusion');
assert.deepStrictEqual(reveal.projection.conclusionCells,[[3,2]]);
assert.strictEqual(reveal.projection.hypothetical,false);

const proof=globalThis.QuadludTangoCausalProofModel.fromEntries(stages.map(x=>({pedagogyStageKind:x.kind,deduction:x.deduction})));
const rollback=proof.steps.find(x=>x.kind==='rollback');
const final=proof.steps.find(x=>x.kind==='conclusion');
assert(rollback&&rollback.synthetic===true,'model must expose a synthetic rollback');
const before=[[0,-1],[-1,1]],after=[[0,-1],[0,1]];
const session={base:{game:'tango'},moves:[{pedagogyStageKind:'action',causalProof:proof,causalStepId:final.id,move:'play',target:[1,0],beforeSnapshot:before,proofSnapshot:after,snapshot:after,presentation:{metadata:{showTutorMove:true},explanation:{move:'play'},action:{conclusions:[{type:'VALUE',cell:[1,0],value:0}]}}}],done:true,total:1};
const inserted=Bridge.injectRollbackEntries(session,0);
assert.strictEqual(inserted,1);
assert.strictEqual(session.moves.length,2);
assert.strictEqual(session.moves[0].pedagogyStageKind,'rollback');
assert.strictEqual(session.moves[0].causalStepId,rollback.id);
assert.strictEqual(session.moves[0].move,'');
assert.strictEqual(session.moves[0].target,null);
assert.deepStrictEqual(session.moves[0].snapshot,before);
assert.strictEqual(session.moves[0].presentation.metadata.showTutorMove,false);
assert.strictEqual(session.moves[1].causalStepId,final.id);
assert.strictEqual(session.total,2);
assert.strictEqual(Bridge.injectRollbackEntries(session,0),0,'rollback injection must be idempotent');

const fs=require('fs');
const css=fs.readFileSync(runtime('tango-causal-proof-projection.css'),'utf8');
for(const cls of ['.hint-causal-context','.hint-causal-focus','.hint-causal-hypothesis','.hint-causal-contradiction','.hint-causal-conclusion','.hint-hypothetical-badge'])assert(css.includes(cls),`missing Coach causal CSS ${cls}`);
const html=fs.readFileSync(runtime('index.html'),'utf8');
assert(html.includes('tango-causal-proof-c2-bridge.js'));
console.log('PASS HF3.6-C2 causal Coach projection and explicit Tutor rollback navigation.');
