#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — Soleil-Lune compact runtime puzzle pool materializer R8
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const fs=require('fs'),path=require('path');
const input=path.resolve(process.argv[2]||'');
const outDir=path.resolve(process.argv[3]||'');
if(!input||!outDir)throw new Error('usage: materialize_tango_runtime_pool_exact_r8.js <certified-pool-v5.js> <out-dir>');
const Pool=require(input),DIFFS=['easy','medium','hard','expert'];
if(Pool?.schema!==3||Pool?.version!=='tango-precompute-pool-v5')throw new Error(`unexpected certified pool ${Pool?.version||'unknown'}`);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const pools={},counts={};
for(const diff of DIFFS){
  const src=Pool.entries?.[diff];if(!Array.isArray(src)||src.length<120)throw new Error(`${diff}: certified pool has ${src?.length||0}/120 entries`);
  const selected=src.slice(0,120);counts[diff]=selected.length;
  pools[diff]=selected.map((entry,index)=>{
    const fingerprint=String(entry?.difficultyProfile?.fingerprint||'');
    if(!/^qfp1-[0-9a-f]{32}$/.test(fingerprint))throw new Error(`${diff}[${index}]: invalid full puzzle fingerprint`);
    if(!Array.isArray(entry?.sol)||entry.sol.length!==6||!Array.isArray(entry?.givens))throw new Error(`${diff}[${index}]: invalid runtime puzzle`);
    return {id:`${diff}-${String(index+1).padStart(3,'0')}`,solution:clone(entry.sol),givens:[...entry.givens],edges:clone(entry.edges||[]),fingerprint};
  });
}
const data={schema:2,version:'tango-runtime-pool-r8',sourcePoolVersion:Pool.version,counts,pools};
const js=`/* QUADLUD — generated Soleil-Lune compact runtime pool R8. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.QuadludTangoRuntimePoolData=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${JSON.stringify(data)});});\n`;
fs.mkdirSync(outDir,{recursive:true});
const output=path.join(outDir,'tango-runtime-pool-data.js');fs.writeFileSync(output,js);
const report={schema:1,status:'PASS',version:data.version,sourcePoolVersion:data.sourcePoolVersion,counts,total:Object.values(counts).reduce((a,b)=>a+b,0),bytes:Buffer.byteLength(js)};
fs.writeFileSync(path.join(outDir,'tango-runtime-pool-r8-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
