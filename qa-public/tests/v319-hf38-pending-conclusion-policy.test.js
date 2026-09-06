/* QUADLUD — HF3.8 pending conclusion continuity regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);
const Policy=require(runtime('pedagogy-next-move-policy.js'));
function candidate(id,{baseCost=[0,1,1,2,3,1,1],premiseCells=[],focusCells=[],target=[0,0],value=0,stableKey=id}={}){return {id,stableKey,baseCost,premiseCells,focusCells,target,value,payload:{id,target,value}}}

{
  const result=Policy.rank([
    candidate('A2-fresh',{target:[0,1],value:0,premiseCells:[[2,1],[3,1]],focusCells:[[0,1],[4,1]],stableKey:'a'}),
    candidate('B3-pending',{target:[1,2],value:1,premiseCells:[],focusCells:[[1,2]],stableKey:'z'})
  ],{recentCells:[[1,1],[1,2]],pendingConclusions:[{cell:[1,2],value:1}]});
  assert.equal(result.selected.id,'B3-pending');
  assert.equal(result.selected.metrics.pendingConclusionMatch,true);
  assert.equal(result.selected.metrics.pendingConclusionPenalty,0);
}

{
  const result=Policy.rank([candidate('B3-moon',{target:[1,2],value:0}),candidate('B3-sun',{target:[1,2],value:1})],{pendingConclusions:[{cell:[1,2],value:1}]});
  assert.equal(result.selected.id,'B3-sun');
}

global.QuadludPedagogyNextMovePolicy=Policy;
global.QuadludTangoPlayedMovePlanner={nextPlayedMove(){return null},_test:{}};
require(runtime('tango-attention-continuity-bridge.js'));
{
  const T=global.QuadludTangoPlayedMovePlanner._attentionTest;
  const state=Array.from({length:6},()=>Array(6).fill(-1));state[1][1]=1;
  const group=[{deduction:{conclusions:[{type:'VALUE',cell:[1,1],value:1},{type:'VALUE',cell:[1,2],value:1}]}}];
  const pending=T.pendingConclusionsForGroup({work:{state}},group);
  assert.deepStrictEqual(pending,[{cell:[1,2],value:1}]);
  assert.equal(T.pendingConclusionMatch({target:[1,2],value:1},pending),true);
  assert.equal(T.pendingConclusionMatch({target:[0,1],value:0},pending),false);
}

console.log('PASS HF3.8 pending-conclusion continuity.');
