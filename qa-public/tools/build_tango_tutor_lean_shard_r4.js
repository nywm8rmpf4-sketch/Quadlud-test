#!/usr/bin/env node
'use strict';

/*
 * QUADLUD — Soleil-Lune lean canonical Tutor cache builder R4
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */

const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'../..');
const arg=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const difficulty=String(arg('--difficulty')||'').trim().toLowerCase();
const poolPath=path.resolve(arg('--pool')||'tango-diversity-pool.js');
const outputPath=path.resolve(arg('--output')||`tango-tutor-cache-${difficulty}.json`);
const reportPath=arg('--report')?path.resolve(arg('--report')):null;
if(!['easy','medium','hard','expert'].includes(difficulty))throw new Error('--difficulty must be easy, medium, hard or expert');

const Pool=require(poolPath);
const DifficultyRating=require(path.join(ROOT,'difficulty-rating.js'));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js',
  'pedagogy-next-move-policy.js','tango-played-move-planner.js',
  'tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js','tango-human-pedagogy-r4.js',
  'tango-tutor-single-planner-r5.js'
])require(path.join(ROOT,file));
const Planner=global.QuadludTangoPlayedMovePlanner;
const Tutor=global.QuadludTangoTutorSinglePlannerR5;
const Human=global.QuadludTangoHumanPedagogyR4;
const Runtime=global.QuadludTangoPlayedMoveRuntime;
if(!Planner||!Tutor||!Human||!Runtime)throw new Error('Soleil-Lune Tutor runtime unavailable');

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function sameJson(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function cellIndex(cell){return Number(cell?.[0])*6+Number(cell?.[1])}
function stateForEntry(entry){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const index of entry.givens||[])state[Math.floor(index/6)][index%6]=entry.sol[Math.floor(index/6)][index%6];
  return state;
}
function publicPuzzle(entry,state){return {game:'tango',n:6,state:state.map(row=>row.slice()),edges:(entry.edges||[]).map(edge=>edge.slice())}}
function deductionSignature(d){return String(d?.signature||d?.id||'')}
function selectionMeta(plan){return {
  selectionStatus:plan?.selectionStatus||null,
  candidateCount:Number(plan?.candidateCount)||0,
  humanCandidateCount:Number(plan?.humanCandidateCount)||0,
  humanGlobalSelection:!!plan?.humanGlobalSelection,
  frontierComplete:plan?.frontierComplete!==false,
  humanProofKind:plan?.displayProof?.kind||'engine-proof',
  humanProofCostVector:Array.isArray(plan?.displayProof?.costVector)?plan.displayProof.costVector.slice():null,
  humanProofTraceCollapsed:!!plan?.displayProof?.traceCollapsed
}}
function compactMeta(meta){return [
  meta.selectionStatus||'',meta.candidateCount,meta.humanCandidateCount,meta.humanGlobalSelection?1:0,meta.frontierComplete?1:0,
  meta.humanProofKind||'',meta.humanProofCostVector||null,meta.humanProofTraceCollapsed?1:0
]}
function expandMeta(data){return {
  selectionStatus:data?.[0]||null,candidateCount:Number(data?.[1])||0,humanCandidateCount:Number(data?.[2])||0,
  humanGlobalSelection:data?.[3]===1,frontierComplete:data?.[4]!==0,humanProofKind:data?.[5]||'engine-proof',
  humanProofCostVector:Array.isArray(data?.[6])?data[6].slice():null,humanProofTraceCollapsed:data?.[7]===1
}}
function resolveStartingDeduction(engine,diff,seed){
  const tier=Planner.tierIndexForDifficulty(diff);
  if(seed.mode==='advanced')return clone(seed.deduction);
  if(seed.mode!=='direct'||!seed.signature)return null;
  const matches=Planner._test.allowedDirectDeductions(engine,tier).filter(d=>deductionSignature(d)===seed.signature);
  return matches.length===1?clone(matches[0]):null
}
function makeSeed(original){
  const starting=clone(original?.startingDeduction||original?.deduction);
  if(!starting||!Array.isArray(starting.conclusions)||!starting.conclusions.length)throw new Error('Tutor plan missing reusable starting deduction');
  const advanced=!!original.advancedStart;
  return {
    mode:advanced?'advanced':'direct',
    ...(advanced?{deduction:starting}:{signature:deductionSignature(starting)}),
    expectedTarget:cellIndex(original.target),
    expectedValue:original.value,
    selection:compactMeta(selectionMeta(original))
  }
}
function certifyTargetedRebuild(engine,original,diff,seed){
  const starting=resolveStartingDeduction(engine,diff,seed);
  if(!starting)throw new Error(`Cached ${seed.mode} starting deduction could not be resolved`);
  const tier=Planner.tierIndexForDifficulty(diff),targeted=Planner._test.planFromFirstDeduction(engine,tier,starting,{advancedStart:seed.mode==='advanced',initialStateValidated:true});
  if(targeted?.status!=='move')throw new Error(`Targeted Tutor reconstruction returned ${targeted?.status||'invalid'}`);
  if(cellIndex(targeted.target)!==seed.expectedTarget||targeted.value!==seed.expectedValue)throw new Error(`Targeted Tutor reconstruction changed move ${JSON.stringify({expected:[seed.expectedTarget,seed.expectedValue],actual:[cellIndex(targeted.target),targeted.value]})}`);
  const meta=expandMeta(seed.selection),humanized=Tutor._test.attachHumanProof(engine,{...targeted,...clone(meta)},Human,Runtime,'precomputed-seed');
  if(humanized?.status!=='move')throw new Error(`Targeted Tutor humanization returned ${humanized?.status||'invalid'}`);
  if(cellIndex(humanized.target)!==seed.expectedTarget||humanized.value!==seed.expectedValue)throw new Error('Targeted Tutor humanization changed move');
  const originalDisplay=original.displayDeduction||original.deduction,targetDisplay=humanized.displayDeduction||humanized.deduction;
  if(!sameJson(targetDisplay,originalDisplay))throw new Error(`Targeted Tutor display deduction mismatch for ${original.target?.join(',')}`);
  return humanized
}

