/*
 * QUADLUD — Soleil-Lune guarded synchronized precomputed Tutor cache runtime
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation without prior written authorization is prohibited.
 */
(function(root,factory){
  'use strict';
  const isNode=typeof module!=='undefined'&&module.exports;
  const api=factory(root,isNode?require('./difficulty-rating.js'):root.DifficultyRating,isNode?require('./tango-played-move-planner.js'):root.QuadludTangoPlayedMovePlanner,isNode?require('./tango-tutor-cache-contract-r8.js'):root.QuadludTangoTutorCacheContractR8);
  if(isNode)module.exports=api;if(root)root.QuadludTangoTutorPrecomputedCache=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,DR,BasePlanner,Contract){
  'use strict';
  if(!DR||!BasePlanner)throw new Error('Soleil-Lune Tutor cache dependencies unavailable');
  const VERSION=5,DATA_SCHEMA=8,DATA_VERSION='tango-tutor-cache-r8-sync3-cognitive',SOURCE_POOL_VERSION='tango-runtime-pool-r8';
  const DIFFICULTIES=Object.freeze(['easy','medium','hard','expert']),BASE64URL='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let payload=null;const indices=new Map();const stats={hits:0,misses:0,dataRejects:0,rebuildRejects:0,contractRejects:0};
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function planner(){return root?.QuadludTangoPlayedMovePlanner||BasePlanner}
  function difficultyKey(diff){const key=String(diff||'').trim().toLowerCase();return ({facile:'easy',moyen:'medium',difficile:'hard'})[key]||key}
  function deductionSignature(d){return String(d?.signature||d?.id||'')}
  function cellFromIndex(index){index=Number(index);if(!Number.isInteger(index)||index<0||index>=36)return null;return [Math.floor(index/6),index%6]}
  function sessionFingerprint(session){try{return DR.fingerprintPublicPuzzle({game:'tango',n:session.n,state:session.state.map(row=>row.slice()),edges:(session.edges||[]).map(edge=>edge.slice())})}catch(_){return null}}
  function hex16ToBase64Url(hex){if(typeof hex!=='string'||!/^[0-9a-f]{32}$/.test(hex))return null;const bytes=[];for(let i=0;i<32;i+=2)bytes.push(parseInt(hex.slice(i,i+2),16));let out='';for(let i=0;i<bytes.length;i+=3){const a=bytes[i],hasB=i+1<bytes.length,hasC=i+2<bytes.length,b=hasB?bytes[i+1]:0,c=hasC?bytes[i+2]:0,n=(a<<16)|(b<<8)|c;out+=BASE64URL[(n>>>18)&63]+BASE64URL[(n>>>12)&63];if(hasB)out+=BASE64URL[(n>>>6)&63];if(hasC)out+=BASE64URL[n&63]}return out}
  function fingerprintKey(fingerprint){const m=/^qfp1-([0-9a-f]{32})$/.exec(String(fingerprint||''));return m?hex16ToBase64Url(m[1]):null}
  function decodeSelection(data){return {selectionStatus:data?.[0]||null,candidateCount:Number(data?.[1])||0,humanCandidateCount:Number(data?.[2])||0,humanGlobalSelection:data?.[3]===1,frontierComplete:data?.[4]!==0,budgetHit:data?.[4]===0,cognitiveCandidateCount:Number(data?.[5])||0,cognitiveGlobalSelection:data?.[6]===1,cognitiveCostVector:Array.isArray(data?.[7])?data[7].slice():null}}
  function validSelectionMeta(meta){return Array.isArray(meta)&&meta.length>=8&&Number.isFinite(Number(meta[1]))&&Number.isFinite(Number(meta[2]))&&(meta[3]===0||meta[3]===1)&&(meta[4]===0||meta[4]===1)&&Number.isFinite(Number(meta[5]))&&(meta[6]===0||meta[6]===1)&&(meta[7]===null||Array.isArray(meta[7]))}
  function validProfileSummary(summary){return summary===null||(Array.isArray(summary)&&summary.length>=9&&summary.every(x=>Number.isFinite(Number(x))))}
  function validProofMeta(meta){return Array.isArray(meta)&&meta.length>=16&&typeof meta[0]==='string'&&(meta[1]===0||meta[1]===1)&&(meta[6]===0||meta[6]===1)&&Number.isFinite(Number(meta[7]))&&typeof meta[8]==='string'&&(meta[9]===0||meta[9]===1)&&(meta[10]===null||Number.isFinite(Number(meta[10])))&&(meta[11]===null||Array.isArray(meta[11]))&&(meta[12]===null||Array.isArray(meta[12]))&&validProfileSummary(meta[13])&&typeof meta[14]==='string'&&typeof meta[15]==='string'}
  function validSignaturePair(pair,data){return Array.isArray(pair)&&pair.length===2&&Number.isInteger(pair[0])&&pair[0]>=0&&pair[0]<data.rules.length&&Number.isInteger(pair[1])&&pair[1]>=-1&&pair[1]<data.payloads.length}
  function signatureFromId(id,data=payload){if(!data||!Number.isInteger(id)||id<0||id>=data.signaturePairs.length)return null;const pair=data.signaturePairs[id];if(!validSignaturePair(pair,data))return null;const rule=data.rules[pair[0]],suffix=pair[1]>=0?data.payloads[pair[1]]:'';return suffix?`${rule}|${suffix}`:rule}
  function validSeedId(kind,id,data){if(kind===0)return Number.isInteger(id)&&id>=0&&id<data.signaturePairs.length;return kind===1&&Number.isInteger(id)&&id>=0&&id<data.materializedDeductions.length&&data.materializedDeductions[id]&&typeof data.materializedDeductions[id]==='object'}
  function validCompactStep(step,data){return Array.isArray(step)&&step.length===10&&/^[A-Za-z0-9_-]{22}$/.test(String(step[0]||''))&&(step[1]===0||step[1]===1)&&(step[2]===0||step[2]===1)&&!!cellFromIndex(step[3])&&(step[4]===0||step[4]===1)&&validSeedId(step[2],step[5],data)&&Number.isInteger(step[6])&&step[6]>=0&&step[6]<data.selectionMeta.length&&(step[7]===0||step[7]===1)&&validSeedId(step[7],step[8],data)&&Number.isInteger(step[9])&&step[9]>=0&&step[9]<data.proofMeta.length}
  function contractMatches(data){return !!Contract&&Number(Contract.schema)===1&&Number(Contract.version)===2&&/^[0-9a-f]{64}$/.test(String(Contract.digest||''))&&String(data?.tutorContract?.digest||'')===String(Contract.digest)&&String(data?.tutorPlannerToken||'')===String(Contract.tutorPlannerToken||'')&&String(data?.humanPolicy||'')===String(Contract.humanPolicy||'')&&String(data?.proofPolicy||'')===String(Contract.proofPolicy||'')}
  function validateData(data){
    if(!data||Number(data.schema)!==DATA_SCHEMA||String(data.version)!==DATA_VERSION||String(data.sourcePoolVersion)!==SOURCE_POOL_VERSION)return false;if(!contractMatches(data))return false;
    if(typeof data.cognitiveModel!=='string'||!data.cognitiveModel||typeof data.cognitivePatternCatalog!=='string'||!data.cognitivePatternCatalog)return false;
    if(!Array.isArray(data.rules)||!data.rules.length||data.rules.some(x=>typeof x!=='string'||!x))return false;if(!Array.isArray(data.payloads)||data.payloads.some(x=>typeof x!=='string'))return false;
    if(!Array.isArray(data.signaturePairs)||!data.signaturePairs.length||data.signaturePairs.some(p=>!validSignaturePair(p,data)))return false;if(!Array.isArray(data.materializedDeductions)||!Array.isArray(data.selectionMeta)||!data.selectionMeta.length||data.selectionMeta.some(m=>!validSelectionMeta(m)))return false;
    if(!Array.isArray(data.proofMeta)||!data.proofMeta.length||data.proofMeta.some(m=>!validProofMeta(m)))return false;if(!data.steps||typeof data.steps!=='object'||!data.puzzleCounts||typeof data.puzzleCounts!=='object')return false;
    for(const diff of DIFFICULTIES){const steps=data.steps[diff];if(Number(data.puzzleCounts[diff])!==120||!Array.isArray(steps)||!steps.length||steps.some(s=>!validCompactStep(s,data)))return false}return true
  }
  function registerData(data){if(!validateData(data)){stats.dataRejects++;if(data?.tutorContract&&!contractMatches(data))stats.contractRejects++;throw new Error('Invalid or stale synchronized Soleil-Lune cognitive Tutor cache data')}payload=data;indices.clear();return {version:DATA_VERSION,puzzles:Object.fromEntries(DIFFICULTIES.map(d=>[d,Number(data.puzzleCounts[d])])),steps:Object.fromEntries(DIFFICULTIES.map(d=>[d,data.steps[d].length])),contractDigest:String(data.tutorContract.digest),cognitiveModel:data.cognitiveModel,cognitivePatternCatalog:data.cognitivePatternCatalog}}
  function clear(){payload=null;indices.clear()}
  function buildIndex(diff){const d=difficultyKey(diff);if(!payload||!DIFFICULTIES.includes(d))return null;const map=new Map();for(const step of payload.steps[d]){const key=step[0],existing=map.get(key);if(existing&&JSON.stringify(existing)!==JSON.stringify(step))throw new Error(`Conflicting synchronized Soleil-Lune Tutor cache key: ${key}`);if(!existing)map.set(key,step)}return map}
  function indexFor(diff){const d=difficultyKey(diff);if(!payload||!DIFFICULTIES.includes(d))return null;if(!indices.has(d))indices.set(d,buildIndex(d));return indices.get(d)}
  function lookup(session,diff){const fingerprint=sessionFingerprint(session),key=fingerprintKey(fingerprint),index=indexFor(diff);if(!fingerprint||!key||!index)return null;const step=index.get(key);return step?{fingerprint,key,step}:null}
  function directMatches(session,diff,signature){const P=planner(),tier=P.tierIndexForDifficulty(diff);return P._test.allowedDirectDeductions(session,tier).filter(d=>deductionSignature(d)===signature)}
  function resolveSeed(session,diff,kind,id,{display=false}={}){if(kind===1)return clone(payload?.materializedDeductions?.[id]||null);const signature=signatureFromId(id);if(!signature)return null;const matches=directMatches(session,diff,signature);if(matches.length!==1)return null;if(!display)return clone(matches[0]);const R=root?.QuadludTangoPlayedMoveRuntime;return typeof R?._test?.minimalDisplayDeduction==='function'?clone(R._test.minimalDisplayDeduction(matches[0])):clone(matches[0])}
  function profileFromSummary(summary){if(!validProfileSummary(summary)||summary===null)return null;return {schema:1,rawDepth:Number(summary[0]),chunkCount:Number(summary[1]),displaySteps:Number(summary[2]),effectiveDepth:Number(summary[3]),recognitionCost:Number(summary[4]),attentionSwitches:Number(summary[5]),hypothesisBranches:Number(summary[6]),depthPenalty:Number(summary[7]),loadBand:Number(summary[8])}}
  function decodeProof(meta,deduction,target,value){if(!validProofMeta(meta)||!deduction)return null;return {schema:3,policy:meta[8]||null,kind:meta[0]||'engine-proof',target:target.slice(),value,deduction:clone(deduction),displayDeductions:[clone(deduction)],replaced:meta[1]===1,witness:clone(meta[2]||null),replacedRule:meta[3]||'',costVector:Array.isArray(meta[4])?meta[4].slice():null,replacedCostVector:Array.isArray(meta[5])?meta[5].slice():null,traceCollapsed:meta[6]===1,discardedAlternativeCount:Number(meta[7])||0,humanRelationSupportCostCorrected:meta[9]===1,humanProofPreferenceTier:meta[10]===null?null:Number(meta[10]),cognitiveCostVector:Array.isArray(meta[11])?meta[11].slice():null,legacyCostVector:Array.isArray(meta[12])?meta[12].slice():null,cognitiveProfile:profileFromSummary(meta[13]),cognitiveModel:meta[14]||null,cognitivePatternCatalog:meta[15]||null}}
  function directlyConcludesTarget(deduction,target,value){return !!(deduction?.conclusions||[]).some(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&c.cell[0]===target?.[0]&&c.cell[1]===target?.[1]&&c.value===value)}
  function materializedPlan(session,diff,starting,target,value,advanced,displayDeduction,displayProof,selection,fingerprint){
    if(!Array.isArray(target)||target.length!==2||session?.state?.[target[0]]?.[target[1]]!==-1||!starting||!displayDeduction||!displayProof)return null;
    if(!directlyConcludesTarget(displayDeduction,target,value))return null;
    const P=planner(),tier=P.tierIndexForDifficulty(diff);
    return {status:'move',tierIndex:tier,target:target.slice(),value,deduction:clone(displayDeduction),startingDeduction:clone(starting),proofChain:[clone(displayDeduction)],advancedStart:!!advanced,...selection,displayDeduction:clone(displayDeduction),displayProof:clone(displayProof),precomputedTutorCache:true,precomputedTutorFingerprint:fingerprint,precomputedTutorAdvanced:!!advanced,precomputedTutorContractDigest:String(payload?.tutorContract?.digest||''),cognitiveModel:payload?.cognitiveModel||displayProof?.cognitiveModel||null,cognitivePatternCatalog:payload?.cognitivePatternCatalog||displayProof?.cognitivePatternCatalog||null};
  }
  function tryPlan(session,diff){
    try{
      if(!session||typeof session.clone!=='function'||!payload){stats.misses++;return null}
      const hit=lookup(session,diff);if(!hit){stats.misses++;return null}
      const {fingerprint,step}=hit,advanced=step[1]===1,startKind=step[2],target=cellFromIndex(step[3]),value=step[4],starting=resolveSeed(session,diff,startKind,step[5]);
      if(!target||!starting){stats.rebuildRejects++;stats.misses++;return null}
      const displayDeduction=resolveSeed(session,diff,step[7],step[8],{display:true}),displayProof=decodeProof(payload.proofMeta[step[9]],displayDeduction,target,value),selection=decodeSelection(payload.selectionMeta[step[6]]);
      const plan=materializedPlan(session,diff,starting,target,value,advanced,displayDeduction,displayProof,selection,fingerprint);
      if(!plan){stats.rebuildRejects++;stats.misses++;return null}
      stats.hits++;return plan
    }catch(_){stats.rebuildRejects++;stats.misses++;return null}
  }
  function info(){return Object.freeze({version:VERSION,dataSchema:DATA_SCHEMA,dataVersion:DATA_VERSION,sourcePoolVersion:SOURCE_POOL_VERSION,contract:Contract?clone(Contract):null,registered:!!payload,steps:payload?Object.fromEntries(DIFFICULTIES.map(d=>[d,payload.steps[d].length])):{},indexed:Object.fromEntries([...indices].map(([d,m])=>[d,m.size])),stats:{...stats}})}
  function resetStats(){for(const k of Object.keys(stats))stats[k]=0}
  return Object.freeze({VERSION,DATA_SCHEMA,DATA_VERSION,SOURCE_POOL_VERSION,registerData,clear,lookup,tryPlan,info,stats,_test:Object.freeze({planner,difficultyKey,deductionSignature,cellFromIndex,sessionFingerprint,hex16ToBase64Url,fingerprintKey,decodeSelection,validSelectionMeta,validProfileSummary,validProofMeta,validSignaturePair,signatureFromId,validSeedId,validCompactStep,contractMatches,validateData,buildIndex,directMatches,resolveSeed,profileFromSummary,decodeProof,directlyConcludesTarget,materializedPlan,resetStats})});
});
