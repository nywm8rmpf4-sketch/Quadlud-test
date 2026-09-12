#!/usr/bin/env node
/* QUADLUD — exact R8 gzip chunk transport parity. Copyright © 2026 Serge Benoliel. All rights reserved. */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..'),DIFFS=['easy','medium','hard','expert'];
const Cache=require(path.join(ROOT,'tango-tutor-precomputed-cache.js')),Transport=require(path.join(ROOT,'tango-tutor-gzip-chunk-transport-r8.js'));
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
  const Manifest=require(path.join(ROOT,'tango-tutor-cache-r8-gzip-manifest.js'));assert(Transport.registerManifest(Manifest));
  let total=0;const rows={};
  for(const diff of DIFFS){
    const entry=Manifest.difficulties[diff],b64=entry.chunks.map(name=>fs.readFileSync(path.join(ROOT,name),'utf8').trim()).join('');
    const decoded=await Transport._test.decodeBase64Gzip(b64,entry),legacyEnv=require(path.join(ROOT,`tango-tutor-cache-r8-${diff}.js`)),legacyDecoded=Cache._test.decodeEncodedShard(legacyEnv);
    const a=Buffer.from(JSON.stringify(decoded),'utf8'),b=Buffer.from(JSON.stringify(legacyDecoded),'utf8');
    assert(a.equals(b),`${diff}: gzip transport changed certified schema-10 JSON`);assert.strictEqual(sha256(a),entry.rawSha256);assert(Cache._test.validateShard(decoded,diff));
    assert.strictEqual(decoded.puzzleCount,120);total+=decoded.steps.length;rows[diff]={steps:decoded.steps.length,chunks:entry.chunks.length,rawSha256:entry.rawSha256};
  }
  assert.strictEqual(total,14861);console.log('PASS R8 gzip chunk exact roundtrip',JSON.stringify({states:total,difficulties:rows,transport:Transport.info()}));
})().catch(e=>{console.error(e);process.exit(1)});