const sourceEntries=Pool.entries?.[difficulty];
if(!Array.isArray(sourceEntries)||sourceEntries.length<120)throw new Error(`${difficulty}: certified pool missing 120 entries`);
const entries=[],seenFingerprints=new Map(),plannerTimes=[],rebuildTimes=[],seedSizes=[],journeys=[];let directSeeds=0,advancedSeeds=0;
for(let poolIndex=0;poolIndex<sourceEntries.length;poolIndex++){
  const entry=sourceEntries[poolIndex],state=stateForEntry(entry),initial=state.map(row=>row.slice()),history=[],steps=[];
  global.walkthroughSession={base:{game:'tango',diff:difficulty},work:{n:6,state,edges:entry.edges},initial:{state:initial},moves:history,navigation:{}};
  let status='move-limit';
  for(let move=0;move<72;move++){
    if(!state.some(row=>row.includes(-1))){status='solved';break}
    const puzzle=publicPuzzle(entry,state),fingerprint=DifficultyRating.fingerprintPublicPuzzle(puzzle),engine=Planner.sessionFromPublicBoard(puzzle,state);
    const started=performance.now(),original=Tutor._test.humanizeTutorPlan(engine,difficulty),elapsed=performance.now()-started;plannerTimes.push(elapsed);
    if(original?.status==='solved'){status='solved';break}
    if(original?.status!=='move')throw new Error(`${difficulty}[${poolIndex}] move ${move}: canonical Tutor returned ${original?.status||'invalid'}`);
    const cacheSeed=makeSeed(original),rebuildStarted=performance.now();certifyTargetedRebuild(engine,original,difficulty,cacheSeed);rebuildTimes.push(performance.now()-rebuildStarted);
    if(cacheSeed.mode==='advanced')advancedSeeds++;else directSeeds++;
    const record=[fingerprint,cacheSeed.mode==='advanced'?1:0,cacheSeed.expectedTarget,cacheSeed.expectedValue,cacheSeed.mode==='advanced'?cacheSeed.deduction:cacheSeed.signature,cacheSeed.selection];
    seedSizes.push(Buffer.byteLength(JSON.stringify(record)));
    const existing=seenFingerprints.get(fingerprint);
    if(existing&&!sameJson(existing,record))throw new Error(`${difficulty}: conflicting cache seed for visible-state fingerprint ${fingerprint}`);
    if(!existing)seenFingerprints.set(fingerprint,clone(record));
    steps.push(record);
    const before=state.map(row=>row.slice());
    if(!Planner.applyPlayedMoveToState(state,original))throw new Error(`${difficulty}[${poolIndex}] move ${move}: canonical Tutor move could not be applied`);
    history.push({target:original.target.slice(),pedagogyStageKind:'action',deduction:clone(original.displayDeduction||original.deduction),presentation:{},beforeSnapshot:{state:before},snapshot:{state:state.map(row=>row.slice())}});
  }
  if(status!=='solved')throw new Error(`${difficulty}[${poolIndex}]: Tutor journey did not solve (${status})`);
  entries.push([poolIndex,entry.difficultyProfile?.fingerprint||'',steps]);
  journeys.push([poolIndex,steps.length]);
  if((poolIndex+1)%10===0||poolIndex===sourceEntries.length-1)console.error(`${difficulty}: ${poolIndex+1}/${sourceEntries.length} puzzles, ${seenFingerprints.size} unique cached states`);
}
function stats(values){if(!values.length)return {count:0,total:0,avg:0,max:0,min:0};const total=values.reduce((a,b)=>a+b,0);return {count:values.length,total:Math.round(total),avg:Number((total/values.length).toFixed(3)),max:Number(Math.max(...values).toFixed(3)),min:Number(Math.min(...values).toFixed(3))}}
const payload={schema:2,version:'tango-tutor-cache-r4-lean',difficulty,poolVersion:Pool.version,policy:'visible-state-direct-signature-or-advanced-deduction-v1',reconstruction:'resolveStartingDeduction+planFromFirstDeduction+attachHumanProof',fallback:'full-humanizeTutorPlan-on-any-miss-or-mismatch',entryShape:'[poolIndex,initialFingerprint,steps]',stepShape:'[fingerprint,advancedFlag,targetIndex,value,signatureOrDeduction,selectionMeta]',entries};
fs.writeFileSync(outputPath,JSON.stringify(payload));
const bytes=fs.statSync(outputPath).size,fullTotal=plannerTimes.reduce((a,b)=>a+b,0),rebuildTotal=rebuildTimes.reduce((a,b)=>a+b,0);
const report={schema:1,version:payload.version,difficulty,poolCount:sourceEntries.length,journeys,cachedSteps:seedSizes.length,uniqueFingerprints:seenFingerprints.size,directSeeds,advancedSeeds,bytes,bytesPerCachedStep:Number((bytes/Math.max(1,seedSizes.length)).toFixed(1)),seedBytes:stats(seedSizes),fullPlannerMs:stats(plannerTimes),targetedRebuildMs:stats(rebuildTimes),speedupMean:Number((fullTotal/Math.max(0.001,rebuildTotal)).toFixed(3))};
if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
