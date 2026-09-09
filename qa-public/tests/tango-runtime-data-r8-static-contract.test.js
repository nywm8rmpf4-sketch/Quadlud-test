'use strict';
/* QUADLUD — Soleil-Lune runtime data R8 static contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const dir=path.resolve(process.argv[2]||'');if(!dir)throw new Error('usage: test runtimeDir');
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir,'tango-runtime-pool-data.js'),'utf8'),ctx,{filename:'tango-runtime-pool-data.js'});
const pool=ctx.QuadludTangoRuntimePoolData;assert(pool&&pool.schema===2);assert.strictEqual(pool.version,'tango-runtime-pool-r8');
for(const d of ['easy','medium','hard','expert']){assert.strictEqual(pool.counts[d],120);assert.strictEqual(pool.pools[d].length,120);const fps=new Set();for(const e of pool.pools[d]){assert(Array.isArray(e.solution)&&e.solution.length===6);assert(Array.isArray(e.givens));assert(Array.isArray(e.edges));assert(/^qfp1-/.test(e.fingerprint));fps.add(e.fingerprint)}assert.strictEqual(fps.size,120)}
ctx.QuadludTangoTutorPrecomputedCache={registered:[],registerShard(s){this.registered.push(s);return true}};
for(const d of ['easy','medium','hard','expert'])vm.runInContext(fs.readFileSync(path.join(dir,`tango-tutor-cache-${d}.js`),'utf8'),ctx,{filename:`tango-tutor-cache-${d}.js`});
assert.strictEqual(ctx.QuadludTangoTutorPrecomputedCache.registered.length,4);for(const s of ctx.QuadludTangoTutorPrecomputedCache.registered){assert.strictEqual(s.schema,2);assert.strictEqual(s.version,'tango-tutor-cache-r4-lean');assert(s.entries.length>=120)}
console.log('tango-runtime-data-r8-static-contract.test.js: OK');
