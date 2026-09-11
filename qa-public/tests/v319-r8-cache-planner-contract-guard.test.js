#!/usr/bin/env node
/* QUADLUD — R8 exact cache/Tutor contract guard regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const candidate=path.resolve(__dirname,'../GitHub');
const repo=path.resolve(__dirname,'../..');
const WEB=fs.existsSync(path.join(candidate,'tango-tutor-single-planner-r5.js'))?candidate:repo;
const runtime=name=>path.join(WEB,name);
const Bridge=require(runtime('tango-tutor-single-planner-r5.js'));
assert.strictEqual(Bridge.VERSION,5);
assert.strictEqual(Bridge.TOKEN,'3.1.9-cognitive-r4-cache-contract-guard');
let tryCalls=0;
const cache={
  tryPlan(){tryCalls++;throw new Error('stale cache must never be queried')},
  info(){return {registered:true,contract:{tutorPlannerVersion:4,tutorPlannerToken:'3.1.9-cognitive-r3-bounded-relation-fallback'}}}
};
global.QuadludTangoTutorPrecomputedCache=cache;
assert.strictEqual(Bridge._test.precomputedCache(),null,'stale planner contract must reject cache before lookup');
assert.strictEqual(tryCalls,0);
cache.info=()=>({registered:false,contract:{tutorPlannerVersion:Bridge.VERSION,tutorPlannerToken:Bridge.TOKEN}});
assert.strictEqual(Bridge._test.precomputedCache(),null,'unregistered cache must be rejected');
cache.info=()=>({registered:true,contract:{tutorPlannerVersion:Bridge.VERSION,tutorPlannerToken:Bridge.TOKEN}});
assert.strictEqual(Bridge._test.precomputedCache(),cache,'exact synchronized contract must be accepted');
assert.strictEqual(tryCalls,0);
delete global.QuadludTangoTutorPrecomputedCache;
console.log('v319-r8-cache-planner-contract-guard.test.js: PASS — stale/unregistered cache rejected; exact Tutor contract accepted');
