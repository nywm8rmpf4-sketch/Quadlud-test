'use strict';
const assert=require('assert');
const Logic=require('../GitHub/tango-logic.js');
global.TangoLogic=Logic;
const Base=require('../GitHub/tango-played-move-runtime.js');
const Bridge=require('../GitHub/tango-human-cost-bridge.js');

Bridge.installRelationEvidence();

// Human regression reported on iPhone/iPad:
// A1 = A2 is visible, A3 is already a sun. The engine may internally derive
// A1 × A3 and then propagate from A3, but the pedagogical proof must prefer the
// concrete causal contradiction:
// assume A1=sun -> A2=sun -> A1/A2/A3 are three suns -> therefore A1=moon.
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

// The raw solver is allowed to encounter a more abstract contradiction first.
// The pedagogical boundary must refine it to a concrete visible witness.
const rawRejected=session.hypothesisResult([0,0],1);
assert(rawRejected.contradiction,'A1=sun must be contradictory');
const concrete=Base._test.concreteContradictionForMove(session,[0,0],0);
assert(concrete&&concrete.deduction,'pedagogy must find a concrete contradiction for A1=moon');
assert.strictEqual(concrete.witness.kind,'TRIPLE_OVERFLOW');
assert.strictEqual(concrete.witness.value,1,'the concrete contradiction must identify three suns');
assert.deepStrictEqual(concrete.witness.cells,[[0,0],[0,1],[0,2]]);
const forcedA2=(concrete.deduction.explanationData.causalTrace||[]).find(d=>(d.conclusions||[]).some(c=>c.type==='VALUE'&&c.cell[0]===0&&c.cell[1]===1&&c.value===1));
assert(forcedA2,'causal trace must explicitly propagate A1=sun through A1=A2 to A2=sun');
assert.strictEqual(forcedA2.rule,'RELATION_PROPAGATION');
assert((forcedA2.premises||[]).some(p=>p.kind==='RELATION'&&p.explicit===true&&p.parity===0),'A2 propagation must use the visible equality A1=A2');

const rawProof={schema:3,kind:'engine-proof',deduction:relationProof,displayDeductions:[relationProof],replaced:false};
const corrected=Bridge._test.correctedProof(Base,session,{status:'move',tierIndex:3,target:[0,0],value:0},rawProof);
assert.strictEqual(corrected.kind,'simpler-causal-contradiction-proof');
assert.strictEqual(corrected.deduction.rule,'ASSUMPTION_CONTRADICTION');
assert((corrected.deduction.conclusions||[]).some(c=>c.type==='VALUE'&&c.cell[0]===0&&c.cell[1]===0&&c.value===0),'corrected proof must conclude A1=moon');
assert.deepStrictEqual(corrected.deduction.explanationData.assumption,{cell:[0,0],value:1});
assert.strictEqual(corrected.deduction.explanationData.witness.kind,'TRIPLE_OVERFLOW');
assert.deepStrictEqual(corrected.deduction.explanationData.witness.cells,[[0,0],[0,1],[0,2]]);
assert((corrected.deduction.explanationData.causalTrace||[]).some(d=>(d.conclusions||[]).some(c=>c.type==='VALUE'&&c.cell[0]===0&&c.cell[1]===1&&c.value===1)),'display proof must retain the indispensable A2 consequence');
assert(Bridge._test.proofPreferenceTier(session,corrected.deduction)<Bridge._test.proofPreferenceTier(session,relationProof),'concrete causal proof must outrank the abstract derived-relation shortcut');

console.log('v319-r3ui-tango-a1a2a3-causal-proof.test.js: PASS');
