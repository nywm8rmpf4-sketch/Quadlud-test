'use strict';
/*
 * QUADLUD — Soleil-Lune R8 cognitive cache/live canonical parity
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub'),repo=path.resolve(__dirname,'../..'),WEB=fs.existsSync(path.join(candidate,'tango-logic.js'))?candidate:repo,file=name=>path.join(WEB,name);
const ALL=['easy','medium','hard','expert'],requested=String(process.env.QUADLUD_PARITY_DIFFICULTY||'').trim().toLowerCase(),DIFFS=requested?[requested]:ALL;
if(requested&&!ALL.includes(requested))throw new Error(`invalid difficulty ${requested}`);
const start=process.env.QUADLUD_PARITY_START==null?0:Number(process.env.QUADLUD_PARITY_START),count=process.env.QUADLUD_PARITY_COUNT==null?120:Number(process.env.QUADLUD_PARITY_COUNT),end=start+count;
if(!Number.isInteger(start)||start<0||!Number.isInteger(count)||count<1||end>120)throw new Error('invalid parity range');
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const name of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js','tango-human-cost-bridge.js','cognitive-cost.js','tango-cognitive-patterns.js','tango-cognitive-pedagogy-bridge.js','tango-human-pedagogy-r4.js','tango-cognitive-proof-stages-bridge.js',
  'tango-direct-visible-priority-bridge.js','tango-tutor-precomputed-cache.js','tango-tutor-single-planner-r5.js'
])require(file(name));
const Cache=global.QuadludTangoTutorPrecomputedCache,Tutor=global.QuadludTangoTutorSinglePlannerR5,Planner=global.QuadludTangoPlayedMovePlanner,Human=global.QuadludTangoHumanPedagogyR4,Runtime=global.QuadludTangoPlayedMoveRuntime;
assert(Cache&&Tutor&&Planner&&Human&&Runtime?.__quadludCognitivePedagogyR1&&Human.__quadludCognitiveProofStagesR1&&Human.__quadludDirectVisiblePriorityR1,'exact cognitive Tango Tutor stack unavailable');
const data=require(file('tango-tutor-cache-data-r8.js'));if(!Cache.info().registered)Cache.registerData(data);const info=Cache.info();
assert.strictEqual(info.dataVersion,'tango-tutor-cache-r8-sync3-cognitive');assert.strictEqual(info.contract?.version,2);assert.strictEqual(data.cognitiveModel,'quadlud-cognitive-load-v1');assert.strictEqual(data.cognitivePatternCatalog,'tango-cognitive-patterns-v1');
const pool=require(file('tango-runtime-pool-data.js'));assert.deepStrictEqual(pool.counts,{easy:120,medium:120,hard:120,expert:120});
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v)),sig=d=>String(d?.signature||d?.id||d?.rule||'');
const profileKey=p=>{const x=p?.displayProof?.cognitiveProfile||p?.cognitiveProfile;if(!x)return null;return [Number(x.rawDepth)||0,Number(x.chunkCount)||0,Number(x.displaySteps)||0,Number(x.effectiveDepth)||0,Number(x.recognitionCost)||0,Number(x.attentionSwitches)||0,Number(x.hypothesisBranches)||0,Number(x.depthPenalty)||0,Number(x.loadBand)||0]};
const cognitiveKey=p=>JSON.stringify([p?.displayProof?.cognitiveCostVector||p?.cognitiveCostVector||null,profileKey(p),p?.displayProof?.cognitiveModel||p?.cognitiveModel||null,p?.displayProof?.cognitivePatternCatalog||p?.cognitivePatternCatalog||null]);
function stateFor(entry){const state=Array.from({length:6},()=>Array(6).fill(-1));for(const i of entry.givens||[])state[Math.floor(i/6)][i%6]=entry.solution[Math.floor(i/6)][i%6];return state}
function puzzle(entry,state){return {game:'tango',n:6,state:clone(state),edges:clone(entry.edges||[])}}
function humanized(engine,raw){return raw?Tutor._test.attachHumanProof(engine,raw,Human,Runtime,'precomputed-cognitive-parity'):null}
const report={schema:2,checkedStates:0,hits:0,lookupMisses:0,validationMisses:0,mismatches:0,maxCacheMs:0,maxLiveMs:0,byDifficulty:{},examples:[]};
for(const diff of DIFFS){const entries=pool.pools?.[diff];assert(Array.isArray(entries)&&entries.length===120);const stats={puzzles:count,states:0,hits:0,lookupMisses:0,validationMisses:0,mismatches:0,maxCacheMs:0,maxLiveMs:0};
  for(let poolIndex=start;poolIndex<end;poolIndex++){const entry=entries[poolIndex],state=stateFor(entry);
    for(let moveIndex=0;moveIndex<72;moveIndex++){if(!state.some(r=>r.includes(-1)))break;const engine=Planner.sessionFromPublicBoard(puzzle(entry,state),state),lookup=Cache.lookup(engine,diff);Cache._test.resetStats();
      let t0=performance.now(),raw=Cache.tryPlan(engine,diff),cacheMs=performance.now()-t0,cached=humanized(engine,raw);t0=performance.now();const live=Tutor._test.humanizeTutorPlan(engine,diff,{usePrecomputedCache:false}),liveMs=performance.now()-t0;
      stats.states++;report.checkedStates++;stats.maxCacheMs=Math.max(stats.maxCacheMs,cacheMs);stats.maxLiveMs=Math.max(stats.maxLiveMs,liveMs);report.maxCacheMs=Math.max(report.maxCacheMs,cacheMs);report.maxLiveMs=Math.max(report.maxLiveMs,liveMs);
      if(raw){stats.hits++;report.hits++}else if(!lookup){stats.lookupMisses++;report.lookupMisses++}else{stats.validationMisses++;report.validationMisses++}
      let reason=null;if(live?.status!=='move')reason=`live-${live?.status||'invalid'}`;else if(!cached)reason=lookup?'cache-rebuild-reject':'cache-key-miss';else if(cached.target?.[0]!==live.target?.[0]||cached.target?.[1]!==live.target?.[1]||cached.value!==live.value)reason='target-value';else if(sig(cached.startingDeduction||cached.deduction)!==sig(live.startingDeduction||live.deduction))reason='starting-deduction';else if(JSON.stringify(cached.displayDeduction)!==JSON.stringify(live.displayDeduction))reason='display-deduction';else if(cognitiveKey(cached)!==cognitiveKey(live))reason='cognitive-proof-metadata';
      if(reason){stats.mismatches++;report.mismatches++;if(report.examples.length<50)report.examples.push({diff,poolIndex,moveIndex,reason,cacheMs:Number(cacheMs.toFixed(3)),liveMs:Number(liveMs.toFixed(3)),cached:cognitiveKey(cached),live:cognitiveKey(live)})}
      if(live?.status!=='move'||!Planner.applyPlayedMoveToState(state,live))throw new Error(`${diff}[${poolIndex}] move ${moveIndex}: live canonical Tutor failed`)
    }
    if(state.some(r=>r.includes(-1)))throw new Error(`${diff}[${poolIndex}]: canonical Tutor did not solve`)
  }
  report.byDifficulty[diff]=stats;console.error(`COGNITIVE_PARITY ${diff}: ${stats.states} states, hits=${stats.hits}, misses=${stats.lookupMisses+stats.validationMisses}, mismatches=${stats.mismatches}, maxCacheMs=${stats.maxCacheMs.toFixed(2)}, maxLiveMs=${stats.maxLiveMs.toFixed(2)}`)
}
console.log(JSON.stringify(report,null,2));
assert.strictEqual(report.lookupMisses,0,'canonical cognitive cache must have zero key misses');assert.strictEqual(report.validationMisses,0,'canonical cognitive cache must have zero materialized-plan validation misses');assert.strictEqual(report.mismatches,0,'cognitive cache/live plan, proof and cost metadata must be identical');assert.strictEqual(report.hits,report.checkedStates,'canonical cognitive path must be 100% cached');
console.log(`PASS cognitive R8 cache/live parity: ${report.checkedStates} states`);
