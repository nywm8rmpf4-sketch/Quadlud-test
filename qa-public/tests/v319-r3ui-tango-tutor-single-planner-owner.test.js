#!/usr/bin/env node
/* QUADLUD — R5.1b Tutor single-planner ownership regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);

let plannerCalls=0,proofCalls=0;
global.QuadludTangoPlayedMovePlanner={
  nextPlayedMove(){plannerCalls++;return {status:'move',target:[2,2],value:1,tierIndex:3,selectionStatus:'PROVEN_MINIMUM',candidateCount:2,frontierComplete:true,deduction:{id:'d1',signature:'d1',rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[2,2],value:1}]},proofChain:[{id:'p1'}],startingDeduction:{id:'s1',signature:'s1'}}},
  sessionFromPublicBoard(){throw new Error('not used by humanize unit')}
};
global.QuadludTangoPlayedMoveRuntime={
  HUMAN_PROOF_POLICY:'base-policy',
  selectDisplayProof(){throw new Error('fallback display proof must not be needed')},
  _test:{minimalDisplayDeduction:d=>d}
};
global.QuadludTangoHumanPedagogyR4={
  POLICY:'tango-human-proof-minimal-v4',
  _test:{
    proofStagesForDeduction(){return []},
    evaluatePlanHumanProof(_session,plan){proofCalls++;return {plan,displayProof:{kind:'engine-proof',deduction:plan.deduction,costVector:[1,2,3]}}}
  }
};

const Bridge=require(runtime('tango-tutor-single-planner-r5.js'));
assert.strictEqual(Bridge.VERSION,1);
const plan=Bridge._test.humanizeTutorPlan({},'expert');
assert.strictEqual(plannerCalls,1,'Tutor humanization must have exactly one R5 planner owner');
assert.strictEqual(proofCalls,1,'selected move proof must be humanized once after selection');
assert.strictEqual(plan.status,'move');
assert.deepStrictEqual(plan.target,[2,2]);
assert.strictEqual(plan.value,1);
assert.strictEqual(plan.selectionStatus,'PROVEN_MINIMUM');
assert.strictEqual(plan.humanGlobalSelection,false,'Tutor must not claim Coach-style global human selection');
assert.strictEqual(plan.humanCandidateCount,2);
assert.strictEqual(plan.displayProof.kind,'engine-proof');
assert.deepStrictEqual(plan.proofChain,[{id:'p1'}],'certified planner proof chain must survive Tutor humanization');

const bridgeSource=fs.readFileSync(runtime('tango-tutor-single-planner-r5.js'),'utf8');
assert(!bridgeSource.includes('evaluateStartingDeductions('),'Tutor bridge must not rebuild the exhaustive candidate frontier');
assert(!bridgeSource.includes('chooseGloballySimplestPlan('),'Tutor bridge must not call the Coach global selector');
const humanSource=fs.readFileSync(runtime('tango-human-pedagogy-r4.js'),'utf8');
assert(/function installCoach\([\s\S]*?chooseGloballySimplestPlan\(engine,current\?\.diff\)/.test(humanSource),'Coach must retain its global human-proof selection path');

console.log('v319-r3ui-tango-tutor-single-planner-owner.test.js: PASS — Tutor has one R5 planner owner; Coach global selection remains unchanged');
