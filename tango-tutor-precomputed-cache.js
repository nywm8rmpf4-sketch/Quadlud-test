/*
 * QUADLUD — Soleil-Lune guarded synchronized precomputed Tutor cache runtime
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation without prior written authorization is prohibited.
 */
(function(root,factory){
  'use strict';
  const isNode=typeof module!=='undefined'&&module.exports;
  const api=factory(root,isNode?require('./difficulty-rating.js'):root.DifficultyRating,isNode?require('./tango-played-move-planner.js'):root.QuadludTangoPlayedMovePlanner,isNode?require('./tango-tutor-cache-contract-r8.js'):root.QuadludTangoTutorCacheContractR8);
  if(isNode)module.exports=api;if(root){root.QuadludTangoTutorPrecomputedCache=api;root.QuadludTangoTutorCacheDataR8=Object.freeze({schema:api.DATA_SCHEMA,version:api.DATA_VERSION,sharded:true});}
})(typeof globalThis!=='undefined'?globalThis:this,function(root,DR,BasePlanner,Contract){
  'use strict';
  if(!DR||!BasePlanner)throw new Error('Soleil-Lune Tutor cache dependencies unavailable');
  const VERSION=7,LEGACY_DATA_SCHEMA=9,LEGACY_DATA_VERSION='tango-tutor-cache-r8-sync4-cognitive-dag',DATA_SCHEMA=10,DATA_VERSION='tango-tutor-cache-r8-sync5-cognitive-sharded-lz4',SOURCE_POOL_VERSION='tango-runtime-pool-r8',MATERIALIZED_DAG_SCHEMA=1,ENCODED_SCHEMA=1,CODEC='lz4-block-v1';
  const DIFFICULTIES=Object.freeze(['easy','medium','hard','expert']),BASE64URL='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',SHARD_URL_VERSION='3.1.9-r8-sync5-cognitive-sharded-lz4';
  let legacyPayload=null;const shards=new Map(),indices=new Map(),loading=new Map();
  const stats={hits:0,misses:0,dataRejects:0,rebuildRejects:0,contractRejects:0,shardDecodes:0,shardLoadFailures:0};
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
  function signatureFromId(id,data){if(!data||!Number.isInteger(id)||id<0||id>=data.signaturePairs.length)return null;const pair=data.signaturePairs[id];if(!validSignaturePair(pair,data))return null;const rule=data.rules[pair[0]],suffix=pair[1]>=0?data.payloads[pair[1]]:'';return suffix?`${rule}|${suffix}`:rule}
  function validMaterializedDag(dag){
    if(!dag||Number(dag.schema)!==MATERIALIZED_DAG_SCHEMA||!Array.isArray(dag.keys)||!Array.isArray(dag.strings)||!Array.isArray(dag.nodes)||!Array.isArray(dag.roots))return false;
    if(dag.keys.some(key=>typeof key!=='string')||dag.strings.some(value=>typeof value!=='string'))return false;
    for(let index=0;index<dag.nodes.length;index++){
      const node=dag.nodes[index];if(!Array.isArray(node)||!node.length||!Number.isInteger(node[0]))return false;const type=node[0];
      if(type===0){if(node.slice(1).some(id=>!Number.isInteger(id)||id<0||id>=index))return false}
      else if(type===1){if(node.length%2!==1)return false;const seen=new Set();for(let i=1;i<node.length;i+=2){const key=node[i],child=node[i+1];if(!Number.isInteger(key)||key<0||key>=dag.keys.length||seen.has(key)||!Number.isInteger(child)||child<0||child>=index)return false;seen.add(key)}}
      else if(type===2){if(node.length!==2||!Number.isInteger(node[1])||node[1]<0||node[1]>=dag.strings.length)return false}
      else if(type===3){if(node.length!==2||!Number.isFinite(node[1]))return false}
      else if(type===4){if(node.length!==2||(node[1]!==0&&node[1]!==1))return false}
      else if(type===5){if(node.length!==1)return false}
      else return false
    }
    return dag.roots.every(id=>Number.isInteger(id)&&id>=0&&id<dag.nodes.length)
  }
  function decodeMaterialized(data,rootIndex){
    const dag=data?.materializedDag;if(!validMaterializedDag(dag)||!Number.isInteger(rootIndex)||rootIndex<0||rootIndex>=dag.roots.length)return null;const memo=new Map();
    function expand(id){if(memo.has(id))return memo.get(id);const node=dag.nodes[id],type=node[0];let value;if(type===5)value=null;else if(type===4)value=node[1]===1;else if(type===3)value=node[1];else if(type===2)value=dag.strings[node[1]];else if(type===0){value=[];memo.set(id,value);for(let i=1;i<node.length;i++)value.push(expand(node[i]));return value}else if(type===1){value={};memo.set(id,value);for(let i=1;i<node.length;i+=2)value[dag.keys[node[i]]]=expand(node[i+1]);return value}memo.set(id,value);return value}
    return expand(dag.roots[rootIndex])
  }
  function validSeedId(kind,id,data){if(kind===0)return Number.isInteger(id)&&id>=0&&id<data.signaturePairs.length;return kind===1&&Number.isInteger(id)&&id>=0&&id<data.materializedDag.roots.length}
  function validCompactStep(step,data){return Array.isArray(step)&&step.length===10&&/^[A-Za-z0-9_-]{22}$/.test(String(step[0]||''))&&(step[1]===0||step[1]===1)&&(step[2]===0||step[2]===1)&&!!cellFromIndex(step[3])&&(step[4]===0||step[4]===1)&&validSeedId(step[2],step[5],data)&&Number.isInteger(step[6])&&step[6]>=0&&step[6]<data.selectionMeta.length&&(step[7]===0||step[7]===1)&&validSeedId(step[7],step[8],data)&&Number.isInteger(step[9])&&step[9]>=0&&step[9]<data.proofMeta.length}
  function contractMatches(data){return !!Contract&&Number(Contract.schema)===1&&Number(Contract.version)===2&&/^[0-9a-f]{64}$/.test(String(Contract.digest||''))&&String(data?.tutorContract?.digest||'')===String(Contract.digest)&&String(data?.tutorPlannerToken||'')===String(Contract.tutorPlannerToken||'')&&String(data?.humanPolicy||'')===String(Contract.humanPolicy||'')&&String(data?.proofPolicy||'')===String(Contract.proofPolicy||'')}
  function commonDataValid(data){
    if(!contractMatches(data)||String(data?.sourcePoolVersion)!==SOURCE_POOL_VERSION)return false;
    if(typeof data.cognitiveModel!=='string'||!data.cognitiveModel||typeof data.cognitivePatternCatalog!=='string'||!data.cognitivePatternCatalog)return false;
    if(!Array.isArray(data.rules)||!data.rules.length||data.rules.some(x=>typeof x!=='string'||!x))return false;if(!Array.isArray(data.payloads)||data.payloads.some(x=>typeof x!=='string'))return false;
    if(!Array.isArray(data.signaturePairs)||!data.signaturePairs.length||data.signaturePairs.some(p=>!validSignaturePair(p,data)))return false;if(!validMaterializedDag(data.materializedDag)||!Array.isArray(data.selectionMeta)||!data.selectionMeta.length||data.selectionMeta.some(m=>!validSelectionMeta(m)))return false;
    if(!Array.isArray(data.proofMeta)||!data.proofMeta.length||data.proofMeta.some(m=>!validProofMeta(m)))return false;return true
  }
  function validateData(data){
    if(!data||Number(data.schema)!==LEGACY_DATA_SCHEMA||String(data.version)!==LEGACY_DATA_VERSION||!commonDataValid(data)||!data.steps||typeof data.steps!=='object'||!data.puzzleCounts||typeof data.puzzleCounts!=='object')return false;
    for(const diff of DIFFICULTIES){const steps=data.steps[diff];if(Number(data.puzzleCounts[diff])!==120||!Array.isArray(steps)||!steps.length||steps.some(s=>!validCompactStep(s,data)))return false}return true
  }
  function validateShard(data,expectedDifficulty=null){
    const d=difficultyKey(expectedDifficulty||data?.difficulty);if(!data||Number(data.schema)!==DATA_SCHEMA||String(data.version)!==DATA_VERSION||!DIFFICULTIES.includes(d)||String(data.difficulty)!==d||!commonDataValid(data))return false;
    return Number(data.puzzleCount)===120&&Array.isArray(data.steps)&&data.steps.length>0&&!data.steps.some(s=>!validCompactStep(s,data))
  }
  function validEncodedEnvelope(e){const d=difficultyKey(e?.difficulty);return !!e&&Number(e.schema)===ENCODED_SCHEMA&&DIFFICULTIES.includes(d)&&String(e.difficulty)===d&&String(e.codec)===CODEC&&Number(e.dataSchema)===DATA_SCHEMA&&String(e.dataVersion)===DATA_VERSION&&String(e.sourcePoolVersion)===SOURCE_POOL_VERSION&&String(e.tutorContractDigest||'')===String(Contract?.digest||'')&&Number(e.puzzleCount)===120&&Number.isInteger(Number(e.stepCount))&&Number(e.stepCount)>0&&Number.isInteger(Number(e.uncompressedBytes))&&Number(e.uncompressedBytes)>0&&/^[A-Za-z0-9+/=]+$/.test(String(e.payload||''))}
  function base64Bytes(value){
    const s=String(value||'');if(typeof Buffer!=='undefined')return Uint8Array.from(Buffer.from(s,'base64'));if(typeof atob!=='function')throw new Error('Base64 decoder unavailable');const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out
  }
  function lz4Decode(block,expectedBytes){
    const src=block instanceof Uint8Array?block:Uint8Array.from(block||[]),out=new Uint8Array(expectedBytes);let p=0,o=0;
    while(p<src.length){const token=src[p++];let lit=token>>>4;if(lit===15){let x;do{if(p>=src.length)throw new Error('Truncated LZ4 literal length');x=src[p++];lit+=x}while(x===255)}if(p+lit>src.length||o+lit>out.length)throw new Error('Invalid LZ4 literal span');out.set(src.subarray(p,p+lit),o);p+=lit;o+=lit;if(p>=src.length)break;
      if(p+2>src.length)throw new Error('Truncated LZ4 offset');const offset=src[p]|(src[p+1]<<8);p+=2;if(!offset||offset>o)throw new Error('Invalid LZ4 offset');let match=(token&15)+4;if((token&15)===15){let x;do{if(p>=src.length)throw new Error('Truncated LZ4 match length');x=src[p++];match+=x}while(x===255)}if(o+match>out.length)throw new Error('Invalid LZ4 match span');let start=o-offset;for(let k=0;k<match;k++)out[o++]=out[start+k]
    }
    if(o!==expectedBytes)throw new Error(`LZ4 size mismatch: ${o} != ${expectedBytes}`);return out
  }
  function utf8Text(bytes){if(typeof TextDecoder!=='undefined')return new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('utf8');let s='';for(const b of bytes)s+=String.fromCharCode(b);return decodeURIComponent(escape(s))}
  function decodeEncodedShard(envelope){
    if(!validEncodedEnvelope(envelope))throw new Error('Invalid synchronized Soleil-Lune Tutor cache shard envelope');const bytes=lz4Decode(base64Bytes(envelope.payload),Number(envelope.uncompressedBytes)),data=JSON.parse(utf8Text(bytes));
    if(!validateShard(data,envelope.difficulty)||data.steps.length!==Number(envelope.stepCount))throw new Error('Invalid or stale synchronized Soleil-Lune Tutor cache shard data');stats.shardDecodes++;return data
  }
  function registerEncodedShard(envelope){
    if(!validEncodedEnvelope(envelope)){stats.dataRejects++;if(envelope?.tutorContractDigest&&String(envelope.tutorContractDigest)!==String(Contract?.digest||''))stats.contractRejects++;throw new Error('Invalid synchronized Soleil-Lune Tutor cache shard envelope')}
    const d=difficultyKey(envelope.difficulty);shards.set(d,{envelope:clone(envelope),data:null});indices.delete(d);return {difficulty:d,encoded:true,puzzles:Number(envelope.puzzleCount),steps:Number(envelope.stepCount),contractDigest:String(envelope.tutorContractDigest)}
  }
  function registerShard(data){
    const d=difficultyKey(data?.difficulty);if(!validateShard(data,d)){stats.dataRejects++;if(data?.tutorContract&&!contractMatches(data))stats.contractRejects++;throw new Error('Invalid or stale synchronized Soleil-Lune Tutor cache shard data')}
    shards.set(d,{envelope:null,data});indices.delete(d);return {difficulty:d,encoded:false,puzzles:Number(data.puzzleCount),steps:data.steps.length,contractDigest:String(data.tutorContract.digest),materializedRoots:data.materializedDag.roots.length}
  }
  function registerData(data){if(!validateData(data)){stats.dataRejects++;if(data?.tutorContract&&!contractMatches(data))stats.contractRejects++;throw new Error('Invalid or stale synchronized Soleil-Lune cognitive Tutor cache data')}legacyPayload=data;indices.clear();return {version:LEGACY_DATA_VERSION,puzzles:Object.fromEntries(DIFFICULTIES.map(d=>[d,Number(data.puzzleCounts[d])])),steps:Object.fromEntries(DIFFICULTIES.map(d=>[d,data.steps[d].length])),contractDigest:String(data.tutorContract.digest),cognitiveModel:data.cognitiveModel,cognitivePatternCatalog:data.cognitivePatternCatalog,materializedRoots:data.materializedDag.roots.length}}
  function materializeDifficulty(diff){
    const d=difficultyKey(diff),slot=shards.get(d);if(!slot)return legacyPayload||null;if(slot.data)return slot.data;try{const envelope=slot.envelope;slot.data=decodeEncodedShard(envelope);slot.envelope={...envelope,payload:null};const bag=root?.QuadludTangoTutorCacheShardEnvelopesR8;if(bag?.[d])bag[d]=slot.envelope;return slot.data}catch(error){stats.dataRejects++;stats.shardLoadFailures++;throw error}
  }
  function dataFor(diff,{decode=true}={}){const d=difficultyKey(diff),slot=shards.get(d);if(slot){if(slot.data)return slot.data;if(decode)return materializeDifficulty(d);return null}return legacyPayload}
  function stepsFor(data,diff){return Number(data?.schema)===DATA_SCHEMA?data.steps:data?.steps?.[difficultyKey(diff)]}
  function puzzleCountFor(data,diff){return Number(data?.schema)===DATA_SCHEMA?Number(data.puzzleCount):Number(data?.puzzleCounts?.[difficultyKey(diff)])}
  function clear(){legacyPayload=null;shards.clear();indices.clear();loading.clear()}
  function buildIndex(diff){const d=difficultyKey(diff),data=dataFor(d);if(!data||!DIFFICULTIES.includes(d))return null;const steps=stepsFor(data,d),map=new Map();for(const step of steps||[]){const key=step[0],existing=map.get(key);if(existing&&JSON.stringify(existing)!==JSON.stringify(step))throw new Error(`Conflicting synchronized Soleil-Lune Tutor cache key: ${key}`);if(!existing)map.set(key,step)}return map}
  function indexFor(diff){const d=difficultyKey(diff);if(!DIFFICULTIES.includes(d)||(!legacyPayload&&!shards.has(d)))return null;if(!indices.has(d))indices.set(d,buildIndex(d));return indices.get(d)}
  function lookup(session,diff){const d=difficultyKey(diff),fingerprint=sessionFingerprint(session),key=fingerprintKey(fingerprint),index=indexFor(d);if(!fingerprint||!key||!index)return null;const step=index.get(key);return step?{fingerprint,key,step,data:dataFor(d)}:null}
  function directMatches(session,diff,signature){const P=planner(),tier=P.tierIndexForDifficulty(diff);return P._test.allowedDirectDeductions(session,tier).filter(d=>deductionSignature(d)===signature)}
  function resolveSeed(session,diff,kind,id,{display=false,data=null}={}){const source=data||dataFor(diff);if(kind===1)return decodeMaterialized(source,id);const signature=signatureFromId(id,source);if(!signature)return null;const matches=directMatches(session,diff,signature);if(matches.length!==1)return null;if(!display)return clone(matches[0]);const R=root?.QuadludTangoPlayedMoveRuntime;return typeof R?._test?.minimalDisplayDeduction==='function'?clone(R._test.minimalDisplayDeduction(matches[0])):clone(matches[0])}
  function profileFromSummary(summary){if(!validProfileSummary(summary)||summary===null)return null;return {schema:1,rawDepth:Number(summary[0]),chunkCount:Number(summary[1]),displaySteps:Number(summary[2]),effectiveDepth:Number(summary[3]),recognitionCost:Number(summary[4]),attentionSwitches:Number(summary[5]),hypothesisBranches:Number(summary[6]),depthPenalty:Number(summary[7]),loadBand:Number(summary[8])}}
  function decodeProof(meta,deduction,target,value){if(!validProofMeta(meta)||!deduction)return null;return {schema:3,policy:meta[8]||null,kind:meta[0]||'engine-proof',target:target.slice(),value,deduction:clone(deduction),displayDeductions:[clone(deduction)],replaced:meta[1]===1,witness:clone(meta[2]||null),replacedRule:meta[3]||'',costVector:Array.isArray(meta[4])?meta[4].slice():null,replacedCostVector:Array.isArray(meta[5])?meta[5].slice():null,traceCollapsed:meta[6]===1,discardedAlternativeCount:Number(meta[7])||0,humanRelationSupportCostCorrected:meta[9]===1,humanProofPreferenceTier:meta[10]===null?null:Number(meta[10]),cognitiveCostVector:Array.isArray(meta[11])?meta[11].slice():null,legacyCostVector:Array.isArray(meta[12])?meta[12].slice():null,cognitiveProfile:profileFromSummary(meta[13]),cognitiveModel:meta[14]||null,cognitivePatternCatalog:meta[15]||null}}
  function directlyConcludesTarget(deduction,target,value){return !!(deduction?.conclusions||[]).some(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&c.cell[0]===target?.[0]&&c.cell[1]===target?.[1]&&c.value===value)}
  function materializedPlan(session,diff,starting,target,value,advanced,displayDeduction,displayProof,selection,fingerprint,data=null){
    if(!Array.isArray(target)||target.length!==2||session?.state?.[target[0]]?.[target[1]]!==-1||!starting||!displayDeduction||!displayProof)return null;
    if(!directlyConcludesTarget(displayDeduction,target,value))return null;const source=data||dataFor(diff,{decode:false})||legacyPayload;
    const P=planner(),tier=P.tierIndexForDifficulty(diff);
    return {status:'move',tierIndex:tier,target:target.slice(),value,deduction:clone(displayDeduction),startingDeduction:clone(starting),proofChain:[clone(displayDeduction)],advancedStart:!!advanced,...selection,displayDeduction:clone(displayDeduction),displayProof:clone(displayProof),precomputedTutorCache:true,precomputedTutorFingerprint:fingerprint,precomputedTutorAdvanced:!!advanced,precomputedTutorContractDigest:String(source?.tutorContract?.digest||''),cognitiveModel:source?.cognitiveModel||displayProof?.cognitiveModel||null,cognitivePatternCatalog:source?.cognitivePatternCatalog||displayProof?.cognitivePatternCatalog||null};
  }
  function tryPlan(session,diff){
    try{
      const d=difficultyKey(diff),data=dataFor(d);if(!session||typeof session.clone!=='function'||!data){stats.misses++;return null}
      const hit=lookup(session,d);if(!hit){stats.misses++;return null}
      const {fingerprint,step}=hit,advanced=step[1]===1,startKind=step[2],target=cellFromIndex(step[3]),value=step[4],starting=resolveSeed(session,d,startKind,step[5],{data});
      if(!target||!starting){stats.rebuildRejects++;stats.misses++;return null}
      const displayDeduction=resolveSeed(session,d,step[7],step[8],{display:true,data}),displayProof=decodeProof(data.proofMeta[step[9]],displayDeduction,target,value),selection=decodeSelection(data.selectionMeta[step[6]]);
      const plan=materializedPlan(session,d,starting,target,value,advanced,displayDeduction,displayProof,selection,fingerprint,data);
      if(!plan){stats.rebuildRejects++;stats.misses++;return null}stats.hits++;return plan
    }catch(_){stats.rebuildRejects++;stats.misses++;return null}
  }
  function shardUrl(diff){const d=difficultyKey(diff);return `tango-tutor-cache-r8-${d}.js?v=${SHARD_URL_VERSION}`}
  function ensureDifficulty(diff){
    const d=difficultyKey(diff);if(!DIFFICULTIES.includes(d))return Promise.resolve(false);if(shards.has(d)){try{materializeDifficulty(d);return Promise.resolve(true)}catch(_){return Promise.resolve(false)}}if(legacyPayload)return Promise.resolve(true);if(typeof document==='undefined')return Promise.resolve(false);if(loading.has(d))return loading.get(d);
    const promise=new Promise(resolve=>{const script=document.createElement('script');script.src=shardUrl(d);script.async=true;script.dataset.quadludTangoCacheShard=d;script.onload=()=>{loading.delete(d);try{const ok=!!materializeDifficulty(d);if(!ok)stats.shardLoadFailures++;resolve(ok)}catch(_){stats.shardLoadFailures++;resolve(false)}};script.onerror=()=>{loading.delete(d);stats.shardLoadFailures++;resolve(false)};(document.head||document.documentElement).appendChild(script)});loading.set(d,promise);return promise
  }
  function info(){
    const steps={},puzzles={},registered=[],decoded=[],encoded=[];
    for(const d of DIFFICULTIES){const slot=shards.get(d);if(slot){registered.push(d);if(slot.data){decoded.push(d);steps[d]=slot.data.steps.length;puzzles[d]=slot.data.puzzleCount}else if(slot.envelope){encoded.push(d);steps[d]=Number(slot.envelope.stepCount)||0;puzzles[d]=Number(slot.envelope.puzzleCount)||0}}else if(legacyPayload){registered.push(d);decoded.push(d);steps[d]=legacyPayload.steps[d].length;puzzles[d]=legacyPayload.puzzleCounts[d]}}
    return Object.freeze({version:VERSION,dataSchema:DATA_SCHEMA,dataVersion:DATA_VERSION,legacyDataSchema:LEGACY_DATA_SCHEMA,legacyDataVersion:LEGACY_DATA_VERSION,sourcePoolVersion:SOURCE_POOL_VERSION,codec:CODEC,contract:Contract?clone(Contract):null,registered:registered.length>0,registeredDifficulties:registered,decodedDifficulties:decoded,encodedDifficulties:encoded,steps,puzzles,indexed:Object.fromEntries([...indices].map(([d,m])=>[d,m.size])),stats:{...stats}})
  }
  function resetStats(){for(const k of Object.keys(stats))stats[k]=0}
  return Object.freeze({VERSION,DATA_SCHEMA,DATA_VERSION,LEGACY_DATA_SCHEMA,LEGACY_DATA_VERSION,SOURCE_POOL_VERSION,CODEC,registerData,registerShard,registerEncodedShard,ensureDifficulty,materializeDifficulty,clear,lookup,tryPlan,info,stats,_test:Object.freeze({planner,difficultyKey,deductionSignature,cellFromIndex,sessionFingerprint,hex16ToBase64Url,fingerprintKey,decodeSelection,validSelectionMeta,validProfileSummary,validProofMeta,validSignaturePair,signatureFromId,validMaterializedDag,decodeMaterialized,validSeedId,validCompactStep,contractMatches,validateData,validateShard,validEncodedEnvelope,base64Bytes,lz4Decode,utf8Text,decodeEncodedShard,dataFor,stepsFor,puzzleCountFor,buildIndex,directMatches,resolveSeed,profileFromSummary,decodeProof,directlyConcludesTarget,materializedPlan,shardUrl,resetStats})});
});
