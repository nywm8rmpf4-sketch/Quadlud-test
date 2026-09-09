#!/usr/bin/env node
'use strict';

/*
 * QUADLUD — Soleil-Lune Tutor precompute payload profiler
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */

const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'../..');
const arg=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const poolPath=path.resolve(arg('--pool')||'tango-diversity-pool.js');
const reportPath=arg('--report')?path.resolve(arg('--report')):null;
const perDifficulty=Math.max(1,Number(arg('--per-difficulty')||2));
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
if(!Planner||!Tutor)throw new Error('Soleil-Lune Tutor runtime unavailable');

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function bytes(value){return Buffer.byteLength(JSON.stringify(value==null?null:value))}
function stateForEntry(entry){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const index of entry.givens||[])state[Math.floor(index/6)][index%6]=entry.sol[Math.floor(index/6)][index%6];
  return state;
}
function publicPuzzle(entry,state){return {game:'tango',n:6,state:state.map(row=>row.slice()),edges:(entry.edges||[]).map(edge=>edge.slice())}}
function displayProofMeta(plan){return plan?.displayProof?{kind:plan.displayProof.kind||null,costVector:Array.isArray(plan.displayProof.costVector)?plan.displayProof.costVector.slice():null,traceCollapsed:!!plan.displayProof.traceCollapsed}:null}
function selectionProjection(plan){return {
  target:Array.isArray(plan?.target)?plan.target.slice():null,
  value:plan?.value,
  selectionStatus:plan?.selectionStatus||null,
  candidateCount:Number(plan?.candidateCount)||0,
  humanCandidateCount:Number(plan?.humanCandidateCount)||0,
  humanGlobalSelection:!!plan?.humanGlobalSelection,
  frontierComplete:plan?.frontierComplete!==false,
  tutorPlannerMode:plan?.tutorPlannerMode||null,
  displayProof:displayProofMeta(plan)
}}
function projectionWith(selection,key,value){return {...selection,[key]:clone(value)}}
function summarize(values){
  if(!values.length)return {count:0,total:0,avg:0,max:0,min:0};
  const total=values.reduce((a,b)=>a+b,0);return {count:values.length,total,avg:Math.round(total/values.length),max:Math.max(...values),min:Math.min(...values)}
}

const records=[],journeys=[];
for(const difficulty of ['easy','medium','hard','expert']){
  const entries=Pool.entries?.[difficulty];if(!Array.isArray(entries)||!entries.length)throw new Error(`${difficulty}: pool entries missing`);
  for(let entryIndex=0;entryIndex<Math.min(perDifficulty,entries.length);entryIndex++){
    const entry=entries[entryIndex],state=stateForEntry(entry),initial=state.map(row=>row.slice()),moves=[];
    global.walkthroughSession={base:{game:'tango',diff:difficulty},work:{n:6,state,edges:entry.edges},initial:{state:initial},moves,navigation:{}};
    let status='move-limit';
    for(let move=0;move<72;move++){
      if(!state.some(row=>row.includes(-1))){status='solved';break}
      const puzzle=publicPuzzle(entry,state),fingerprint=DifficultyRating.fingerprintPublicPuzzle(puzzle),engine=Planner.sessionFromPublicBoard(puzzle,state),started=performance.now();
      const plan=Tutor._test.humanizeTutorPlan(engine,difficulty),elapsedMs=performance.now()-started;
      if(plan?.status==='solved'){status='solved';break}
      if(plan?.status!=='move'){status=plan?.status||'invalid';break}
      const selection=selectionProjection(plan),record={difficulty,entryIndex,move,fingerprint,elapsedMs:Math.round(elapsedMs),fullPlanBytes:bytes(plan),selectionBytes:bytes(selection),displayDeductionBytes:bytes(plan.displayDeduction),deductionBytes:bytes(plan.deduction),startingDeductionBytes:bytes(plan.startingDeduction),proofChainBytes:bytes(plan.proofChain),displayProofBytes:bytes(plan.displayProof),selectionPlusDisplayDeductionBytes:bytes(projectionWith(selection,'displayDeduction',plan.displayDeduction)),selectionPlusDeductionBytes:bytes(projectionWith(selection,'deduction',plan.deduction)),selectionPlusStartingDeductionBytes:bytes(projectionWith(selection,'startingDeduction',plan.startingDeduction))};
      records.push(record);
      if(!Planner.applyPlayedMoveToState(state,plan)){status='invalid-application';break}
      moves.push({target:plan.target.slice(),deduction:clone(plan.displayDeduction||plan.deduction),beforeSnapshot:{state:puzzle.state},snapshot:{state:state.map(row=>row.slice())}});
    }
    journeys.push({difficulty,entryIndex,status,moves:moves.length});
  }
}

const fields=['elapsedMs','fullPlanBytes','selectionBytes','displayDeductionBytes','deductionBytes','startingDeductionBytes','proofChainBytes','displayProofBytes','selectionPlusDisplayDeductionBytes','selectionPlusDeductionBytes','selectionPlusStartingDeductionBytes'];
const summary=Object.fromEntries(fields.map(field=>[field,summarize(records.map(record=>record[field]))]));
const byDifficulty=Object.fromEntries(['easy','medium','hard','expert'].map(difficulty=>[difficulty,Object.fromEntries(fields.map(field=>[field,summarize(records.filter(record=>record.difficulty===difficulty).map(record=>record[field]))]))]));
const report={schema:1,poolVersion:Pool.version,perDifficulty,journeys,recordCount:records.length,summary,byDifficulty,slowest:records.slice().sort((a,b)=>b.elapsedMs-a.elapsedMs).slice(0,12),largestDisplayDeduction:records.slice().sort((a,b)=>b.displayDeductionBytes-a.displayDeductionBytes).slice(0,12)};
if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
