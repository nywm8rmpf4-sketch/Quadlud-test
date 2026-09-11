#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — cognitive proof selection must retain the engine-demonstrated proof
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const assert=require('assert');
const Bridge=require('../../tango-cognitive-pedagogy-bridge.js');

const value=(cell,v)=>({kind:'VALUE',cell,value:v});
const target=[0,0],answer=1;
const engine={
  rule:'LINE_DOMAIN_SUPPORT',signature:'engine-line-domain',techniqueLevel:2,
  premises:[value([0,1],0),value([0,2],1)],focusCells:[[0,0],[0,1],[0,2]],focusUnits:[{family:'row',id:0}],
  conclusions:[{type:'VALUE',cell:target,value:answer}],explanationData:{family:'row',id:0}
};
function traceStep(i){const row=i%6;return {
  rule:'RELATION_CLOSURE',signature:`closure-${i}`,techniqueLevel:2,
  premises:[{kind:'RELATION',a:[row,0],b:[row,1],parity:i%2}],focusCells:[[row,0],[row,1]],focusUnits:[{family:'row',id:row}],
  conclusions:[{type:'RELATION',a:[row,0],b:[row,1],parity:i%2}],explanationData:{family:'row',id:row}
}}
const huge={
  rule:'ASSUMPTION_CONTRADICTION',signature:'legacy-huge-contradiction',techniqueLevel:3,
  premises:[{kind:'ASSUMPTION',cell:target,value:0,hypothesis:true}],focusCells:[target],
  conclusions:[{type:'VALUE',cell:target,value:answer}],
  explanationData:{assumption:{cell:target,value:0},causalTrace:Array.from({length:40},(_,i)=>traceStep(i)),witness:{kind:'NO_LINE_COMPLETION',family:'row',id:5,cells:Array.from({length:6},(_,c)=>[5,c])}}
};
const source={_test:{
  minimalDisplayDeduction(d){return JSON.parse(JSON.stringify(d))},
  humanProofCost(_session,list){return list?.[0]?.rule==='ASSUMPTION_CONTRADICTION'?[2,5,4,6,3,3,0]:[1,2,2,3,2,1,1]}
}};
const session={directDeductions(){return []}};
const plan={status:'move',tierIndex:3,target,value:answer,deduction:engine,startingDeduction:engine};
const rawProof={schema:3,kind:'concrete-contradiction',deduction:huge,displayDeductions:[huge],replaced:true,replacedRule:'LINE_DOMAIN_SUPPORT',costVector:[2,5,4,6,3,3,0]};
const selected=Bridge._test.selectCognitiveProof(source,session,plan,rawProof);
assert.strictEqual(selected.deduction.signature,'engine-line-domain','engine-demonstrated proof must remain eligible against legacy replacement');
assert.strictEqual(selected.cognitiveProfile.loadBand,0,'short engine proof must be ordinary human-sized');
assert(selected.replaced,'selection should record replacement of the legacy displayed contradiction');
assert.notStrictEqual(selected.kind,'concrete-contradiction','huge legacy contradiction must not survive cognitive ranking');

const shortDirect={...engine,rule:'RELATION_PROPAGATION',signature:'shorter-direct',techniqueLevel:0,premises:[value([0,1],1),{kind:'RELATION',a:[0,1],b:target,parity:0,explicit:true}],explanationData:{source:[0,1],target,parity:0}};
const sessionWithDirect={directDeductions(){return [shortDirect]}};
const selectedDirect=Bridge._test.selectCognitiveProof(source,sessionWithDirect,plan,{schema:3,kind:'engine-proof',deduction:engine,displayDeductions:[engine],costVector:[1,2,2,3,2,1,1]});
assert.strictEqual(selectedDirect.deduction.signature,'shorter-direct','a genuinely simpler direct visible proof must still replace the engine proof');
console.log('PASS v319-cognitive-engine-proof-retention',JSON.stringify({legacyBand:Bridge._test.cognitiveEvidence(source,session,huge).cognitiveProfile.loadBand,selected:selected.deduction.signature,direct:selectedDirect.deduction.signature}));
