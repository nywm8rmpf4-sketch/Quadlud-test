#!/usr/bin/env node
/*
 * QUADLUD — guarded runtime stage for Soleil-Lune R8 gzip chunks.
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const fs=require('fs'),path=require('path');const ROOT=path.resolve(__dirname,'../..');
const VERSION='3.1.9-r8-gzip-chunks-r1';
function read(name){return fs.readFileSync(path.join(ROOT,name),'utf8')}
function write(name,s){fs.writeFileSync(path.join(ROOT,name),s)}
function replaceExact(name,from,to){const s=read(name),count=s.split(from).length-1;if(count!==1)throw new Error(`${name}: expected one guarded replacement, found ${count}`);write(name,s.replace(from,to))}
const manifest=require(path.join(ROOT,'tango-tutor-cache-r8-gzip-manifest.js'));const chunks=Object.values(manifest.difficulties).flatMap(x=>x.chunks);
replaceExact('tango-tutor-precomputed-cache.js',
  "if(legacyPayload)return Promise.resolve(true);if(typeof document==='undefined')return Promise.resolve(false);",
  "if(legacyPayload)return Promise.resolve(true);const transport=root?.QuadludTangoTutorGzipChunkTransportR8;if(transport&&typeof transport.ensureDifficulty==='function')return Promise.resolve(transport.ensureDifficulty(d));if(typeof document==='undefined')return Promise.resolve(false);"
);
replaceExact('index.html',
  '<script src="tango-tutor-precomputed-cache.js?v=3.1.9-r8-sync5-cognitive-sharded-lz4"></script><script src="tango-tutor-single-planner-r5.js?v=3.1.9-cognitive-r4-cache-contract-guard"></script>',
  `<script src="tango-tutor-precomputed-cache.js?v=3.1.9-r8-sync5-cognitive-sharded-lz4"></script><script src="tango-tutor-gzip-chunk-transport-r8.js?v=${VERSION}"></script><script src="tango-tutor-cache-r8-gzip-manifest.js?v=${VERSION}"></script><script src="tango-tutor-single-planner-r5.js?v=3.1.9-cognitive-r4-cache-contract-guard"></script>`
);
replaceExact('index.html','3.1.9-A · TANGO-R8-SHARDED-CACHE-R1 · candidate','3.1.9-A · TANGO-R8-GZIP-CHUNKS-R1 · candidate');
let sw=read('sw.js');
const oldCache="const CACHE='quadlud-v3.1.9-tango-r8-sync5-cognitive-sharded-lz4-v23';",newCache="const CACHE='quadlud-v3.1.9-tango-r8-gzip-chunks-v24';";
if(!sw.includes(oldCache))throw new Error('sw.js: old cache namespace not found');sw=sw.replace(oldCache,newCache);
const q='3.1.9-r8-sync5-cognitive-sharded-lz4';
const oldAssets=['easy','medium','hard','expert'].map(d=>`'./tango-tutor-cache-r8-${d}.js?v=${q}'`).join(',');
const newAssets=[`'./tango-tutor-gzip-chunk-transport-r8.js?v=${VERSION}'`,`'./tango-tutor-cache-r8-gzip-manifest.js?v=${VERSION}'`,...chunks.map(x=>`'./${x}'`)].join(',');
if((sw.split(oldAssets).length-1)!==1)throw new Error('sw.js: exact four-shard asset block not found');sw=sw.replace(oldAssets,newAssets);write('sw.js',sw);
let gm=read('game-manifest.js');
const oldSupport="'tango-played-move-planner.js','tango-played-move-runtime.js','tango-runtime-pool-data.js','tango-precomputed-pool-runtime.js','tango-tutor-precomputed-cache.js','tango-tutor-cache-r8-easy.js','tango-tutor-cache-r8-medium.js','tango-tutor-cache-r8-hard.js','tango-tutor-cache-r8-expert.js'";
const newSupport=["tango-played-move-planner.js","tango-played-move-runtime.js","tango-runtime-pool-data.js","tango-precomputed-pool-runtime.js","tango-tutor-precomputed-cache.js","tango-tutor-gzip-chunk-transport-r8.js","tango-tutor-cache-r8-gzip-manifest.js",...chunks].map(x=>`'${x}'`).join(',');
if((gm.split(oldSupport).length-1)!==1)throw new Error('game-manifest.js: exact Tango supportModules block not found');gm=gm.replace(oldSupport,newSupport);write('game-manifest.js',gm);
const info=JSON.parse(read('build-info.json'));info.version='3.1.9-A';info.candidate='TANGO-R8-GZIP-CHUNKS-R1';info.channel='Quadlud-test';info.feature='v3.1.9-tango-r8-sync5-cognitive-gzip-chunks-r1';write('build-info.json',JSON.stringify(info)+'\n');
for(const name of ['index.html','sw.js','game-manifest.js']){const s=read(name);if(name!=='index.html'&&/tango-tutor-cache-r8-(easy|medium|hard|expert)\.js/.test(s))throw new Error(`${name}: stale LZ4 shard runtime reference remains`)}
console.log('TANGO_R8_GZIP_CHUNKS_RUNTIME_STAGED',JSON.stringify({chunks:chunks.length,cache:'quadlud-v3.1.9-tango-r8-gzip-chunks-v24',candidate:info.candidate}));
