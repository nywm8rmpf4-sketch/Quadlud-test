/* QUADLUD — R5.1b shared initial-state validation regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const Planner=require(path.join(__dirname,'..','GitHub','tango-played-move-planner.js'));
const T=Planner._test;

function deduction(id,cell,value){return {id,signature:id,rule:'TRIPLE_CONSTRAINT',rank:0,techniqueLevel:0,premises:[],conclusions:[{type:'VALUE',cell:cell.slice(),value}]}}
function cloneGrid(state){return state.map(row=>row.slice())}
function mockSession(log,state=[[-1,-1],[-1,-1]]){
  return {
    n:2,
    state:cloneGrid(state),
    diagnose(){log.diagnose++;return null},
    directDeductions(){return []},
    relationBetween(){return null},
    clone(){return mockSession(log,this.state)},
    applyDeduction(d,options={}){
      log.apply.push(options.close);
      const applied=JSON.parse(JSON.stringify(d)),automatic=[];
      let changed=false;
      for(const c of applied.conclusions||[]){
        if(c?.type==='VALUE'&&Array.isArray(c.cell)&&this.state?.[c.cell[0]]?.[c.cell[1]]===-1){this.state[c.cell[0]][c.cell[1]]=c.value;changed=true}
      }
      if(options.close!==false&&this.state[1][1]===-1){
        const auto={id:`auto-${d.id}`,signature:`auto-${d.id}`,rule:'RELATION_PROPAGATION',rank:0,techniqueLevel:0,premises:[{dependencies:[d.id]}],dependencies:[d.id],conclusions:[{type:'VALUE',cell:[1,1],value:1}]};
        this.state[1][1]=1;automatic.push(auto);changed=true
      }
      return changed?{deduction:applied,automatic}:{deduction:null,automatic:[]}
    }
  }
}

const d1=deduction('d1',[0,0],0),d2=deduction('d2',[0,1],1);
const batchLog={diagnose:0,apply:[]};
const evaluation=T.evaluateStartingDeductions(mockSession(batchLog),1,[d1,d2],{maxEngineSteps:4},false);
assert.equal(evaluation.plans.length,2,'both direct candidates must still be evaluated');
assert.equal(batchLog.diagnose,1,'the identical initial state must be diagnosed once for the whole direct frontier, not once per candidate');
assert.equal(batchLog.apply.filter(close=>close===undefined).length,2,'each candidate simulation must retain certified full automatic closure');
assert.equal(batchLog.apply.filter(close=>close===false).length,2,'causal frontier reconstruction must still stage each selected direct deduction without closure');
for(const plan of evaluation.plans){
  assert(plan.engineVisiblePlacements.some(x=>x.cell?.[0]===1&&x.cell?.[1]===1&&x.to===1),'full engine simulation metadata must preserve the automatic downstream placement');
}

const individualLog={diagnose:0,apply:[]};
const individual=T.planFromFirstDeduction(mockSession(individualLog),1,d1,{maxEngineSteps:4});
assert.equal(individual.status,'move');
assert.equal(individualLog.diagnose,1,'standalone planning without prior validation must still diagnose its initial state');
assert(individual.engineVisiblePlacements.some(x=>x.cell?.[0]===1&&x.cell?.[1]===1&&x.to===1),'standalone planning must preserve automatic downstream metadata');

const prevalidatedLog={diagnose:0,apply:[]};
const prevalidated=T.planFromFirstDeduction(mockSession(prevalidatedLog),1,d1,{maxEngineSteps:4,initialStateValidated:true});
assert.equal(prevalidated.status,'move');
assert.equal(prevalidatedLog.diagnose,0,'a caller that just validated the same immutable start state may skip only that duplicate first diagnosis');
assert(prevalidated.engineVisiblePlacements.some(x=>x.cell?.[0]===1&&x.cell?.[1]===1&&x.to===1),'prevalidated planning must preserve full simulation consequences');

// Advanced rule families are ordered: a demonstrated contradiction candidate
// outranks a common-consequence scan. Do not synchronously rescan every branch
// for a family that cannot replace the already available candidates.
let assumptionCalls=0,commonCalls=0;
const assumption=deduction('assumption',[1,0],1);assumption.rule='ASSUMPTION_CONTRADICTION';assumption.rank=3;
const advanced=T.advancedDeductionsDetailed({
  findAssumptionContradictionsDetailed(){assumptionCalls++;return {deductions:[assumption],budgetHit:false}},
  findCommonConsequencesDetailed(){commonCalls++;return {deductions:[deduction('common',[1,1],0)],budgetHit:false}}
},3);
assert.equal(assumptionCalls,1,'the ordered contradiction frontier must be evaluated once');
assert.equal(commonCalls,0,'a lower-priority common-consequence frontier must not be rebuilt when contradiction candidates exist');
assert.deepEqual(advanced.deductions,[assumption],'the available contradiction proof must be preserved exactly');

console.log('v319-r5-frontier-validation-cache.test.js: PASS — one shared initial diagnosis; full automatic closure and causal metadata preserved');
