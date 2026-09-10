'use strict';
/*
 * QUADLUD — Human regression: direct equality before contradiction
 * Reproduces the visible Expert state reported on 2026-09-10.
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub');
const repo=path.resolve(__dirname,'../..');
const WEB=fs.existsSync(path.join(candidate,'tango-logic.js'))?candidate:repo;
const load=name=>require(path.join(WEB,name));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const f of ['tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js','tango-played-move-runtime.js','tango-human-pedagogy-r4.js','tango-tutor-single-planner-r5.js'])load(f);
const P=global.QuadludTangoPlayedMovePlanner,T=global.QuadludTangoTutorSinglePlannerR5;
assert(P&&T,'Tango live Tutor unavailable');
// Visible state after E5 = soleil in the user's screenshot.
// Coordinates are zero-based internally: C5=[2,4], D5=[3,4].
const E=-1;
const state=[
  [E,E,E,E,E,E],
  [E,E,E,E,E,E],
  [E,E,E,0,E,E],
  [E,E,E,1,0,0],
  [E,0,E,E,1,E],
  [0,1,1,0,0,1]
];
const edges=[
  [1,0,'d','×'],
  [1,1,'r','×'],
  [2,3,'d','×'],
  [2,4,'d','='],
  [3,3,'r','×'],
  [5,3,'r','=']
];
const engine=P.sessionFromPublicBoard({game:'tango',n:6,state:state.map(r=>r.slice()),edges:edges.map(e=>e.slice())},state);
const tier=P.tierIndexForDifficulty('expert');
const direct=P._test.allowedDirectDeductions(engine,tier);
const c5=direct.filter(d=>(d.conclusions||[]).some(c=>c?.type==='VALUE'&&c.cell?.[0]===2&&c.cell?.[1]===4&&c.value===0));
assert(c5.length>0,'fixture must expose the direct visible C5 = lune deduction');
assert(c5.some(d=>d.rule==='RELATION_PROPAGATION'||/RELATION/i.test(String(d.rule||''))),`C5 direct proof should be relation-based, got ${c5.map(d=>d.rule).join(',')}`);
const t0=performance.now();
const live=T._test.humanizeTutorPlan(engine,'expert',{usePrecomputedCache:false});
const ms=performance.now()-t0;
assert.strictEqual(live?.status,'move',`live Tutor returned ${live?.status||'invalid'}`);
assert.deepStrictEqual(live.target,[2,4],`simpler C5 direct equality must outrank advanced contradiction; got ${JSON.stringify(live.target)}`);
assert.strictEqual(live.value,0,'C5 must be lune');
assert.strictEqual(live.advancedStart,false,'direct C5 proof must not be an advanced contradiction');
assert.notStrictEqual((live.startingDeduction||live.deduction)?.rule,'ASSUMPTION_CONTRADICTION','contradiction must not outrank direct C5 equality');
console.log(`PASS human priority regression: C5=lune direct equality selected before contradiction (${ms.toFixed(2)} ms, mode=${live.tutorPlannerMode||'n/a'}).`);
