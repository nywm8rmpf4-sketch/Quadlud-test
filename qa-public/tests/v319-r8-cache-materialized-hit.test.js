#!/usr/bin/env node
/* QUADLUD — exact materialized Tutor cache hit regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub'),repo=path.resolve(__dirname,'../..'),WEB=fs.existsSync(path.join(candidate,'tango-tutor-precomputed-cache.js'))?candidate:repo;
const Cache=require(path.join(WEB,'tango-tutor-precomputed-cache.js'));
const Tutor=require(path.join(WEB,'tango-tutor-single-planner-r5.js'));
const source=fs.readFileSync(path.join(WEB,'tango-tutor-precomputed-cache.js'),'utf8');
assert(!source.includes('planFromFirstDeduction'),'cache-hit runtime must not re-run targeted played-move planning');
const state=Array.from({length:6},()=>Array(6).fill(-1)),session={state};
const starting={rule:'RELATION_PROPAGATION',signature:'RELATION_PROPAGATION|synthetic',conclusions:[{type:'RELATION',a:[0,0],b:[0,1],same:true}]};
const display={rule:'LINE_DOMAIN_SUPPORT',signature:'LINE_DOMAIN_SUPPORT|synthetic',conclusions:[{type:'VALUE',cell:[1,1],value:0}]};
const proof={kind:'engine-proof',deduction:display,cognitiveModel:'quadlud-cognitive-load-v1',cognitivePatternCatalog:'tango-cognitive-patterns-v1'};
const selection={selectionStatus:'synthetic-cache',candidateCount:2,humanCandidateCount:2,humanGlobalSelection:false,frontierComplete:true,budgetHit:false,cognitiveCandidateCount:2,cognitiveGlobalSelection:true,cognitiveCostVector:[1,2,3]};
const plan=Cache._test.materializedPlan(session,'hard',starting,[1,1],0,false,display,proof,selection,'synthetic-fingerprint');
assert(plan&&plan.status==='move');assert.deepStrictEqual(plan.target,[1,1]);assert.strictEqual(plan.value,0);assert.strictEqual(plan.startingDeduction.signature,starting.signature);assert.deepStrictEqual(plan.displayDeduction,display);
assert.strictEqual(Cache._test.materializedPlan(session,'hard',starting,[1,2],0,false,display,proof,selection,'bad'),null,'display proof must visibly conclude cached target/value');
let humanSearch=0,runtimeSearch=0;
const H={_test:{evaluatePlanHumanProof(){humanSearch++;throw new Error('must not run')}}};
const R={selectDisplayProof(){runtimeSearch++;throw new Error('must not run')},_test:{minimalDisplayDeduction(){throw new Error('must not run')}}};
const attached=Tutor._test.attachHumanProof(session,plan,H,R,'precomputed-guarded');
assert(attached&&attached.status==='move');assert.strictEqual(humanSearch,0);assert.strictEqual(runtimeSearch,0);
console.log('v319-r8-cache-materialized-hit.test.js: PASS — cached plan/proof used directly; no targeted planner or proof search');
