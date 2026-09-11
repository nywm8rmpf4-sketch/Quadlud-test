#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — Soleil-Lune synchronized compact Tutor cache R8
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation without prior written authorization is prohibited.
 */
const fs=require('fs'),path=require('path'),Dag=require('./tango_materialized_dag.js');
const cacheDir=path.resolve(process.argv[2]||'');
const outDir=path.resolve(process.argv[3]||'');
if(!cacheDir||!outDir)throw new Error('usage: compact_tango_tutor_sync_r8.js <shard-dir> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const DIFFS=['easy','medium','hard','expert'];
const data={schema:9,version:'tango-tutor-cache-r8-sync4-cognitive-dag',sourcePoolVersion:null,tutorContract:null,tutorPlannerToken:null,humanPolicy:null,proofPolicy:null,cognitiveModel:null,cognitivePatternCatalog:null,rules:[],payloads:[],signaturePairs:[],materializedDag:null,selectionMeta:[],proofMeta:[],puzzleCounts:{},steps:{}};
const materializedDeductions=[];
const ruleIds=new Map(),payloadIds=new Map(),sigIds=new Map(),deductionIds=new Map(),selectionIds=new Map(),proofIds=new Map();
const idFor=(map,array,key,value)=>{if(map.has(key))return map.get(key);const id=array.length;map.set(key,id);array.push(value);return id};
function fpKey(fp){const m=/^qfp1-([0-9a-f]{32})$/.exec(String(fp||''));if(!m)throw new Error(`invalid fingerprint ${fp}`);return Buffer.from(m[1],'hex').toString('base64url')}
function splitSignature(signature){const s=String(signature||''),i=s.indexOf('|');return i<0?[s,'']:[s.slice(0,i),s.slice(i+1)]}
function signatureId(signature){const [rule,suffix]=splitSignature(signature);if(!rule)throw new Error('empty deduction signature');const rid=idFor(ruleIds,data.rules,rule,rule),pid=suffix?idFor(payloadIds,data.payloads,suffix,suffix):-1,key=`${rid}:${pid}`;return idFor(sigIds,data.signaturePairs,key,[rid,pid])}
function deductionId(d){const key=JSON.stringify(d);return idFor(deductionIds,materializedDeductions,key,d)}
function seedId(kind,payload){return kind===0?signatureId(payload):deductionId(payload)}
function identity(source){return JSON.stringify([source.poolVersion,source.tutorContract?.schema,source.tutorContract?.version,source.tutorContract?.algorithm,source.tutorContract?.digest,source.tutorPlannerToken,source.humanPolicy,source.proofPolicy,source.cognitiveModel,source.cognitivePatternCatalog])}
let expectedIdentity=null,totalSteps=0,advancedMoves=0,directStarts=0,materializedStarts=0,directDisplays=0,materializedDisplays=0;
for(const diff of DIFFS){
  const file=path.join(cacheDir,`tango-tutor-sync-${diff}.json`),source=JSON.parse(fs.readFileSync(file,'utf8'));
  if(source.schema!==3||source.version!=='tango-tutor-sync-shard-r3-cognitive'||source.difficulty!==diff||!source.tutorContract?.digest||!source.tutorPlannerToken||!source.humanPolicy||!source.proofPolicy||!source.cognitiveModel||!source.cognitivePatternCatalog||!Array.isArray(source.entries)||source.entries.length!==120)throw new Error(`${diff}: invalid synchronized cognitive Tutor shard`);
  const ident=identity(source);if(expectedIdentity===null){expectedIdentity=ident;data.sourcePoolVersion=source.poolVersion;data.tutorContract=source.tutorContract;data.tutorPlannerToken=source.tutorPlannerToken;data.humanPolicy=source.humanPolicy;data.proofPolicy=source.proofPolicy;data.cognitiveModel=source.cognitiveModel;data.cognitivePatternCatalog=source.cognitivePatternCatalog}else if(ident!==expectedIdentity)throw new Error(`${diff}: Tutor algorithm identity differs between shards`);
  data.puzzleCounts[diff]=source.entries.length;const out=[],seen=new Map();
  for(const entry of source.entries){
    if(!Array.isArray(entry)||!Array.isArray(entry[2]))throw new Error(`${diff}: invalid shard entry`);
    for(const step of entry[2]){
      if(!Array.isArray(step)||step.length!==10)throw new Error(`${diff}: invalid synchronized step`);
      const [fingerprint,advancedFlag,startKind,target,value,startPayload,selection,displayKind,displayPayload,proofMeta]=step;
      if((advancedFlag!==0&&advancedFlag!==1)||(startKind!==0&&startKind!==1)||(displayKind!==0&&displayKind!==1)||!Number.isInteger(target)||target<0||target>=36||(value!==0&&value!==1)||!Array.isArray(selection)||selection.length<5||!Array.isArray(proofMeta)||proofMeta.length<16)throw new Error(`${diff}: malformed synchronized cognitive step`);
      const startId=seedId(startKind,startPayload),displayId=seedId(displayKind,displayPayload),selKey=JSON.stringify(selection),selId=idFor(selectionIds,data.selectionMeta,selKey,selection),proofKey=JSON.stringify(proofMeta),proofId=idFor(proofIds,data.proofMeta,proofKey,proofMeta);
      const compact=[fpKey(fingerprint),advancedFlag,startKind,target,value,startId,selId,displayKind,displayId,proofId],key=compact[0],previous=seen.get(key);
      if(previous&&JSON.stringify(previous)!==JSON.stringify(compact))throw new Error(`${diff}: conflicting visible-state fingerprint ${fingerprint}`);
      if(!previous){seen.set(key,compact);out.push(compact)}
      if(advancedFlag)advancedMoves++;startKind===0?directStarts++:materializedStarts++;displayKind===0?directDisplays++:materializedDisplays++;totalSteps++;
    }
  }
  data.steps[diff]=out;
}
data.materializedDag=Dag.pack(materializedDeductions);
if(!Dag.validate(data.materializedDag)||data.materializedDag.roots.length!==materializedDeductions.length)throw new Error('invalid materialized proof DAG');
for(let i=0;i<materializedDeductions.length;i++)if(JSON.stringify(Dag.decode(data.materializedDag,i))!==JSON.stringify(materializedDeductions[i]))throw new Error(`materialized DAG round-trip mismatch at root ${i}`);
function signatureFromId(id){const pair=data.signaturePairs[id];if(!Array.isArray(pair))return null;const rule=data.rules[pair[0]],suffix=pair[1]>=0?data.payloads[pair[1]]:'';return suffix?`${rule}|${suffix}`:rule}
function fpFromKey(key){return `qfp1-${Buffer.from(key,'base64url').toString('hex')}`}
function expandSeed(kind,id){return kind===0?signatureFromId(id):Dag.decode(data.materializedDag,id)}
for(const diff of DIFFS){
  const source=JSON.parse(fs.readFileSync(path.join(cacheDir,`tango-tutor-sync-${diff}.json`),'utf8')),sourceSteps=source.entries.flatMap(e=>e[2]),out=data.steps[diff];
  if(identity(source)!==expectedIdentity||sourceSteps.length!==out.length)throw new Error(`${diff}: synchronized compaction cardinality/identity mismatch`);
  sourceSteps.forEach((oldStep,i)=>{const x=out[i];if(fpFromKey(x[0])!==oldStep[0]||x[1]!==oldStep[1]||x[2]!==oldStep[2]||x[3]!==oldStep[3]||x[4]!==oldStep[4]||JSON.stringify(expandSeed(x[2],x[5]))!==JSON.stringify(oldStep[5])||JSON.stringify(data.selectionMeta[x[6]])!==JSON.stringify(oldStep[6])||x[7]!==oldStep[7]||JSON.stringify(expandSeed(x[7],x[8]))!==JSON.stringify(oldStep[8])||JSON.stringify(data.proofMeta[x[9]])!==JSON.stringify(oldStep[9]))throw new Error(`${diff}: lossless round-trip mismatch at step ${i}`)})
}
const json=JSON.stringify(data),js=`/* QUADLUD — synchronized generated Soleil-Lune cognitive Tutor cache R8. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root){'use strict';const d=${json};root.QuadludTangoTutorCacheDataR8=d;const c=root.QuadludTangoTutorPrecomputedCache;if(c&&typeof c.registerData==='function'){try{c.registerData(d)}catch(_){}}if(typeof module!=='undefined'&&module.exports)module.exports=d;})(typeof globalThis!=='undefined'?globalThis:this);\n`;
fs.writeFileSync(path.join(outDir,'tango-tutor-cache-data-r8.js'),js);
const materializedRawBytes=Buffer.byteLength(JSON.stringify(materializedDeductions)),materializedPackedBytes=Buffer.byteLength(JSON.stringify(data.materializedDag));
const report={schema:4,version:data.version,sourcePoolVersion:data.sourcePoolVersion,tutorContract:data.tutorContract,tutorPlannerToken:data.tutorPlannerToken,humanPolicy:data.humanPolicy,proofPolicy:data.proofPolicy,cognitiveModel:data.cognitiveModel,cognitivePatternCatalog:data.cognitivePatternCatalog,puzzles:data.puzzleCounts,steps:Object.fromEntries(DIFFS.map(d=>[d,data.steps[d].length])),totalSteps,advancedMoves,directStarts,materializedStarts,directDisplays,materializedDisplays,rules:data.rules.length,payloads:data.payloads.length,signatures:data.signaturePairs.length,materializedDeductions:materializedDeductions.length,materializedDagNodes:data.materializedDag.nodes.length,materializedDagKeys:data.materializedDag.keys.length,materializedDagStrings:data.materializedDag.strings.length,materializedRawBytes,materializedPackedBytes,materializedReductionPct:Number(((1-materializedPackedBytes/materializedRawBytes)*100).toFixed(2)),selectionMeta:data.selectionMeta.length,proofMeta:data.proofMeta.length,bytes:Buffer.byteLength(js)};
fs.writeFileSync(path.join(outDir,'tango-tutor-cache-r8-sync-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
