/* QUADLUD — ADR-018 cognitive conclusion batch regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const Batch=require(path.join(__dirname,'..','GitHub','pedagogy-conclusion-batch.js'));
globalThis.QuadludPedagogyConclusionBatch=Batch;
const R6=require(path.join(__dirname,'..','GitHub','tango-tutor-conclusion-batch-r6.js'));

assert.equal(Batch.VERSION,1);
const generic=Batch.create({sourceKey:'proof:C2xD2',items:[{key:'A2',target:[0,1],value:1},{key:'E2',target:[4,1],value:1}],primaryKey:'E2'});
assert.deepStrictEqual(generic.items.map(x=>x.key),['E2','A2']);
assert.deepStrictEqual(Batch.labels(3,1),['3']);
assert.deepStrictEqual(Batch.labels(3,2),['3.1','3.2']);
assert.equal(Batch.label(4,1,3),'4.2');

const before=Array.from({length:6},()=>Array(6).fill(-1));
const after=before.map(row=>row.slice());after[4][1]=1;
const deduction={id:'d-e2-a2',rule:'RELATION_BALANCE',premises:[{kind:'RELATION',relation:'OPPOSITE',a:[2,1],b:[3,1],explicit:true}],conclusions:[{type:'VALUE',cell:[0,1],value:1},{type:'VALUE',cell:[4,1],value:1}]};
const action={pedagogyStageKind:'action',target:[4,1],beforeSnapshot:{state:before},snapshot:{state:after},deduction};
const tangoBatch=R6._test.conclusionBatchFromAction(action);
assert(tangoBatch);
assert.deepStrictEqual(tangoBatch.batch.items.map(x=>({target:x.target,value:x.value})),[{target:[4,1],value:1},{target:[0,1],value:1}]);
assert.equal(tangoBatch.batch.metadata.zeroMarginalCognitiveCost,true);

const monoAfter=before.map(row=>row.slice());monoAfter[1][1]=0;
const mono=R6._test.conclusionBatchFromAction({pedagogyStageKind:'action',target:[1,1],beforeSnapshot:{state:before},snapshot:{state:monoAfter},deduction:{id:'mono',rule:'DIRECT',conclusions:[{type:'VALUE',cell:[1,1],value:0}]}});
assert.equal(mono,null);

const proof={steps:[{id:'cp3',kind:'deduction',hypothetical:true,sequenceIndex:3,producedCells:[[0,2],[0,3]]}]};
const hierarchy=R6._test.hierarchyItems({entries:[{move:{causalProof:proof,causalStepId:'cp3'}}]},0);
assert.equal(hierarchy.get(3).length,2);
assert.deepStrictEqual(hierarchy.get(3).map((_,i)=>Batch.label(3,i,hierarchy.get(3).length)),['3.1','3.2']);
console.log('PASS ADR-018 cognitive conclusion batches: selected-first ordering, zero-cost metadata, mono/multi distinction and x.y hypothesis labels.');
