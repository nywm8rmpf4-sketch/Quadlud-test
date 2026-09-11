'use strict';
/*
 * QUADLUD — Soleil-Lune R8 synchronized runtime/cache static contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub');
const repo=path.resolve(__dirname,'../..');
const WEB=fs.existsSync(path.join(candidate,'tango-runtime-pool-data.js'))?candidate:repo;
const file=name=>path.join(WEB,name);
const pool=require(file('tango-runtime-pool-data.js'));
const cache=require(file('tango-tutor-cache-data-r8.js'));
const contract=require(file('tango-tutor-cache-contract-r8.js'));
const DIFFS=['easy','medium','hard','expert'];
assert.strictEqual(pool?.schema,2,'runtime pool schema must remain 2');
assert.strictEqual(pool?.version,'tango-runtime-pool-r8');
assert.deepStrictEqual(pool.counts,{easy:120,medium:120,hard:120,expert:120});
let total=0;
for(const diff of DIFFS){
  const entries=pool.pools?.[diff];
  assert(Array.isArray(entries),`${diff}: runtime pool missing`);
  assert.strictEqual(entries.length,120,`${diff}: runtime pool must contain exactly 120 entries`);
  const fps=new Set();
  for(const entry of entries){
    assert(Array.isArray(entry.solution)&&entry.solution.length===6,`${diff}: invalid solution`);
    assert(entry.solution.every(row=>Array.isArray(row)&&row.length===6&&row.every(v=>v===0||v===1)),`${diff}: invalid solution values`);
    assert(Array.isArray(entry.givens),`${diff}: givens missing`);
    assert(Array.isArray(entry.edges),`${diff}: edges missing`);
    assert(/^qfp1-[0-9a-f]{32}$/.test(String(entry.fingerprint||'')),`${diff}: invalid fingerprint`);
    assert(!fps.has(entry.fingerprint),`${diff}: duplicate fingerprint ${entry.fingerprint}`);
    fps.add(entry.fingerprint);
  }
  total+=entries.length;
}
assert.strictEqual(total,480,'runtime pool must contain exactly 480 certified entries');
assert.strictEqual(cache?.schema,8,'synchronized Tutor cache must use schema 8');
assert.strictEqual(cache?.version,'tango-tutor-cache-r8-sync2');
assert.strictEqual(cache?.sourcePoolVersion,'tango-runtime-pool-r8');
assert.deepStrictEqual(cache?.puzzleCounts,{easy:120,medium:120,hard:120,expert:120});
assert(cache?.tutorContract&&cache.tutorContract.digest===contract.digest,'cache Tutor contract digest mismatch');
assert.strictEqual(cache?.tutorPlannerToken,contract.tutorPlannerToken,'cache planner token mismatch');
assert.strictEqual(cache?.humanPolicy,contract.humanPolicy,'cache human policy mismatch');
assert.strictEqual(cache?.proofPolicy,contract.proofPolicy,'cache proof policy mismatch');
let steps=0;
for(const diff of DIFFS){
  const rows=cache.steps?.[diff];
  assert(Array.isArray(rows)&&rows.length>0,`${diff}: synchronized cache steps missing`);
  steps+=rows.length;
}
assert(steps>480,'synchronized cache must materialize canonical Tutor progression, not only puzzle starts');
console.log(JSON.stringify({poolEntries:total,cacheSteps:steps,contractDigest:contract.digest},null,2));
console.log('PASS synchronized R8 static contract: 480 unique certified puzzles and schema8 cache bound to current Tutor contract.');
