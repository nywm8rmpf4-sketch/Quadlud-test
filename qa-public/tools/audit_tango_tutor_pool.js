#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');

const privateRuntime=path.resolve(__dirname,'../../GitHub');
const ROOT=fs.existsSync(path.join(privateRuntime,'tango-generator.js'))?privateRuntime:path.resolve(__dirname,'../..');
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js',
  'pedagogy-next-move-policy.js','tango-played-move-planner.js',
  'tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js','tango-human-pedagogy-r4.js',
  'tango-tutor-single-planner-r5.js'
])require(path.join(ROOT,file));

const Pool=require(path.join(ROOT,'tango-diversity-pool.js'));
const Generator=require(path.join(ROOT,'tango-generator.js'));
const Planner=global.QuadludTangoPlayedMovePlanner;
const Tutor=global.QuadludTangoTutorSinglePlannerR5;
const requested=process.argv.slice(2);
const selections=requested.length?requested:['medium','hard','expert'];

function auditEntry(difficulty,index,entry){
  const candidate=Generator.fromDiversityEntry(difficulty,entry);
  if(!candidate)return {difficulty,index,status:'invalid-entry'};
  const puzzle=Generator.publicPuzzleFromCandidate(candidate),state=puzzle.state.map(row=>row.slice()),initial=state.map(row=>row.slice()),moves=[];
  global.walkthroughSession={base:{game:'tango',diff:difficulty},work:{n:puzzle.n,state,edges:puzzle.edges},initial:{state:initial},moves,navigation:{}};
  const timings=[],rules=[];
  for(let step=0;step<72;step++){
    if(!state.some(row=>row.includes(-1)))return {
      difficulty,index,status:'solved',moves:step,totalMs:Math.round(timings.reduce((a,b)=>a+b,0)),
      maxMoveMs:Math.round(Math.max(...timings)),slowestStep:timings.indexOf(Math.max(...timings)),
      slowestRule:rules[timings.indexOf(Math.max(...timings))]||null,contextual:true,
      fingerprint:candidate.difficultyProfile.fingerprint
    };
    const engine=Planner.sessionFromPublicBoard(puzzle,state);
    const start=performance.now(),plan=Tutor._test.humanizeTutorPlan(engine,difficulty),elapsedMs=performance.now()-start;
    timings.push(elapsedMs);
    if(plan?.status==='solved')return {difficulty,index,status:'solved',moves:step,totalMs:Math.round(timings.reduce((a,b)=>a+b,0)),maxMoveMs:Math.round(Math.max(...timings)),slowestStep:timings.indexOf(Math.max(...timings)),slowestRule:rules[timings.indexOf(Math.max(...timings))]||null,contextual:true,fingerprint:candidate.difficultyProfile.fingerprint};
    if(plan?.status!=='move')return {difficulty,index,status:plan?.status||'invalid-plan',step,elapsedMs:Math.round(elapsedMs)};
    rules.push(plan.deduction?.rule||null);
    const before=state.map(row=>row.slice());
    if(!Planner.applyPlayedMoveToState(state,plan))return {difficulty,index,status:'invalid-application',step};
    moves.push({target:plan.target.slice(),pedagogyStageKind:'action',deduction:JSON.parse(JSON.stringify(plan.displayDeduction||plan.deduction)),presentation:{},beforeSnapshot:{state:before},snapshot:{state:state.map(row=>row.slice())}});
  }
  return {difficulty,index,status:'move-limit'};
}

for(const selection of selections){
  const [difficulty,indexText]=selection.split(':');
  const entries=Pool.entries[difficulty];
  if(!Array.isArray(entries))throw new Error(`Unknown pool difficulty: ${difficulty}`);
  const indices=indexText==null?entries.map((_,index)=>index):[Number(indexText)];
  for(const index of indices){
    if(!Number.isInteger(index)||!entries[index])throw new Error(`Unknown pool entry: ${selection}`);
    const result=auditEntry(difficulty,index,entries[index]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}
