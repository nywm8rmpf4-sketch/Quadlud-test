'use strict';
/*
 * QUADLUD — Soleil-Lune R8 cache/live canonical parity invariant
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub');
const repo=path.resolve(__dirname,'../..');
const WEB=fs.existsSync(path.join(candidate,'tango-logic.js'))?candidate:repo;
const file=name=>path.join(WEB,name);
const DIFFS=['easy','medium','hard','expert'];
const diagnostic=process.env.QUADLUD_PARITY_DIAGNOSTIC==='1';
const reportPath=process.env.QUADLUD_PARITY_REPORT||'';

global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
require(file('tango-logic.js'));
require(file('tango-difficulty.js'));
require(file('tutor-move-selector.js'));
require(file('pedagogy-next-move-policy.js'));
require(file('tango-played-move-planner.js'));
require(file('tango-attention-continuity-bridge.js'));
require(file('tango-tutor-frontier-pruner-r5.js'));
require(file('tango-played-move-runtime.js'));
require(file('tango-human-pedagogy-r4.js'));
require(file('tango-tutor-precomputed-cache.js'));
require(file('tango-tutor-single-planner-r5.js'));
const Cache=global.QuadludTangoTutorPrecomputedCache;
const Tutor=global.QuadludTangoTutorSinglePlannerR5;
const Planner=global.QuadludTangoPlayedMovePlanner;
const Human=global.QuadludTangoHumanPedagogyR4;
const Runtime=global.QuadludTangoPlayedMoveRuntime;
assert(Cache&&Tutor&&Planner&&Human&&Runtime,'Tango Tutor runtime unavailable');
const data=require(file('tango-tutor-cache-data-r8.js'));
if(!Cache.info().registered)Cache.registerData(data);
const pool=require(file('tango-runtime-pool-data.js'));
assert.deepStrictEqual(pool.counts,{easy:120,medium:120,hard:120,expert:120});

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sig=d=>String(d?.signature||d?.id||d?.rule||'');
const keyPlan=p=>p?.status==='move'?`${p.target?.[0]},${p.target?.[1]}:${p.value}|${sig(p.startingDeduction||p.deduction)}`:String(p?.status||'null');
const displayKey=p=>JSON.stringify(p?.displayDeduction||p?.deduction||null);
function stateForEntry(entry){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const index of entry.givens||[])state[Math.floor(index/6)][index%6]=entry.solution[Math.floor(index/6)][index%6];
  return state;
}
function publicPuzzle(entry,state){return {game:'tango',n:6,state:clone(state),edges:clone(entry.edges||[])}}
function humanizedCached(engine,raw){return raw?Tutor._test.attachHumanProof(engine,raw,Human,Runtime,'precomputed-parity'):null}
function directSummary(engine,diff){
  try{
    const tier=Planner.tierIndexForDifficulty(diff);
    return (Planner._test.allowedDirectDeductions(engine,tier)||[]).filter(d=>(d?.conclusions||[]).some(c=>c?.type==='VALUE')).slice(0,20).map(d=>({rule:d.rule,signature:sig(d),conclusions:clone(d.conclusions)}));
  }catch(_){return []}
}
const report={schema:1,kind:'tango-r8-cache-live-canonical-parity',poolCounts:pool.counts,checkedStates:0,canonicalMoves:0,cacheHits:0,lookupMisses:0,rebuildMisses:0,mismatches:0,byDifficulty:{},examples:[]};
for(const diff of DIFFS){
  const entries=pool.pools?.[diff];assert(Array.isArray(entries)&&entries.length===120,`${diff}: exact 120-entry pool unavailable`);
  const stats={puzzles:entries.length,states:0,hits:0,lookupMisses:0,rebuildMisses:0,mismatches:0};
  for(let poolIndex=0;poolIndex<entries.length;poolIndex++){
    const entry=entries[poolIndex],state=stateForEntry(entry);
    for(let moveIndex=0;moveIndex<72;moveIndex++){
      if(!state.some(row=>row.includes(-1)))break;
      const pub=publicPuzzle(entry,state),engine=Planner.sessionFromPublicBoard(pub,state),lookup=Cache.lookup(engine,diff);
      Cache._test.resetStats();
      const raw=Cache.tryPlan(engine,diff),cacheStats=Cache.info().stats;
      const cached=humanizedCached(engine,raw);
      const started=performance.now(),live=Tutor._test.humanizeTutorPlan(engine,diff,{usePrecomputedCache:false}),liveMs=performance.now()-started;
      stats.states++;report.checkedStates++;
      if(raw){stats.hits++;report.cacheHits++}else if(!lookup){stats.lookupMisses++;report.lookupMisses++}else{stats.rebuildMisses++;report.rebuildMisses++}
      let reason=null;
      if(live?.status!=='move')reason=`live-${live?.status||'invalid'}`;
      else if(!cached)reason=lookup?'cache-rebuild-reject':'cache-key-miss';
      else if(cached.target?.[0]!==live.target?.[0]||cached.target?.[1]!==live.target?.[1]||cached.value!==live.value)reason='target-or-value';
      else if(sig(cached.startingDeduction||cached.deduction)!==sig(live.startingDeduction||live.deduction))reason='starting-proof';
      else if(displayKey(cached)!==displayKey(live))reason='display-proof';
      if(reason){
        stats.mismatches++;report.mismatches++;
        if(report.examples.length<100)report.examples.push({diff,poolIndex,poolEntryId:entry.id||null,moveIndex,fingerprint:lookup?.fingerprint||Cache._test.sessionFingerprint(engine),reason,lookup:!!lookup,cacheStats,cached:cached?{key:keyPlan(cached),mode:cached.tutorPlannerMode||null,rule:(cached.startingDeduction||cached.deduction)?.rule||null}:null,live:{key:keyPlan(live),mode:live?.tutorPlannerMode||null,rule:(live?.startingDeduction||live?.deduction)?.rule||null,ms:Number(liveMs.toFixed(3))},direct:directSummary(engine,diff)});
      }
      if(live?.status!=='move'||!Planner.applyPlayedMoveToState(state,live))throw new Error(`${diff}[${poolIndex}] move ${moveIndex}: live canonical Tutor failed (${live?.status||'invalid'})`);
      report.canonicalMoves++;
    }
    if(state.some(row=>row.includes(-1)))throw new Error(`${diff}[${poolIndex}]: live canonical Tutor did not solve within 72 moves`);
  }
  report.byDifficulty[diff]=stats;
  console.error(`PARITY ${diff}: ${stats.states} states, ${stats.hits} hits, ${stats.lookupMisses} key misses, ${stats.rebuildMisses} rebuild misses, ${stats.mismatches} mismatches`);
}
if(reportPath){fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));}
console.log(JSON.stringify({checkedStates:report.checkedStates,cacheHits:report.cacheHits,lookupMisses:report.lookupMisses,rebuildMisses:report.rebuildMisses,mismatches:report.mismatches,byDifficulty:report.byDifficulty,examples:report.examples.slice(0,10)},null,2));
if(report.mismatches&&!diagnostic)assert.fail(`R8 cache/live canonical parity failed: ${report.mismatches}/${report.checkedStates} states differ`);
if(!report.mismatches)console.log(`PASS R8 cache/live canonical parity: ${report.checkedStates} states, 100% exact cache/live identity.`);
else console.log(`DIAGNOSTIC R8 cache/live canonical parity: ${report.mismatches}/${report.checkedStates} mismatches detected.`);
