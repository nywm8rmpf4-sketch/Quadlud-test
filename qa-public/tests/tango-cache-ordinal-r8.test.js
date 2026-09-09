#!/usr/bin/env node
'use strict';
/* QUADLUD — Soleil-Lune Tutor cache ordinal audit
 * Copyright © 2026 Serge Benoliel. All rights reserved. */
const path=require('path');
const fs=require('fs');
const ROOT=path.resolve(__dirname,'../..');
const poolPath=path.resolve(process.argv[2]||'tango-diversity-pool.js');
const cacheDir=path.resolve(process.argv[3]||'.');
const Pool=require(poolPath);
const DR=require(path.join(ROOT,'difficulty-rating.js'));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of ['tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js','tango-played-move-runtime.js','tango-human-pedagogy-r4.js','tango-tutor-single-planner-r5.js'])require(path.join(ROOT,file));
const Planner=global.QuadludTangoPlayedMovePlanner;
if(!Planner)throw new Error('Tango planner unavailable');
const DIFFS=['easy','medium','hard','expert'];
const sig=d=>String(d?.signature||d?.id||'');
const stateFor=e=>{const s=Array.from({length:6},()=>Array(6).fill(-1));for(const i of e.givens||[])s[Math.floor(i/6)][i%6]=e.sol[Math.floor(i/6)][i%6];return s};
const puzzle=(e,state)=>({game:'tango',n:6,state:state.map(r=>r.slice()),edges:(e.edges||[]).map(x=>x.slice())});
const report={schema:1,sourcePoolVersion:Pool.version,totalSteps:0,maxAllowed:0,maxOrdinal:0,byDifficulty:{}};
for(const diff of DIFFS){
  const cache=JSON.parse(fs.readFileSync(path.join(cacheDir,`tango-tutor-cache-${diff}.json`),'utf8'));
  if(cache.poolVersion!==Pool.version)throw new Error(`${diff}: pool/cache mismatch`);
  if(cache.entries.length!==Pool.entries[diff].length)throw new Error(`${diff}: entry count mismatch`);
  let steps=0,maxAllowed=0,maxOrdinal=0;
  for(let pi=0;pi<cache.entries.length;pi++){
    const entry=Pool.entries[diff][pi],state=stateFor(entry),records=cache.entries[pi][2]||[];
    for(let si=0;si<records.length;si++){
      const rec=records[si],fp=DR.fingerprintPublicPuzzle(puzzle(entry,state));
      if(fp!==rec[0])throw new Error(`${diff}[${pi}]#${si}: fingerprint drift`);
      if(rec[1]!==0)throw new Error(`${diff}[${pi}]#${si}: advanced seed cannot use direct ordinal encoding`);
      const engine=Planner.sessionFromPublicBoard(puzzle(entry,state),state),tier=Planner.tierIndexForDifficulty(diff),allowed=Planner._test.allowedDirectDeductions(engine,tier),signature=String(rec[4]||''),matches=[];
      allowed.forEach((d,i)=>{if(sig(d)===signature)matches.push(i)});
      if(matches.length!==1)throw new Error(`${diff}[${pi}]#${si}: signature resolves ${matches.length} times`);
      const ordinal=matches[0],starting=allowed[ordinal];maxAllowed=Math.max(maxAllowed,allowed.length);maxOrdinal=Math.max(maxOrdinal,ordinal);
      const plan=Planner._test.planFromFirstDeduction(engine,tier,starting,{advancedStart:false,initialStateValidated:true});
      const target=Number(rec[2]),tr=Math.floor(target/6),tc=target%6;
      if(plan?.status!=='move'||plan.target?.[0]!==tr||plan.target?.[1]!==tc||plan.value!==rec[3])throw new Error(`${diff}[${pi}]#${si}: ordinal reconstruction changed move`);
      if(sig(plan.startingDeduction||plan.deduction)!==signature)throw new Error(`${diff}[${pi}]#${si}: ordinal reconstruction changed starting proof`);
      if(!Planner.applyPlayedMoveToState(state,plan))throw new Error(`${diff}[${pi}]#${si}: move apply failed`);
      steps++;
    }
  }
  report.byDifficulty[diff]={puzzles:cache.entries.length,steps,maxAllowed,maxOrdinal};report.totalSteps+=steps;report.maxAllowed=Math.max(report.maxAllowed,maxAllowed);report.maxOrdinal=Math.max(report.maxOrdinal,maxOrdinal);
}
console.log(JSON.stringify(report,null,2));
if(report.totalSteps!==14861)process.exit(2);
if(report.maxOrdinal>255||report.maxAllowed>256)process.exit(3);
