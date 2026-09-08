/* QUADLUD — HF3.9-R5.4 Tutor presentation regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const R=require(path.join(__dirname,'..','GitHub','tango-tutor-human-regression-r54.js'));
const empty=()=>Array.from({length:6},()=>Array(6).fill(-1));

const relC2D2={a:[2,1],b:[3,1]};
assert.equal(R._test.relationDistance([0,1],relC2D2),2,'A2 relation distance');
assert.equal(R._test.relationDistance([4,1],relC2D2),1,'E2 relation distance');
assert(R._test.relationDistance([4,1],relC2D2)<R._test.relationDistance([0,1],relC2D2));
const relationBalance={
  rule:'RELATION_BALANCE',rank:0,techniqueLevel:0,
  premises:[{kind:'RELATION',relation:'OPPOSITE',a:[2,1],b:[3,1],explicit:true}],
  conclusions:[{type:'VALUE',cell:[0,1],value:1},{type:'VALUE',cell:[4,1],value:1}]
};
const projectionState=empty(),proofBefore=JSON.stringify(relationBalance);
const projectedPlan=R._test.directRelationBalancePlan(relationBalance,projectionState,3);
assert(projectedPlan,'multi-conclusion relation balance must yield a Tutor projection');
assert.deepStrictEqual(projectedPlan.target,[4,1],'E2 must be the nearest proven conclusion');
assert.equal(projectedPlan.value,1);
assert.equal(projectedPlan.siblingConclusionProjection,true);
assert.equal(projectedPlan.relationLocalityTieBreak,true);
assert.equal(projectedPlan.pendingConclusionContinuation,false);
assert.equal(projectedPlan.recentDependencyContinuation,false);
assert.equal(projectedPlan.localAttentionContinuation,false);
assert.equal(JSON.stringify(relationBalance),proofBefore,'E2 projection must not mutate the certified proof');
assert.deepStrictEqual(projectedPlan.deduction.conclusions,relationBalance.conclusions,'both A2 and E2 conclusions stay in the proof');

const state=empty();state[0][5]=0;
const hyp={pedagogyStageKind:'hypothesis',deduction:{premises:[{kind:'ASSUMPTION',cell:[0,5],value:0,hypothesis:true}],conclusions:[]},causalStep:{id:'cp9',kind:'hypothesis',sequenceIndex:0}};
const a3={pedagogyStageKind:'reasoning',beforeSnapshot:{state},deduction:{conclusions:[{type:'VALUE',cell:[0,2],value:0}]},causalStep:{id:'cp10',kind:'deduction',sequenceIndex:1,premises:[]}};
const a4Step={id:'cp11',kind:'deduction',sequenceIndex:2,premises:[{kind:'RELATION',a:[0,2],b:[0,3],explicit:false,path:[{a:[0,2],b:[0,3],parity:1,explicit:false,support:{premises:[{kind:'RELATION',relation:'SAME',a:[0,3],b:[0,4],explicit:true,path:[{a:[0,3],b:[0,4],parity:0,explicit:true}]}]}}]}],conclusions:[{type:'VALUE',cell:[0,3],value:1}]};
const a4={pedagogyStageKind:'reasoning',beforeSnapshot:{state},deduction:{conclusions:[{type:'VALUE',cell:[0,3],value:1}]},causalStep:a4Step};
const group={entries:[{move:hyp},{move:a3},{move:a4}]};
const before=JSON.stringify(group);
const atA4=R._test.projectedMarkers(group,2);
assert.deepStrictEqual(atA4.map(x=>({cell:x.cell,value:x.value,sequence:x.sequence})),[{cell:[0,4],value:1,sequence:3}]);
assert.equal(JSON.stringify(group),before,'presentation projection must not mutate the proof');

const c3={pedagogyStageKind:'reasoning',beforeSnapshot:{state},deduction:{conclusions:[{type:'VALUE',cell:[2,2],value:1}]},causalStep:{id:'cp12',kind:'deduction',sequenceIndex:3,premises:[]}};
const c4Projection={pedagogyStageKind:'reasoning',beforeSnapshot:{state},deduction:{conclusions:[{type:'VALUE',cell:[2,3],value:0}]},causalStep:{id:'cp13',kind:'deduction',sequenceIndex:4,premises:[{kind:'RELATION',a:[2,2],b:[2,3],parity:1,explicit:true}]}};
const extended={entries:[...group.entries,{move:c3},{move:c4Projection}]};
const projected=R._test.projectedMarkers(extended,4);
assert(!projected.some(x=>x.cell[0]===2&&x.cell[1]===2&&x.value===1),'C3 must not be duplicated as a projected consequence');

const step18={deduction:{rule:'RELATION_BALANCE',focusUnits:[{family:'column',id:3}],focusCells:[[3,3],[4,3],[0,3],[1,3],[2,3],[5,3]],premises:[{kind:'RELATION',relation:'OPPOSITE',a:[3,3],b:[4,3],explicit:true},{kind:'VALUE',cell:[0,3],value:0},{kind:'VALUE',cell:[1,3],value:1},{kind:'VALUE',cell:[2,3],value:0}],conclusions:[{type:'VALUE',cell:[5,3],value:1}]}};
const detail=R._test.relationBalanceDetail(step18,'fr');
assert(detail);
const text=[detail.where,...detail.steps].join(' ').toLowerCase();
for(const token of ['d4','e4','colonne 4','f4','soleil','lune'])assert(text.includes(token),token);
assert(text.includes('2 soleils')&&text.includes('3 lunes'));
assert(text.includes('f4 doit être soleil'));
const english=R._test.relationBalanceDetail(step18,'en');
assert(english);
const englishText=[english.where,...english.steps].join(' ').toLowerCase();
assert(englishText.includes('2 suns')&&englishText.includes('3 moons'),englishText);
assert(!/\b1 moons\b/.test(englishText),englishText);
assert(!/\b3 moon\b(?!s)/.test(englishText),englishText);
console.log('PASS HF3.9-R5.4 Tutor presentation regressions.');
