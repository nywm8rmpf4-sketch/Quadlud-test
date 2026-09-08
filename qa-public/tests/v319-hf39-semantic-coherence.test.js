const assert = require('assert');
const fs = require('fs');
const path = require('path');
function runtime(name){
  const candidates=[
    path.resolve(__dirname,'../GitHub',name),
    path.resolve(__dirname,'../../',name),
    path.resolve(__dirname,'../../GitHub',name)
  ];
  const found=candidates.find(fs.existsSync);
  assert(found,`cannot locate ${name}`);
  return found;
}
const HF39 = require(runtime('tango-semantic-coherence-hf39.js'));
const CausalProjection = require(runtime('tango-causal-proof-projection.js'));
const ContradictionVisuals = require(runtime('tango-contradiction-visuals.js'));
const Finalizer = require(runtime('tango-pedagogy-text-finalizer.js'));

global.document={documentElement:{lang:'fr'}};

const T = HF39._test;
const snap = state => ({state: state.map(row => row.slice())});
const empty = () => Array.from({length:6},()=>Array(6).fill(-1));
const presentation = (conclusions, move='', why='') => ({
  metadata:{showTutorMove:true},
  explanation:{where:'',why,move},
  action:{type:'APPLY_DEDUCTION',conclusions:JSON.parse(JSON.stringify(conclusions))}
});

// SEM-01 moved to the dedicated R5.5 valid-unit-label contract. Keeping one
// owner avoids testing helpers that no longer belong to this projection.

// SEM-02: the displayed action is the one atomic cell actually applied,
// even when the deduction proves several fresh conclusions.
{
  const before=empty(),after=empty();after[2][0]=0;
  const conclusions=[{type:'VALUE',cell:[2,0],value:0},{type:'VALUE',cell:[3,0],value:0}];
  const move={target:[2,0],snapshot:snap(after),deduction:{rule:'RELATION_BALANCE',conclusions},presentation:presentation(conclusions,'C1 = lune · D1 = lune'),move:'C1 = lune · D1 = lune'};
  const session={base:{game:'tango'},moves:[move]};
  assert(HF39.normalizeGeneratedMoves(session,0));
  assert.strictEqual(move.move,'C1 = lune ☾');
  assert.strictEqual(move.presentation.explanation.move,'C1 = lune ☾');
}

// SEM-03 / SEM-06: proof substeps recover their proof snapshot and cannot
// expose the final real action before the action stage.
{
  const before=empty(),final=empty();final[0][0]=1;
  const hypothesis={
    target:[0,0],snapshot:snap(final),proofSnapshot:snap(before),beforeSnapshot:snap(before),
    pedagogyStageKind:'hypothesis',proofStage:{kind:'reasoning',apply:false},
    deduction:{rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:[0,0],value:0,hypothesis:true}],conclusions:[]},
    presentation:presentation([], 'A1 = soleil ☀'),move:'A1 = soleil ☀'
  };
  const action={
    target:[0,0],snapshot:snap(final),proofSnapshot:snap(final),beforeSnapshot:snap(before),
    pedagogyStageKind:'action',proofStage:{kind:'action',apply:true},
    deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:1}]},
    presentation:presentation([{type:'VALUE',cell:[0,0],value:1}], 'A1 = soleil ☀','L’hypothèse est impossible. Donc A1 = soleil ☀.'),move:'A1 = soleil ☀'
  };
  const session={base:{game:'tango'},moves:[hypothesis,action]};
  HF39.normalizeGeneratedMoves(session,0);
  assert.strictEqual(hypothesis.snapshot.state[0][0],-1,'hypothesis must not use final real snapshot');
  assert.strictEqual(hypothesis.move,'');
  assert.strictEqual(hypothesis.presentation.metadata.showTutorMove,false);
  assert.strictEqual(hypothesis.proofStage.kind,'hypothesis');
  assert.strictEqual(action.move,'A1 = soleil ☀');
  assert.strictEqual(action.presentation.metadata.showTutorMove,true);
}

