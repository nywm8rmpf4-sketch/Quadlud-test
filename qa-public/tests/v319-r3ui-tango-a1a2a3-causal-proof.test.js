'use strict';
const assert=require('assert');
const Logic=require('../GitHub/tango-logic.js');
global.TangoLogic=Logic;
const Base=require('../GitHub/tango-played-move-runtime.js');
const Bridge=require('../GitHub/tango-human-cost-bridge.js');

Bridge.installRelationEvidence();
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);

// Human regression reported on iPhone/iPad:
// A1 = A2 is visible, A3 is already a sun. The engine may internally derive
// A1 × A3 and then propagate from A3. Human-first pedagogy must instead select
// the shortest self-contained visible proof for A1=moon. In this fixture that
// proof is RELATION_BALANCE: A1 and A2 are identical; choosing both as suns
// would create the forbidden triple A1/A2/A3, so A1 and A2 are moons.
const state=Array.from({length:6},()=>Array(6).fill(-1));
state[0][2]=1;
const board={n:6,state,edges:[[0,0,'r','=']]};
const session=Logic.createSession(board);

const relationProducer=session.findTripleConstraint().find(d=>
  d?.explanationData?.mode==='RELATION'&&
  (d.conclusions||[]).some(c=>c.type==='RELATION'&&c.parity===1&&
    ((c.a[0]===0&&c.a[1]===0&&c.b[0]===0&&c.b[1]===2)||(c.b[0]===0&&c.b[1]===0&&c.a[0]===0&&c.a[1]===2)))
);
assert(relationProducer,'engine must expose the internal relation shortcut fixture');

const frontier=session.clone();
const applied=frontier.applyDeduction(relationProducer,{close:false});
assert(applied.deduction,'derived relation must be applicable in the engine fixture');
const relationProof=frontier.relationPropagationDeductions().find(d=>(d.conclusions||[]).some(c=>c.type==='VALUE'&&c.cell[0]===0&&c.cell[1]===0&&c.value===0));
assert(relationProof,'engine fixture must expose the derived-relation A1=moon proof');
const relationPremise=(relationProof.premises||[]).find(p=>p.kind==='RELATION');
assert(relationPremise&&!relationPremise.explicit,'the shortcut must depend on a derived, not visible, relation');
assert(Array.isArray(relationPremise.path)&&relationPremise.path.length,'derived relation provenance must travel with the premise');

// A concrete contradiction proof also exists and remains auditable, but it is
// longer than the direct visible RELATION_BALANCE deduction and must not win.
const concrete=Base._test.concreteContradictionForMove(session,[0,0],0);
assert(concrete&&concrete.deduction,'pedagogy must still be able to construct the concrete contradiction alternative');
assert.strictEqual(concrete.witness.kind,'TRIPLE_OVERFLOW');
assert.deepStrictEqual(concrete.witness.cells,[[0,0],[0,1],[0,2]]);

const directCandidates=Bridge._test.selfContainedDirectCandidates(Base,session,[0,0],0);
assert(directCandidates.length,'a self-contained direct proof must exist');
const direct=directCandidates[0].deduction;
assert.strictEqual(direct.rule,'RELATION_BALANCE','minimal proof must be the visible relation-orientation deduction');
const directRelation=(direct.premises||[]).find(p=>p.kind==='RELATION');
const a1=[0,0],a2=[0,1];
assert(directRelation&&directRelation.explicit===true&&String(directRelation.relation||'').toUpperCase()==='SAME','direct proof must use the visible SAME relation');
assert(((sameCell(directRelation.a,a1)&&sameCell(directRelation.b,a2))||(sameCell(directRelation.a,a2)&&sameCell(directRelation.b,a1))),'direct proof relation must be exactly A1=A2');
assert.strictEqual(direct.explanationData?.rejected?.kind,'TRIPLE_OVERFLOW','direct proof must retain the concrete rejected triple witness');
assert.deepStrictEqual(direct.explanationData.rejected.cells,[[0,0],[0,1],[0,2]]);
assert((direct.conclusions||[]).some(c=>c.type==='VALUE'&&sameCell(c.cell,a1)&&c.value===0),'direct proof must conclude A1=moon');
assert((direct.conclusions||[]).some(c=>c.type==='VALUE'&&sameCell(c.cell,a2)&&c.value===0),'direct proof must also conclude A2=moon');

const rawProof={schema:3,kind:'engine-proof',deduction:relationProof,displayDeductions:[relationProof],replaced:false};
const corrected=Bridge._test.correctedProof(Base,session,{status:'move',tierIndex:3,target:[0,0],value:0},rawProof);
assert.strictEqual(corrected.kind,'simpler-self-contained-direct-proof');
assert.strictEqual(corrected.deduction.rule,'RELATION_BALANCE');
assert.strictEqual(corrected.deduction.explanationData?.rejected?.kind,'TRIPLE_OVERFLOW');
assert.deepStrictEqual(corrected.deduction.explanationData.rejected.cells,[[0,0],[0,1],[0,2]]);
assert((corrected.deduction.conclusions||[]).some(c=>c.type==='VALUE'&&sameCell(c.cell,a1)&&c.value===0),'corrected proof must conclude A1=moon');
assert(Bridge._test.proofPreferenceTier(session,corrected.deduction)<Bridge._test.proofPreferenceTier(session,relationProof),'direct self-contained proof must outrank the derived-relation shortcut');

console.log('v319-r3ui-tango-a1a2a3-causal-proof.test.js: PASS');
