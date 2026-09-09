#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — Soleil-Lune exact compact Tutor cache R8 materializer
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const fs=require('fs'),path=require('path');
const cacheDir=path.resolve(process.argv[2]||'');
const outDir=path.resolve(process.argv[3]||'');
if(!cacheDir||!outDir)throw new Error('usage: compact_tango_tutor_cache_exact_r8.js <r4-cache-dir> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const DIFFS=['easy','medium','hard','expert'];
const DATA={schema:6,version:'tango-tutor-cache-r8-b64-rule-dict',sourcePoolVersion:'tango-precompute-pool-v6-compact',rules:[],payloads:[],signaturePairs:[],selectionMeta:[],puzzleCounts:{},steps:{}};
const ruleIds=new Map(),payloadIds=new Map(),pairIds=new Map(),metaIds=new Map();
function idFor(map,array,key,value){if(map.has(key))return map.get(key);const id=array.length;map.set(key,id);array.push(value);return id}
function fpKey(fp){const m=/^qfp1-([0-9a-f]{32})$/.exec(String(fp||''));if(!m)throw new Error(`invalid fingerprint ${fp}`);return Buffer.from(m[1],'hex').toString('base64url')}
function splitSignature(signature){const s=String(signature||''),p=s.indexOf('|');return p<0?[s,'']:[s.slice(0,p),s.slice(p+1)]}
let totalSteps=0;
for(const diff of DIFFS){
  const file=path.join(cacheDir,`tango-tutor-cache-${diff}.json`),source=JSON.parse(fs.readFileSync(file,'utf8'));
  if(source.schema!==2||source.version!=='tango-tutor-cache-r4-lean'||source.poolVersion!=='tango-precompute-pool-v6-compact'||!Array.isArray(source.entries)||source.entries.length<120)throw new Error(`${diff}: invalid R4 source cache`);
  DATA.puzzleCounts[diff]=source.entries.length;const out=[],seen=new Map();
  for(const entry of source.entries){
    if(!Array.isArray(entry)||!Array.isArray(entry[2]))throw new Error(`${diff}: invalid entry`);
    for(const step of entry[2]){
      if(!Array.isArray(step)||step.length<6||step[1]!==0)throw new Error(`${diff}: R8 only accepts certified direct R4 seeds`);
      const [fingerprint,,target,value,signature,meta]=step;
      if(!Number.isInteger(target)||target<0||target>=36||(value!==0&&value!==1)||typeof signature!=='string'||!Array.isArray(meta)||meta.length<5)throw new Error(`${diff}: invalid R4 step`);
      const [rule,suffix]=splitSignature(signature);if(!rule)throw new Error(`${diff}: empty deduction rule`);
      const rid=idFor(ruleIds,DATA.rules,rule,rule),pid=suffix?idFor(payloadIds,DATA.payloads,suffix,suffix):-1;
      const pairKey=`${rid}:${pid}`,sigId=idFor(pairIds,DATA.signaturePairs,pairKey,[rid,pid]);
      const selected=[meta[0]||null,Number(meta[1])||0,Number(meta[2])||0,meta[3]===1?1:0,meta[4]===0?0:1],metaKey=JSON.stringify(selected),metaId=idFor(metaIds,DATA.selectionMeta,metaKey,selected);
      const compact=[fpKey(fingerprint),target,value,sigId,metaId],key=compact[0],previous=seen.get(key);
      if(previous&&JSON.stringify(previous)!==JSON.stringify(compact))throw new Error(`${diff}: conflicting exact fingerprint ${fingerprint}`);
      if(!previous){seen.set(key,compact);out.push(compact)}
      totalSteps++;
    }
  }
  DATA.steps[diff]=out;
}
function signatureFromId(id){const pair=DATA.signaturePairs[id],rule=DATA.rules[pair[0]],suffix=pair[1]>=0?DATA.payloads[pair[1]]:'';return suffix?`${rule}|${suffix}`:rule}
function fpFromKey(key){return `qfp1-${Buffer.from(key,'base64url').toString('hex')}`}
// Lossless round-trip against every source R4 step; no Tutor journey is recalculated here.
for(const diff of DIFFS){
  const source=JSON.parse(fs.readFileSync(path.join(cacheDir,`tango-tutor-cache-${diff}.json`),'utf8'));
  const sourceSteps=source.entries.flatMap(entry=>entry[2]);
  if(sourceSteps.length!==DATA.steps[diff].length)throw new Error(`${diff}: duplicate state unexpectedly removed (${sourceSteps.length} -> ${DATA.steps[diff].length})`);
  sourceSteps.forEach((oldStep,i)=>{const step=DATA.steps[diff][i];if(fpFromKey(step[0])!==oldStep[0]||step[1]!==oldStep[2]||step[2]!==oldStep[3]||signatureFromId(step[3])!==oldStep[4]||JSON.stringify(DATA.selectionMeta[step[4]])!==JSON.stringify([oldStep[5][0]||null,Number(oldStep[5][1])||0,Number(oldStep[5][2])||0,oldStep[5][3]===1?1:0,oldStep[5][4]===0?0:1]))throw new Error(`${diff}: round-trip mismatch at ${i}`)})
}
const json=JSON.stringify(DATA),js=`/* QUADLUD — generated exact compact Soleil-Lune Tutor cache R8. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root){'use strict';const d=${json};root.QuadludTangoTutorCacheDataR8=d;const c=root.QuadludTangoTutorPrecomputedCache;if(c&&typeof c.registerData==='function')c.registerData(d);if(typeof module!=='undefined'&&module.exports)module.exports=d;})(typeof globalThis!=='undefined'?globalThis:this);\n`;
fs.writeFileSync(path.join(outDir,'tango-tutor-cache-data-r8.js'),js);
const report={schema:1,version:DATA.version,sourcePoolVersion:DATA.sourcePoolVersion,puzzles:DATA.puzzleCounts,steps:Object.fromEntries(DIFFS.map(d=>[d,DATA.steps[d].length])),totalSteps,rules:DATA.rules.length,payloads:DATA.payloads.length,signatures:DATA.signaturePairs.length,selectionMeta:DATA.selectionMeta.length,bytes:Buffer.byteLength(js)};
fs.writeFileSync(path.join(outDir,'tango-tutor-cache-r8-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
