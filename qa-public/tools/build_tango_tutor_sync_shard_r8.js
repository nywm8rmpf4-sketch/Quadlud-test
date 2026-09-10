#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — Soleil-Lune synchronized canonical Tutor shard builder
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null};
const difficulty=String(arg('--difficulty')||'').trim().toLowerCase();
const poolPath=path.resolve(arg('--pool')||path.join(ROOT,'tango-runtime-pool-data.js'));
const outputPath=path.resolve(arg('--output')||`tango-tutor-sync-${difficulty}.json`);
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
const Contract=require(path.join(ROOT,'qa-public','tools','tango_tutor_cache_contract.js'));
const tutorContract=Contract.compute(ROOT);

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameJson=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const signature=d=>String(d?.signature||d?.id||'');
const cellIndex=cell=>Number(cell?.[0])*6+Number(cell?.[1]);
function solutionFor(entry){const sol=entry?.solution||entry?.sol;if(!Array.isArray(sol)||sol.length!==6)throw new Error('pool entry missing 6x6 solution');return sol}
function stateFor(entry){const sol=solutionFor(entry),state=Array.from({length:6},()=>Array(6).fill(-1));for(const i of entry.givens||[])state[Math.floor(i/6)][i%6]=sol[Math.floor(i/6)][i%6];return state}
function publicPuzzle(entry,state){return {game:'tango',n:6,state:clone(state),edges:clone(entry.edges||[])}}
function selectionMeta(plan){return [plan?.selectionStatus||'',Number(plan?.candidateCount)||0,Number(plan?.humanCandidateCount)||0,plan?.humanGlobalSelection?1:0,plan?.frontierComplete===false?0:1]}
function proofMeta(plan){const p=plan?.displayProof||{};return [String(p.kind||'engine-proof'),p.replaced?1:0,clone(p.witness||null),String(p.replacedRule||''),Array.isArray(p.costVector)?p.costVector.slice():null,Array.isArray(p.replacedCostVector)?p.replacedCostVector.slice():null,p.traceCollapsed?1:0,Number(p.discardedAlternativeCount)||0,String(p.policy||Runtime.HUMAN_PROOF_POLICY||'')]}
function directMatches(engine,diff,sig){const tier=Planner.tierIndexForDifficulty(diff);return Planner._test.allowedDirectDeductions(engine,tier).filter(d=>signature(d)===sig)}
function startingSeed(engine,diff,plan){const d=clone(plan?.startingDeduction||plan?.deduction);if(!d)throw new Error('Tutor plan missing starting deduction');const sig=signature(d),matches=directMatches(engine,diff,sig);if(sig&&matches.length===1)return [0,sig];return [1,d]}
function displaySeed(engine,diff,plan){const d=clone(plan?.displayDeduction||plan?.displayProof?.deduction||plan?.deduction);if(!d)throw new Error('Tutor plan missing display deduction');const sig=signature(d),matches=directMatches(engine,diff,sig);if(sig&&matches.length===1){const minimized=Runtime._test.minimalDisplayDeduction(matches[0]);if(sameJson(minimized,d))return [0,sig]}return [1,d]}
function resolveSeed(engine,diff,seed,{display=false}={}){if(seed?.[0]===1)return clone(seed[1]);if(seed?.[0]!==0||typeof seed[1]!=='string')return null;const matches=directMatches(engine,diff,seed[1]);if(matches.length!==1)return null;return display?Runtime._test.minimalDisplayDeduction(matches[0]):clone(matches[0])}
function verifyRebuild(engine,diff,plan,startSeed,dispSeed){const starting=resolveSeed(engine,diff,startSeed);if(!starting)throw new Error('starting seed cannot be resolved');const tier=Planner.tierIndexForDifficulty(diff),rebuilt=Planner._test.planFromFirstDeduction(engine,tier,starting,{advancedStart:!!plan.advancedStart,initialStateValidated:true});if(rebuilt?.status!=='move')throw new Error(`targeted rebuild returned ${rebuilt?.status||'invalid'}`);if(cellIndex(rebuilt.target)!==cellIndex(plan.target)||rebuilt.value!==plan.value)throw new Error(`targeted rebuild changed move ${JSON.stringify({expected:[cellIndex(plan.target),plan.value],actual:[cellIndex(rebuilt.target),rebuilt.value]})}`);const display=resolveSeed(engine,diff,dispSeed,{display:true});if(!display||!sameJson(display,plan.displayDeduction||plan.displayProof?.deduction||plan.deduction))throw new Error(`materialized display proof cannot be reproduced for ${plan.target?.join(',')}`)}

