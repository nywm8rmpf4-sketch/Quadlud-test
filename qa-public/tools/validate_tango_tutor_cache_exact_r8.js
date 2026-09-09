#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — exhaustive exact compact Tutor cache R8 validator
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const poolPath=path.resolve(process.argv[2]||'');
const cacheDir=path.resolve(process.argv[3]||'');
const dataPath=path.resolve(process.argv[4]||'');
const reportPath=process.argv[5]?path.resolve(process.argv[5]):null;
if(!poolPath||!cacheDir||!dataPath)throw new Error('usage: validate_tango_tutor_cache_exact_r8.js <raw-pool.js> <r4-cache-dir> <r8-data.js> [report.json]');
const Pool=require(poolPath);
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js',
  'tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js','tango-human-pedagogy-r4.js','tango-tutor-single-planner-r5.js'
])require(path.join(ROOT,file));
const DR=require(path.join(ROOT,'difficulty-rating.js'));
const Planner=global.QuadludTangoPlayedMovePlanner;
const Tutor=global.QuadludTangoTutorSinglePlannerR5;
const Human=global.QuadludTangoHumanPedagogyR4;
const Runtime=global.QuadludTangoPlayedMoveRuntime;
const Cache=require(path.join(ROOT,'tango-tutor-precomputed-cache.js'));
if(!Planner||!Tutor||!Human||!Runtime||!Cache)throw new Error('Soleil-Lune Tutor/cache runtime unavailable');
delete require.cache[require.resolve(dataPath)];
const Data=require(dataPath);
Cache.clear();Cache._test.resetStats();
const registered=Cache.registerData(Data);
const DIFFS=['easy','medium','hard','expert'];
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const cellIndex=cell=>Number(cell?.[0])*6+Number(cell?.[1]);
const deductionSignature=d=>String(d?.signature||d?.id||'');
function stateForEntry(entry){const state=Array.from({length:6},()=>Array(6).fill(-1));for(const index of entry.givens||[])state[Math.floor(index/6)][index%6]=entry.sol[Math.floor(index/6)][index%6];return state}
function puzzle(entry,state){return {game:'tango',n:6,state:clone(state),edges:clone(entry.edges||[])}}
function expectedMeta(meta){return {selectionStatus:meta?.[0]||null,candidateCount:Number(meta?.[1])||0,humanCandidateCount:Number(meta?.[2])||0,humanGlobalSelection:meta?.[3]===1,frontierComplete:meta?.[4]!==0}}
function actualMeta(plan){return {selectionStatus:plan?.selectionStatus||null,candidateCount:Number(plan?.candidateCount)||0,humanCandidateCount:Number(plan?.humanCandidateCount)||0,humanGlobalSelection:!!plan?.humanGlobalSelection,frontierComplete:plan?.frontierComplete!==false}}
function decodeKey(key){if(!/^[A-Za-z0-9_-]{22}$/.test(String(key||'')))throw new Error(`invalid R8 key ${key}`);const bytes=Buffer.from(key,'base64url');if(bytes.length!==16)throw new Error(`R8 key is not 128-bit (${bytes.length} bytes)`);return `qfp1-${bytes.toString('hex')}`}
function applyExpected(state,targetIndex,value){const r=Math.floor(targetIndex/6),c=targetIndex%6;if(state[r][c]!==-1&&state[r][c]!==value)throw new Error(`cached move conflicts with visible state at ${r},${c}`);state[r][c]=value}
function mutationFallback(entry,state,diff,index){
  for(let i=0;i<36;i++){
    const r=Math.floor(i/6),c=i%6;if(state[r][c]!==-1)continue;
    for(const value of [0,1]){
      const changed=clone(state);changed[r][c]=value;
      const before=DR.fingerprintPublicPuzzle(puzzle(entry,state)),after=DR.fingerprintPublicPuzzle(puzzle(entry,changed));
      if(before===after)throw new Error(`${diff}: visible-state mutation did not change fingerprint`);
      const engine=Planner.sessionFromPublicBoard(puzzle(entry,changed),changed);
      if(Cache.lookup(engine,diff))continue;
      const cached=Cache.tryPlan(engine,diff);if(cached)throw new Error(`${diff}: cache unexpectedly accepted uncached mutation`);
      const live=Tutor._test.humanizeTutorPlan(engine,diff);
      if(!live||!['move','solved','blocked','budget-exhausted','contradictory'].includes(String(live.status||'')))throw new Error(`${diff}: live fallback returned unsafe/unknown status ${live?.status||'invalid'}`);
      return {diff,poolIndex:index,cell:i,value,before,after,liveStatus:live.status};
    }
  }
  return null;
}
let totalSteps=0,expectedHits=0,presentationReady=0,rebuildRejectsBefore=Cache.stats.rebuildRejects;const perDifficulty={},allKeys=new Map(),mutations=[];
for(const diff of DIFFS){
  const sourceEntries=Pool.entries?.[diff],r4=JSON.parse(fs.readFileSync(path.join(cacheDir,`tango-tutor-cache-${diff}.json`),'utf8'));
  if(Pool.version!=='tango-precompute-pool-v5'||Pool.schema!==3)throw new Error(`unexpected source pool ${Pool.version||'unknown'}`);
  if(r4.schema!==2||r4.version!=='tango-tutor-cache-r4-lean'||r4.poolVersion!=='tango-precompute-pool-v6-compact')throw new Error(`${diff}: unexpected R4 cache contract`);
  if(!Array.isArray(sourceEntries)||sourceEntries.length<120||!Array.isArray(r4.entries)||r4.entries.length<120)throw new Error(`${diff}: fewer than 120 source puzzles`);
  if(Number(Data.puzzleCounts?.[diff])!==r4.entries.length)throw new Error(`${diff}: compact puzzle count mismatch`);
  let diffSteps=0,diffHits=0;
  for(const journey of r4.entries){
    const poolIndex=journey?.[0],steps=journey?.[2],entry=sourceEntries?.[poolIndex];
    if(!Number.isInteger(poolIndex)||!entry||!Array.isArray(steps))throw new Error(`${diff}: invalid R4 journey`);
    const state=stateForEntry(entry);
    if(!mutations.some(m=>m.diff===diff)){const probe=mutationFallback(entry,state,diff,poolIndex);if(probe)mutations.push(probe)}
    for(let stepIndex=0;stepIndex<steps.length;stepIndex++){
      const old=steps[stepIndex];if(!Array.isArray(old)||old.length<6||old[1]!==0)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: non-direct/invalid R4 seed`);
      const [expectedFp,,expectedTarget,expectedValue,expectedSignature,meta]=old;
      if(!/^qfp1-[0-9a-f]{32}$/.test(String(expectedFp||'')))throw new Error(`${diff}: source fingerprint is not full 128-bit`);
      const currentPuzzle=puzzle(entry,state),currentFp=DR.fingerprintPublicPuzzle(currentPuzzle);
      if(currentFp!==expectedFp)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: current-engine fingerprint mismatch`);
      const engine=Planner.sessionFromPublicBoard(currentPuzzle,state),lookup=Cache.lookup(engine,diff);
      if(!lookup)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: expected exact cache hit missing`);
      if(lookup.fingerprint!==expectedFp||decodeKey(lookup.key)!==expectedFp)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: fingerprint round-trip mismatch`);
      const prior=allKeys.get(`${diff}:${lookup.key}`);if(prior&&!same(prior,lookup.step))throw new Error(`${diff}: conflicting collision at ${lookup.key}`);allKeys.set(`${diff}:${lookup.key}`,clone(lookup.step));
      if(lookup.step[1]!==expectedTarget||lookup.step[2]!==expectedValue)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: compact target/value mismatch`);
      if(Cache._test.signatureFromId(lookup.step[3],Data)!==expectedSignature)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: compact deduction signature mismatch`);
      const plan=Cache.tryPlan(engine,diff);if(!plan)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: current-engine R8 rebuild rejected`);
      if(cellIndex(plan.target)!==expectedTarget||plan.value!==expectedValue)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: rebuilt target/value mismatch`);
      if(deductionSignature(plan.startingDeduction||plan.deduction)!==expectedSignature)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: rebuilt starting deduction signature mismatch`);
      if(!same(actualMeta(plan),expectedMeta(meta)))throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: Tutor selection metadata mismatch`);
      if(plan.precomputedTutorCache!==true||plan.precomputedTutorFingerprint!==expectedFp)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: cache provenance marker missing`);
      const tutorPlan=Tutor._test.attachHumanProof(engine,plan,Human,Runtime,'precomputed-cache-r8');
      if(tutorPlan?.status!=='move'||cellIndex(tutorPlan.target)!==expectedTarget||tutorPlan.value!==expectedValue||!tutorPlan.displayDeduction)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: presentation-ready Tutor rebuild mismatch`);
      if(deductionSignature(tutorPlan.startingDeduction||tutorPlan.deduction)!==expectedSignature)throw new Error(`${diff}[${poolIndex}] step ${stepIndex}: presentation Tutor signature mismatch`);
      presentationReady++;applyExpected(state,expectedTarget,expectedValue);diffSteps++;diffHits++;
    }
  }
  if(diffSteps!==Data.steps[diff].length)throw new Error(`${diff}: exhaustive step count mismatch ${diffSteps} != ${Data.steps[diff].length}`);
  perDifficulty[diff]={puzzles:r4.entries.length,steps:diffSteps,hits:diffHits};totalSteps+=diffSteps;expectedHits+=diffHits;
}
if(totalSteps!==14861)throw new Error(`expected 14861 Tutor states, got ${totalSteps}`);
if(Cache.stats.hits!==expectedHits)throw new Error(`cache hit counter mismatch ${Cache.stats.hits} != ${expectedHits}`);
if(Cache.stats.rebuildRejects!==rebuildRejectsBefore)throw new Error(`unexpected rebuild rejects: ${Cache.stats.rebuildRejects-rebuildRejectsBefore}`);
if(mutations.length!==4)throw new Error(`safe mutation fallback not demonstrated for all difficulties (${mutations.length}/4)`);
const dataBytes=fs.statSync(dataPath).size,dataSha256=crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex');
if(presentationReady!==totalSteps)throw new Error(`presentation-ready Tutor rebuild count mismatch ${presentationReady} != ${totalSteps}`);
const report={schema:1,status:'PASS',cacheVersion:Cache.DATA_VERSION,dataSchema:Cache.DATA_SCHEMA,registered,sourcePool:{version:Pool.version,schema:Pool.schema},perDifficulty,totalPuzzles:Object.values(perDifficulty).reduce((n,x)=>n+x.puzzles,0),totalSteps,presentationReady,uniqueStateKeys:allKeys.size,collisions:0,unexpectedRebuildRejects:0,mutations,dataBytes,dataSha256,stats:{...Cache.stats}};
if(report.totalPuzzles<480)throw new Error(`expected at least 480 puzzles, got ${report.totalPuzzles}`);
if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
