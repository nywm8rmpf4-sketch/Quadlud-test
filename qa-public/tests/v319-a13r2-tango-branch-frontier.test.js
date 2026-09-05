#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Planner=require(path.join(ROOT,'GitHub','tango-played-move-planner.js'));

// Human pilot regression captured 2026-09-05.
// Visible board before the Tutor preview:
// - C3 = C4 is explicit;
// - C5 is moon;
// therefore the rule-of-three makes C3/C4 = sun directly.
// Because B3 = C3, the engine closure also derives B3 = sun, but that is a
// downstream consequence and must not be preferred over C3/C4.
const state=[
  [-1,-1,-1,-1,1,-1],
  [1,-1,-1,-1,1,-1],
  [-1,-1,-1,-1,0,1],
  [-1,-1,-1,0,1,0],
  [0,0,1,1,0,1],
  [1,-1,-1,1,0,0]
];
const puzzle={
  n:6,
  state:state.map(row=>row.slice()),
  edges:[
    [1,2,'d','='],
    [2,2,'r','='],
    [2,4,'r','×'],
    [2,4,'d','×'],
    [3,3,'d','×'],
    [4,4,'r','×'],
    [5,1,'r','×']
  ]
};

const session=Planner.sessionFromPublicBoard(puzzle);
const direct=Planner._test.allowedDirectDeductions(session,1);
const triple=direct.find(d=>d?.rule==='TRIPLE_CONSTRAINT'&&d?.explanationData?.mode==='RELATION'&&JSON.stringify(d?.explanationData?.window)===JSON.stringify([[2,2],[2,3],[2,4]]));
assert(triple,'expected the direct C3=C4 / C5 rule-of-three relation deduction');

const fork=session.clone();
const before=fork.state.map(row=>row.slice());
const applied=fork.applyDeduction(triple);
assert(applied?.deduction,'the triple deduction must apply');
const trace=Planner._test.traceEntries(applied);
const placements=Planner._test.frontierPlacementsFromApplied(session,1,triple,before,fork.state,trace,[]);
const find=(r,c,v)=>placements.find(p=>p.target?.[0]===r&&p.target?.[1]===c&&p.value===v);
const c3=find(2,2,1),c4=find(2,3,1),b3=find(1,2,1);
assert(c3,'pre-propagation frontier must expose direct C3=sun');
assert(c4,'pre-propagation frontier must expose direct C4=sun');
assert(b3,'pre-propagation frontier may also expose transitive B3=sun');

function asPlan(p){return {status:'move',tierIndex:1,...p,engineStepCount:1,advancedStart:false,startingDeduction:triple};}
const c3Metrics=Planner._test.planMetrics(asPlan(c3));
const b3Metrics=Planner._test.planMetrics(asPlan(b3));
assert(c3Metrics.spatialExtent<b3Metrics.spatialExtent,'direct C3 proof must have a smaller visible proof extent than transitive B3');

const branch=Planner._test.planFromFirstDeduction(session,1,triple,{maxEngineSteps:24});
assert.strictEqual(branch.status,'move');
assert.deepStrictEqual(branch.target,[2,2],'within one causal bundle, the planner must choose C3 before downstream B3');
assert.strictEqual(branch.value,1);
assert.notDeepStrictEqual(branch.target,[1,2]);

const selected=Planner.nextPlayedMove(session,'medium',{maxEngineSteps:48,maxCandidatePlans:128});
assert.strictEqual(selected.status,'move');
assert.deepStrictEqual(selected.target,[2,2],'Tutor must propose the simpler C3 move in the reproduced human-pilot state');
assert.strictEqual(selected.value,1);
assert.notDeepStrictEqual(selected.target,[1,2]);

const mutated=state.map(row=>row.slice());
assert.strictEqual(Planner.applyPlayedMoveToState(mutated,selected),true);
const changed=Planner.stateDiff(state,mutated);
assert.strictEqual(changed.length,1,'Tutor application must still change exactly one visible cell');
assert.deepStrictEqual(changed[0].cell,[2,2]);
assert.strictEqual(changed[0].to,1);

console.log('v319-a13r2-tango-branch-frontier.test.js: PASS');
