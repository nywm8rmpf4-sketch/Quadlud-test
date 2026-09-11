'use strict';
/*
 * QUADLUD — Soleil-Lune R8 synchronized Tutor cache-hit contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const assert=require('assert'),path=require('path'),fs=require('fs');
const candidate=path.resolve(__dirname,'../GitHub');
const repo=path.resolve(__dirname,'../..');
const WEB=fs.existsSync(path.join(candidate,'tango-logic.js'))?candidate:repo;
const file=name=>path.join(WEB,name);
const ContractTool=require(path.resolve(repo,'qa-public/tools/tango_tutor_cache_contract.js'));
const generatedContract=require(file('tango-tutor-cache-contract-r8.js'));
const recomputed=ContractTool.compute(WEB);
assert.strictEqual(recomputed.digest,generatedContract.digest,'generated Tutor/cache contract is stale versus current live Tutor sources');
assert.deepStrictEqual(recomputed.files,generatedContract.files,'generated Tutor/cache per-file hashes are stale');

global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
require(file('tango-logic.js'));
require(file('tango-difficulty.js'));
require(file('tutor-move-selector.js'));
require(file('pedagogy-next-move-policy.js'));
require(file('tango-played-move-planner.js'));
require(file('tango-attention-continuity-bridge.js'));
require(file('tango-tutor-frontier-pruner-r5.js'));
require(file('tango-played-move-runtime.js'));
require(file('tango-human-cost-bridge.js'));
require(file('tango-human-pedagogy-r4.js'));
require(file('tango-tutor-precomputed-cache.js'));
require(file('tango-tutor-single-planner-r5.js'));

const Cache=global.QuadludTangoTutorPrecomputedCache;
const Tutor=global.QuadludTangoTutorSinglePlannerR5;
const Planner=global.QuadludTangoPlayedMovePlanner;
const Human=global.QuadludTangoHumanPedagogyR4;
const Runtime=global.QuadludTangoPlayedMoveRuntime;
assert(Cache&&Tutor&&Planner&&Human&&Runtime,'Tango synchronized Tutor runtime unavailable');
const data=require(file('tango-tutor-cache-data-r8.js'));
if(!Cache.info().registered)Cache.registerData(data);
const info=Cache.info();
assert.strictEqual(info.dataSchema,8,'Tutor cache runtime must require schema 8');
assert.strictEqual(info.dataVersion,'tango-tutor-cache-r8-sync2','Tutor cache data version must be synchronized R8 sync2');
assert.strictEqual(info.contract.digest,generatedContract.digest,'runtime contract must match generated contract');
const pool=require(file('tango-runtime-pool-data.js'));
assert.deepStrictEqual(pool.counts,{easy:120,medium:120,hard:120,expert:120});

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function initialState(entry){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const index of entry.givens||[])state[Math.floor(index/6)][index%6]=entry.solution[Math.floor(index/6)][index%6];
  return state;
}
function engineFor(entry){
  const state=initialState(entry);
  return Planner.sessionFromPublicBoard({game:'tango',n:6,state:clone(state),edges:clone(entry.edges||[])},state);
}

let liveHumanProofCalls=0,liveDisplayProofCalls=0;
const originalHuman=global.QuadludTangoHumanPedagogyR4;
const originalRuntime=global.QuadludTangoPlayedMoveRuntime;
global.QuadludTangoHumanPedagogyR4={...originalHuman,_test:{...originalHuman._test,evaluatePlanHumanProof(){liveHumanProofCalls++;throw new Error('cache hit must not evaluate live human proof')}}};
global.QuadludTangoPlayedMoveRuntime={...originalRuntime,selectDisplayProof(){liveDisplayProofCalls++;throw new Error('cache hit must not select live display proof')},_test:{...originalRuntime._test}};

const samples=[];
try{
  for(const diff of ['easy','medium','hard','expert']){
    const entry=pool.pools?.[diff]?.[0];
    assert(entry,`${diff}: pool entry 0 missing`);
    const engine=engineFor(entry);
    Cache._test.resetStats();
    const t0=performance.now();
    const plan=Tutor._test.humanizeTutorPlan(engine,diff);
    const elapsedMs=performance.now()-t0;
    const stats=Cache.info().stats;
    assert.strictEqual(plan?.status,'move',`${diff}: Tutor did not return a move`);
    assert.strictEqual(plan?.precomputedTutorCache,true,`${diff}: canonical initial state did not use synchronized cache`);
    assert.strictEqual(plan?.tutorPlannerMode,'precomputed-guarded',`${diff}: canonical initial state did not stay on cache-first planner mode`);
    assert(plan?.displayDeduction,`${diff}: cached display deduction missing`);
    assert(plan?.displayProof,`${diff}: cached display proof missing`);
    assert.strictEqual(plan?.precomputedTutorContractDigest,generatedContract.digest,`${diff}: cached plan contract digest mismatch`);
    assert.strictEqual(stats.hits,1,`${diff}: expected exactly one cache hit`);
    assert.strictEqual(stats.misses,0,`${diff}: unexpected cache miss`);
    assert.strictEqual(stats.rebuildRejects,0,`${diff}: unexpected cache rebuild rejection`);
    samples.push({difficulty:diff,target:plan.target,value:plan.value,rule:(plan.startingDeduction||plan.deduction)?.rule||null,displayRule:plan.displayDeduction?.rule||null,elapsedMs:Number(elapsedMs.toFixed(3))});
  }
}finally{
  global.QuadludTangoHumanPedagogyR4=originalHuman;
  global.QuadludTangoPlayedMoveRuntime=originalRuntime;
}
assert.strictEqual(liveHumanProofCalls,0,'synchronized cache hit must not run evaluatePlanHumanProof');
assert.strictEqual(liveDisplayProofCalls,0,'synchronized cache hit must not run selectDisplayProof');
console.log(JSON.stringify({contractDigest:generatedContract.digest,liveHumanProofCalls,liveDisplayProofCalls,samples},null,2));
console.log('PASS R8 synchronized Tutor cache-hit contract: current source hash, schema8 cache and zero live proof recomputation.');
