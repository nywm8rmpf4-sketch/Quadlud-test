'use strict';
const assert=require('assert'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js',
  'tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js','tango-played-move-runtime.js','tango-human-cost-bridge.js',
  'cognitive-cost.js','tango-cognitive-patterns.js','tango-cognitive-pedagogy-bridge.js','tango-human-pedagogy-r4.js',
  'tango-cognitive-proof-stages-bridge.js','tango-direct-visible-priority-bridge.js'
])require(path.join(ROOT,file));
const P=global.QuadludTangoPlayedMovePlanner,H=global.QuadludTangoHumanPedagogyR4;
assert(P&&H&&H.__quadludDirectVisiblePriorityR1,'direct-visible priority runtime unavailable');
const E=-1,state=[
  [E,E,E,E,E,E],[E,E,E,E,E,E],[E,E,E,0,E,E],[E,E,E,1,0,0],[E,0,E,E,1,E],[0,1,1,0,0,1]
],edges=[[1,0,'d','×'],[1,1,'r','×'],[2,3,'d','×'],[2,4,'d','='],[3,3,'r','×'],[5,3,'r','=']];
const engine=P.sessionFromPublicBoard({game:'tango',n:6,state:state.map(r=>r.slice()),edges:edges.map(e=>e.slice())},state);
const frontier=H._test.directVisiblePriorityPlans(engine,'expert',{});
assert(frontier&&frontier.plans.length>0,'fixture must expose direct-visible plans');
assert(frontier.plans.every(p=>p.status==='move'&&p.engineStepCount===1&&p.advancedStart===false&&p.directVisibleFastPath===true),'fast frontier must contain only immediate one-step placements');
const t0=performance.now(),plan=H._test.chooseDirectVisiblePriority(engine,'expert',{}),ms=performance.now()-t0;
assert(plan&&plan.status==='move','fast direct-visible selector must return a move');
assert.deepStrictEqual(plan.target,[2,4],'C5 direct relation must remain the preferred move');
assert.strictEqual(plan.value,0,'C5 must be lune');
assert.strictEqual(plan.directVisibleFastPath,true);
assert.strictEqual(plan.engineStepCount,1);
assert.notStrictEqual((plan.startingDeduction||plan.deduction)?.rule,'ASSUMPTION_CONTRADICTION');
assert(ms<5000,`direct-visible fast path unexpectedly slow: ${ms.toFixed(1)} ms`);
console.log('PASS v319-r8-direct-visible-fastpath',JSON.stringify({plans:frontier.plans.length,direct:frontier.directCount,visible:frontier.visibleDeductionCount,ms:Number(ms.toFixed(3)),target:plan.target,value:plan.value}));
