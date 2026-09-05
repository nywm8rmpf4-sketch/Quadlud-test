#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Planner=require(path.join(ROOT,'GitHub','tango-played-move-planner.js'));
const PlayedMoveRuntime=require(path.join(ROOT,'GitHub','tango-played-move-runtime.js'));

assert.strictEqual(Planner.VERSION,4);
assert.strictEqual(Planner.COST_MODEL,'tango-tutor-ordinal-v2');
assert.strictEqual(PlayedMoveRuntime.VERSION,4);
assert.strictEqual(PlayedMoveRuntime.HUMAN_PROOF_POLICY,'tango-human-proof-minimal-v1');

const state=Array.from({length:6},()=>Array(6).fill(-1));
state[2][1]=1;
const puzzle={n:6,state:state.map(row=>row.slice()),edges:[[2,1,'d','×'],[3,0,'r','×']]};
const session=Planner.sessionFromPublicBoard(puzzle);
const direct=Planner._test.allowedDirectDeductions(session,1).filter(d=>d?.rule==='RELATION_PROPAGATION');
const targetOf=d=>d?.conclusions?.find(c=>c?.type==='VALUE')?.cell;
const valueOf=d=>d?.conclusions?.find(c=>c?.type==='VALUE')?.value;
const d2=direct.find(d=>JSON.stringify(targetOf(d))===JSON.stringify([3,1])&&valueOf(d)===0);
const d1=direct.find(d=>JSON.stringify(targetOf(d))===JSON.stringify([3,0])&&valueOf(d)===1);
assert(d2);assert(d1);
assert.strictEqual(Planner._test.relationPathLengthForDeduction(session,d2),1);
assert.strictEqual(Planner._test.relationPathLengthForDeduction(session,d1),2);
const d2Plan=Planner._test.planFromFirstDeduction(session,1,d2,{maxEngineSteps:24});
const d1Plan=Planner._test.planFromFirstDeduction(session,1,d1,{maxEngineSteps:24});
assert.strictEqual(d2Plan.status,'move');assert.strictEqual(d1Plan.status,'move');
assert.deepStrictEqual(d2Plan.target,[3,1]);assert.deepStrictEqual(d1Plan.target,[3,0]);
assert.strictEqual(d2Plan.humanRelationPathLength,1);assert.strictEqual(d1Plan.humanRelationPathLength,2);
const d2Metrics=Planner._test.planMetrics(d2Plan),d1Metrics=Planner._test.planMetrics(d1Plan);
assert.strictEqual(d2Metrics.relationPathLength,1);assert.strictEqual(d1Metrics.relationPathLength,2);assert(d2Metrics.premiseCount<d1Metrics.premiseCount);
const selectedA=Planner._test.selectPlans([d1Plan,d2Plan],{frontierComplete:true});
const selectedB=Planner._test.selectPlans([d2Plan,d1Plan],{frontierComplete:true});
assert.deepStrictEqual(selectedA.plan.target,[3,1]);assert.deepStrictEqual(selectedB.plan.target,[3,1]);
const selected=Planner.nextPlayedMove(session,'medium',{maxEngineSteps:24,maxCandidatePlans:64});
assert.strictEqual(selected.status,'move');assert.deepStrictEqual(selected.target,[3,1]);assert.strictEqual(selected.value,0);assert.strictEqual(selected.humanRelationPathLength,1);
const mutated=state.map(row=>row.slice());assert.strictEqual(Planner.applyPlayedMoveToState(mutated,selected),true);const changed=Planner.stateDiff(state,mutated);assert.strictEqual(changed.length,1);assert.deepStrictEqual(changed[0].cell,[3,1]);assert.strictEqual(changed[0].to,0);

