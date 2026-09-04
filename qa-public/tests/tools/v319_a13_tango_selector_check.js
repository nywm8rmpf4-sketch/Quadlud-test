#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const Selector=require(path.join(ROOT,'GitHub','tutor-move-selector.js'));
const Planner=require(path.join(ROOT,'GitHub','tango-played-move-planner.js'));
const TL=require(path.join(ROOT,'GitHub','tango-logic.js'));
const TD=require(path.join(ROOT,'GitHub','tango-difficulty.js'));

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

// Historical Stage-28 Soleil-Lune regression subset. These four public puzzles
// are copied from generation-stage25-app-boundaries-v240.json and are the exact
// sources referenced by pedagogy-stage28-v227.json.
const historical=[
  {
    difficulty:'easy',seed:'quadlud-v2.25-stage25.0:tango:easy:reference-00',fingerprint:'qfp1-ff444bbaf1b16b898b0e044e9b01e184',tier:0,preSteps:0,rule:'RELATION_PROPAGATION',
    puzzle:{n:6,state:[[-1,-1,-1,-1,1,-1],[0,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1],[1,-1,-1,1,-1,-1],[-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1]],edges:[[3,4,'r','='],[3,1,'d','×'],[3,2,'r','×'],[1,4,'r','×'],[2,0,'d','='],[1,3,'d','×'],[1,0,'r','×'],[5,2,'r','×'],[4,5,'d','×'],[2,5,'d','='],[1,3,'r','=']]}
  },
  {
    difficulty:'medium',seed:'quadlud-v2.25-stage25.0:tango:medium:reference-00',fingerprint:'qfp1-e827bfeadcd755de8c9c4070cfcb6886',tier:1,preSteps:10,rule:'BALANCE_RELATION',
    puzzle:{n:6,state:[[0,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1],[-1,-1,-1,0,-1,0],[-1,-1,-1,-1,-1,1],[1,-1,-1,-1,-1,-1],[-1,-1,1,-1,-1,-1]],edges:[[1,1,'d','×'],[3,2,'r','='],[3,3,'r','×'],[3,4,'d','='],[4,1,'d','=']]}
  },
  {
    difficulty:'hard',seed:'quadlud-v2.25-stage25.0:tango:hard:reference-00',fingerprint:'qfp1-d7919b2ca5703d81806e07b27a022cb2',tier:2,preSteps:10,rule:'RELATION_BALANCE_COMPONENT',
    puzzle:{n:6,state:[[-1,1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,0],[-1,-1,-1,-1,0,-1],[-1,-1,-1,-1,-1,-1],[-1,-1,-1,0,-1,-1],[-1,-1,-1,-1,-1,-1]],edges:[[0,1,'r','='],[2,0,'r','='],[2,2,'r','×'],[3,2,'d','='],[4,4,'r','='],[5,1,'r','×']]}
  },
  {
    difficulty:'expert',seed:'quadlud-v2.25-stage25.0:tango:expert:reference-00',fingerprint:'qfp1-0ba869bc59909aef702dea5d2ed5fe55',tier:3,preSteps:28,rule:'ASSUMPTION_CONTRADICTION',
    puzzle:{n:6,state:[[-1,-1,-1,-1,-1,-1],[0,-1,-1,-1,-1,-1],[-1,-1,-1,1,0,-1],[-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1]],edges:[[0,3,'r','×'],[1,1,'d','='],[1,3,'d','×'],[2,0,'d','='],[2,2,'r','×'],[2,3,'d','×'],[2,4,'r','×'],[4,3,'r','×'],[5,4,'r','=']]}
  }
];

for(const expected of historical){
  // Reproduce the historical Stage-28 proof path on the exact public puzzle.
  const legacy=TL.createSession(TD._test.initialBoard(expected.puzzle));
  let found=null,preSteps=0;
  for(;preSteps<500;preSteps++){
    const next=TD._test.nextAllowedDeduction(legacy,expected.tier,false);
    assert(next.deduction,`${expected.difficulty}: historical engine path must reach tier ${expected.tier}`);
    if(TD._test.policyTierForRule(next.deduction.rule)===expected.tier){found=next.deduction;break}
    const applied=legacy.applyDeduction(next.deduction);
    assert(applied&&applied.deduction,`${expected.difficulty}: historical pre-step applies`);
  }
  assert(found,`${expected.difficulty}: historical representative proof found`);
  assert.strictEqual(preSteps,expected.preSteps,`${expected.difficulty}: historical Stage-28 path length stable`);
  assert.strictEqual(found.rule,expected.rule,`${expected.difficulty}: historical Stage-28 rule stable`);

  // The new Tutor planner must solve the same puzzle using only visible-state moves,
  // deterministically, without hidden-solution access.
  const runA=Planner.solveByPlayedMoves(expected.puzzle,expected.difficulty,{maxMoves:80,maxEngineSteps:96,maxCandidatePlans:128,maxHypothesisSteps:18,maxCommonSteps:10});
  const runB=Planner.solveByPlayedMoves(expected.puzzle,expected.difficulty,{maxMoves:80,maxEngineSteps:96,maxCandidatePlans:128,maxHypothesisSteps:18,maxCommonSteps:10});
  assert.strictEqual(runA.status,'solved',`${expected.difficulty}: Tutor planner must solve historical Stage-28 puzzle`);
  assert.strictEqual(runB.status,'solved',`${expected.difficulty}: repeated Tutor planner run must solve`);
  assert.deepStrictEqual(runA.moves.map(m=>[m.target,m.value,m.selectionStatus]),runB.moves.map(m=>[m.target,m.value,m.selectionStatus]),`${expected.difficulty}: Tutor played-move sequence must be deterministic`);
  assert(runA.moves.length>0&&runA.moves.length<=36,`${expected.difficulty}: visible move count remains bounded by board size`);
  for(const move of runA.moves){
    assert(move.status==='move');
    assert([Selector.STATUS.PROVEN_MINIMUM,Selector.STATUS.BEST_AVAILABLE_BUDGET_LIMITED].includes(move.selectionStatus),`${expected.difficulty}: selection status explicit`);
    assert(Array.isArray(move.target)&&move.target.length===2);
  }
}

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
