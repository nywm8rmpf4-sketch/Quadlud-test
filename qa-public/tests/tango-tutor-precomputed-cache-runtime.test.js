'use strict';

/*
 * QUADLUD — Soleil-Lune guarded Tutor precomputed cache runtime contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */

const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');

global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
require(path.join(ROOT,'game-contract.js'));
require(path.join(ROOT,'game-manifest.js'));
require(path.join(ROOT,'game-registry.js'));
const DifficultyRating=require(path.join(ROOT,'difficulty-rating.js'));
require(path.join(ROOT,'tango-logic.js'));
require(path.join(ROOT,'tango-difficulty.js'));
require(path.join(ROOT,'tutor-move-selector.js'));
require(path.join(ROOT,'pedagogy-next-move-policy.js'));
const Planner=require(path.join(ROOT,'tango-played-move-planner.js'));
require(path.join(ROOT,'tango-attention-continuity-bridge.js'));
require(path.join(ROOT,'tango-tutor-frontier-pruner-r5.js'));
require(path.join(ROOT,'tango-played-move-runtime.js'));
require(path.join(ROOT,'tango-human-pedagogy-r4.js'));
require(path.join(ROOT,'tango-tutor-single-planner-r5.js'));
require(path.join(ROOT,'generation-common.js'));
const Generator=require(path.join(ROOT,'tango-generator.js'));
const Cache=require(path.join(ROOT,'tango-tutor-precomputed-cache.js'));
const Tutor=global.QuadludTangoTutorSinglePlannerR5;
const Human=global.QuadludTangoHumanPedagogyR4;
const Runtime=global.QuadludTangoPlayedMoveRuntime;
const Common=global.QuadludGenerationCommon;

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function targetIndex(target){return target[0]*6+target[1]}
function selectionMeta(plan){return [plan.selectionStatus||'',Number(plan.candidateCount)||0,Number(plan.humanCandidateCount)||0,plan.humanGlobalSelection?1:0,plan.frontierComplete===false?0:1,plan.displayProof?.kind||'',Array.isArray(plan.displayProof?.costVector)?plan.displayProof.costVector.slice():null,plan.displayProof?.traceCollapsed?1:0]}

const candidate=Common.withSeed('tango-tutor-cache-runtime-contract',()=>Generator.generateTangoPuzzle('easy'));
const puzzle=Generator.publicPuzzleFromCandidate(candidate),state=puzzle.state.map(row=>row.slice());
global.walkthroughSession={base:{game:'tango',diff:'easy'},work:{n:6,state,edges:puzzle.edges},initial:{state:state.map(row=>row.slice())},moves:[],navigation:{}};
const engine=Planner.sessionFromPublicBoard(puzzle,state),original=Tutor._test.humanizeTutorPlan(engine,'easy');
assert.strictEqual(original.status,'move','canonical easy Tutor must produce a move');
assert.strictEqual(original.advancedStart,false,'runtime contract fixture must use a direct starting deduction');
const starting=original.startingDeduction||original.deduction;
assert(starting?.signature,'canonical direct Tutor move must expose a stable starting signature');
const fingerprint=DifficultyRating.fingerprintPublicPuzzle(puzzle),step=[fingerprint,0,targetIndex(original.target),original.value,starting.signature,selectionMeta(original)];
const fakeEntries=Array.from({length:120},(_,index)=>[index,index===0?fingerprint:'',[clone(step)]]);
Cache.clear();Cache.registerShard({schema:2,version:'tango-tutor-cache-r4-lean',difficulty:'easy',entries:fakeEntries});
const cached=Cache.tryPlan(engine,'easy');
assert(cached,'exact visible state must produce a cache hit');
assert.strictEqual(cached.precomputedTutorCache,true,'cache hit marker missing');
assert.deepStrictEqual(cached.target,original.target,'cached reconstruction target mismatch');
assert.strictEqual(cached.value,original.value,'cached reconstruction value mismatch');
const humanized=Tutor._test.attachHumanProof(engine,cached,Human,Runtime,'precomputed-seed');
assert.deepStrictEqual(humanized.displayDeduction||humanized.deduction,original.displayDeduction||original.deduction,'cached reconstruction display deduction mismatch');

assert.strictEqual(Planner.applyPlayedMoveToState(state,original),true,'fixture move could not be applied');
const changedPuzzle={...puzzle,state:state.map(row=>row.slice())},changedEngine=Planner.sessionFromPublicBoard(changedPuzzle,state);
assert.notStrictEqual(DifficultyRating.fingerprintPublicPuzzle(changedPuzzle),fingerprint,'fixture fingerprint did not change');
assert.strictEqual(Cache.tryPlan(changedEngine,'easy'),null,'stale cache seed must not apply after visible-state change');

Cache.clear();
assert.strictEqual(Cache.tryPlan(engine,'easy'),null,'cache miss must be safe when no shard is registered');
console.log('tango-tutor-precomputed-cache-runtime.test.js: OK');