// R4: A6=moon, C6=sun, F6=moon. Hypothesis B6=moon reaches the moon quota,
// forces D6/E6=sun, then violates the three-consecutive-suns rule on C6-D6-E6.
const r4State=Array.from({length:6},()=>Array(6).fill(-1));
r4State[0][5]=0;r4State[2][5]=1;r4State[5][5]=0;
const r4Session=Planner.sessionFromPublicBoard({n:6,state:r4State.map(row=>row.slice()),edges:[]});
const r4Plan=Planner.nextPlayedMove(r4Session,'hard',{maxEngineSteps:24,maxCandidatePlans:64});
assert.strictEqual(r4Plan.status,'move');assert.deepStrictEqual(r4Plan.target,[1,5]);assert.strictEqual(r4Plan.value,1);
assert.strictEqual(r4Plan.deduction.rule,'LINE_DOMAIN_SUPPORT');assert((r4Plan.deduction.conclusions||[]).length>1);
const rawHypothesis=r4Session.hypothesisResult([1,5],0);
assert.strictEqual(rawHypothesis.contradiction?.kind,'NO_LINE_COMPLETION','baseline must reproduce abstract short-circuit');
const concreteSearch=PlayedMoveRuntime._test.concreteHumanContradictionSearch(r4Session,[1,5],0);
assert(concreteSearch&&concreteSearch.contradiction);
assert.strictEqual(concreteSearch.contradiction.kind,'TRIPLE_OVERFLOW');
assert.deepStrictEqual(concreteSearch.contradiction.cells,[[2,5],[3,5],[4,5]]);
assert((concreteSearch.trace||[]).some(d=>d.rule==='BALANCE_QUOTA'));
const human=PlayedMoveRuntime.selectDisplayProof(r4Session,r4Plan);
assert.strictEqual(human.replaced,true);assert.strictEqual(human.kind,'concrete-contradiction');assert.strictEqual(human.replacedRule,'LINE_DOMAIN_SUPPORT');
assert.strictEqual(human.deduction.rule,'ASSUMPTION_CONTRADICTION');assert.strictEqual(human.witness.kind,'TRIPLE_OVERFLOW');
assert.deepStrictEqual(human.witness.cells,[[2,5],[3,5],[4,5]]);assert.deepStrictEqual(human.deduction.explanationData.assumption,{cell:[1,5],value:0});
assert((human.deduction.explanationData.causalTrace||[]).some(d=>d.rule==='BALANCE_QUOTA'));
assert.deepStrictEqual(human.deduction.conclusions.map(c=>({type:c.type,cell:c.cell,value:c.value})),[{type:'VALUE',cell:[1,5],value:1}]);
assert.strictEqual(human.displayDeductions.length,1);assert.strictEqual(r4Plan.deduction.rule,'LINE_DOMAIN_SUPPORT');

const simpleState=Array.from({length:6},()=>Array(6).fill(-1));simpleState[0][0]=1;simpleState[0][1]=1;
const simpleSession=Planner.sessionFromPublicBoard({n:6,state:simpleState,edges:[]});
const simplePlan=Planner.nextPlayedMove(simpleSession,'easy',{maxEngineSteps:24,maxCandidatePlans:64});
assert.strictEqual(simplePlan.status,'move');assert.strictEqual(simplePlan.deduction.rule,'TRIPLE_CONSTRAINT');
const simpleHuman=PlayedMoveRuntime.selectDisplayProof(simpleSession,simplePlan);assert.strictEqual(simpleHuman.replaced,false);assert.strictEqual(simpleHuman.deduction.rule,'TRIPLE_CONSTRAINT');
const serialized=JSON.stringify(human);for(const forbidden of ['solutionGrid','hiddenSolution','validationState','answerGrid','backtracking'])assert(!serialized.includes(forbidden));

const index=fs.readFileSync(path.join(ROOT,'GitHub','index.html'),'utf8');
const sw=fs.readFileSync(path.join(ROOT,'GitHub','sw.js'),'utf8');
const runtimeSource=fs.readFileSync(path.join(ROOT,'GitHub','tango-played-move-runtime.js'),'utf8');
assert(index.includes('tango-played-move-runtime.js?v=3.1.9-a13r4b'));
assert(sw.includes('tango-played-move-runtime.js?v=3.1.9-a13r4b'));
assert(runtimeSource.includes('plan=planHumanMove(engine,s.base.diff)'));
assert(runtimeSource.includes('plan=planHumanMove(engine,current?.diff)'));
assert(runtimeSource.includes('tangoCoachHandleDeduction=coherent'));
console.log('v319-a13r3-tango-relation-path-cost.test.js: PASS');
