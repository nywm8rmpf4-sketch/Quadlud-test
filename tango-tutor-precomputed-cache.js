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
  const VERSION=2,DATA_SCHEMA=6,DATA_VERSION='tango-tutor-cache-r8-b64-rule-dict',SOURCE_POOL_VERSION='tango-precompute-pool-v6-compact';
  const DIFFICULTIES=Object.freeze(['easy','medium','hard','expert']);
  const BASE64URL='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let payload=null;const indices=new Map();
  const stats={hits:0,misses:0,dataRejects:0,rebuildRejects:0};
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function difficultyKey(diff){const key=String(diff||'').trim().toLowerCase();return ({facile:'easy',moyen:'medium',difficile:'hard'})[key]||key}
  function deductionSignature(d){return String(d?.signature||d?.id||'')}
  function cellFromIndex(index){index=Number(index);if(!Number.isInteger(index)||index<0||index>=36)return null;return [Math.floor(index/6),index%6]}
  function sessionFingerprint(session){try{return DR.fingerprintPublicPuzzle({game:'tango',n:session.n,state:session.state.map(row=>row.slice()),edges:(session.edges||[]).map(edge=>edge.slice())})}catch(_){return null}}
  function hex16ToBase64Url(hex){
    if(typeof hex!=='string'||!/^[0-9a-f]{32}$/.test(hex))return null;
    const bytes=[];for(let i=0;i<32;i+=2)bytes.push(parseInt(hex.slice(i,i+2),16));let out='';
    for(let i=0;i<bytes.length;i+=3){const a=bytes[i],hasB=i+1<bytes.length,hasC=i+2<bytes.length,b=hasB?bytes[i+1]:0,c=hasC?bytes[i+2]:0,n=(a<<16)|(b<<8)|c;out+=BASE64URL[(n>>>18)&63]+BASE64URL[(n>>>12)&63];if(hasB)out+=BASE64URL[(n>>>6)&63];if(hasC)out+=BASE64URL[n&63]}
    return out
  }
  function fingerprintKey(fingerprint){const m=/^qfp1-([0-9a-f]{32})$/.exec(String(fingerprint||''));return m?hex16ToBase64Url(m[1]):null}
  function decodeSelection(data){return {selectionStatus:data?.[0]||null,candidateCount:Number(data?.[1])||0,humanCandidateCount:Number(data?.[2])||0,humanGlobalSelection:data?.[3]===1,frontierComplete:data?.[4]!==0}}
  function validMeta(meta){return Array.isArray(meta)&&meta.length>=5&&Number.isFinite(Number(meta[1]))&&Number.isFinite(Number(meta[2]))&&(meta[3]===0||meta[3]===1)&&(meta[4]===0||meta[4]===1)}
  function validSignaturePair(pair,data){return Array.isArray(pair)&&pair.length===2&&Number.isInteger(pair[0])&&pair[0]>=0&&pair[0]<data.rules.length&&Number.isInteger(pair[1])&&pair[1]>=-1&&pair[1]<data.payloads.length}
  function signatureFromId(id,data=payload){if(!data||!Number.isInteger(id)||id<0||id>=data.signaturePairs.length)return null;const pair=data.signaturePairs[id];if(!validSignaturePair(pair,data))return null;const rule=data.rules[pair[0]],suffix=pair[1]>=0?data.payloads[pair[1]]:'';return suffix?`${rule}|${suffix}`:rule}
  function validCompactStep(step,data){return Array.isArray(step)&&step.length===5&&/^[A-Za-z0-9_-]{22}$/.test(String(step[0]||''))&&!!cellFromIndex(step[1])&&(step[2]===0||step[2]===1)&&Number.isInteger(step[3])&&step[3]>=0&&step[3]<data.signaturePairs.length&&Number.isInteger(step[4])&&step[4]>=0&&step[4]<data.selectionMeta.length}
  function validateData(data){
    if(!data||Number(data.schema)!==DATA_SCHEMA||String(data.version)!==DATA_VERSION||String(data.sourcePoolVersion)!==SOURCE_POOL_VERSION)return false;
    if(!Array.isArray(data.rules)||!data.rules.length||data.rules.some(x=>typeof x!=='string'||!x))return false;
    if(!Array.isArray(data.payloads)||data.payloads.some(x=>typeof x!=='string'))return false;
    if(!Array.isArray(data.signaturePairs)||!data.signaturePairs.length||data.signaturePairs.some(p=>!validSignaturePair(p,data)))return false;
    if(!Array.isArray(data.selectionMeta)||!data.selectionMeta.length||data.selectionMeta.some(m=>!validMeta(m)))return false;
    if(!data.steps||typeof data.steps!=='object'||!data.puzzleCounts||typeof data.puzzleCounts!=='object')return false;
    for(const diff of DIFFICULTIES){const steps=data.steps[diff];if(Number(data.puzzleCounts[diff])<120||!Array.isArray(steps)||!steps.length||steps.some(s=>!validCompactStep(s,data)))return false}
    return true
  }
  function registerData(data){if(!validateData(data)){stats.dataRejects++;throw new Error('Invalid compact Soleil-Lune Tutor cache data')}payload=data;indices.clear();return {version:DATA_VERSION,puzzles:Object.fromEntries(DIFFICULTIES.map(d=>[d,Number(data.puzzleCounts[d])])),steps:Object.fromEntries(DIFFICULTIES.map(d=>[d,data.steps[d].length]))}}
  function clear(){payload=null;indices.clear()}
  function buildIndex(diff){const d=difficultyKey(diff);if(!payload||!DIFFICULTIES.includes(d))return null;const map=new Map();for(const step of payload.steps[d]){const key=step[0],existing=map.get(key);if(existing&&JSON.stringify(existing)!==JSON.stringify(step))throw new Error(`Conflicting compact Soleil-Lune Tutor cache key: ${key}`);if(!existing)map.set(key,step)}return map}
  function indexFor(diff){const d=difficultyKey(diff);if(!payload||!DIFFICULTIES.includes(d))return null;if(!indices.has(d))indices.set(d,buildIndex(d));return indices.get(d)}
  function lookup(session,diff){const fingerprint=sessionFingerprint(session),key=fingerprintKey(fingerprint),index=indexFor(diff);if(!fingerprint||!key||!index)return null;const step=index.get(key);return step?{fingerprint,key,step}:null}
  function resolveStartingDeduction(session,diff,signatureId){const signature=signatureFromId(signatureId);if(!signature)return null;const tier=Planner.tierIndexForDifficulty(diff),matches=Planner._test.allowedDirectDeductions(session,tier).filter(d=>deductionSignature(d)===signature);return matches.length===1?clone(matches[0]):null}
  function tryPlan(session,diff){
    try{
      if(!session||typeof session.clone!=='function'){stats.misses++;return null}
      const hit=lookup(session,diff);if(!hit){stats.misses++;return null}
      const {fingerprint,step}=hit,target=cellFromIndex(step[1]),value=step[2],starting=resolveStartingDeduction(session,diff,step[3]);if(!target||!starting){stats.rebuildRejects++;stats.misses++;return null}
      const tier=Planner.tierIndexForDifficulty(diff),plan=Planner._test.planFromFirstDeduction(session,tier,starting,{advancedStart:false,initialStateValidated:true});
      if(plan?.status!=='move'||plan?.target?.[0]!==target[0]||plan?.target?.[1]!==target[1]||plan?.value!==value){stats.rebuildRejects++;stats.misses++;return null}
      stats.hits++;return {...plan,...decodeSelection(payload.selectionMeta[step[4]]),precomputedTutorCache:true,precomputedTutorFingerprint:fingerprint,precomputedTutorAdvanced:false}
    }catch(_){stats.rebuildRejects++;stats.misses++;return null}
  }
  function info(){return Object.freeze({version:VERSION,dataSchema:DATA_SCHEMA,dataVersion:DATA_VERSION,sourcePoolVersion:SOURCE_POOL_VERSION,registered:!!payload,steps:payload?Object.fromEntries(DIFFICULTIES.map(d=>[d,payload.steps[d].length])):{},indexed:Object.fromEntries([...indices].map(([d,m])=>[d,m.size])),stats:{...stats}})}
  function resetStats(){for(const k of Object.keys(stats))stats[k]=0}
  return Object.freeze({VERSION,DATA_SCHEMA,DATA_VERSION,SOURCE_POOL_VERSION,registerData,clear,lookup,tryPlan,info,stats,_test:Object.freeze({difficultyKey,deductionSignature,cellFromIndex,sessionFingerprint,hex16ToBase64Url,fingerprintKey,decodeSelection,validMeta,validSignaturePair,signatureFromId,validCompactStep,validateData,buildIndex,resolveStartingDeduction,resetStats})});
});
