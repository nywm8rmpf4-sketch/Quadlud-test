/* QUADLUD — R5.1 recent demonstrated dependency continuity
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);
const Policy=require(runtime('pedagogy-next-move-policy.js'));

global.QuadludPedagogyNextMovePolicy=Policy;
global.QuadludTangoPlayedMovePlanner={nextPlayedMove(){return null},_test:{}};
global.walkthroughSession={
  base:{game:'tango'},
  work:{state:Array.from({length:6},()=>Array(6).fill(-1))},
  moves:[
    {target:[1,3],proofStage:{kind:'action'},beforeSnapshot:{state:[[0]]}},
    {target:[2,5],proofStage:{kind:'action'},beforeSnapshot:{state:[[1]]}}
  ]
};
require(runtime('tango-attention-continuity-bridge.js'));
const T=global.QuadludTangoPlayedMovePlanner._attentionTest;

assert.deepStrictEqual(T.recentPlayedTargets(global.walkthroughSession),[[2,5],[1,3]],'two most recent demonstrated action targets must remain available');

const context={recentCells:[[2,5],[2,4]],recentActionCells:[[2,5],[1,3]],pendingConclusions:[]};
const local={...context,recentCells:[[2,5],[2,4],[2,3],[2,2]],localExpansionApplied:true,localAxis:{family:'row',id:2}};
const candidate=(rule,target,premises,baseCost=[0,1,1,3,2,0,0])=>({
  target,value:1,baseCost,premiseCells:premises,focusCells:premises,payload:{deduction:{rule,rank:0},target,value:1}
});

const c3=candidate('RELATION_PROPAGATION',[2,2],[[1,3],[2,2]]);
assert.equal(T.localDependencyContinuationCandidate(c3,context,local),true,'C3 must reuse B4 while staying inside the local C-row attention zone');

const distant=candidate('RELATION_PROPAGATION',[0,0],[[1,3],[0,0]]);
assert.equal(T.localDependencyContinuationCandidate(distant,context,local),false,'recent dependency must not pull attention to a distant target');

const missingDependency=candidate('RELATION_PROPAGATION',[2,2],[[1,4],[2,2]]);
assert.equal(T.localDependencyContinuationCandidate(missingDependency,context,local),false,'an undemonstrated source must not become a continuation');

const rank1=candidate('RELATION_BALANCE',[2,0],[[2,3],[2,4],[2,5],[2,0]],[0,1,1,5,6,1,1]);
assert.equal(T.localDependencyContinuationCandidate(rank1,context,local),false,'R1/multi-premise relation balance must not be promoted by recent-action memory');

const abstract=candidate('LINE_DOMAIN_SUPPORT',[2,2],[[2,3],[2,4],[2,5],[2,2]],[0,1,1,5,6,2,1]);
assert.equal(T.localDependencyContinuationCandidate(abstract,context,local),false,'abstract line-domain support must remain excluded');

console.log('v319-r3ui-tango-attention-dependency.test.js: PASS — local target + recent demonstrated source only');
