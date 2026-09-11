#!/usr/bin/env node
/*
 * QUADLUD — R8 sharded Tutor cache lossless roundtrip regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub'),repo=path.resolve(__dirname,'../..'),WEB=fs.existsSync(path.join(candidate,'tango-tutor-precomputed-cache.js'))?candidate:repo;
const Cache=require(path.join(WEB,'tango-tutor-precomputed-cache.js'));
const legacy=require(path.join(WEB,'tango-tutor-cache-data-r8.js'));
const DIFFS=['easy','medium','hard','expert'];
function seed(data,kind,id){return kind===0?Cache._test.signatureFromId(id,data):Cache._test.decodeMaterialized(data,id)}
function normalize(data,step){return {
  fingerprint:step[0],advanced:step[1],target:step[3],value:step[4],
  starting:seed(data,step[2],step[5]),selection:data.selectionMeta[step[6]],
  display:seed(data,step[7],step[8]),proof:data.proofMeta[step[9]]
}}
let total=0,totalBytes=0;
for(const diff of DIFFS){
  const file=path.join(WEB,`tango-tutor-cache-r8-${diff}.js`),bytes=fs.statSync(file).size;totalBytes+=bytes;
  assert(bytes<1000000,`${diff} shard must stay below 1,000,000 bytes, got ${bytes}`);
  const envelope=require(file);assert(Cache._test.validEncodedEnvelope(envelope),`${diff} envelope invalid`);
  const shard=Cache._test.decodeEncodedShard(envelope);assert(Cache._test.validateShard(shard,diff),`${diff} decoded shard invalid`);
  const oldSteps=legacy.steps[diff];assert.strictEqual(shard.steps.length,oldSteps.length,`${diff} step count`);assert.strictEqual(shard.puzzleCount,120,`${diff} puzzle count`);
  for(let i=0;i<oldSteps.length;i++)assert.deepStrictEqual(normalize(shard,shard.steps[i]),normalize(legacy,oldSteps[i]),`${diff} semantic step mismatch at ${i}`);
  total+=oldSteps.length;
}
assert.strictEqual(total,14861,'all canonical visible states covered');
const expert=require(path.join(WEB,'tango-tutor-cache-r8-expert.js'));
const corrupt={...expert,payload:expert.payload.slice(0,-8)+'AAAAAAAA'};
assert.throws(()=>Cache._test.decodeEncodedShard(corrupt),/LZ4|JSON|Invalid|size/i,'corrupt shard must be rejected');
console.log('PASS v319-r8-sharded-cache-roundtrip',JSON.stringify({states:total,totalBytes,files:Object.fromEntries(DIFFS.map(d=>[d,fs.statSync(path.join(WEB,`tango-tutor-cache-r8-${d}.js`)).size]))}));
