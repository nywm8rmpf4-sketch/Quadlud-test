/*
 * QUADLUD — Soleil-Lune R8 gzip chunk transport
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation without prior written authorization is prohibited.
 */
(function(root,factory){
  'use strict';
  const isNode=typeof module!=='undefined'&&module.exports;
  const api=factory(root,isNode?require('zlib'):null,isNode?require('crypto'):null);
  if(isNode)module.exports=api;if(root){root.QuadludTangoTutorGzipChunkTransportR8=api;const m=root.QuadludTangoTutorGzipChunkManifestR8;if(m)try{api.registerManifest(m)}catch(_){}}
})(typeof globalThis!=='undefined'?globalThis:this,function(root,NodeZlib,NodeCrypto){
  'use strict';
  const VERSION=1,CODEC='gzip-base64-chunks-v1',DIFFICULTIES=Object.freeze(['easy','medium','hard','expert']);
  let manifest=null;const loading=new Map();const stats={loads:0,loadFailures:0,hashRejects:0,decodeRejects:0};
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
  function difficultyKey(v){const k=String(v||'').trim().toLowerCase();return ({facile:'easy',moyen:'medium',difficile:'hard'})[k]||k}
  function validHex64(v){return /^[0-9a-f]{64}$/.test(String(v||''))}
  function validEntry(e,d){return !!e&&e.difficulty===d&&e.codec===CODEC&&Number(e.puzzles)===120&&Number.isInteger(Number(e.steps))&&Number(e.steps)>0&&Number.isInteger(Number(e.rawJsonBytes))&&Number(e.rawJsonBytes)>0&&Number.isInteger(Number(e.gzipBytes))&&Number(e.gzipBytes)>0&&validHex64(e.rawSha256)&&validHex64(e.gzipSha256)&&Array.isArray(e.chunks)&&e.chunks.length>0&&e.chunks.every(x=>typeof x==='string'&&/^tango-tutor-cache-r8-[a-z]+-gz-\d{2}\.txt$/.test(x))}
  function validManifest(m){return !!m&&Number(m.schema)===1&&m.codec===CODEC&&typeof m.dataVersion==='string'&&m.dataVersion&&m.sourcePoolVersion==='tango-runtime-pool-r8'&&validHex64(m.tutorContractDigest)&&m.difficulties&&DIFFICULTIES.every(d=>validEntry(m.difficulties[d],d))}
  function registerManifest(m){if(!validManifest(m))throw new Error('Invalid Soleil-Lune R8 gzip chunk manifest');manifest=clone(m);return info()}
  function base64Bytes(value){const s=String(value||'');if(typeof Buffer!=='undefined')return Uint8Array.from(Buffer.from(s,'base64'));if(typeof atob!=='function')throw new Error('Base64 decoder unavailable');const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
  async function sha256Hex(bytes){
    if(NodeCrypto)return NodeCrypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    const subtle=root?.crypto?.subtle;if(!subtle)throw new Error('SHA-256 unavailable');const digest=await subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  }
  async function gunzip(bytes){
    if(NodeZlib)return Uint8Array.from(NodeZlib.gunzipSync(Buffer.from(bytes)));
    if(typeof DecompressionStream!=='function')throw new Error('gzip DecompressionStream unavailable');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  function utf8Text(bytes){if(typeof TextDecoder!=='undefined')return new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('utf8');throw new Error('UTF-8 decoder unavailable')}
  async function decodeBase64Gzip(base64,entry){
    if(!validEntry(entry,entry?.difficulty))throw new Error('Invalid Soleil-Lune R8 gzip entry');
    const compressed=base64Bytes(base64);if(compressed.length!==Number(entry.gzipBytes))throw new Error('gzip size mismatch');
    if(await sha256Hex(compressed)!==entry.gzipSha256){stats.hashRejects++;throw new Error('gzip SHA-256 mismatch')}
    const raw=await gunzip(compressed);if(raw.length!==Number(entry.rawJsonBytes))throw new Error('raw JSON size mismatch');
    if(await sha256Hex(raw)!==entry.rawSha256){stats.hashRejects++;throw new Error('raw JSON SHA-256 mismatch')}
    return JSON.parse(utf8Text(raw))
  }
  async function fetchChunk(name){const r=await fetch(name,{cache:'force-cache'});if(!r.ok)throw new Error(`R8 gzip chunk HTTP ${r.status}: ${name}`);return (await r.text()).trim()}
  async function ensureDifficulty(diff){
    const d=difficultyKey(diff),Cache=root?.QuadludTangoTutorPrecomputedCache;if(!DIFFICULTIES.includes(d)||!Cache||!manifest)return false;
    const current=Cache.info?.();if(current?.registeredDifficulties?.includes(d)){try{Cache.materializeDifficulty(d);return true}catch(_){return false}}
    if(loading.has(d))return loading.get(d);const entry=manifest.difficulties[d];
    const p=(async()=>{try{const parts=await Promise.all(entry.chunks.map(fetchChunk)),data=await decodeBase64Gzip(parts.join(''),entry);Cache.registerShard(data);Cache.materializeDifficulty(d);stats.loads++;return true}catch(_){stats.loadFailures++;return false}finally{loading.delete(d)}})();loading.set(d,p);return p
  }
  function info(){return Object.freeze({version:VERSION,codec:CODEC,manifest:manifest?clone(manifest):null,stats:{...stats}})}
  function clear(){manifest=null;loading.clear();for(const k of Object.keys(stats))stats[k]=0}
  return Object.freeze({VERSION,CODEC,registerManifest,ensureDifficulty,info,clear,_test:Object.freeze({clone,difficultyKey,validHex64,validEntry,validManifest,base64Bytes,sha256Hex,gunzip,utf8Text,decodeBase64Gzip})});
});
