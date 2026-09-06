const assert = require('assert');
const HF39 = require('../../tango-semantic-coherence-hf39.js');

const T = HF39._test;
const snap = state => ({state: state.map(row => row.slice())});
const empty = () => Array.from({length:6},()=>Array(6).fill(-1));
const presentation = (conclusions, move='') => ({
  metadata:{showTutorMove:true},
  explanation:{where:'',why:'',move},
  action:{type:'APPLY_DEDUCTION',conclusions:JSON.parse(JSON.stringify(conclusions))}
});

{
  const d={focusCells:[[2,0],[3,0]],premises:[{kind:'RELATION',a:[2,0],b:[3,0],parity:0}],conclusions:[{type:'VALUE',cell:[2,0],value:0}]};
  assert.deepStrictEqual(T.inferUnit(d),{family:'column',id:0});
  assert.strictEqual(T.repairInvalidUnitText('équilibre de colonne NaN',d,'fr'),'équilibre de colonne 1');
}
{
  const after=empty();after[2][0]=0;
  const conclusions=[{type:'VALUE',cell:[2,0],value:0},{type:'VALUE',cell:[3,0],value:0}];
  const move={target:[2,0],snapshot:snap(after),deduction:{rule:'RELATION_BALANCE',conclusions},presentation:presentation(conclusions,'C1 = lune · D1 = lune'),move:'C1 = lune · D1 = lune'};
  assert(HF39.normalizeGeneratedMoves({base:{game:'tango'},moves:[move]},0));
  assert.strictEqual(move.move,'C1 = lune ☾');
  assert.deepStrictEqual(move.presentation.action.conclusions,[{type:'VALUE',cell:[2,0],value:0}]);
}
{
  const before=empty(),final=empty();final[0][0]=1;
  const hypothesis={target:[0,0],snapshot:snap(final),proofSnapshot:snap(before),beforeSnapshot:snap(before),pedagogyStageKind:'hypothesis',proofStage:{kind:'reasoning',apply:false},deduction:{rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:[0,0],value:0,hypothesis:true}],conclusions:[]},presentation:presentation([], 'A1 = soleil ☀'),move:'A1 = soleil ☀'};
  const action={target:[0,0],snapshot:snap(final),proofSnapshot:snap(final),beforeSnapshot:snap(before),pedagogyStageKind:'action',proofStage:{kind:'action',apply:true},deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:1}]},presentation:presentation([{type:'VALUE',cell:[0,0],value:1}], 'A1 = soleil ☀'),move:'A1 = soleil ☀'};
  HF39.normalizeGeneratedMoves({base:{game:'tango'},moves:[hypothesis,action]},0);
  assert.strictEqual(hypothesis.snapshot.state[0][0],-1);
  assert.strictEqual(hypothesis.move,'');
  assert.strictEqual(hypothesis.presentation.metadata.showTutorMove,false);
  assert.strictEqual(hypothesis.proofStage.kind,'hypothesis');
  assert.strictEqual(action.move,'A1 = soleil ☀');
}
{
  const h={move:{pedagogyStageKind:'hypothesis',deduction:{premises:[{kind:'ASSUMPTION',cell:[0,0],value:0,hypothesis:true}],conclusions:[]}}};
  const r1={move:{pedagogyStageKind:'reasoning',deduction:{conclusions:[{type:'VALUE',cell:[4,1],value:1}]},causalProof:{steps:[{id:'s1',kind:'deduction',sequenceIndex:1}]},causalStepId:'s1'}};
  const r2={move:{pedagogyStageKind:'reasoning',deduction:{conclusions:[{type:'VALUE',cell:[5,3],value:0}]},causalProof:{steps:[{id:'s2',kind:'deduction',sequenceIndex:2}]},causalStepId:'s2'}};
  assert.deepStrictEqual(T.proofMarkers({entries:[h,r1,r2]},2).map(x=>[x.kind,x.cell,x.value,x.sequence]),[
    ['hypothesis',[0,0],0,0],['consequence',[4,1],1,1],['consequence',[5,3],0,2]
  ]);
}
{
  const before=empty(),final=empty();final[0][0]=1;
  const duplicate={target:[0,0],snapshot:snap(final),proofSnapshot:snap(before),pedagogyStageKind:'action',proofStage:{kind:'reasoning'},deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:1}]},presentation:presentation([{type:'VALUE',cell:[0,0],value:1}], 'A1 = soleil ☀'),move:'A1 = soleil ☀'};
  const action={target:[0,0],snapshot:snap(final),proofSnapshot:snap(final),pedagogyStageKind:'action',proofStage:{kind:'action'},deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:1}]},presentation:presentation([{type:'VALUE',cell:[0,0],value:1}], 'A1 = soleil ☀'),move:'A1 = soleil ☀'};
  HF39.normalizeGeneratedMoves({base:{game:'tango'},moves:[duplicate,action]},0);
  assert.strictEqual(duplicate.pedagogyStageKind,'reasoning');
  assert.strictEqual(duplicate.move,'');
  assert(/impasse/.test(duplicate.why));
  assert.strictEqual(action.move,'A1 = soleil ☀');
}
console.log('HF3.9 semantic coherence PASS — SEM-01/02/03/05/06/07 structural regressions');
