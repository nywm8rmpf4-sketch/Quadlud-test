#!/usr/bin/env node
'use strict';
/* QUADLUD — cognitive Tutor cache depth diagnostics
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const fs=require('fs'),path=require('path');
const data=require(path.resolve(process.argv[2]||'tango-tutor-cache-data-r8.js'));
const Dag=require('./tango_materialized_dag.js');
const DIFFS=['easy','medium','hard','expert'];
function profile(meta){const s=meta?.[13];return Array.isArray(s)?{raw:Number(s[0]),chunks:Number(s[1]),display:Number(s[2]),effective:Number(s[3]),recognition:Number(s[4]),attention:Number(s[5]),branches:Number(s[6]),penalty:Number(s[7]),band:Number(s[8])}:null}
function fp(key){try{return 'qfp1-'+Buffer.from(String(key),'base64url').toString('hex')}catch(_){return String(key)}}
function signature(id){const pair=data.signaturePairs?.[id];if(!pair)return null;const rule=data.rules?.[pair[0]],suffix=pair[1]>=0?data.payloads?.[pair[1]]:'';return suffix?`${rule}|${suffix}`:rule}
function seed(kind,id){return kind===1?Dag.decode(data.materializedDag,id):{signature:signature(id)}}
function compactDeduction(d){if(!d||typeof d!=='object')return null;const rules={};let objects=0,arrays=0,maxDepth=0;function walk(x,depth=0){maxDepth=Math.max(maxDepth,depth);if(Array.isArray(x)){arrays++;for(const v of x)walk(v,depth+1)}else if(x&&typeof x==='object'){objects++;if(typeof x.rule==='string')rules[x.rule]=(rules[x.rule]||0)+1;for(const v of Object.values(x))walk(v,depth+1)}}walk(d);const explanation=d.explanationData||{};return {rule:d.rule||null,signature:d.signature||d.id||null,premises:Array.isArray(d.premises)?d.premises.length:0,conclusions:Array.isArray(d.conclusions)?d.conclusions.length:0,traceLength:Array.isArray(explanation.trace)?explanation.trace.length:null,causalTraceLength:Array.isArray(explanation.causalTrace)?explanation.causalTrace.length:null,jsonBytes:Buffer.byteLength(JSON.stringify(d)),objects,arrays,maxDepth,rules}}
const rows=[],summary={};
for(const diff of DIFFS){summary[diff]={states:0,bands:{},over9:0,max:null};for(const step of data.steps[diff]||[]){const p=profile(data.proofMeta?.[step[9]]);if(!p)continue;const row={difficulty:diff,fingerprint:fp(step[0]),advanced:step[1]===1,targetIndex:step[3],target:[Math.floor(step[3]/6),step[3]%6],value:step[4],startKind:step[2],startId:step[5],displayKind:step[7],displayId:step[8],proofMetaId:step[9],profile:p};rows.push(row);const s=summary[diff];s.states++;s.bands[p.band]=(s.bands[p.band]||0)+1;if(p.band>=4)s.over9++;if(!s.max||p.effective>s.max.profile.effective)s.max=row}}
rows.sort((a,b)=>b.profile.effective-a.profile.effective||b.profile.display-a.profile.display||a.difficulty.localeCompare(b.difficulty));
const top=rows.slice(0,20).map(row=>({...row,start:compactDeduction(seed(row.startKind,row.startId)),displayDeduction:compactDeduction(seed(row.displayKind,row.displayId))}));
const distinctBand4=new Map();for(const r of rows.filter(x=>x.profile.band>=4)){const k=String(r.proofMetaId);if(!distinctBand4.has(k))distinctBand4.set(k,{proofMetaId:r.proofMetaId,profile:r.profile,references:0,difficulties:{},example:r});const x=distinctBand4.get(k);x.references++;x.difficulties[r.difficulty]=(x.difficulties[r.difficulty]||0)+1}
const report={schema:1,cacheVersion:data.version,totalStates:rows.length,summary,band4Distinct:distinctBand4.size,band4States:rows.filter(r=>r.profile.band>=4).length,top,band4Top:[...distinctBand4.values()].sort((a,b)=>b.profile.effective-a.profile.effective).slice(0,20)};
fs.writeFileSync(process.argv[3]||'tango-cognitive-depth-diagnostic.json',JSON.stringify(report,null,2));
console.log('COGNITIVE_DEPTH_DIAGNOSTIC',JSON.stringify({totalStates:report.totalStates,band4Distinct:report.band4Distinct,band4States:report.band4States,summary,ObjectTop:top.slice(0,5)}));
