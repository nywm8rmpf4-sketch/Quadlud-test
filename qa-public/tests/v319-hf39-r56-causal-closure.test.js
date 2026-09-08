'use strict';
const assert=require('assert');
const fs=require('fs'),pathUtil=require('path');
const R=require('../GitHub/tango-tutor-causal-atomic-r55.js');
const T=R._test;

const A3=[0,2],B3=[1,2];
const opaque={
  rule:'LINE_DOMAIN_SUPPORT',
  premises:[],
  conclusions:[{type:'RELATION',a:A3,b:B3,parity:1}],
  explanationData:{family:'column',id:2,domainCount:2}
};

assert.equal(
  T.lineDomainProofComplete(opaque),
  false,
  'domainCount without the compatible domains is not an accessible proof'
);
assert.equal(
  T.supportProofComplete(opaque),
  false,
  'an opaque LINE_DOMAIN_SUPPORT must never authorize propagation'
);

const selfContained={
  rule:'LINE_DOMAIN_SUPPORT',
  premises:[
    {kind:'VALUE',cell:A3,value:1,hypothesis:true},
    {kind:'VALUE',cell:[5,2],value:1}
  ],
  conclusions:[{type:'RELATION',a:A3,b:B3,parity:1}],
  explanationData:{
    family:'column',id:2,quota:3,domainCount:2,
    domains:[[1,0,1,0,0,1],[1,0,0,1,0,1]]
  }
};
assert.equal(T.lineDomainProofComplete(selfContained),true);
assert.equal(T.supportProofComplete(selfContained),true);

const path=[{a:A3,b:B3,parity:1,explicit:false,support:selfContained}];
const propagation={
  pedagogyStageKind:'reasoning',
  deduction:{
    rule:'RELATION_PROPAGATION',
    premises:[{kind:'VALUE',cell:A3,value:1,hypothesis:true},{kind:'RELATION',a:A3,b:B3,parity:1,path}],
    conclusions:[{type:'VALUE',cell:B3,value:0}],
    explanationData:{source:A3,target:B3,sourceValue:1,parity:1}
  },
  causalStep:{kind:'deduction',hypothetical:true,cellRoles:{premiseCells:[A3]},producedCells:[B3]}
};
const closure=T.planRelationProofs(propagation,new Set());
assert.deepEqual(closure.map(m=>T.deduction(m).rule),['LINE_DOMAIN_SUPPORT','RELATION_PROPAGATION']);
assert.equal(T.isRelationProofMove(closure[0]),true);
assert.equal(T.isRelationProofMove(closure[1]),false);

const available=new Set([T.relationKey(A3,B3,1)]);
assert.deepEqual(T.planRelationProofs(propagation,available).map(m=>T.deduction(m).rule),['RELATION_PROPAGATION']);

const root=pathUtil.resolve(__dirname,'../GitHub'),index=fs.readFileSync(pathUtil.join(root,'index.html'),'utf8'),sw=fs.readFileSync(pathUtil.join(root,'sw.js'),'utf8');
const asset=`tango-tutor-causal-atomic-r55.js?v=${R.TOKEN}`;
assert(index.includes(asset),'iPhone page must request the new causal-closure asset');
assert(sw.includes(`./${asset}`),'service worker must precache that exact asset URL');

console.log('PASS HF3.9-R5.6 causal closure rejects opaque supports and inserts a self-contained relation proof before propagation.');
