#!/usr/bin/env node
'use strict';
/* QUADLUD — Soleil-Lune Tutor target-only cache ambiguity audit
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const poolPath=process.argv[2];const cacheDir=process.argv[3];
if(!poolPath||!cacheDir)throw new Error('usage: test pool.js cacheDir');
const Pool=require(path.resolve(poolPath));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of ['difficulty-rating.js','tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js','tango-played-move-runtime.js','tango-human-pedagogy-r4.js','tango-tutor-single-planner-r5.js'])require(path.join(ROOT,file));
const DR=require(path.join(ROOT,'difficulty-rating.js')),Planner=global.QuadludTangoPlayedMovePlanner;
function stateForEntry(e){const s=Array.from({length:6},()=>Array(6).fill(-1));for(const i of e.givens||[])s[Math.floor(i/6)][i%6]=e.sol[Math.floor(i/6)][i%6];return s}
function publicPuzzle(e,s){return {game:'tango',n:6,state:s.map(r=>r.slice()),edges:(e.edges||[]).map(x=>x.slice())}}
function sameTarget(d,index,value){return (d.conclusions||[]).some(c=>c?.type==='VALUE'&&Number(c?.cell?.[0])*6+Number(c?.cell?.[1])===index&&Number(c.value)===value)}
const report={schema:1,totalSteps:0,uniqueByTarget:0,ambiguousByTarget:0,missingByTarget:0,maxMatches:0,byDifficulty:{},ambiguousExamples:[]};
for(const diff of ['easy','medium','hard','expert']){
 const cache=JSON.parse(fs.readFileSync(path.join(cacheDir,`tango-tutor-cache-${diff}.json`),'utf8')),source=Pool.entries[diff];
 let unique=0,ambiguous=0,missing=0,max=0,steps=0;
 for(const [poolIndex,,records] of cache.entries){
  const e=source[poolIndex],state=stateForEntry(e),tier=Planner.tierIndexForDifficulty(diff);
  for(const rec of records){
   const [fingerprint,advanced,target,value,signature]=rec;steps++;report.totalSteps++;
   const puzzle=publicPuzzle(e,state),actual=DR.fingerprintPublicPuzzle(puzzle);if(actual!==fingerprint)throw new Error(`${diff}[${poolIndex}] fingerprint drift`);
   if(advanced!==0)throw new Error(`${diff}[${poolIndex}] unexpected advanced seed`);
   const engine=Planner.sessionFromPublicBoard(puzzle,state),matches=Planner._test.allowedDirectDeductions(engine,tier).filter(d=>sameTarget(d,target,value));
   max=Math.max(max,matches.length);report.maxMatches=Math.max(report.maxMatches,matches.length);
   if(matches.length===1){unique++;report.uniqueByTarget++;}
   else if(matches.length===0){missing++;report.missingByTarget++;}
   else{ambiguous++;report.ambiguousByTarget++;if(report.ambiguousExamples.length<20)report.ambiguousExamples.push({diff,poolIndex,target,value,count:matches.length,expectedSignature:signature,signatures:matches.map(d=>String(d.signature||d.id||''))})}
   state[Math.floor(target/6)][target%6]=value;
  }
 }
 report.byDifficulty[diff]={steps,unique,ambiguous,missing,maxMatches:max};
}
console.log(JSON.stringify(report,null,2));
if(report.missingByTarget)process.exitCode=2;
