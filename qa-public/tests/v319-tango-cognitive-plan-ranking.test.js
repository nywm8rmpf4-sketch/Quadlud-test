#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Cognitive=require('../../cognitive-cost.js');
const Patterns=require('../../tango-cognitive-patterns.js');
const Bridge=require('../../tango-cognitive-pedagogy-bridge.js');

const value=(cell,v)=>({kind:'VALUE',cell,value:v});
function triple(row,index){return {
  rule:'TRIPLE_CONSTRAINT',signature:`triple-${row}-${index}`,techniqueLevel:1,
  premises:[value([row,0],0),value([row,1],0)],focusCells:[[row,0],[row,1],[row,2]],focusUnits:[{family:'row',id:row}],
  conclusions:[{type:'VALUE',cell:[row,2],value:1}],explanationData:{family:'row',id:row}
}}
const direct={
  rule:'RELATION_PROPAGATION',signature:'direct-equality',techniqueLevel:0,
  premises:[value([2,3],0),{kind:'RELATION',a:[2,3],b:[2,4],parity:0,explicit:true}],focusCells:[[2,3],[2,4]],
  conclusions:[{type:'VALUE',cell:[2,4],value:0}],explanationData:{source:[2,3],target:[2,4],parity:0}
};
const longTrace=Array.from({length:12},(_,i)=>triple(i%6,i));
const longContradiction={
  rule:'ASSUMPTION_CONTRADICTION',signature:'long-contradiction',techniqueLevel:3,
  premises:[{kind:'ASSUMPTION',cell:[0,1],value:1,hypothesis:true}],focusCells:[[0,1]],
  conclusions:[{type:'VALUE',cell:[0,1],value:0}],
  explanationData:{assumption:{cell:[0,1],value:1},causalTrace:longTrace,witness:{kind:'NO_LINE_COMPLETION',family:'row',id:5,cells:[[5,0],[5,1],[5,2],[5,3],[5,4],[5,5]]}}
};

const source={_test:{
  humanProofCost(_session,list){const d=list?.[0];return d?.rule==='ASSUMPTION_CONTRADICTION'?[2,4,2,4,3,3,0]:[0,1,2,2,0,0,0]},
  minimalDisplayDeduction(d){return JSON.parse(JSON.stringify(d))}
}};
const session={directDeductions(){return []}};
const rawSelect=function(_session,plan){return {schema:3,kind:'engine-proof',deduction:plan.deduction,displayDeductions:[plan.deduction],costVector:source._test.humanProofCost(null,[plan.deduction])}};
const shortPlan={status:'move',tierIndex:3,target:[2,4],value:0,deduction:direct,startingDeduction:direct};
const longPlan={status:'move',tierIndex:3,target:[0,1],value:0,deduction:longContradiction,startingDeduction:longContradiction,advancedStart:true};
const scoredShort=Bridge._test.scorePlan(source,session,shortPlan,rawSelect);
const scoredLong=Bridge._test.scorePlan(source,session,longPlan,rawSelect);
assert.strictEqual(scoredShort.displayProof.cognitiveProfile.loadBand,0);
assert.strictEqual(scoredShort.displayProof.cognitiveProfile.depthPenalty,0);
assert.strictEqual(scoredLong.displayProof.cognitiveProfile.loadBand,4);
assert(scoredLong.displayProof.cognitiveProfile.depthPenalty>6);
assert(Cognitive.compareCostVector(scoredShort.cognitiveCostVector,scoredLong.cognitiveCostVector)<0,'direct proof must be cognitively cheaper');
const chosen=Bridge._test.selectLowestCognitivePlan([scoredLong,scoredShort]);
assert.deepStrictEqual(chosen.plan.target,[2,4],'lower cognitive-load proven plan must win independently of enumeration order');

const mediumTrace=[triple(0,0),triple(1,1),triple(2,2),triple(3,3),triple(4,4),triple(5,5)];
const medium={...longContradiction,signature:'medium-contradiction',explanationData:{...longContradiction.explanationData,causalTrace:mediumTrace}};
const p3=Patterns.profileForDeduction(direct),p8=Patterns.profileForDeduction(medium),p14=Patterns.profileForDeduction(longContradiction);
assert(p3.effectiveDepth<p8.effectiveDepth&&p8.effectiveDepth<p14.effectiveDepth,'cognitive depth must reflect proof depth');
assert(p3.depthPenalty<=p8.depthPenalty&&p8.depthPenalty<p14.depthPenalty,'nonlinear penalty must preserve ordering');

console.log('PASS v319-tango-cognitive-plan-ranking',JSON.stringify({direct:scoredShort.cognitiveCostVector,long:scoredLong.cognitiveCostVector,longProfile:scoredLong.displayProof.cognitiveProfile}));
