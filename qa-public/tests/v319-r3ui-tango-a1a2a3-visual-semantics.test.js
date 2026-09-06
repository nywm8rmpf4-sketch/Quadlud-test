'use strict';
const assert=require('assert');
const Logic=require('../GitHub/tango-logic.js');
global.TangoLogic=Logic;
const Base=require('../GitHub/tango-played-move-runtime.js');
const CostBridge=require('../GitHub/tango-human-cost-bridge.js');
const UnitFocus=require('../GitHub/tango-pedagogy-unit-focus.js');
const Navigation=require('../GitHub/tutor-action-first-navigation.js');

CostBridge.installRelationEvidence();
const key=c=>`${c[0]},${c[1]}`;
const keys=cells=>new Set((cells||[]).map(key));
const state=Array.from({length:6},()=>Array(6).fill(-1));
state[0][2]=1;
const session=Logic.createSession({n:6,state,edges:[[0,0,'r','=']]});
const direct=CostBridge._test.selfContainedDirectCandidates(Base,session,[0,0],0)[0]?.deduction;
assert(direct,'fixture must expose the direct A1/A2/A3 proof');
assert.strictEqual(direct.rule,'RELATION_BALANCE');
assert.strictEqual(direct.explanationData?.rejected?.kind,'TRIPLE_OVERFLOW');

const normalized=UnitFocus._test.normalizePresentationDeduction(direct,0,null);
const focus=keys(normalized.focusCells);
for(const cell of [[0,0],[0,1],[0,2]])assert(focus.has(key(cell)),`local witness cell ${key(cell)} must remain a concrete pedagogical cell`);
for(const cell of [[0,3],[0,4],[0,5]])assert(!focus.has(key(cell)),`unrelated row cell ${key(cell)} must not become concrete focus`);
const units=UnitFocus._test.unitRefs(normalized).map(u=>`${u.family}:${u.id}`);
assert(!units.includes('row:0'),'a three-cell TRIPLE_OVERFLOW witness must not promote the whole row to unit context');

// A deduction may have several logical conclusions while the runtime chooses
// one actual move. The strongest visual action role must follow that move.
const entry={move:{
  target:[0,0],
  pedagogyStageKind:'action',
  deduction:normalized,
  presentation:{metadata:{showTutorMove:true},action:{conclusions:normalized.conclusions}}
}};
const action=Navigation.actionCoords(entry);
assert.deepStrictEqual(action,[[0,0]],'only the explicit played target A1 may receive the action role');

const group={logicalMoveIndex:0,entries:[entry]};
const roles=Navigation._test.semanticRoles(group);
assert.deepStrictEqual(roles.action,[[0,0]],'semantic action must remain the actual played cell');
const context=keys(roles.context);
for(const cell of [[0,0],[0,1],[0,2]])assert(context.has(key(cell)),`reasoning context must retain ${key(cell)}`);
assert(!context.has('0,3')&&!context.has('0,4')&&!context.has('0,5'),'reasoning context must not expand to the whole row');

const directPremises=keys(UnitFocus._test.premiseStepCells(normalized,null));
for(const cell of [[0,0],[0,1],[0,2]])assert(directPremises.has(key(cell)),`action-stage premise context must retain ${key(cell)}`);

console.log('v319-r3ui-tango-a1a2a3-visual-semantics.test.js: PASS');
