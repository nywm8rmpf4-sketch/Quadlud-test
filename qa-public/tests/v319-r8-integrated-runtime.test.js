'use strict';
/* QUADLUD — R8 integrated runtime contract. Copyright © 2026 Serge Benoliel. All rights reserved. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const packaged=path.resolve(__dirname,'../GitHub'),repo=path.resolve(__dirname,'../..'),WEB=fs.existsSync(path.join(packaged,'tango-logic.js'))?packaged:repo,file=name=>path.join(WEB,name);
const DIFFS=['easy','medium','hard','expert'];
const poolData=require(file('tango-runtime-pool-data.js'));assert.deepStrictEqual(poolData.counts,{easy:120,medium:120,hard:120,expert:120});global.QuadludTangoRuntimePoolData=poolData;
const pool=require(file('tango-precomputed-pool-runtime.js'));for(const d of DIFFS){assert(pool.hasShard(d),d);const p=pool.takePuzzle(d,()=>0);assert(p);assert.strictEqual(p.generationStats.strategy,'certified-precomputed-pool')}
const cache=require(file('tango-tutor-precomputed-cache.js'));global.QuadludTangoTutorPrecomputedCache=cache;
assert.strictEqual(cache.VERSION,7);assert.strictEqual(cache.DATA_SCHEMA,10);assert.strictEqual(cache.DATA_VERSION,'tango-tutor-cache-r8-sync5-cognitive-sharded-lz4');assert.strictEqual(cache.CODEC,'lz4-block-v1');
for(const d of DIFFS){const envelope=require(file(`tango-tutor-cache-r8-${d}.js`));assert.strictEqual(envelope.difficulty,d);cache.registerEncodedShard(envelope);const data=cache.materializeDifficulty(d);assert(data&&cache._test.validateShard(data,d),d);const info=cache.info();assert(info.decodedDifficulties.includes(d),d);assert.strictEqual(info.puzzles[d],120,d);assert(info.steps[d]>0,d)}
const index=fs.readFileSync(file('index.html'),'utf8'),sw=fs.readFileSync(file('sw.js'),'utf8'),manifest=require(file('game-manifest.js')),single=fs.readFileSync(file('tango-tutor-single-planner-r5.js'),'utf8'),pos=x=>index.indexOf(x);
assert(pos('tango-tutor-precomputed-cache.js')>=0&&pos('tango-tutor-precomputed-cache.js')<pos('tango-tutor-single-planner-r5.js'));assert.strictEqual(pos('tango-tutor-cache-data-r8.js?v='),-1,'monolithic cache must not be loaded by index');
assert(pos('tango-runtime-pool-data.js')<pos('tango-precomputed-pool-runtime.js')&&pos('tango-precomputed-pool-runtime.js')<pos('app-precompute.js'));
const support=manifest.requireGame('tango').supportModules;
for(const f of ['tango-runtime-pool-data.js','tango-precomputed-pool-runtime.js','tango-tutor-precomputed-cache.js',...DIFFS.map(d=>`tango-tutor-cache-r8-${d}.js`)])assert(support.includes(f),f);
for(const d of DIFFS)assert(sw.includes(`./tango-tutor-cache-r8-${d}.js?v=3.1.9-r8-sync5-cognitive-sharded-lz4`),d);
assert(sw.includes("const CACHE='quadlud-v3.1.9-g-certification-r1-v28'"));assert(!sw.includes('./tango-tutor-cache-data-r8.js?v='));
assert(single.includes("'precomputed-guarded'")&&single.includes('P.nextPlayedMove(session,diff,options)'));
console.log('PASS v319-r8-integrated-runtime',{schema:cache.DATA_SCHEMA,version:cache.DATA_VERSION,decoded:cache.info().decodedDifficulties,steps:cache.info().steps});
