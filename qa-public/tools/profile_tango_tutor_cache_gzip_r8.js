#!/usr/bin/env node
/*
 * QUADLUD — profile gzip transport for certified Soleil-Lune R8 shards.
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const Cache=require(path.join(ROOT,'tango-tutor-precomputed-cache.js'));
const DIFFS=['easy','medium','hard','expert'];
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const out={schema:1,sourceDataVersion:Cache.DATA_VERSION,difficulties:{},totals:{rawJsonBytes:0,gzipBytes:0,base64Bytes:0}};
for(const diff of DIFFS){
  const env=require(path.join(ROOT,`tango-tutor-cache-r8-${diff}.js`));
  const data=Cache._test.decodeEncodedShard(env);
  const json=Buffer.from(JSON.stringify(data),'utf8');
  const gzip=zlib.gzipSync(json,{level:9});
  const b64=gzip.toString('base64');
  const roundtrip=zlib.gunzipSync(gzip);
  if(!roundtrip.equals(json))throw new Error(`${diff}: gzip roundtrip mismatch`);
  out.difficulties[diff]={rawJsonBytes:json.length,gzipBytes:gzip.length,base64Bytes:Buffer.byteLength(b64),rawSha256:sha256(json),gzipSha256:sha256(gzip),steps:data.steps.length,puzzles:data.puzzleCount};
  out.totals.rawJsonBytes+=json.length;out.totals.gzipBytes+=gzip.length;out.totals.base64Bytes+=Buffer.byteLength(b64);
}
console.log('TANGO_R8_GZIP_PROFILE',JSON.stringify(out));
