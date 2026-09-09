/*
 * QUADLUD — Soleil-Lune guarded precomputed Tutor cache runtime
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  'use strict';
  const api=factory(
    (typeof module!=='undefined'&&module.exports)?require('./difficulty-rating.js'):root.DifficultyRating,
    (typeof module!=='undefined'&&module.exports)?require('./tango-played-move-planner.js'):root.QuadludTangoPlayedMovePlanner
  );
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoTutorPrecomputedCache=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(DR,Planner){
  'use strict';
  if(!DR||!Planner)throw new Error('Soleil-Lune Tutor cache dependencies unavailable');

  const VERSION=1;
  const SHARD_VERSION='tango-tutor-cache-r4-lean';
  const shards=new Map(),indices=new Map();
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function difficultyKey(diff){const key=String(diff||'').trim().toLowerCase();return ({facile:'easy',moyen:'medium',difficile:'hard'})[key]||key}
  function deductionSignature(d){return String(d?.signature||d?.id||'')}
  function cellFromIndex(index){index=Number(index);if(!Number.isInteger(index)||index<0||index>=36)return null;return [Math.floor(index/6),index%6]}
  function sessionFingerprint(session){
    try{return DR.fingerprintPublicPuzzle({game:'tango',n:session.n,state:session.state.map(row=>row.slice()),edges:(session.edges||[]).map(edge=>edge.slice())})}catch(_){return null}
  }
  function decodeSelection(data){return {
    selectionStatus:data?.[0]||null,
    candidateCount:Number(data?.[1])||0,
    humanCandidateCount:Number(data?.[2])||0,
    humanGlobalSelection:data?.[3]===1,
    frontierComplete:data?.[4]!==0
  }}
  function validateStep(step){
    if(!Array.isArray(step)||step.length<6||typeof step[0]!=='string')return false;
    if(step[1]!==0&&step[1]!==1)return false;
    if(!cellFromIndex(step[2])||(step[3]!==0&&step[3]!==1))return false;
    if(step[1]===0&&typeof step[4]!=='string')return false;
    if(step[1]===1&&(!step[4]||typeof step[4]!=='object'||!Array.isArray(step[4].conclusions)))return false;
    return Array.isArray(step[5])
  }
  function buildIndex(shard){
    const map=new Map();
    for(const entry of shard.entries||[]){
      if(!Array.isArray(entry)||!Array.isArray(entry[2]))continue;
      for(const step of entry[2]){
        if(!validateStep(step))continue;
        const fingerprint=step[0],existing=map.get(fingerprint);
        if(existing&&JSON.stringify(existing)!==JSON.stringify(step))throw new Error(`Conflicting Soleil-Lune Tutor cache fingerprint: ${fingerprint}`);
        if(!existing)map.set(fingerprint,step)
      }
    }
    return map
  }
  function registerShard(shard){
    if(!shard||shard.schema!==2||shard.version!==SHARD_VERSION)throw new Error('Invalid Soleil-Lune Tutor cache shard');
    const difficulty=difficultyKey(shard.difficulty);if(!['easy','medium','hard','expert'].includes(difficulty))throw new Error('Invalid Soleil-Lune Tutor cache difficulty');
    if(!Array.isArray(shard.entries)||shard.entries.length<120)throw new Error('Incomplete Soleil-Lune Tutor cache shard');
    shards.set(difficulty,shard);indices.delete(difficulty);return {difficulty,entries:shard.entries.length}
  }
  function unregisterShard(diff){const key=difficultyKey(diff);indices.delete(key);return shards.delete(key)}
  function clear(){shards.clear();indices.clear()}
  function indexFor(diff){
    const key=difficultyKey(diff),shard=shards.get(key);if(!shard)return null;
    if(!indices.has(key))indices.set(key,buildIndex(shard));return indices.get(key)
  }
  function lookup(session,diff){const fingerprint=sessionFingerprint(session),index=indexFor(diff);if(!fingerprint||!index)return null;const step=index.get(fingerprint);return step?{fingerprint,step}:null}
  function resolveStartingDeduction(session,diff,step){
    if(step[1]===1)return clone(step[4]);
    const signature=String(step[4]||''),tier=Planner.tierIndexForDifficulty(diff);
    const matches=Planner._test.allowedDirectDeductions(session,tier).filter(d=>deductionSignature(d)===signature);
    return matches.length===1?clone(matches[0]):null
  }
  function tryPlan(session,diff){
    try{
      if(!session||typeof session.clone!=='function')return null;
      const hit=lookup(session,diff);if(!hit)return null;
      const {fingerprint,step}=hit,target=cellFromIndex(step[2]),value=step[3],starting=resolveStartingDeduction(session,diff,step);if(!target||!starting)return null;
      const tier=Planner.tierIndexForDifficulty(diff),plan=Planner._test.planFromFirstDeduction(session,tier,starting,{advancedStart:step[1]===1,initialStateValidated:true});
      if(plan?.status!=='move'||plan?.target?.[0]!==target[0]||plan?.target?.[1]!==target[1]||plan?.value!==value)return null;
      return {...plan,...decodeSelection(step[5]),precomputedTutorCache:true,precomputedTutorFingerprint:fingerprint,precomputedTutorAdvanced:step[1]===1}
    }catch(_){return null}
  }
  function info(){return Object.freeze({version:VERSION,shardVersion:SHARD_VERSION,registered:[...shards.keys()].sort(),indexed:Object.fromEntries([...indices].map(([key,value])=>[key,value.size]))})}

  return Object.freeze({VERSION,SHARD_VERSION,registerShard,unregisterShard,clear,lookup,tryPlan,info,_test:Object.freeze({difficultyKey,deductionSignature,cellFromIndex,sessionFingerprint,decodeSelection,validateStep,buildIndex,resolveStartingDeduction})});
});
