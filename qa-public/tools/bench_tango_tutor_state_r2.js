#!/usr/bin/env node
'use strict';
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const input=JSON.parse(process.env.QUADLUD_TANGO_STATE||'null');
if(!input||!Array.isArray(input.state)||!Array.isArray(input.edges))throw new Error('QUADLUD_TANGO_STATE missing');
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js','tango-played-move-planner.js',
  'tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js','tango-played-move-runtime.js','tango-human-cost-bridge.js',
  'cognitive-cost.js','tango-cognitive-patterns.js','tango-cognitive-pedagogy-bridge.js','tango-human-pedagogy-r4.js',
  'tango-cognitive-proof-stages-bridge.js','tango-direct-visible-priority-bridge.js','tango-tutor-single-planner-r5.js'
])require(path.join(ROOT,file));
const P=global.QuadludTangoPlayedMovePlanner,T=global.QuadludTangoTutorSinglePlannerR5;
if(!P||!T)throw new Error('Tutor runtime unavailable');
const pub={game:'tango',n:6,state:input.state.map(r=>r.slice()),edges:input.edges.map(e=>e.slice())},engine=P.sessionFromPublicBoard(pub,pub.state);
const tier=P.tierIndexForDifficulty(input.diff||'expert'),direct=P._test.allowedDirectDeductions(engine,tier),A=P._attentionTest||{};
const directSummary=direct.map(d=>({rule:d.rule,signature:d.signature||d.id||'',visible:typeof A.directlyPlacesVisibleValue==='function'?!!A.directlyPlacesVisibleValue(engine,d):null,conclusions:d.conclusions||[]}));
const t0=performance.now(),plan=T._test.humanizeTutorPlan(engine,input.diff||'expert',{usePrecomputedCache:false}),ms=performance.now()-t0;
console.log(JSON.stringify({status:plan?.status||null,target:plan?.target||null,value:plan?.value,rule:(plan?.startingDeduction||plan?.deduction)?.rule||null,mode:plan?.tutorPlannerMode||null,selectionStatus:plan?.selectionStatus||null,directVisibleFastPath:!!plan?.directVisibleFastPath,ms:Number(ms.toFixed(3)),directSummary}));
