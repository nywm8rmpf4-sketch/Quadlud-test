'use strict';
/*
 * QUADLUD — materialized Tutor proof DAG regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const assert=require('assert');
const Dag=require('../tools/tango_materialized_dag.js');

const shared={kind:'RELATION',path:[{a:[0,0],b:[0,1],parity:1,support:{premises:[{kind:'VALUE',cell:[0,0],value:0}]}}]};
const values=[
  {schema:1,rule:'ASSUMPTION_CONTRADICTION',premises:[shared,shared,{kind:'ASSUMPTION',cell:[1,1],value:1}],conclusions:[{type:'VALUE',cell:[2,2],value:0}],explanationData:{trace:[shared,shared],witness:null,valid:true,score:2.5}},
  {schema:1,rule:'LINE_DOMAIN_SUPPORT',premises:[shared],conclusions:[{type:'VALUE',cell:[3,3],value:1}],explanationData:{trace:[shared],label:'same'}}
];
const packed=Dag.pack(values);
assert.strictEqual(packed.schema,1);assert(Dag.validate(packed));assert.strictEqual(packed.roots.length,2);
for(let i=0;i<values.length;i++)assert.strictEqual(JSON.stringify(Dag.decode(packed,i)),JSON.stringify(values[i]),`root ${i} must round-trip byte-for-byte through JSON`);
assert.deepStrictEqual(Dag.pack(values),packed,'packing must be deterministic');
assert(Buffer.byteLength(JSON.stringify(packed))<Buffer.byteLength(JSON.stringify(values)),'shared proof structure must compact');
assert.strictEqual(Dag.decode(packed,-1),null);assert.strictEqual(Dag.decode(packed,packed.roots.length),null);
assert.strictEqual(Dag.validate({...packed,roots:[packed.nodes.length]}),false,'out-of-range root must be rejected');
const badChild=JSON.parse(JSON.stringify(packed));badChild.nodes[badChild.nodes.length-1]=[0,badChild.nodes.length-1];assert.strictEqual(Dag.validate(badChild),false,'self/cyclic node references must be rejected');
assert.throws(()=>Dag.pack([{x:Infinity}]),/finite JSON numbers/);
console.log('v319-r8-materialized-dag.test.js: PASS — deterministic lossless DAG with structural sharing and strict validation');
