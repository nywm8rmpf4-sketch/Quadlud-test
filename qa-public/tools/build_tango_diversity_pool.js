#!/usr/bin/env node
'use strict';

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

// Expert entries are not certified solely by the difficulty engine.  The
// player-facing Tutor must also be able to finish them in a bounded sequence.
// We oversample deterministic expert families, audit their complete Tutor
// journeys, then retain the fastest portfolio.  Wall-clock measurements are
// build metadata; the checked-in pool remains the reproducible runtime input.
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
const argumentValue=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const reusePath=argumentValue('--reuse-non-expert'),auditCachePath=process.env.QUADLUD_TANGO_AUDIT_CACHE||null;
const reusedPool=reusePath?require(path.resolve(reusePath)):null;
let auditCache={};
if(auditCachePath&&fs.existsSync(auditCachePath))auditCache=JSON.parse(fs.readFileSync(auditCachePath,'utf8'));

function publicKey(candidate){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const i of candidate.givens)state[Math.floor(i/6)][i%6]=candidate.sol[Math.floor(i/6)][i%6];
  return JSON.stringify({state,edges:candidate.edges.map(e=>[...e]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2].localeCompare(b[2]))});
}
function familyKey(candidate){
  const source={...candidate,state:Array.from({length:6},()=>Array(6).fill(-1))};
  for(const i of candidate.givens)source.state[Math.floor(i/6)][i%6]=candidate.sol[Math.floor(i/6)][i%6];
  const variants=[];
  for(let k=0;k<8;k++)for(const invert of [false,true])variants.push(publicKey(sandbox.__transform(source,k,invert)));
  return variants.sort()[0];
}
function compactProfile(profile){return JSON.parse(JSON.stringify(profile))}
function tutorAudit(candidate,difficulty){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const index of candidate.givens)state[Math.floor(index/6)][index%6]=candidate.sol[Math.floor(index/6)][index%6];
  const initial=state.map(row=>row.slice()),history=[],puzzle={game:'tango',n:6,state:initial.map(row=>row.slice()),edges:candidate.edges.map(edge=>edge.slice())},timings=[],rules=[];
  global.walkthroughSession={base:{game:'tango',diff:difficulty},work:{n:6,state,edges:puzzle.edges},initial:{state:initial},moves:history,navigation:{}};
  for(let move=0;move<72;move++){
    if(!state.some(row=>row.includes(-1))){const maximum=Math.max(...timings),slowestStep=timings.indexOf(maximum);return {schema:2,status:'solved',policy:'full-contextual-tutor-journey-v2',moves:move,totalMs:Math.round(timings.reduce((a,b)=>a+b,0)),maxMoveMs:Math.round(maximum),slowestStep,slowestRule:rules[slowestStep]||null}}
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
    history.push({target:plan.target.slice(),pedagogyStageKind:'action',deduction:JSON.parse(JSON.stringify(plan.displayDeduction||plan.deduction)),presentation:{},beforeSnapshot:{state:before},snapshot:{state:state.map(row=>row.slice())}});
  }
  return {schema:2,status:'move-limit',policy:'full-contextual-tutor-journey-v2'};
}
function entry(candidate,profile,tutorProfile=null){const out={sol:candidate.sol.map(r=>[...r]),givens:[...candidate.givens].sort((a,b)=>a-b),edges:candidate.edges.map(e=>[...e]),difficultyProfile:compactProfile(profile)};if(tutorProfile)out.tutorProfile=tutorProfile;return out}

const targets={medium:24,hard:32,expert:16};
const generationTargets={...targets,expert:32};
const minClues={medium:[8,9,10,11,12,13,14],hard:[6,7,8,9,10,11,12],expert:[6,7,8,9,10,11,12]};
const entries={medium:[],hard:[],expert:[]},families={medium:new Set(),hard:new Set(),expert:new Set()},fingerprints={medium:new Set(),hard:new Set(),expert:new Set()};
const attempts={medium:0,hard:0,expert:0};
for(const diff of ['medium','hard'])if(Array.isArray(reusedPool?.entries?.[diff])){
  entries[diff]=reusedPool.entries[diff].map(value=>JSON.parse(JSON.stringify(value)));
  attempts[diff]=Number(reusedPool.attempts?.[diff])||0;
  for(const saved of entries[diff]){const candidate={sol:saved.sol,givens:new Set(saved.givens),edges:saved.edges};families[diff].add(familyKey(candidate));fingerprints[diff].add(saved.difficultyProfile.fingerprint)}
}
for(const diff of Object.keys(targets)){
  for(let i=0;entries[diff].length<generationTargets[diff]&&i<12000;i++){
    attempts[diff]++;
    const clue=minClues[diff][i%minClues[diff].length];
    const candidate=sandbox.QuadludGenerationCommon.withSeed(`tango-diversity-v1:${diff}:${i}`,()=>sandbox.__random(clue));
    if(!candidate)continue;
    const rated=sandbox.__rate(candidate),profile=rated?.profile;
    if(!profile||profile.status!=='solved'||profile.difficulty!==diff||profile.budgetHit)continue;
    const family=familyKey(candidate),fingerprint=profile.fingerprint;
    if(families[diff].has(family)||fingerprints[diff].has(fingerprint))continue;
    let tutorProfile=null;
    if(diff==='expert'){
      tutorProfile=auditCache[fingerprint]||tutorAudit(candidate,diff);
      if(auditCachePath&&!auditCache[fingerprint]){auditCache[fingerprint]=tutorProfile;fs.writeFileSync(auditCachePath,JSON.stringify(auditCache,null,2))}
    }
    if(tutorProfile&&tutorProfile.status!=='solved')continue;
    families[diff].add(family);fingerprints[diff].add(fingerprint);entries[diff].push(entry(candidate,profile,tutorProfile));
    console.error(`${diff}: ${entries[diff].length}/${generationTargets[diff]} (attempt ${i+1}${tutorProfile?`, Tutor max ${tutorProfile.maxMoveMs} ms`:''})`);
  }
  if(entries[diff].length!==generationTargets[diff])throw new Error(`${diff}: only ${entries[diff].length}/${generationTargets[diff]} entries after ${attempts[diff]} attempts`);
  if(diff==='expert')entries[diff]=entries[diff].sort((a,b)=>a.tutorProfile.maxMoveMs-b.tutorProfile.maxMoveMs||a.tutorProfile.totalMs-b.tutorProfile.totalMs||a.difficultyProfile.fingerprint.localeCompare(b.difficultyProfile.fingerprint)).slice(0,targets.expert);
}

const payload={schema:2,version:'tango-diversity-pilot-v4',generatedBy:'qa-public/tools/build_tango_diversity_pool.js',targets,generationTargets,attempts,certification:{difficulty:'exact-current-engine-tier',families:'dihedral-and-inversion-canonical',expertTutor:'full-contextual-tutor-journey-v2-fastest-portfolio'},entries};
const output=`/* QUADLUD — generated certified Soleil-Lune diversity pool. */\n(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.QuadludTangoDiversityPool=api})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${JSON.stringify(payload)});});\n`;
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0){const outputPath=process.argv[outputIndex+1];if(!outputPath)throw new Error('--output requires a file path');fs.writeFileSync(path.resolve(outputPath),output)}else process.stdout.write(output);