const sourceEntries=Pool.pools?.[difficulty]||Pool.entries?.[difficulty];
if(!Array.isArray(sourceEntries)||sourceEntries.length!==120)throw new Error(`${difficulty}: exact 120-entry runtime pool unavailable`);
const entries=[],seen=new Map(),plannerTimes=[];let directStarts=0,materializedStarts=0,directDisplays=0,materializedDisplays=0,advancedMoves=0,totalSteps=0;
for(let poolIndex=0;poolIndex<sourceEntries.length;poolIndex++){
  const entry=sourceEntries[poolIndex],state=stateFor(entry),steps=[];
  for(let moveIndex=0;moveIndex<72;moveIndex++){
    if(!state.some(row=>row.includes(-1)))break;
    const puzzle=publicPuzzle(entry,state),fingerprint=DifficultyRating.fingerprintPublicPuzzle(puzzle),engine=Planner.sessionFromPublicBoard(puzzle,state);
    const t0=performance.now(),plan=Tutor._test.humanizeTutorPlan(engine,difficulty,{usePrecomputedCache:false});plannerTimes.push(performance.now()-t0);
    if(plan?.status!=='move')throw new Error(`${difficulty}[${poolIndex}] move ${moveIndex}: live Tutor returned ${plan?.status||'invalid'}`);
    const start=startingSeed(engine,difficulty,plan),display=displaySeed(engine,difficulty,plan);verifyRebuild(engine,difficulty,plan,start,display);
    start[0]===0?directStarts++:materializedStarts++;display[0]===0?directDisplays++:materializedDisplays++;if(plan.advancedStart)advancedMoves++;
    const record=[fingerprint,plan.advancedStart?1:0,start[0],cellIndex(plan.target),plan.value,clone(start[1]),selectionMeta(plan),display[0],clone(display[1]),proofMeta(plan)];
    const previous=seen.get(fingerprint);if(previous&&!sameJson(previous,record))throw new Error(`${difficulty}: conflicting canonical plan for fingerprint ${fingerprint}`);if(!previous)seen.set(fingerprint,clone(record));
    steps.push(record);totalSteps++;
    if(!Planner.applyPlayedMoveToState(state,plan))throw new Error(`${difficulty}[${poolIndex}] move ${moveIndex}: canonical move could not be applied`);
  }
  if(state.some(row=>row.includes(-1)))throw new Error(`${difficulty}[${poolIndex}]: canonical live Tutor did not solve within 72 moves`);
  entries.push([poolIndex,entry.fingerprint||entry.difficultyProfile?.fingerprint||'',steps]);
  if((poolIndex+1)%10===0||poolIndex===119)console.error(`${difficulty}: ${poolIndex+1}/120 puzzles, ${seen.size} unique synchronized states`);
}
const stats=v=>{const total=v.reduce((a,b)=>a+b,0);return {count:v.length,total:Number(total.toFixed(3)),avg:Number((total/Math.max(1,v.length)).toFixed(3)),max:Number(Math.max(...v).toFixed(3)),min:Number(Math.min(...v).toFixed(3))}};
const payload={schema:2,version:'tango-tutor-sync-shard-r2',difficulty,poolVersion:Pool.version,tutorContract:{schema:tutorContract.schema,version:tutorContract.version,algorithm:tutorContract.algorithm,digest:tutorContract.digest},tutorPlannerToken:Tutor.TOKEN||null,humanPolicy:Human.POLICY||null,proofPolicy:Runtime.HUMAN_PROOF_POLICY||null,entryShape:'[poolIndex,initialFingerprint,steps]',stepShape:'[fingerprint,advancedFlag,startKind,targetIndex,value,startPayload,selectionMeta,displayKind,displayPayload,proofMeta]',entries};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(payload));
const report={schema:2,version:payload.version,difficulty,poolVersion:payload.poolVersion,tutorContract:payload.tutorContract,tutorPlannerToken:payload.tutorPlannerToken,humanPolicy:payload.humanPolicy,proofPolicy:payload.proofPolicy,puzzles:entries.length,totalSteps,uniqueFingerprints:seen.size,advancedMoves,directStarts,materializedStarts,directDisplays,materializedDisplays,bytes:fs.statSync(outputPath).size,livePlannerMs:stats(plannerTimes)};
if(reportPath){fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2))}console.log(JSON.stringify(report));