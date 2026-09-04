#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const Selector=require(path.join(ROOT,'GitHub','tutor-move-selector.js'));
const Planner=require(path.join(ROOT,'GitHub','tango-played-move-planner.js'));

assert.strictEqual(Planner.VERSION,3);
assert.strictEqual(Planner.COST_MODEL,'tango-tutor-ordinal-v1');

// Real visible-state case: two rows each expose an immediate no-three deduction.
const state=[
  [0,0,-1,-1,-1,-1],
  [1,1,-1,-1,-1,-1],
  [-1,-1,-1,-1,-1,-1],
  [-1,-1,-1,-1,-1,-1],
  [-1,-1,-1,-1,-1,-1],
  [-1,-1,-1,-1,-1,-1]
];
const puzzle={n:6,state:state.map(r=>r.slice()),edges:[]};
const session=Planner.sessionFromPublicBoard(puzzle);
const direct=Planner._test.allowedDirectDeductions(session,0);
const directValue=direct.filter(d=>(d.conclusions||[]).some(c=>c.type==='VALUE'));
assert(directValue.length>=2,`expected at least two simultaneous visible deductions, got ${directValue.length}`);
const evaluated=Planner._test.evaluateStartingDeductions(session,0,direct,{maxEngineSteps:24,maxCandidatePlans:100},false);
assert(evaluated.plans.length>=2,`expected at least two visible candidate plans, got ${evaluated.plans.length}`);
const selectedA=Planner._test.selectPlans(evaluated.plans,{frontierComplete:true});
const selectedB=Planner._test.selectPlans(evaluated.plans.slice().reverse(),{frontierComplete:true});
assert(selectedA.plan&&selectedB.plan);
assert.strictEqual(selectedA.selection.status,Selector.STATUS.PROVEN_MINIMUM);
assert.strictEqual(selectedA.selection.selectedId,selectedB.selection.selectedId,'candidate enumeration order must not affect Tutor selection');
assert.deepStrictEqual(selectedA.plan.target,selectedB.plan.target);

const planned=Planner.nextPlayedMove(session,'easy',{maxEngineSteps:24,maxCandidatePlans:100});
assert.strictEqual(planned.status,'move');
assert.strictEqual(planned.selectionStatus,Selector.STATUS.PROVEN_MINIMUM);
assert(planned.candidateCount>=2,'planner must compare simultaneous visible plans');
assert(Array.isArray(planned.selectedCostVector)&&planned.selectedCostVector.length===7);
const mutated=state.map(r=>r.slice());
assert.strictEqual(Planner.applyPlayedMoveToState(mutated,planned),true);
const changed=Planner.stateDiff(state,mutated);
assert.strictEqual(changed.length,1,'a selected Tutor plan must apply exactly one visible board change');
assert.deepStrictEqual(changed[0].cell,planned.target);
assert.strictEqual(changed[0].to,planned.value);

function d(id,{deps=[],premises=[],focusCells=[],cell=[0,0],value=1,rank=1,techniqueLevel=1}={}){
  return {schema:1,id,signature:id,rule:'SYNTH_VISIBLE_RULE',rank,techniqueLevel,premises,dependencies:deps,focusCells,focusRelations:[],focusUnits:[],conclusions:[{type:'VALUE',cell:cell.slice(),value}],explanationData:{visible:true}};
}
const directDeduction=d('direct-id',{cell:[2,2],value:1,rank:9,techniqueLevel:3,focusCells:[[2,2]]});
const complexDeduction=d('complex-id',{deps:['direct-id'],cell:[3,3],value:0,rank:0,techniqueLevel:0,focusCells:[[3,3]]});
const directPlan={status:'move',target:[2,2],value:1,deduction:directDeduction,startingDeduction:directDeduction,proofChain:[directDeduction],engineStepCount:1,advancedStart:false};
const complexPlan={status:'move',target:[3,3],value:0,deduction:complexDeduction,startingDeduction:complexDeduction,proofChain:[complexDeduction],engineStepCount:2,advancedStart:false};
const candidates=Planner._test.buildSelectorCandidates([complexPlan,directPlan]);
const directCandidate=candidates.find(c=>c.plan===directPlan),complexCandidate=candidates.find(c=>c.plan===complexPlan);
assert(directCandidate&&complexCandidate);
assert(complexCandidate.blockedBy.includes(directCandidate.id),'demonstrated dependency must become pedagogical dominance');
const dominance=Planner._test.selectPlans([complexPlan,directPlan],{frontierComplete:true});
assert.strictEqual(dominance.plan,directPlan,'direct playable premise must dominate dependent complex conclusion even when its later cost dimensions are higher');
assert(dominance.selection.discardedDominatedIds.includes(complexCandidate.id));

const indirectNoDependency={...complexPlan,deduction:d('indirect-id',{cell:[4,4],value:0,rank:0,techniqueLevel:0}),startingDeduction:d('indirect-start',{cell:[4,4],value:0,rank:0,techniqueLevel:0}),proofChain:[d('indirect-proof',{cell:[4,4],value:0,rank:0,techniqueLevel:0})]};
const directVsIndirect=Planner._test.selectPlans([indirectNoDependency,directPlan],{frontierComplete:true});
assert.strictEqual(directVsIndirect.plan,directPlan,'direct visible move must beat a longer indirect chain before later cost dimensions');

const limited=Planner._test.selectPlans([directPlan],{frontierComplete:false});
assert.strictEqual(limited.selection.status,Selector.STATUS.BEST_AVAILABLE_BUDGET_LIMITED);

const source=fs.readFileSync(path.join(ROOT,'GitHub','tango-played-move-planner.js'),'utf8');
for(const forbidden of ['current.sol','hiddenSolution','solutionGrid','answerGrid','backtracking'])assert(!source.includes(forbidden),`Soleil-Lune Tutor planner must not use ${forbidden}`);
assert(!source.includes('QuadludQueens')&&!source.includes('QuadludSudoku')&&!source.includes('QuadludPatches')&&!source.includes('QuadludNonogram'),'Soleil-Lune planner must not know other games');

// Browser/PWA dependency graph: the exact selector URL must be loaded and cached
// before the specialized Soleil-Lune planner that consumes it.
const index=fs.readFileSync(path.join(ROOT,'GitHub','index.html'),'utf8');
const sw=fs.readFileSync(path.join(ROOT,'GitHub','sw.js'),'utf8');
const selectorBrowser='tutor-move-selector.js?v=3.1.9-a11';
const plannerBrowser='tango-played-move-planner.js?v=3.1.8';
const selectorCache='./'+selectorBrowser;
const plannerCache='./'+plannerBrowser;
assert.strictEqual(index.split(selectorBrowser).length-1,1,'index.html must load the selector exactly once');
assert.strictEqual(index.split(plannerBrowser).length-1,1,'index.html must load the Soleil-Lune planner exactly once');
assert(index.indexOf(selectorBrowser)<index.indexOf(plannerBrowser),'index.html must load the selector before the Soleil-Lune planner');
assert.strictEqual(sw.split(selectorCache).length-1,1,'sw.js must cache the exact selector browser URL once');
assert.strictEqual(sw.split(plannerCache).length-1,1,'sw.js must cache the exact Soleil-Lune planner browser URL once');
assert(sw.indexOf(selectorCache)<sw.indexOf(plannerCache),'sw.js must cache selector before planner in the delivery graph');

console.log('v319_a13_tango_selector_check.js: PASS');