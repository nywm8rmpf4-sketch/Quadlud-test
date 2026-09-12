#!/usr/bin/env node
/*
 * QUADLUD — deterministic gzip chunk builder for certified Soleil-Lune R8 Tutor cache.
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..'),OUT=process.argv[2]?path.resolve(process.argv[2]):ROOT;
const Cache=require(path.join(ROOT,'tango-tutor-precomputed-cache.js'));
const DIFFS=['easy','medium','hard','expert'],CODEC='gzip-base64-chunks-v1',CHUNK_CHARS=60000;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(OUT,{recursive:true});
for(const name of fs.readdirSync(OUT))if(/^tango-tutor-cache-r8-(easy|medium|hard|expert)-gz-\d{2}\.txt$/.test(name))fs.unlinkSync(path.join(OUT,name));
const manifest={schema:1,codec:CODEC,dataSchema:Cache.DATA_SCHEMA,dataVersion:Cache.DATA_VERSION,sourcePoolVersion:Cache.SOURCE_POOL_VERSION,tutorContractDigest:null,chunkChars:CHUNK_CHARS,difficulties:{}};
for(const diff of DIFFS){
  const envelope=require(path.join(ROOT,`tango-tutor-cache-r8-${diff}.js`)),data=Cache._test.decodeEncodedShard(envelope),json=Buffer.from(JSON.stringify(data),'utf8');
  if(sha256(json)!==String(envelope.contentSha256))throw new Error(`${diff}: certified raw JSON SHA mismatch before gzip`);
  const gzip=zlib.gzipSync(json,{level:9}),roundtrip=zlib.gunzipSync(gzip);if(!roundtrip.equals(json))throw new Error(`${diff}: gzip roundtrip mismatch`);
  const b64=gzip.toString('base64'),chunks=[];for(let pos=0,index=0;pos<b64.length;pos+=CHUNK_CHARS,index++){const filename=`tango-tutor-cache-r8-${diff}-gz-${String(index).padStart(2,'0')}.txt`;fs.writeFileSync(path.join(OUT,filename),b64.slice(pos,pos+CHUNK_CHARS));chunks.push(filename)}
  const entry={difficulty:diff,codec:CODEC,puzzles:data.puzzleCount,steps:data.steps.length,rawJsonBytes:json.length,gzipBytes:gzip.length,base64Bytes:b64.length,rawSha256:sha256(json),gzipSha256:sha256(gzip),chunks};manifest.difficulties[diff]=entry;
  if(manifest.tutorContractDigest===null)manifest.tutorContractDigest=String(data.tutorContract?.digest||'');else if(manifest.tutorContractDigest!==String(data.tutorContract?.digest||''))throw new Error(`${diff}: tutor contract drift`)
}
const js=`/* QUADLUD — generated Soleil-Lune R8 gzip chunk manifest. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root){'use strict';const m=${JSON.stringify(manifest)};root.QuadludTangoTutorGzipChunkManifestR8=m;const t=root.QuadludTangoTutorGzipChunkTransportR8;if(t&&typeof t.registerManifest==='function')t.registerManifest(m);if(typeof module!=='undefined'&&module.exports)module.exports=m;})(typeof globalThis!=='undefined'?globalThis:this);\n`;
fs.writeFileSync(path.join(OUT,'tango-tutor-cache-r8-gzip-manifest.js'),js);
fs.writeFileSync(path.join(OUT,'tango-tutor-cache-r8-gzip-report.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('TANGO_R8_GZIP_CHUNKS_BUILT',JSON.stringify({dataVersion:manifest.dataVersion,codec:CODEC,difficulties:Object.fromEntries(DIFFS.map(d=>[d,{chunks:manifest.difficulties[d].chunks.length,gzipBytes:manifest.difficulties[d].gzipBytes,base64Bytes:manifest.difficulties[d].base64Bytes,rawSha256:manifest.difficulties[d].rawSha256}]))}));
