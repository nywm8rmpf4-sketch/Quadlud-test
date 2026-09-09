#!/usr/bin/env node
'use strict';

/*
 * QUADLUD — Soleil-Lune precomputed diversity pool builder v5
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const privateRuntime=path.resolve(__dirname,'../../GitHub');
const ROOT=fs.existsSync(path.join(privateRuntime,'tango-generator.js'))?privateRuntime:path.resolve(__dirname,'../..');
const sandbox={console};sandbox.globalThis=sandbox;vm.createContext(sandbox);
for(const file of ['game-contract.js','game-manifest.js','game-registry.js','difficulty-rating.js','tango-logic.js','tango-difficulty.js','generation-common.js','tango-generator.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),sandbox,{filename:file});
}
vm.runInContext('globalThis.__random=tangoRandomStructuralCandidateV223;globalThis.__rate=tangoRateGeneratedV223;globalThis.__transform=tangoTransformTemplateV223',sandbox);

// Expert entries receive the same contextual Tutor journey audit used by the
// diversity pilot. The logical trace certification below applies to all tiers.
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js',
  'pedagogy-next-move-policy.js','tango-played-move-planner.js',
  'tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js','tango-human-pedagogy-r4.js',
  'tango-tutor-single-planner-r5.js'
])require(path.join(ROOT,file));
const TutorPlanner=global.QuadludTangoPlayedMovePlanner;
const TutorRuntime=global.QuadludTangoTutorSinglePlannerR5;

const arg=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const reusePath=arg('--reuse');
const outputPath=arg('--output');
const reportPath=arg('--report');
const auditCachePath=process.env.QUADLUD_TANGO_AUDIT_CACHE||null;
const reusedPool=reusePath&&fs.existsSync(path.resolve(reusePath))?require(path.resolve(reusePath)):null;
let auditCache={};
if(auditCachePath&&fs.existsSync(auditCachePath))auditCache=JSON.parse(fs.readFileSync(auditCachePath,'utf8'));

const TARGETS=Object.freeze({easy:120,medium:120,hard:120,expert:120});
const GENERATION_TARGETS=Object.freeze({...TARGETS,expert:140});
const MAX_ATTEMPTS=50000;
const MIN_CLUES=Object.freeze({
  easy:Object.freeze([12,13,14,15,16,17,18,19,20,21,22,23,24]),
  medium:Object.freeze([7,8,9,10,11,12,13,14,15]),
  hard:Object.freeze([5,6,7,8,9,10,11,12,13]),
  expert:Object.freeze([5,6,7,8,9,10,11,12,13])
});

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function candidateState(candidate){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const index of candidate.givens)state[Math.floor(index/6)][index%6]=candidate.sol[Math.floor(index/6)][index%6];
  return state;
}
function publicPuzzle(candidate){return {game:'tango',n:6,state:candidateState(candidate),edges:candidate.edges.map(edge=>edge.slice())}}
function publicKey(candidate){
  const puzzle=publicPuzzle(candidate);
  const edges=puzzle.edges.map(edge=>edge.slice()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2].localeCompare(b[2])||a[3].localeCompare(b[3]));
  return JSON.stringify({state:puzzle.state,edges});
}
function familyKey(candidate){
  const source={...candidate,state:candidateState(candidate)};
  const variants=[];
  for(let k=0;k<8;k++)for(const invert of [false,true])variants.push(publicKey(sandbox.__transform(source,k,invert)));
  variants.sort();
  return `tango-family-v1:${variants[0]}`;
}
function candidateFromSaved(saved){
  if(!saved||!Array.isArray(saved.sol)||!Array.isArray(saved.givens)||!Array.isArray(saved.edges))return null;
  return {sol:saved.sol.map(row=>row.slice()),givens:new Set(saved.givens),edges:saved.edges.map(edge=>edge.slice())};
}
function exactRate(candidate,difficulty){
  const rated=sandbox.__rate(candidate),profile=rated?.profile;
  if(!profile||profile.status!=='solved'||profile.difficulty!==difficulty||profile.minimumRequiredTier!==sandbox.DifficultyRating.tierIndex(difficulty)||profile.budgetHit)return null;
  const fingerprint=sandbox.DifficultyRating.fingerprintPublicPuzzle(publicPuzzle(candidate));
  if(profile.fingerprint!==fingerprint)throw new Error(`${difficulty}: rating fingerprint mismatch`);
  return rated;
}
function certifyLogicTrace(candidate,difficulty,rated){
  const puzzle=publicPuzzle(candidate),tierIndex=sandbox.DifficultyRating.tierIndex(difficulty);
  const sourceFingerprint=sandbox.DifficultyRating.fingerprintPublicPuzzle(puzzle);
  const solved=sandbox.TangoDifficulty.solveTier({puzzle,tierIndex},{collectSecondaryMetrics:false});
  if(solved?.status!=='solved'||solved?.budgetHit)throw new Error(`${difficulty}: logical trace did not solve`);
  const trace=clone(solved.trace||[]),winningTrace=clone(rated?.winningAttempt?.result?.trace||[]);
  if(JSON.stringify(trace)!==JSON.stringify(winningTrace))throw new Error(`${difficulty}: stored trace differs from minimum-tier rating trace`);
  if(sourceFingerprint!==rated.profile.fingerprint)throw new Error(`${difficulty}: trace source fingerprint differs from profile`);
  return {
    schema:1,
    policy:'current-engine-minimum-tier-visible-state-v1',
    sourceFingerprint,
    tierIndex,
    stepCount:trace.length,
    trace
  };
}
function tutorAudit(candidate,difficulty){
  const puzzle=publicPuzzle(candidate),state=puzzle.state.map(row=>row.slice()),initial=state.map(row=>row.slice()),history=[],timings=[],rules=[];
  global.walkthroughSession={base:{game:'tango',diff:difficulty},work:{n:6,state,edges:puzzle.edges},initial:{state:initial},moves:history,navigation:{}};
  for(let move=0;move<72;move++){
    if(!state.some(row=>row.includes(-1))){
      const maximum=timings.length?Math.max(...timings):0,slowestStep=timings.indexOf(maximum);
      return {schema:2,status:'solved',policy:'full-contextual-tutor-journey-v2',moves:move,totalMs:Math.round(timings.reduce((a,b)=>a+b,0)),maxMoveMs:Math.round(maximum),slowestStep,slowestRule:rules[slowestStep]||null};
    }
    const engine=TutorPlanner.sessionFromPublicBoard(puzzle,state),start=performance.now();
    const plan=TutorRuntime._test.humanizeTutorPlan(engine,difficulty),elapsedMs=performance.now()-start;
    timings.push(elapsedMs);
    if(plan?.status==='solved'){
      const maximum=Math.max(...timings),slowestStep=timings.indexOf(maximum);
      return {schema:2,status:'solved',policy:'full-contextual-tutor-journey-v2',moves:move,totalMs:Math.round(timings.reduce((a,b)=>a+b,0)),maxMoveMs:Math.round(maximum),slowestStep,slowestRule:rules[slowestStep]||null};
    }
    const before=state.map(row=>row.slice());
    if(plan?.status!=='move'||!TutorPlanner.applyPlayedMoveToState(state,plan))return {schema:2,status:plan?.status||'invalid',policy:'full-contextual-tutor-journey-v2',move};
    rules.push(plan.deduction?.rule||null);
    history.push({target:plan.target.slice(),pedagogyStageKind:'action',deduction:clone(plan.displayDeduction||plan.deduction),presentation:{},beforeSnapshot:{state:before},snapshot:{state:state.map(row=>row.slice())}});
  }
  return {schema:2,status:'move-limit',policy:'full-contextual-tutor-journey-v2'};
}
function certifiedEntry(candidate,difficulty,rated,tutorProfile=null){
  const family=familyKey(candidate),logicTrace=certifyLogicTrace(candidate,difficulty,rated);
  const out={
    sol:candidate.sol.map(row=>row.slice()),
    givens:[...candidate.givens].sort((a,b)=>a-b),
    edges:candidate.edges.map(edge=>edge.slice()),
    familyKey:family,
    difficultyProfile:clone(rated.profile),
    logicTrace
  };
  if(tutorProfile)out.tutorProfile=clone(tutorProfile);
  return out;
}

const entries={easy:[],medium:[],hard:[],expert:[]};
const families={easy:new Set(),medium:new Set(),hard:new Set(),expert:new Set()};
const fingerprints={easy:new Set(),medium:new Set(),hard:new Set(),expert:new Set()};
const attempts={easy:0,medium:0,hard:0,expert:0};
const reused={easy:0,medium:0,hard:0,expert:0};

for(const difficulty of Object.keys(TARGETS)){
  const savedEntries=Array.isArray(reusedPool?.entries?.[difficulty])?reusedPool.entries[difficulty]:[];
  for(const saved of savedEntries){
    if(entries[difficulty].length>=GENERATION_TARGETS[difficulty])break;
    const candidate=candidateFromSaved(saved);if(!candidate)continue;
    const rated=exactRate(candidate,difficulty);if(!rated)continue;
    const family=familyKey(candidate),fingerprint=rated.profile.fingerprint;
    if(families[difficulty].has(family)||fingerprints[difficulty].has(fingerprint))continue;
    let tutorProfile=null;
    if(difficulty==='expert'){
      tutorProfile=auditCache[fingerprint]||tutorAudit(candidate,difficulty);
      if(auditCachePath&&!auditCache[fingerprint]){auditCache[fingerprint]=tutorProfile;fs.writeFileSync(auditCachePath,JSON.stringify(auditCache,null,2))}
      if(tutorProfile.status!=='solved')continue;
    }
    const value=certifiedEntry(candidate,difficulty,rated,tutorProfile);
    families[difficulty].add(family);fingerprints[difficulty].add(fingerprint);entries[difficulty].push(value);reused[difficulty]++;
  }
  console.error(`${difficulty}: reused ${reused[difficulty]} certified entries`);
}

for(const difficulty of Object.keys(TARGETS)){
  const clues=MIN_CLUES[difficulty];
  for(let i=0;entries[difficulty].length<GENERATION_TARGETS[difficulty]&&i<MAX_ATTEMPTS;i++){
    attempts[difficulty]++;
    const clue=clues[i%clues.length];
    const candidate=sandbox.QuadludGenerationCommon.withSeed(`tango-precompute-v5:${difficulty}:${i}`,()=>sandbox.__random(clue));
    if(!candidate)continue;
    const rated=exactRate(candidate,difficulty);if(!rated)continue;
    const family=familyKey(candidate),fingerprint=rated.profile.fingerprint;
    if(families[difficulty].has(family)||fingerprints[difficulty].has(fingerprint))continue;
    let tutorProfile=null;
    if(difficulty==='expert'){
      tutorProfile=auditCache[fingerprint]||tutorAudit(candidate,difficulty);
      if(auditCachePath&&!auditCache[fingerprint]){auditCache[fingerprint]=tutorProfile;fs.writeFileSync(auditCachePath,JSON.stringify(auditCache,null,2))}
      if(tutorProfile.status!=='solved')continue;
    }
    const value=certifiedEntry(candidate,difficulty,rated,tutorProfile);
    families[difficulty].add(family);fingerprints[difficulty].add(fingerprint);entries[difficulty].push(value);
    console.error(`${difficulty}: ${entries[difficulty].length}/${GENERATION_TARGETS[difficulty]} (attempt ${i+1}${tutorProfile?`, Tutor max ${tutorProfile.maxMoveMs} ms`:''})`);
  }
  if(entries[difficulty].length!==GENERATION_TARGETS[difficulty])throw new Error(`${difficulty}: only ${entries[difficulty].length}/${GENERATION_TARGETS[difficulty]} entries after ${attempts[difficulty]} attempts`);
}

entries.expert=entries.expert
  .sort((a,b)=>(a.tutorProfile?.maxMoveMs??Infinity)-(b.tutorProfile?.maxMoveMs??Infinity)||(a.tutorProfile?.totalMs??Infinity)-(b.tutorProfile?.totalMs??Infinity)||a.difficultyProfile.fingerprint.localeCompare(b.difficultyProfile.fingerprint))
  .slice(0,TARGETS.expert);
for(const difficulty of Object.keys(TARGETS))entries[difficulty]=entries[difficulty].slice(0,TARGETS[difficulty]);

const finalCounts=Object.fromEntries(Object.keys(TARGETS).map(difficulty=>[difficulty,entries[difficulty].length]));
for(const difficulty of Object.keys(TARGETS))if(finalCounts[difficulty]<TARGETS[difficulty])throw new Error(`${difficulty}: final pool below target`);
const total=Object.values(finalCounts).reduce((a,b)=>a+b,0);
const payload={
  schema:3,
  version:'tango-precompute-pool-v5',
  generatedBy:'qa-public/tools/build_tango_precompute_pool_v5.js',
  targets:TARGETS,
  generationTargets:GENERATION_TARGETS,
  attempts,
  reused,
  counts:finalCounts,
  total,
  certification:{
    difficulty:'exact-current-engine-tier',
    families:'dihedral-and-inversion-canonical-v1',
    logicalTrace:'current-engine-minimum-tier-visible-state-v1',
    traceReuse:'exact-source-fingerprint-only',
    expertTutor:'full-contextual-tutor-journey-v2-fastest-portfolio'
  },
  entries
};
const output=`/*\n * QUADLUD — generated certified Soleil-Lune precomputed diversity pool v5\n * Copyright © 2026 Serge Benoliel. All rights reserved.\n * Proprietary software. Copying, modification, redistribution or exploitation\n * without prior written authorization is prohibited.\n */\n(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.QuadludTangoDiversityPool=api})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${JSON.stringify(payload)});});\n`;
if(outputPath)fs.writeFileSync(path.resolve(outputPath),output);else process.stdout.write(output);
const report={schema:1,version:payload.version,targets:TARGETS,counts:finalCounts,total,attempts,reused,bytes:Buffer.byteLength(output),expertMaxMoveMs:Math.max(...entries.expert.map(entry=>entry.tutorProfile?.maxMoveMs||0)),traceSteps:Object.fromEntries(Object.keys(TARGETS).map(difficulty=>[difficulty,entries[difficulty].reduce((sum,entry)=>sum+(entry.logicTrace?.stepCount||0),0)]))};
if(reportPath)fs.writeFileSync(path.resolve(reportPath),JSON.stringify(report,null,2));
console.error(JSON.stringify(report));
