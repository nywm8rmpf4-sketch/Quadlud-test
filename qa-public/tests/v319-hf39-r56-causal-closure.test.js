'use strict';
const assert=require('assert');
const fs=require('fs'),pathUtil=require('path');
globalThis.QuadludTangoCausalProofModel=require('../GitHub/tango-causal-proof-model.js');
globalThis.QuadludTangoTutorClarity=require('../GitHub/tango-tutor-clarity.js');
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
const hypothesis={pedagogyStageKind:'hypothesis',deduction:{rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:A3,value:1,hypothesis:true}],conclusions:[]}};
const attached=T.attachCausalProof([hypothesis,...closure]),proofSteps=attached.map(m=>m.causalProof.steps.find(s=>s.id===m.causalStepId));
assert.deepEqual(proofSteps.map(s=>s.sequenceIndex),[0,0,1],'relation proof screen must not consume a numbered move badge');

const available=new Set([T.relationKey(A3,B3,1)]);
assert.deepEqual(T.planRelationProofs(propagation,available).map(m=>T.deduction(m).rule),['RELATION_PROPAGATION']);

assert.equal(T.supportProofComplete(selfContained,5),true,'valid nested support must remain inspectable beyond the former arbitrary depth four');
const domainProofText=T.relationProofText(selfContained);
assert(domainProofText.why.includes('Compatible configurations'),'line-domain proof must expose the exact compatible domains');
assert(!domainProofText.why.includes('Given ,'),'line-domain proof must never omit all premises');

const tripleSupport={
  rule:'TRIPLE_CONSTRAINT',
  premises:[{kind:'RELATION',a:[1,3],b:[1,4],parity:0,explicit:true,path:[{a:[1,3],b:[1,4],parity:0,explicit:true}]}],
  conclusions:[{type:'RELATION',a:[1,5],b:[1,3],parity:1}],
  explanationData:{family:'row',id:1,mode:'RELATION',pair:[[1,3],[1,4]],target:[1,5],window:[[1,3],[1,4],[1,5]]}
};
const tripleProofText=T.relationProofText(tripleSupport);
assert(!tripleProofText.why.includes('Avec ,'),'triple relation proof must not be formatted as an empty domain proof');
assert(tripleProofText.why.includes('B4')&&tripleProofText.why.includes('B5')&&tripleProofText.why.includes('B6'),'triple relation proof must expose its visible pair and target');

const tripleValue={rule:'TRIPLE_CONSTRAINT',premises:[{kind:'VALUE',cell:[5,0],value:1},{kind:'VALUE',cell:[5,1],value:1}],conclusions:[{type:'VALUE',cell:[5,2],value:0}],focusUnits:[{family:'row',id:5}],explanationData:{family:'row',id:5,mode:'VALUE',pair:[[5,0],[5,1]],target:[5,2]}};
const tripleAtomic=T.atomicText({rule:'TRIPLE_CONSTRAINT',deduction:tripleValue,current:{cell:[5,2],value:0},dependency:null});
assert(tripleAtomic.why.includes('F1')&&tripleAtomic.why.includes('F2')&&tripleAtomic.why.includes('F3'),'atomic triple explanation must name every causal cell');
assert(!tripleAtomic.why.includes('Using these premises'),'atomic triple explanation must state the actual rule implication');

const exactAtomicMove={causalAtomicRelationHop:true,deduction:{rule:'RELATION_PROPAGATION',premises:[{kind:'VALUE',cell:[1,5],value:1},{kind:'RELATION',a:[1,5],b:[1,3],parity:1,path:[{a:[1,5],b:[1,3],parity:1,explicit:false,support:tripleSupport}]}],conclusions:[{type:'VALUE',cell:[1,3],value:0}],explanationData:{source:[1,5],target:[1,3],sourceValue:1,parity:1,causalAtomicRelationHop:true}}};
const exactDisplay=T.atomicHopDisplay(exactAtomicMove);
assert.deepEqual(exactDisplay.dependency,{cell:[1,5],value:1},'atomic display must use its own exact source fact');
assert.deepEqual(exactDisplay.current,{cell:[1,3],value:0},'atomic display must use its own exact conclusion');

const priorClosedBranch=[
  {pedagogyStageKind:'hypothesis',deduction:{rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:[1,5],value:1,hypothesis:true}],conclusions:[]}},
  {pedagogyStageKind:'reasoning',deduction:{rule:'RELATION_PROPAGATION',conclusions:[{type:'VALUE',cell:[1,5],value:1}]}},
  {pedagogyStageKind:'rollback',deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[]}},
  {pedagogyStageKind:'action',deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:0}]}}
];
const stableFacts=T.knownValuesBefore(priorClosedBranch);
assert(!stableFacts.has('1,5'),'rolled-back hypothetical values must not leak into the next proof');
assert.equal(stableFacts.get('0,0'),0,'the real post-rollback action must remain pedagogically available');

const root=pathUtil.resolve(__dirname,'../GitHub'),index=fs.readFileSync(pathUtil.join(root,'index.html'),'utf8'),sw=fs.readFileSync(pathUtil.join(root,'sw.js'),'utf8');
const asset=`tango-tutor-causal-atomic-r55.js?v=${R.TOKEN}`;
assert.equal(R.VERSION,17,'causal closure runtime must restore the final semantic stabilizer owner');
assert(index.includes(asset),'iPhone page must request the new causal-closure asset');
assert(sw.includes(`./${asset}`),'service worker must precache that exact asset URL');
const inner=function(){},outer=function(){};inner.__quadludTutorCausalAtomicR55=true;outer.__quadludPrevious=inner;
assert.equal(T.chainHas(outer,'__quadludTutorCausalAtomicR55'),true,'wrapper ownership must be detected below the final stabilizer');
const source=fs.readFileSync(pathUtil.join(root,'tango-tutor-causal-atomic-r55.js'),'utf8');
assert(source.includes('restoreFinalSemanticStabilizer()'),'R5.6 must restore R4 after installing its late wrappers');

console.log('PASS HF3.9-R5.6 causal closure rejects opaque supports and inserts a self-contained relation proof before propagation.');