// SEM-05: hypothetical consequences carry both an explicit value and a stable
// sequence number; the hypothesis keeps its own H marker.
{
  const h={move:{pedagogyStageKind:'hypothesis',deduction:{premises:[{kind:'ASSUMPTION',cell:[0,0],value:0,hypothesis:true}],conclusions:[]}}};
  const r1={move:{pedagogyStageKind:'reasoning',deduction:{conclusions:[{type:'VALUE',cell:[4,1],value:1}]},causalProof:{steps:[{id:'s1',kind:'deduction',hypothetical:true,sequenceIndex:1}]},causalStepId:'s1'}};
  const r2={move:{pedagogyStageKind:'reasoning',deduction:{conclusions:[{type:'VALUE',cell:[5,3],value:0}]},causalProof:{steps:[{id:'s2',kind:'deduction',hypothetical:true,sequenceIndex:2}]},causalStepId:'s2'}};
  const markers=T.proofMarkers({entries:[h,r1,r2]},2);
  assert.deepStrictEqual(markers.map(x=>[x.kind,x.cell,x.value,x.sequence]),[
    ['hypothesis',[0,0],0,0],
    ['consequence',[4,1],1,1],
    ['consequence',[5,3],0,2]
  ]);
}

// SEM-07 R5.5: contradiction, rollback and real action remain three distinct
// stages. The rollback never previews the real action.
{
  const before=empty(),final=empty();final[0][0]=1;
  const rollback={target:null,snapshot:snap(before),proofSnapshot:snap(before),pedagogyStageKind:'rollback',proofStage:{kind:'rollback',apply:false},deduction:{rule:'ROLLBACK',conclusions:[]},presentation:presentation([], '', 'L’hypothèse est impossible. Donc A1 = soleil ☀.'),why:'L’hypothèse est impossible. Donc A1 = soleil ☀.',move:''};
  const action={target:[0,0],snapshot:snap(final),proofSnapshot:snap(final),pedagogyStageKind:'action',proofStage:{kind:'action'},deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:1}]},presentation:presentation([{type:'VALUE',cell:[0,0],value:1}], 'A1 = soleil ☀','L’hypothèse est impossible. Donc A1 = soleil ☀.'),move:'A1 = soleil ☀'};
  HF39.normalizeGeneratedMoves({base:{game:'tango'},moves:[rollback,action]},0);
  assert.strictEqual(rollback.pedagogyStageKind,'rollback');
  assert.strictEqual(rollback.move,'');
  assert.match(rollback.why,/contradiction vient d’être établie/);
  assert(!/A1\s*=\s*soleil/i.test(rollback.why),'rollback must not preview the real action');
  assert.strictEqual(action.move,'A1 = soleil ☀');
}

// SEM-08 R3: HF3.9 remains the authoritative final marker projection, while
// lower-level projectors retain their own callable fallbacks. Browser QA checks
// that the fallback works alone; semantic evidence checks that the final DOM
// contains only the canonical H/1/2/3 sequence after HF3.9 replacement.
{
  assert.strictEqual(HF39.OWNS_HYPOTHETICAL_MARKERS,true);
  assert.strictEqual(typeof CausalProjection.decorate,'function');
  assert.strictEqual(typeof ContradictionVisuals.decorate,'function');
}

// Artifact review: the finalizer owns symbol normalization, French grammar,
// and HTML boundary spacing.
{
  const french=Finalizer.finalizeText('Dans colonne 1, colonne 1 doit contenir 3 Soleils et 3 Lunes. Un troisième lune 🌙 est interdit.');
  assert(french.includes('Dans la colonne 1'),french);
  assert(french.includes('la colonne 1 doit contenir'),french);
  assert(french.includes('3 soleils ☀')&&french.includes('3 lunes ☾'),french);
  assert(french.includes('Une troisième lune ☾'),french);
  const html=Finalizer.finalizeHtml('<p><b>Où regarder :</b> Regarde A1.</p><p><b>Coup conseillé :</b> A1 = sun 🌞.</p>');
  assert(!html.includes(':Regarde'),html);
  assert(/<\/b>\s+Regarde A1/.test(html),html);
  assert(/<\/b>\s+A1 = soleil ☀/.test(html),html);
}

console.log('HF3.9-R5.5 semantic coherence PASS — distinct rollback/action, canonical markers, finalizer grammar/spacing.');
