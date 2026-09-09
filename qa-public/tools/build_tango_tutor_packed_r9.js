#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — Soleil-Lune guarded packed Tutor cache builder R9
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software.
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const poolPath=path.resolve(process.argv[2]||'tango-diversity-pool.js');
const cacheDir=path.resolve(process.argv[3]||'.');
const outDir=path.resolve(process.argv[4]||'tango-tutor-packed-r9');
const Pool=require(poolPath),DR=require(path.join(ROOT,'difficulty-rating.js'));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of ['tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js','tango-played-move-runtime.js','tango-human-pedagogy-r4.js','tango-tutor-single-planner-r5.js'])require(path.join(ROOT,file));
const Planner=global.QuadludTangoPlayedMovePlanner;if(!Planner)throw new Error('Tango planner unavailable');
const DIFFS=['easy','medium','hard','expert'],RECORD_BYTES=6,CHUNKS=2;
const sig=d=>String(d?.signature||d?.id||'');
const stateFor=e=>{const s=Array.from({length:6},()=>Array(6).fill(-1));for(const i of e.givens||[])s[Math.floor(i/6)][i%6]=e.sol[Math.floor(i/6)][i%6];return s};
const puzzle=(e,state)=>({game:'tango',n:6,state:state.map(r=>r.slice()),edges:(e.edges||[]).map(x=>x.slice())});
function fnv24(text,salt){let h=2166136261>>>0,s=String(text)+'#'+String(salt);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)&0xffffff}
function findSalt(records){for(let salt=0;salt<100000;salt++){const seen=new Set();let ok=true;for(const r of records){const h=fnv24(r.fp,salt);if(seen.has(h)){ok=false;break}seen.add(h)}if(ok)return salt}throw new Error('Could not find collision-free 24-bit hash salt')}
function internMeta(map,list,meta){const compact=(meta||[]).slice(0,5),key=JSON.stringify(compact);if(map.has(key))return map.get(key);const id=list.length;if(id>255)throw new Error('selection metadata dictionary exceeds one byte');map.set(key,id);list.push(compact);return id}
function encode(records,salt){const b=Buffer.alloc(records.length*RECORD_BYTES);records.forEach((r,i)=>{const o=i*RECORD_BYTES,h=fnv24(r.fp,salt),tv=r.target|(r.value<<6);b[o]=(h>>>16)&255;b[o+1]=(h>>>8)&255;b[o+2]=h&255;b[o+3]=tv;b[o+4]=r.ordinal;b[o+5]=r.metaId});return b}
function sha(buf){return crypto.createHash('sha256').update(buf).digest('hex')}
fs.mkdirSync(outDir,{recursive:true});
const selectionMeta=[],metaMap=new Map(),recordsByDiff={},salts={},chunkStepCounts={},puzzleCounts={},stepCounts={};let total=0,maxAllowed=0,maxOrdinal=0;
for(const diff of DIFFS){
  const cache=JSON.parse(fs.readFileSync(path.join(cacheDir,`tango-tutor-cache-${diff}.json`),'utf8'));
  if(cache.poolVersion!==Pool.version||cache.entries.length!==Pool.entries[diff].length)throw new Error(`${diff}: pool/cache mismatch`);
  puzzleCounts[diff]=cache.entries.length;const records=[];
  for(let pi=0;pi<cache.entries.length;pi++){
    const entry=Pool.entries[diff][pi],state=stateFor(entry),source=cache.entries[pi][2]||[];
    for(let si=0;si<source.length;si++){
      const rec=source[si],fp=DR.fingerprintPublicPuzzle(puzzle(entry,state));if(fp!==rec[0])throw new Error(`${diff}[${pi}]#${si}: fingerprint drift`);if(rec[1]!==0)throw new Error('advanced seed unsupported by R9');
      const engine=Planner.sessionFromPublicBoard(puzzle(entry,state),state),tier=Planner.tierIndexForDifficulty(diff),allowed=Planner._test.allowedDirectDeductions(engine,tier),matches=[];allowed.forEach((d,i)=>{if(sig(d)===String(rec[4]||''))matches.push(i)});if(matches.length!==1)throw new Error(`${diff}[${pi}]#${si}: non-unique ordinal`);
      const ordinal=matches[0];if(ordinal>255)throw new Error('ordinal exceeds one byte');maxAllowed=Math.max(maxAllowed,allowed.length);maxOrdinal=Math.max(maxOrdinal,ordinal);
      const plan=Planner._test.planFromFirstDeduction(engine,tier,allowed[ordinal],{advancedStart:false,initialStateValidated:true}),target=Number(rec[2]),tr=Math.floor(target/6),tc=target%6;if(plan?.status!=='move'||plan.target?.[0]!==tr||plan.target?.[1]!==tc||plan.value!==rec[3]||sig(plan.startingDeduction||plan.deduction)!==String(rec[4]||''))throw new Error(`${diff}[${pi}]#${si}: reconstruction drift`);
      records.push({fp,target,value:rec[3],ordinal,metaId:internMeta(metaMap,selectionMeta,rec[5])});if(!Planner.applyPlayedMoveToState(state,plan))throw new Error('move apply failed');
    }
  }
  const salt=findSalt(records),bytes=encode(records,salt);salts[diff]=salt;recordsByDiff[diff]=records;stepCounts[diff]=records.length;total+=records.length;
  const cut=Math.ceil(records.length/CHUNKS),counts=[];for(let ci=0;ci<CHUNKS;ci++){const start=ci*cut,end=Math.min(records.length,(ci+1)*cut),count=Math.max(0,end-start),part=bytes.subarray(start*RECORD_BYTES,end*RECORD_BYTES);counts.push(count);const src=`/* QUADLUD — packed Tango Tutor cache ${diff} chunk ${ci+1}/${CHUNKS}; Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root){'use strict';const C=root.QuadludTangoTutorPrecomputedCache;if(!C||typeof C.registerPackedChunk!=='function')throw new Error('Soleil-Lune Tutor cache runtime unavailable');C.registerPackedChunk(${JSON.stringify(diff)},${ci},${JSON.stringify(part.toString('base64'))});})(typeof globalThis!=='undefined'?globalThis:this);\n`;fs.writeFileSync(path.join(outDir,`tango-tutor-precomputed-${diff}-${ci+1}.js`),src)}chunkStepCounts[diff]=counts;
}
if(total!==14861)throw new Error(`unexpected total ${total}`);
const manifest={schema:9,version:'tango-tutor-cache-r9-ordinal-h24',sourcePoolVersion:Pool.version,plannerVersion:Planner.VERSION,costModel:Planner.COST_MODEL,recordBytes:RECORD_BYTES,puzzleCounts,stepCounts,chunkStepCounts,salts,selectionMeta};
const manifestSource=`/*\n * QUADLUD — packed Soleil-Lune Tutor cache manifest R9\n * Copyright © 2026 Serge Benoliel. All rights reserved.\n */\n(function(root){'use strict';const C=root.QuadludTangoTutorPrecomputedCache;if(!C||typeof C.registerManifest!=='function')throw new Error('Soleil-Lune Tutor cache runtime unavailable');const M=${JSON.stringify(manifest)};C.registerManifest(M);root.QuadludTangoTutorPrecomputedData=Object.freeze({schema:M.schema,version:M.version,sourcePoolVersion:M.sourcePoolVersion,puzzleCounts:Object.freeze({...M.puzzleCounts}),stepCounts:Object.freeze({...M.stepCounts})});})(typeof globalThis!=='undefined'?globalThis:this);\n`;
fs.writeFileSync(path.join(outDir,'tango-tutor-precomputed-manifest.js'),manifestSource);
const files=fs.readdirSync(outDir).sort().map(name=>{const b=fs.readFileSync(path.join(outDir,name));return {name,bytes:b.length,sha256:sha(b)}}),report={schema:1,version:manifest.version,totalSteps:total,maxAllowed,maxOrdinal,selectionMeta:selectionMeta.length,salts,puzzleCounts,stepCounts,chunkStepCounts,files,totalBytes:files.reduce((s,f)=>s+f.bytes,0)};
fs.writeFileSync(path.join(outDir,'tango-tutor-precomputed-r9-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
