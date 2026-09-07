#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Baseline=require(path.join(ROOT,'GitHub','tango-played-move-planner.js'));
const Policy=require(path.join(ROOT,'GitHub','pedagogy-next-move-policy.js'));

assert.strictEqual(Baseline.VERSION,4,'certified planner contract must stay VERSION 4');
global.QuadludTangoPlayedMovePlanner=Baseline;
global.QuadludPedagogyNextMovePolicy=Policy;
require(path.join(ROOT,'GitHub','tango-attention-continuity-bridge.js'));
const Bridge=global.QuadludTangoPlayedMovePlanner;
assert.strictEqual(Bridge.attentionContinuityVersion,9);

// Same public visible-state contract as A13R1: C5=sun is direct, while the
// full engine closure additionally derives downstream B5=moon.
const state=[
  [1,-1,-1,1,0,0],
  [1,-1,-1,0,-1,1],
  [0,1,0,0,-1,1],
  [1,0,1,1,0,0],
  [0,0,1,0,1,1],
  [0,1,0,1,1,0]
];
const puzzle={n:6,state:state.map(row=>row.slice()),edges:[[1,4,'d','×'],[3,1,'r','×'],[3,2,'r','='],[3,1,'d','='],[4,4,'d','=']]};
const session=Baseline.sessionFromPublicBoard(puzzle);
const direct=Baseline._test.allowedDirectDeductions(session,1);
const c5=direct.find(d=>(d.conclusions||[]).some(c=>c.type==='VALUE'&&c.cell?.[0]===2&&c.cell?.[1]===4&&c.value===1));
assert(c5,'C5=sun direct deduction must exist');

const full=Baseline._test.planFromFirstDeduction(session,1,c5,{maxEngineSteps:24});
assert.strictEqual(full.status,'move');
assert(full.engineVisiblePlacements.some(x=>x.cell?.[0]===1&&x.cell?.[1]===4&&x.to===0),'certified baseline exposes downstream B5=moon');

const fast=Bridge._attentionTest.fastDirectPlan(session,1,c5,{maxEngineSteps:24,maxCandidatePlans:128});
assert.strictEqual(fast.status,'move');
assert.deepStrictEqual(fast.target,full.target,'fast Tutor frontier must keep certified target');
assert.strictEqual(fast.value,full.value,'fast Tutor frontier must keep certified value');
assert.deepStrictEqual(Baseline._test.planCostVector(fast),Baseline._test.planCostVector(full),'fast Tutor frontier must keep certified human cost');
assert.strictEqual(fast.__attentionFastDirect,true);
assert.strictEqual(Object.prototype.propertyIsEnumerable.call(fast,'__attentionFastDirect'),false,'internal fast marker must not leak into serialized plan');
const descriptor=Object.getOwnPropertyDescriptor(fast,'engineVisiblePlacements');
assert.strictEqual(typeof descriptor?.get,'function','engine closure metadata must be deferred until selected plan is serialized/read');
const hydrated=fast.engineVisiblePlacements;
assert(hydrated.some(x=>x.cell?.[0]===2&&x.cell?.[1]===4&&x.to===1),'hydrated metadata keeps direct C5=sun');
assert(hydrated.some(x=>x.cell?.[0]===1&&x.cell?.[1]===4&&x.to===0),'hydrated metadata restores downstream B5=moon');
assert.strictEqual(fast.engineVisiblePlacementCount,full.engineVisiblePlacementCount,'hydrated placement count must match certified baseline');

const fastFrontier=Bridge._attentionTest.directFrontierCandidates(session,1,{maxEngineSteps:24,maxCandidatePlans:128});
const baselineEval=Baseline._test.evaluateStartingDeductions(session,1,direct,{maxEngineSteps:24,maxCandidatePlans:128},false);
const baselineSelected=Baseline._test.selectPlans(baselineEval.plans,{frontierComplete:!baselineEval.truncated&&!baselineEval.branchBudgetHit});
const bridgeSelected=Bridge._attentionTest.baselineDirectPlan(fastFrontier);
assert(baselineSelected.plan&&bridgeSelected);
assert.deepStrictEqual(bridgeSelected.target,baselineSelected.plan.target,'fast frontier selection must match certified baseline');
assert.strictEqual(bridgeSelected.value,baselineSelected.plan.value);
assert.deepStrictEqual(bridgeSelected.engineVisiblePlacements,baselineSelected.plan.engineVisiblePlacements,'selected fast plan must serialize with complete certified engine metadata');

const source=fs.readFileSync(path.join(ROOT,'GitHub','tango-attention-continuity-bridge.js'),'utf8');
assert(source.includes("applyDeduction(copy(deduction),{close:false})"),'Tutor bridge must use no-close simulation for direct candidate ranking');
assert(source.includes('deferEngineMetadata'),'Tutor bridge must defer full closure metadata');
assert(source.includes('evaluateDirectStartingDeductions'),'Tutor bridge must own the direct fast frontier');

console.log('v319-r3ui-tango-attention-fast-frontier.test.js: PASS — certified planner unchanged; Tutor ranks direct candidates without closure and hydrates only the selected plan');
