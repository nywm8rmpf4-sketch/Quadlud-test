#!/usr/bin/env node
'use strict';

/*
 * QUADLUD — Soleil-Lune canonical Tutor seed-cache builder R3
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
const outputPath=path.resolve(arg('--output')||`tango-tutor-seed-${difficulty}.json`);
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
function sameJson(a,b){return JSON.stringify(a)==JSON.stringify(b)}
function cellIndex(cell){return Number(cell?.[0])*6+Number(cell?.[1])}
function stateForEntry(entry){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const index of entry.givens||[])state[Math.floor(index/6)][index%6]=entry.sol[Math.floor(index/6)][index%6];
  return state;
}
function publicPuzzle(entry,state){return {game:'tango',n:6,state:state.map(row=>row.slice()),edges:(entry.edges||[]).map(edge=>edge.slice())}}
function selectionMeta(plan){return {
  selectionStatus:plan?.selectionStatus||null,
  candidateCount:Number(plan?.candidateCount)||0,
  humanCandidateCount:Number(plan?.humanCandidateCount)||0,
  humanGlobalSelection:!!plan?.humanGlobalSelection,
  frontierComplete:plan?.frontierComplete!==false,
  tutorPlannerMode:plan?.tutorPlannerMode||null,
  humanProofKind:plan?.displayProof?.kind||'engine-proof',
  humanProofCostVector:Array.isArray(plan?.displayProof?.costVector)?plan.displayProof.costVector.slice():null,
  humanProofTraceCollapsed:!!plan?.displayProof?.traceCollapsed
}}
function overlaySelection(plan,meta){return {...plan,...clone(meta)}}
function certifyTargetedRebuild(engine,original,diff){
  const starting=clone(original?.startingDeduction||original?.deduction);
  if(!starting||!Array.isArray(starting.conclusions)||!starting.conclusions.length)throw new Error('Tutor plan missing reusable starting deduction');
  const tier=Planner.tierIndexForDifficulty(diff),targeted=Planner._test.planFromFirstDeduction(engine,tier,starting,{advancedStart:!!original.advancedStart,initialStateValidated:true});
  if(targeted?.status!=='move')throw new Error(`Targeted Tutor reconstruction returned ${targeted?.status||'invalid'}`);
  if(!sameJson(targeted.target,original.target)||targeted.value!==original.value)throw new Error(`Targeted Tutor reconstruction changed move ${JSON.stringify({expected:[original.target,original.value],actual:[targeted.target,targeted.value]})}`);
  const meta=selectionMeta(original),humanized=Tutor._test.attachHumanProof(engine,overlaySelection(targeted,meta),Human,Runtime,'precomputed-seed');
  if(humanized?.status!=='move')throw new Error(`Targeted Tutor humanization returned ${humanized?.status||'invalid'}`);
  if(!sameJson(humanized.target,original.target)||humanized.value!==original.value)throw new Error('Targeted Tutor humanization changed move');
  const originalDisplay=original.displayDeduction||original.deduction,targetDisplay=humanized.displayDeduction||humanized.deduction;
  if(!sameJson(targetDisplay,originalDisplay))throw new Error(`Targeted Tutor display deduction mismatch for ${original.target?.join(',')}`);
  return {starting,meta,humanized}
}

const sourceEntries=Pool.entries?.[difficulty];
if(!Array.isArray(sourceEntries)||sourceEntries.length<120)throw new Error(`${difficulty}: certified pool missing 120 entries`);
const entries=[],globalFingerprints=new Map(),timings=[],seedSizes=[],rebuildTimings=[],journeys=[];
for(let poolIndex=0;poolIndex<sourceEntries.length;poolIndex++){
  const entry=sourceEntries[poolIndex],state=stateForEntry(entry),initial=state.map(row=>row.slice()),history=[],steps=[];
  global.walkthroughSession={base:{game:'tango',diff:difficulty},work:{n:6,state,edges:entry.edges},initial:{state:initial},moves:history,navigation:{}};
  let status='move-limit';
  for(let move=0;move<72;move++){
    if(!state.some(row=>row.includes(-1))){status='solved';break}
    const puzzle=publicPuzzle(entry,state),fingerprint=DifficultyRating.fingerprintPublicPuzzle(puzzle),engine=Planner.sessionFromPublicBoard(puzzle,state);
    const started=performance.now(),original=Tutor._test.humanizeTutorPlan(engine,difficulty),elapsed=performance.now()-started;timings.push(elapsed);
    if(original?.status==='solved'){status='solved';break}
    if(original?.status!=='move')throw new Error(`${difficulty}[${poolIndex}] move ${move}: canonical Tutor returned ${original?.status||'invalid'}`);
    const rebuildStart=performance.now(),rebuilt=certifyTargetedRebuild(engine,original,difficulty),rebuildElapsed=performance.now()-rebuildStart;rebuildTimings.push(rebuildElapsed);
    const seed={
      fingerprint,
      target:cellIndex(original.target),
      value:original.value,
      advancedStart:!!original.advancedStart,
      startingDeduction:rebuilt.starting,
      selection:rebuilt.meta
    };
    const seedJson=JSON.stringify(seed);seedSizes.push(Buffer.byteLength(seedJson));
    const existing=globalFingerprints.get(fingerprint);
    if(existing&&!sameJson(existing,seed))throw new Error(`${difficulty}: conflicting cache seed for visible-state fingerprint ${fingerprint}`);
    if(!existing)globalFingerprints.set(fingerprint,clone(seed));
    steps.push(seed);
    const before=state.map(row=>row.slice());
    if(!Planner.applyPlayedMoveToState(state,original))throw new Error(`${difficulty}[${poolIndex}] move ${move}: canonical Tutor move could not be applied`);
    history.push({target:original.target.slice(),pedagogyStageKind:'action',deduction:clone(original.displayDeduction||original.deduction),presentation:{},beforeSnapshot:{state:before},snapshot:{state:state.map(row=>row.slice())}});
  }
  if(status!=='solved')throw new Error(`${difficulty}[${poolIndex}]: Tutor journey did not solve (${status})`);
  entries.push({poolIndex,initialFingerprint:entry.difficultyProfile?.fingerprint||null,steps});
  journeys.push({poolIndex,status,moves:steps.length});
  if((poolIndex+1)%10===0||poolIndex===sourceEntries.length-1)console.error(`${difficulty}: ${poolIndex+1}/${sourceEntries.length} puzzles, ${globalFingerprints.size} unique cached states`);
}
function stats(values){if(!values.length)return {count:0,total:0,avg:0,max:0,min:0};const total=values.reduce((a,b)=>a+b,0);return {count:values.length,total:Math.round(total),avg:Number((total/values.length).toFixed(3)),max:Number(Math.max(...values).toFixed(3)),min:Number(Math.min(...values).toFixed(3))}}
const payload={
  schema:1,
  version:'tango-tutor-seed-cache-r3',
  difficulty,
  poolVersion:Pool.version,
  poolCount:sourceEntries.length,
  policy:'canonical-visible-state-starting-deduction-v1',
  reconstruction:'planFromFirstDeduction+attachHumanProof',
  fallback:'full-humanizeTutorPlan-on-any-miss-or-mismatch',
  entries
};
fs.writeFileSync(outputPath,JSON.stringify(payload));
const bytes=fs.statSync(outputPath).size;
const report={schema:1,version:payload.version,difficulty,poolCount:sourceEntries.length,journeys,cachedSteps:seedSizes.length,uniqueFingerprints:globalFingerprints.size,bytes,bytesPerCachedStep:Number((bytes/Math.max(1,seedSizes.length)).toFixed(1)),seedBytes:stats(seedSizes),fullPlannerMs:stats(timings),targetedRebuildMs:stats(rebuildTimings),speedupMean:Number(((timings.reduce((a,b)=>a+b,0)||1)/(rebuildTimings.reduce((a,b)=>a+b,0)||1)).toFixed(3))};
if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
