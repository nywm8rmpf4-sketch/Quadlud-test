#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Planner=require(path.join(ROOT,'GitHub','tango-played-move-planner.js'));

assert.strictEqual(Planner.VERSION,4);
assert.strictEqual(Planner.COST_MODEL,'tango-tutor-ordinal-v2');

// Human pilot regression captured 2026-09-05.
// Minimal visible-state reproduction of the screenshot:
//   C2 = sun
//   C2 × D2  => D2 = moon   (one visible relation edge)
//   D1 × D2  => D1 = sun    (second relation edge)
// Therefore D2 must be proposed before the transitive D1 conclusion.
const state=Array.from({length:6},()=>Array(6).fill(-1));
state[2][1]=1; // C2 = sun
const puzzle={
  n:6,
  state:state.map(row=>row.slice()),
  edges:[
    [2,1,'d','×'], // C2 × D2
    [3,0,'r','×']  // D1 × D2
  ]
};

const session=Planner.sessionFromPublicBoard(puzzle);
const direct=Planner._test.allowedDirectDeductions(session,1).filter(d=>d?.rule==='RELATION_PROPAGATION');
const targetOf=d=>d?.conclusions?.find(c=>c?.type==='VALUE')?.cell;
const valueOf=d=>d?.conclusions?.find(c=>c?.type==='VALUE')?.value;
const d2=direct.find(d=>JSON.stringify(targetOf(d))===JSON.stringify([3,1])&&valueOf(d)===0);
const d1=direct.find(d=>JSON.stringify(targetOf(d))===JSON.stringify([3,0])&&valueOf(d)===1);
assert(d2,'direct one-hop D2=moon deduction must exist');
assert(d1,'transitive two-hop D1=sun deduction must exist');

assert.strictEqual(Planner._test.relationPathLengthForDeduction(session,d2),1,'D2 proof must use one visible relation edge');
assert.strictEqual(Planner._test.relationPathLengthForDeduction(session,d1),2,'D1 proof must use two visible relation edges');

const d2Plan=Planner._test.planFromFirstDeduction(session,1,d2,{maxEngineSteps:24});
const d1Plan=Planner._test.planFromFirstDeduction(session,1,d1,{maxEngineSteps:24});
assert.strictEqual(d2Plan.status,'move');
assert.strictEqual(d1Plan.status,'move');
assert.deepStrictEqual(d2Plan.target,[3,1]);
assert.deepStrictEqual(d1Plan.target,[3,0]);
assert.strictEqual(d2Plan.humanRelationPathLength,1);
assert.strictEqual(d1Plan.humanRelationPathLength,2);

const d2Metrics=Planner._test.planMetrics(d2Plan);
const d1Metrics=Planner._test.planMetrics(d1Plan);
assert.strictEqual(d2Metrics.relationPathLength,1);
assert.strictEqual(d1Metrics.relationPathLength,2);
assert(d2Metrics.premiseCount<d1Metrics.premiseCount,'one-hop D2 must have fewer visible premises than transitive D1');

const selectedA=Planner._test.selectPlans([d1Plan,d2Plan],{frontierComplete:true});
const selectedB=Planner._test.selectPlans([d2Plan,d1Plan],{frontierComplete:true});
assert(selectedA.plan&&selectedB.plan);
assert.deepStrictEqual(selectedA.plan.target,[3,1],'selector must choose direct D2 over transitive D1');
assert.deepStrictEqual(selectedB.plan.target,[3,1],'enumeration order must not change the pedagogical choice');

const selected=Planner.nextPlayedMove(session,'medium',{maxEngineSteps:24,maxCandidatePlans:64});
assert.strictEqual(selected.status,'move');
assert.deepStrictEqual(selected.target,[3,1],'Tutor must recommend D2 before D1 in the human-pilot relation chain');
assert.strictEqual(selected.value,0);
assert.strictEqual(selected.humanRelationPathLength,1);

const mutated=state.map(row=>row.slice());
assert.strictEqual(Planner.applyPlayedMoveToState(mutated,selected),true);
const changed=Planner.stateDiff(state,mutated);
assert.strictEqual(changed.length,1,'Tutor application must still change exactly one visible cell');
assert.deepStrictEqual(changed[0].cell,[3,1]);
assert.strictEqual(changed[0].to,0);

console.log('v319-a13r3-tango-relation-path-cost.test.js: PASS');
