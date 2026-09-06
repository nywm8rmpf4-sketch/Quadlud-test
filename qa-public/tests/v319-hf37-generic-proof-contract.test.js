/* QUADLUD — HF3.7 / ADR-011 proof contract regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
global.lang=()=> 'fr';
global.pieceName=(game,value)=>Number(value)===1?'soleil ☀':'lune ☾';
const runtime=name=>path.join(__dirname,'..','GitHub',name);
const mod=require(runtime('tango-proof-contract-hf37.js'));
{
  const d={rule:'RELATION_BALANCE',premises:[
    {kind:'RELATION',a:[3,2],b:[4,2],parity:0,dependencies:['R1']},
    {kind:'VALUE',cell:[1,2],value:0,dependencies:['B3']},
    {kind:'VALUE',cell:[5,2],value:0,dependencies:['F3']},
    {kind:'VALUE',cell:[3,5],value:1,dependencies:['D6']}
  ],dependencies:['R1','B3','F3','D6'],focusCells:[[3,2],[4,2]],conclusions:[{type:'VALUE',cell:[3,2],value:1},{type:'VALUE',cell:[4,2],value:1}],explanationData:{rejected:{kind:'BALANCE_OVERFLOW',family:'column',id:2,cells:[[0,2],[1,2],[2,2],[3,2],[4,2],[5,2]],value:0}}};
  const reduced=mod._test.reduceWitnessPremises(d);
  const keys=reduced.premises.filter(p=>p.kind==='VALUE').map(p=>p.cell.join(','));
  assert.deepStrictEqual(keys,['1,2','5,2']);
  assert.ok(reduced.premises.some(p=>p.kind==='RELATION'));
  assert.ok(!reduced.dependencies.includes('D6'));
  assert.strictEqual(reduced.proofReduction.contract,'ADR-011');
}
{
  const base={rule:'LINE_DOMAIN_SUPPORT',focusUnits:[{family:'column',id:4}],explanationData:{domainCount:2},premises:[],focusCells:[[0,4],[1,4],[2,4],[3,4],[4,4],[5,4]]};
  const conclusions=[
    {type:'VALUE',cell:[0,4],value:0},
    {type:'RELATION',a:[0,4],b:[5,4],parity:1},
    {type:'RELATION',a:[1,4],b:[2,4],parity:1},
    {type:'RELATION',a:[1,4],b:[3,4],parity:1},
    {type:'RELATION',a:[1,4],b:[4,4],parity:0},
    {type:'RELATION',a:[2,4],b:[4,4],parity:1},
    {type:'RELATION',a:[3,4],b:[4,4],parity:1}
  ];
  const entries=conclusions.map((c,i)=>({target:[0,4],pedagogyStageKind:'reasoning',deduction:{...JSON.parse(JSON.stringify(base)),id:`D15:presentation:${i+1}`,signature:`D15:${i+1}`,conclusions:[c]},presentation:{explanation:{title:'Combined',where:'Look',why:'technical',move:''},action:{conclusions:[c]},metadata:{showTutorMove:false}},beforeSnapshot:{state:Array.from({length:6},()=>Array(6).fill(-1)),tangoDerivedRelations:[]},snapshot:{state:Array.from({length:6},()=>Array(6).fill(-1)),tangoDerivedRelations:[]}}));
  const finalState=Array.from({length:6},()=>Array(6).fill(-1));finalState[0][4]=0;
  const out=mod._test.collapseLineDomainCase({work:{state:finalState,tangoDerivedRelations:[]}},entries);
  assert.strictEqual(out.length,1);
  const e=out[0],d=e.deduction;
  assert.strictEqual(e.pedagogyStageKind,'action');
  assert.deepStrictEqual(d.conclusions,[{type:'VALUE',cell:[0,4],value:0}]);
  assert.deepStrictEqual(e.target,[0,4]);
  assert.match(e.move,/A5\s*=\s*lune/);
  assert.match(e.presentation.explanation.why,/Dans toutes ces possibilités, A5 = lune/);
  assert.match(e.presentation.explanation.why,/Donc A5 = lune/);
  assert.strictEqual(e.presentation.metadata.showTutorMove,true);
  assert.strictEqual(e.presentation.metadata.proofCompleteness,'complete-case-invariant-final-action');
  assert.strictEqual(e.snapshot.state[0][4],0);
}
console.log('PASS HF3.7 ADR-011: causal witness premises and case proof finalAction.');
