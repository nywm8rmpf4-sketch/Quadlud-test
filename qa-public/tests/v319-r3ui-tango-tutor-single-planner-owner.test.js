#!/usr/bin/env node
/* QUADLUD — R5.1b Tutor single-planner ownership regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);

const valueDeduction={id:'visible',rule:'RELATION_PROPAGATION',conclusions:[{type:'VALUE',cell:[2,5],value:1}]};
const relationDeduction={id:'relation',rule:'LINE_DOMAIN_SUPPORT',conclusions:[{type:'RELATION',a:[0,0],b:[0,1],parity:1}]};
let plannerCalls=0,globalCalls=0,proofCalls=0;
global.QuadludTangoPlayedMovePlanner={
  nextPlayedMove(){plannerCalls++;return {status:'move',target:[0,0],value:1,tierIndex:3,selectionStatus:'PROVEN_MINIMUM',candidateCount:2,frontierComplete:true,relationFrontierPruned:true,deduction:{id:'deep',signature:'deep',rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:1}]},proofChain:[{id:'p1'}],startingDeduction:relationDeduction}},
  sessionFromPublicBoard(){throw new Error('not used by humanize unit')},
  _test:{allowedDirectDeductions(session){return [session.directVisible?valueDeduction:relationDeduction]}},
  _attentionTest:{directlyPlacesVisibleValue(_session,d){return !!(d.conclusions||[]).some(c=>c.type==='VALUE')}}
};
global.QuadludTangoPlayedMoveRuntime={
  HUMAN_PROOF_POLICY:'base-policy',
  selectDisplayProof(_session,plan){return {kind:'engine-proof',deduction:plan.deduction,costVector:[1,2,3]}},
  _test:{minimalDisplayDeduction:d=>d}
};
global.QuadludTangoHumanPedagogyR4={
  POLICY:'tango-human-proof-minimal-v4',
  chooseGloballySimplestPlan(){globalCalls++;return {status:'move',target:[2,5],value:1,selectionStatus:'human-proof-global-minimum',candidateCount:4,humanCandidateCount:4,humanGlobalSelection:true,deduction:valueDeduction,proofChain:[valueDeduction],displayProof:{kind:'simpler-direct-proof',deduction:valueDeduction,costVector:[1,1,1]}}},
  _test:{
    proofStagesForDeduction(){return []},
    evaluatePlanHumanProof(_session,plan){proofCalls++;return {plan,displayProof:plan.displayProof||{kind:'engine-proof',deduction:plan.deduction,costVector:[1,2,3]}}}
  }
};

const Bridge=require(runtime('tango-tutor-single-planner-r5.js'));
assert.strictEqual(Bridge.VERSION,2);

const direct=Bridge._test.humanizeTutorPlan({directVisible:true},'expert');
assert.strictEqual(globalCalls,1,'direct visible frontier must preserve the validated human-global selector');
assert.strictEqual(plannerCalls,0,'direct visible frontier must not invoke the deep R5 planner first');
assert.deepStrictEqual(direct.target,[2,5]);
assert.strictEqual(direct.selectionStatus,'human-proof-global-minimum');
assert.strictEqual(direct.tutorPlannerMode,'direct-human-global');

const deep=Bridge._test.humanizeTutorPlan({directVisible:false},'expert');
assert.strictEqual(globalCalls,1,'relation-only deep frontier must bypass the exhaustive human-global selector');
assert.strictEqual(plannerCalls,1,'relation-only deep frontier must have exactly one R5 planner owner');
assert.deepStrictEqual(deep.target,[0,0]);
assert.strictEqual(deep.value,1);
assert.strictEqual(deep.selectionStatus,'PROVEN_MINIMUM');
assert.strictEqual(deep.humanGlobalSelection,false,'deep Tutor path must not claim Coach-style global human selection');
assert.strictEqual(deep.tutorPlannerMode,'relation-pruned-single');
assert.deepStrictEqual(deep.proofChain,[{id:'p1'}],'certified planner proof chain must survive Tutor humanization');
assert(proofCalls>=1,'selected move proof must be humanized after selection');

const bridgeSource=fs.readFileSync(runtime('tango-tutor-single-planner-r5.js'),'utf8');
assert(!bridgeSource.includes('evaluateStartingDeductions('),'Tutor bridge must not rebuild the exhaustive candidate frontier itself');
assert(bridgeSource.includes('directVisible!==false'),'legacy human-global selector must be gated by the cheap direct-visible preflight');
const humanSource=fs.readFileSync(runtime('tango-human-pedagogy-r4.js'),'utf8');
assert(/function installCoach\([\s\S]*?chooseGloballySimplestPlan\(engine,current\?\.diff\)/.test(humanSource),'Coach must retain its global human-proof selection path');

console.log('v319-r3ui-tango-tutor-single-planner-owner.test.js: PASS — direct visible Tutor ordering preserved; relation-only deep frontier has one R5 planner owner; Coach unchanged');
