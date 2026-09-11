'use strict';
/*
 * QUADLUD — Cognitive Tutor live regression on the reported C5 fixture
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub');
const repo=path.resolve(__dirname,'../..');
const WEB=fs.existsSync(path.join(candidate,'tango-logic.js'))?candidate:repo;
const load=name=>require(path.join(WEB,name));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const f of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js',
  'tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js','tango-human-cost-bridge.js','cognitive-cost.js','tango-cognitive-patterns.js',
  'tango-cognitive-pedagogy-bridge.js','tango-human-pedagogy-r4.js','tango-tutor-single-planner-r5.js'
])load(f);
const P=global.QuadludTangoPlayedMovePlanner,T=global.QuadludTangoTutorSinglePlannerR5,C=global.QuadludCognitiveCost;
assert(P&&T&&C&&global.QuadludTangoPlayedMoveRuntime?.__quadludCognitivePedagogyR1,'cognitive Tango live Tutor unavailable');
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
  [1,0,'d','×'],[1,1,'r','×'],[2,3,'d','×'],[2,4,'d','='],[3,3,'r','×'],[5,3,'r','=']
];
const engine=P.sessionFromPublicBoard({game:'tango',n:6,state:state.map(r=>r.slice()),edges:edges.map(e=>e.slice())},state);
const t0=performance.now();
const live=T._test.humanizeTutorPlan(engine,'expert',{usePrecomputedCache:false});
const ms=performance.now()-t0;
assert.strictEqual(live?.status,'move');
assert.deepStrictEqual(live.target,[2,4],'cognitive ranking must keep the direct C5 equality ahead of contradiction');
assert.strictEqual(live.value,0);
assert.strictEqual(live.advancedStart,false);
assert(Array.isArray(live.displayProof?.cognitiveCostVector),'live proof must expose cognitive cost');
assert.strictEqual(live.displayProof?.cognitiveProfile?.loadBand,0,'direct C5 proof should be in the lowest working-memory band');
assert(live.displayProof?.cognitiveProfile?.effectiveDepth<=3);
console.log('PASS v319-r8-cognitive-live-priority',JSON.stringify({target:live.target,value:live.value,mode:live.tutorPlannerMode,profile:live.displayProof.cognitiveProfile,ms:Number(ms.toFixed(3))}));
