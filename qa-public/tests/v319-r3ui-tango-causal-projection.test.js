/* QUADLUD HF3.6-C1 — causal Tutor projection regression */
'use strict';
const assert=require('assert');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);
const Projection=require(runtime('tango-causal-proof-projection.js'));

const proof={schema:'quadlud-pedagogical-proof-v1',premises:[
  {kind:'VALUE',cell:[1,1],value:1},{kind:'RELATION',a:[1,1],b:[1,2],parity:1}
],steps:[
  {id:'cp1',kind:'hypothesis',hypothetical:true,sequenceIndex:0,producedCells:[],cellRoles:{focusCells:[[3,2]],hypothesisCells:[[3,2]],contradictionCells:[],conclusionCells:[]}},
  {id:'cp2',kind:'deduction',hypothetical:true,sequenceIndex:1,producedCells:[[4,2]],cellRoles:{focusCells:[[3,2],[4,2]],hypothesisCells:[[3,2]],contradictionCells:[],conclusionCells:[]}},
  {id:'cp3',kind:'contradiction',hypothetical:true,sequenceIndex:2,producedCells:[],cellRoles:{focusCells:[[4,2],[5,2]],hypothesisCells:[],contradictionCells:[[4,2],[5,2]],conclusionCells:[]}},
  {id:'cp4',kind:'conclusion',hypothetical:false,sequenceIndex:null,producedCells:[[3,2]],cellRoles:{focusCells:[[3,2]],hypothesisCells:[],contradictionCells:[],conclusionCells:[[3,2]]}}
]};

const hypothesis=Projection.projectionForMove({causalProof:proof,causalStepId:'cp1'});
assert.deepStrictEqual(hypothesis.contextCells,[[1,1],[1,2]]);
assert.deepStrictEqual(hypothesis.hypothesisCells,[[3,2]]);
assert.deepStrictEqual(hypothesis.conclusionCells,[]);
assert.strictEqual(hypothesis.kind,'hypothesis');

const deduction=Projection.projectionForMove({causalProof:proof,causalStepId:'cp2'});
assert.strictEqual(deduction.hypothetical,true);
assert.deepStrictEqual(deduction.hypotheticalMoves,[{cell:[4,2],sequenceIndex:1}]);
assert.deepStrictEqual(deduction.focusCells,[[3,2],[4,2]]);

const contradiction=Projection.projectionForMove({causalProof:proof,causalStepId:'cp3'});
assert.deepStrictEqual(contradiction.contradictionCells,[[4,2],[5,2]]);
assert.deepStrictEqual(contradiction.conclusionCells,[]);

const conclusion=Projection.projectionForMove({causalProof:proof,causalStepId:'cp4'});
assert.strictEqual(conclusion.hypothetical,false);
assert.deepStrictEqual(conclusion.conclusionCells,[[3,2]]);
assert.deepStrictEqual(conclusion.hypotheticalMoves,[]);

const fs=require('fs');
const css=fs.readFileSync(runtime('tango-causal-proof-projection.css'),'utf8');
assert(css.includes('.walkthrough-causal-conclusion'));
assert(css.includes('.walkthrough-causal-hypothesis'));
assert(css.includes('.walkthrough-causal-contradiction'));
assert(css.includes('.walkthrough-hypothetical-badge'));
const html=fs.readFileSync(runtime('index.html'),'utf8');
assert(html.includes('tango-causal-proof-projection.css'));
assert(html.includes('tango-causal-proof-projection.js'));
console.log('PASS HF3.6-C1 causal Tutor projection: context/focus/hypothesis/contradiction/conclusion roles and numbered hypothetical moves are structurally projected.');
