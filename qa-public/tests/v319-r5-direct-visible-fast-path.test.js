/* QUADLUD — R5.1b direct visible planner fast-path regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const Planner=require(path.join(__dirname,'..','..','tango-played-move-planner.js'));
const T=Planner._test;

assert.equal(typeof T.directlyPlacesVisibleValue,'function','planner must expose the direct-visible predicate for regression coverage');
const empty=Array.from({length:2},()=>Array(2).fill(-1));
const directDeduction={id:'direct-1',rule:'TRIPLE_CONSTRAINT',rank:0,techniqueLevel:0,premises:[],conclusions:[{type:'VALUE',cell:[0,0],value:0}]};
assert.equal(T.directlyPlacesVisibleValue(empty,directDeduction),true,'an empty visible VALUE conclusion is a direct playable placement');
assert.equal(T.directlyPlacesVisibleValue([[0,-1],[-1,-1]],directDeduction),false,'an already-filled VALUE conclusion must not use the direct-visible fast path');
assert.equal(T.directlyPlacesVisibleValue(empty,{rule:'RELATION_COMBINATION',conclusions:[{type:'RELATION',a:[0,0],b:[0,1],relation:'SAME'}]}),false,'relation-only deductions must retain the full-closure path');

function mockSession(log,state=empty){
  return {
    n:2,
    state:state.map(row=>row.slice()),
    diagnose(){return null},
    directDeductions(){return []},
    clone(){return mockSession(log,this.state)},
    applyDeduction(deduction,options={}){
      log.push({rule:deduction?.rule||null,close:options.close});
      const automatic=[];
      let applied=false;
      for(const c of deduction?.conclusions||[]){
        if(c?.type==='VALUE'&&Array.isArray(c.cell)&&this.state?.[c.cell[0]]?.[c.cell[1]]===-1){this.state[c.cell[0]][c.cell[1]]=c.value;applied=true}
      }
      if(!applied&&options.close!==false&&deduction?.rule==='RELATION_COMBINATION'&&this.state[0][1]===-1){
        const auto={id:'auto-1',rule:'RELATION_PROPAGATION',rank:0,techniqueLevel:0,premises:[],conclusions:[{type:'VALUE',cell:[0,1],value:1}]};
        this.state[0][1]=1;automatic.push(auto);applied=true;
      }
      return {applied:true,deduction:JSON.parse(JSON.stringify(deduction)),automatic};
    }
  };
}

const directCalls=[];
const directPlan=T.planFromFirstDeduction(mockSession(directCalls),3,directDeduction,{maxEngineSteps:1});
assert.equal(directPlan.status,'move');
assert.deepStrictEqual(directPlan.target,[0,0]);
assert.equal(directPlan.value,0);
assert.ok(directCalls.length>=2,'direct planning must include validation and frontier reconstruction');
assert.equal(directCalls[0].close,false,'the first apply of an already-visible deduction must skip automatic closure');
assert.ok(directCalls.every(call=>call.close===false),'direct-visible planning must not compute discarded automatic downstream propagation');

const relationCalls=[];
const relationDeduction={id:'relation-1',rule:'RELATION_COMBINATION',rank:0,techniqueLevel:0,premises:[],conclusions:[{type:'RELATION',a:[0,0],b:[0,1],relation:'SAME'}]};
const relationPlan=T.planFromFirstDeduction(mockSession(relationCalls),3,relationDeduction,{maxEngineSteps:1});
assert.equal(relationPlan.status,'move');
assert.deepStrictEqual(relationPlan.target,[0,1]);
assert.equal(relationCalls[0].close,undefined,'relation-only first deductions must retain the certified full-closure behavior');

console.log('v319-r5-direct-visible-fast-path.test.js: PASS — direct visible placements skip discarded automatic closure; relation-only deductions retain baseline closure');
