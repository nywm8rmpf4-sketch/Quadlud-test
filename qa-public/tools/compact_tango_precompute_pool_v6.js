#!/usr/bin/env node
'use strict';

/*
 * QUADLUD — Soleil-Lune precomputed pool compactor v6
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */

const fs=require('fs');
const path=require('path');
const Codec=require(path.resolve(__dirname,'../../tango-trace-codec.js'));

const arg=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const inputArg=arg('--input'),outputArg=arg('--output'),reportArg=arg('--report');
if(!inputArg||!outputArg)throw new Error('Usage: compact_tango_precompute_pool_v6.js --input <raw-pool.js> --output <compact-pool.js> [--report <report.json>]');
const inputPath=path.resolve(inputArg),outputPath=path.resolve(outputArg);
delete require.cache[require.resolve(inputPath)];
const raw=require(inputPath);
if(raw?.version!=='tango-precompute-pool-v5'||raw?.schema!==3)throw new Error(`Unexpected raw Soleil-Lune pool: ${raw?.version||'unknown'}`);

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
const payload=clone(raw);
payload.schema=4;
payload.version='tango-precompute-pool-v6-compact';
payload.generatedBy='qa-public/tools/compact_tango_precompute_pool_v6.js';
payload.sourcePool={schema:raw.schema,version:raw.version};
payload.certification={...(payload.certification||{}),logicalTraceEncoding:Codec.ENCODING,logicalTraceCodecVersion:Codec.VERSION,logicalTraceRoundTrip:'exact-json-v1'};

let rawTraceBytes=0,compactTraceBytes=0,traceIntegers=0,traceSteps=0;
for(const difficulty of ['easy','medium','hard','expert']){
  const rawEntries=raw.entries?.[difficulty],entries=payload.entries?.[difficulty];
  if(!Array.isArray(rawEntries)||!Array.isArray(entries)||rawEntries.length!==entries.length)throw new Error(`${difficulty}: pool entry mismatch`);
  for(let index=0;index<entries.length;index++){
    const source=rawEntries[index].logicTrace;
    if(!source||!Array.isArray(source.trace))throw new Error(`${difficulty}[${index}]: raw logical trace missing`);
    const compact=Codec.encode(source,6),hydrated=Codec.decode(compact,6);
    if(JSON.stringify(hydrated)!==JSON.stringify(source))throw new Error(`${difficulty}[${index}]: compact logical trace round-trip mismatch`);
    rawTraceBytes+=Buffer.byteLength(JSON.stringify(source));
    compactTraceBytes+=Buffer.byteLength(JSON.stringify(compact));
    traceIntegers+=Codec.encodedIntegerCount(compact);traceSteps+=compact.stepCount;
    entries[index].logicTrace=compact;
  }
}

const output=`/*\n * QUADLUD — generated certified Soleil-Lune compact precomputed pool v6\n * Copyright © 2026 Serge Benoliel. All rights reserved.\n * Proprietary software. Copying, modification, redistribution or exploitation\n * without prior written authorization is prohibited.\n */\n(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.QuadludTangoDiversityPool=api})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${JSON.stringify(payload)});});\n`;
fs.writeFileSync(outputPath,output);
const rawBytes=fs.statSync(inputPath).size,compactBytes=Buffer.byteLength(output),ratio=compactBytes/rawBytes;
const report={schema:1,version:payload.version,sourceVersion:raw.version,counts:payload.counts,total:payload.total,rawBytes,compactBytes,ratio:Number(ratio.toFixed(6)),savedBytes:rawBytes-compactBytes,rawTraceBytes,compactTraceBytes,traceRatio:Number((compactTraceBytes/rawTraceBytes).toFixed(6)),traceSteps,traceIntegers,codec:{version:Codec.VERSION,encoding:Codec.ENCODING}};
if(reportArg)fs.writeFileSync(path.resolve(reportArg),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
