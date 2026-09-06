'use strict';
const assert=require('assert');
const Bridge=require('../GitHub/tango-human-cost-bridge.js');

const source={_test:{
  humanProofCost(_session,list){
    const d=list?.[0];
    if(d?.rule==='TRIPLE_CONSTRAINT')return [1,2,3,1,1,0];
    if(d?.rule==='RELATION_PROPAGATION')return [1,2,2,0,0,0];
    return [1,1,1,0,0,0]
  },
  compareCostVector(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const x=Number(a[i])||0,y=Number(b[i])||0;if(x!==y)return x-y}return 0},
  minimalDisplayDeduction(d){return JSON.parse(JSON.stringify(d))}
}};
const relationProof={rule:'RELATION_PROPAGATION',signature:'relation',premises:[{kind:'VALUE',cell:[0,0],value:0},{kind:'RELATION',a:[0,0],b:[0,2],parity:1,explicit:false}],focusCells:[[0,0],[0,2]],conclusions:[{type:'VALUE',cell:[0,2],value:1}],explanationData:{source:[0,0],target:[0,2],sourceValue:0,parity:1}};
const tripleProof={rule:'TRIPLE_CONSTRAINT',signature:'triple',premises:[{kind:'VALUE',cell:[0,0],value:0},{kind:'VALUE',cell:[0,1],value:0}],focusCells:[[0,0],[0,1],[0,2]],conclusions:[{type:'VALUE',cell:[0,2],value:1}],explanationData:{family:'row',id:0,mode:'VALUE',target:[0,2]}};
const session={
  relationBetween(){return {a:[0,0],b:[0,2],parity:1,explicit:false,path:[{a:[0,0],b:[0,2],parity:1,explicit:false}]}},
  directDeductions(){return [relationProof,tripleProof]}
};
assert.strictEqual(Bridge._test.relationDerivedSupportPenalty(session,relationProof),1);
assert.deepStrictEqual(Bridge._test.relationAwareHumanProofCost(source,session,relationProof),[2,3,2,0,0,1]);
const corrected=Bridge._test.correctedProof(source,session,{status:'move',target:[0,2],value:1},{schema:3,kind:'engine-proof',deduction:relationProof,displayDeductions:[relationProof],replaced:false});
assert.strictEqual(corrected.kind,'simpler-self-contained-direct-proof');
assert.strictEqual(corrected.deduction.rule,'TRIPLE_CONSTRAINT');
assert.deepStrictEqual(corrected.costVector,[1,2,3,1,1,0]);

const producer={id:'D7',rule:'TRIPLE_CONSTRAINT',conclusions:[{type:'RELATION',a:[0,0],b:[0,2],parity:1}]};
const sessionWithEvidence={
  relationFacts:new Map([['edge',{a:[0,0],b:[0,2],parity:1,explicit:false,source:'derived',deductionId:'D7',dependencies:['D7']}]]),
  appliedDeductions:[producer]
};
const enriched=Bridge._test.enrichedRelationPath(sessionWithEvidence,[{a:[0,0],b:[0,2],parity:1,explicit:false}]);
assert.strictEqual(enriched[0].deductionId,'D7');
assert.strictEqual(enriched[0].support.rule,'TRIPLE_CONSTRAINT');
assert.deepStrictEqual(enriched[0].support.conclusions,producer.conclusions);

console.log('v319-r3ui-tango-derived-relation-human-cost.test.js: PASS');
