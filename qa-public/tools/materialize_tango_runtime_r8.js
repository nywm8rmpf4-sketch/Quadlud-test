#!/usr/bin/env node
'use strict';
/* QUADLUD — Soleil-Lune runtime materializer R8
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const fs=require('fs'),path=require('path');
const poolPath=path.resolve(process.argv[2]||'');
const cacheDir=path.resolve(process.argv[3]||'');
const outDir=path.resolve(process.argv[4]||'');
if(!poolPath||!cacheDir||!outDir)throw new Error('usage: materialize pool.js cacheDir outDir');
const Pool=require(poolPath);
fs.mkdirSync(outDir,{recursive:true});
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function runtimePool(){
  const pools={};
  for(const d of ['easy','medium','hard','expert']){
    const src=Pool.entries?.[d]; if(!Array.isArray(src)||src.length<120)throw new Error(`${d}: incomplete source pool`);
    pools[d]=src.slice(0,120).map((e,i)=>({id:`${d}-${String(i+1).padStart(3,'0')}`,solution:clone(e.sol),givens:[...(e.givens||[])],edges:clone(e.edges||[]),fingerprint:String(e.difficultyProfile?.fingerprint||'')}));
  }
  return {schema:2,version:'tango-runtime-pool-r8',counts:Object.fromEntries(Object.entries(pools).map(([d,a])=>[d,a.length])),pools};
}
const pool=runtimePool();
const poolJs=`/* QUADLUD — generated Soleil-Lune runtime pool R8. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.QuadludTangoRuntimePoolData=api})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${JSON.stringify(pool)});});\n`;
fs.writeFileSync(path.join(outDir,'tango-runtime-pool-data.js'),poolJs);
for(const d of ['easy','medium','hard','expert']){
  const p=path.join(cacheDir,`tango-tutor-cache-${d}.json`); const cache=JSON.parse(fs.readFileSync(p,'utf8'));
  if(cache.schema!==2||!Array.isArray(cache.entries)||cache.entries.length<120)throw new Error(`${d}: invalid Tutor cache`);
  const js=`/* QUADLUD — generated Soleil-Lune Tutor cache ${d} R8. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.QuadludTangoTutorCacheShards=root.QuadludTangoTutorCacheShards||{};root.QuadludTangoTutorCacheShards[${JSON.stringify(d)}]=api;const rt=root.QuadludTangoTutorPrecomputedCache;if(rt&&typeof rt.registerShard==='function')rt.registerShard(api)}})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${JSON.stringify(cache)});});\n`;
  fs.writeFileSync(path.join(outDir,`tango-tutor-cache-${d}.js`),js);
}
const sizes={};for(const f of fs.readdirSync(outDir)){const p=path.join(outDir,f);if(fs.statSync(p).isFile())sizes[f]=fs.statSync(p).size}
fs.writeFileSync(path.join(outDir,'runtime-data-report.json'),JSON.stringify({schema:1,poolVersion:pool.version,counts:pool.counts,sizes,totalBytes:Object.values(sizes).reduce((a,b)=>a+b,0)},null,2));
console.log(JSON.stringify({counts:pool.counts,sizes,totalBytes:Object.values(sizes).reduce((a,b)=>a+b,0)}));
