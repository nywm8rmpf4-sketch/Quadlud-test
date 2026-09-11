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
const P=global.QuadludTangoPlayedMovePlanner,H=global.QuadludTangoHumanPedagogyR4,A=P?._attentionTest||{};
assert(P&&H&&typeof A.evaluateRelationFrontier==='function','relation-frontier pruner unavailable');
const state=[[0,-1,-1,-1,-1,-1],[1,-1,-1,-1,-1,-1],[1,-1,-1,-1,-1,-1],[0,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1]];
const Pool=require(path.join(ROOT,'tango-runtime-pool-data.js')),entry=Pool.pools.expert[0],edges=entry.edges.map(e=>e.slice());
const session=P.sessionFromPublicBoard({game:'tango',n:6,state:state.map(r=>r.slice()),edges},state),tier=P.tierIndexForDifficulty('expert'),direct=P._test.allowedDirectDeductions(session,tier);
assert.equal(direct.length,7,'slow-state direct frontier cardinality changed');
assert(direct.every(d=>A.relationOnlyDeduction(d)),'slow state must be relation-only');
assert(!direct.some(d=>A.directlyPlacesVisibleValue(session,d)),'slow state must have no immediate visible placement');
const t0=performance.now(),evaluation=A.evaluateRelationFrontier(session,tier,direct,{initialStateValidated:true}),ms=performance.now()-t0;
assert(evaluation&&evaluation.plans.length>0,'pruned relation frontier must produce a move plan');
const scored=evaluation.plans.map(plan=>H._test.evaluatePlanHumanProof(session,plan)).filter(Boolean).sort(H._test.compareHumanCandidate),chosen=scored[0];
assert(chosen?.plan?.status==='move','cognitive scoring must select a pruned move');
const metrics={ms:Number(ms.toFixed(3)),direct:direct.length,plans:evaluation.plans.length,hydrated:evaluation.hydratedCandidateCount,pruned:evaluation.prunedCandidateCount,estimated:evaluation.estimatedCandidateCount,minimumSteps:evaluation.provenMinimumEngineStepCount,target:chosen.plan.target,value:chosen.plan.value,rule:(chosen.plan.startingDeduction||chosen.plan.deduction)?.rule,cost:chosen.cost};
console.log('RELATION_FRONTIER_METRICS',JSON.stringify(metrics));
assert(ms<3000,`relation frontier pruner too slow: ${ms.toFixed(1)} ms; ${JSON.stringify(metrics)}`);
console.log('PASS v319-r8-relation-frontier-fastpath');
