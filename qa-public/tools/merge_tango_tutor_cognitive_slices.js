#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — merge bounded cognitive Soleil-Lune Tutor shards
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const fs=require('fs'),path=require('path');
const dir=path.resolve(process.argv[2]||''),difficulty=String(process.argv[3]||'').toLowerCase(),out=path.resolve(process.argv[4]||'');
if(!dir||!['easy','medium','hard','expert'].includes(difficulty)||!out)throw new Error('usage: merge_tango_tutor_cognitive_slices.js <dir> <difficulty> <output>');
const files=fs.readdirSync(dir).filter(name=>name.startsWith(`tango-tutor-sync-${difficulty}-`)&&name.endsWith('.json')&&!name.includes('-report')).sort();
if(!files.length)throw new Error(`${difficulty}: no cognitive shard slices found`);
const identity=x=>JSON.stringify([x.schema,x.version,x.difficulty,x.poolVersion,x.tutorContract,x.tutorPlannerToken,x.humanPolicy,x.proofPolicy,x.cognitiveModel,x.cognitivePatternCatalog,x.entryShape,x.stepShape]);
let expected=null,template=null;const byIndex=new Map();
for(const name of files){
  const x=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
  if(x.schema!==3||x.version!=='tango-tutor-sync-shard-r3-cognitive'||x.difficulty!==difficulty||!Array.isArray(x.entries)||!x.entries.length)throw new Error(`${name}: invalid cognitive slice`);
  const id=identity(x);if(expected===null){expected=id;template=x}else if(id!==expected)throw new Error(`${name}: cognitive Tutor identity mismatch`);
  for(const entry of x.entries){const index=Number(entry?.[0]);if(!Number.isInteger(index)||index<0||index>=120)throw new Error(`${name}: invalid pool index ${entry?.[0]}`);const previous=byIndex.get(index);if(previous&&JSON.stringify(previous)!==JSON.stringify(entry))throw new Error(`${difficulty}: conflicting duplicate pool index ${index}`);if(previous)throw new Error(`${difficulty}: duplicate pool index ${index}`);byIndex.set(index,entry)}
}
const missing=[];for(let i=0;i<120;i++)if(!byIndex.has(i))missing.push(i);if(missing.length)throw new Error(`${difficulty}: missing pool indices ${missing.join(',')}`);if(byIndex.size!==120)throw new Error(`${difficulty}: expected 120 unique entries, got ${byIndex.size}`);
const merged={...template,entries:Array.from({length:120},(_,i)=>byIndex.get(i))};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(merged));
const states=merged.entries.reduce((sum,e)=>sum+(Array.isArray(e?.[2])?e[2].length:0),0);
console.log(JSON.stringify({difficulty,slices:files.length,puzzles:merged.entries.length,states,contract:merged.tutorContract?.digest,cognitiveModel:merged.cognitiveModel,cognitivePatternCatalog:merged.cognitivePatternCatalog}));
