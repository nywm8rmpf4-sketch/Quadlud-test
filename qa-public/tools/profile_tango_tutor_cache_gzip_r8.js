#!/usr/bin/env node
/*
 * QUADLUD — profile lossless transports for certified Soleil-Lune R8 shards.
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const Cache=require(path.join(ROOT,'tango-tutor-precomputed-cache.js'));
const DIFFS=['easy','medium','hard','expert'];
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function encodeBinary(value){
  const chunks=[];let bytes=0;
  const push=b=>{const x=Buffer.isBuffer(b)?b:Buffer.from(b);chunks.push(x);bytes+=x.length};
  const tag=n=>push(Buffer.from([n]));
  const varint=n=>{n=Math.trunc(n);const a=[];while(n>=128){a.push((n%128)|128);n=Math.floor(n/128)}a.push(n);push(Buffer.from(a))};
  const enc=v=>{
    if(v===null){tag(0);return}if(v===false){tag(1);return}if(v===true){tag(2);return}
    if(typeof v==='number'){
      if(Number.isSafeInteger(v)){tag(3);varint(v>=0?v*2:(-v)*2-1);return}
      tag(4);const b=Buffer.allocUnsafe(8);b.writeDoubleLE(v,0);push(b);return
    }
    if(typeof v==='string'){tag(5);const b=Buffer.from(v,'utf8');varint(b.length);push(b);return}
    if(Array.isArray(v)){tag(6);varint(v.length);for(const x of v)enc(x);return}
    if(v&&typeof v==='object'){const keys=Object.keys(v);tag(7);varint(keys.length);for(const k of keys){enc(k);enc(v[k])}return}
    throw new TypeError(`Unsupported value: ${typeof v}`)
  };
  enc(value);return Buffer.concat(chunks,bytes)
}
const out={schema:2,sourceDataVersion:Cache.DATA_VERSION,difficulties:{},totals:{rawJsonBytes:0,jsonGzipBytes:0,binaryBytes:0,binaryGzipBytes:0,binaryGzipBase64Bytes:0}};
for(const diff of DIFFS){
  const env=require(path.join(ROOT,`tango-tutor-cache-r8-${diff}.js`));
  const data=Cache._test.decodeEncodedShard(env);
  const json=Buffer.from(JSON.stringify(data),'utf8'),jsonGzip=zlib.gzipSync(json,{level:9});
  const binary=encodeBinary(data),binaryGzip=zlib.gzipSync(binary,{level:9});
  const row={rawJsonBytes:json.length,jsonGzipBytes:jsonGzip.length,binaryBytes:binary.length,binaryGzipBytes:binaryGzip.length,binaryGzipBase64Bytes:Buffer.byteLength(binaryGzip.toString('base64')),rawSha256:sha256(json),binarySha256:sha256(binary),binaryGzipSha256:sha256(binaryGzip),steps:data.steps.length,puzzles:data.puzzleCount};
  out.difficulties[diff]=row;for(const k of ['rawJsonBytes','jsonGzipBytes','binaryBytes','binaryGzipBytes','binaryGzipBase64Bytes'])out.totals[k]+=row[k];
}
console.log('TANGO_R8_GZIP_PROFILE',JSON.stringify(out));
