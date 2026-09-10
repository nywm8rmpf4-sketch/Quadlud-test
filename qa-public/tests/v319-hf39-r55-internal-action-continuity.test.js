/* QUADLUD — regression: only the final proof entry may be a real action. */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
function runtime(name){const candidates=[path.resolve(__dirname,'../GitHub',name),path.resolve(__dirname,'../../',name),path.resolve(__dirname,'../../GitHub',name)],found=candidates.find(fs.existsSync);assert(found,`cannot locate ${name}`);return found}
const S=require(runtime('tango-semantic-coherence-hf39.js'));
const empty=()=>Array.from({length:6},()=>Array(6).fill(-1)),snap=state=>({state:state.map(r=>r.slice())});
const base=empty(),branch=empty(),final=empty();branch[0][0]=1;branch[3][5]=0;final[0][0]=0;
const presentation=()=>({metadata:{showTutorMove:true},explanation:{where:'',why:'',move:'D6 = lune ☾'}});
const hypothesis={pedagogyStageKind:'hypothesis',proofStage:{kind:'hypothesis',apply:false},proofSnapshot:snap(base),snapshot:snap(final),beforeSnapshot:snap(base),deduction:{rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:[0,0],value:1,hypothesis:true}],conclusions:[]},presentation:presentation(),move:'A1 = soleil ☀'};
const internal={pedagogyStageKind:'action',proofStage:{kind:'action',apply:true},proofSnapshot:snap(branch),snapshot:snap(final),beforeSnapshot:snap(base),deduction:{id:'D49:presentation:1:pedagogical-final-action',rule:'LINE_DOMAIN_SUPPORT',conclusions:[{type:'VALUE',cell:[3,5],value:0}]},presentation:presentation(),move:'D6 = lune ☾'};
const contradiction={pedagogyStageKind:'contradiction',proofStage:{kind:'contradiction',apply:false},proofSnapshot:snap(branch),snapshot:snap(final),beforeSnapshot:snap(base),deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[]},presentation:presentation(),move:''};
const rollback={pedagogyStageKind:'rollback',proofStage:{kind:'rollback',apply:false},proofSnapshot:snap(base),snapshot:snap(final),beforeSnapshot:snap(base),deduction:{rule:'ROLLBACK',conclusions:[]},presentation:presentation(),move:''};
const action={pedagogyStageKind:'action',proofStage:{kind:'action',apply:true},proofSnapshot:snap(final),snapshot:snap(final),beforeSnapshot:snap(base),target:[0,0],deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,0],value:0}]},presentation:presentation(),move:'A1 = lune ☾'};
const session={base:{game:'tango'},moves:[hypothesis,internal,contradiction,rollback,action]};
assert.strictEqual(S.normalizeGeneratedMoves(session,0),true);
assert.strictEqual(internal.pedagogyStageKind,'reasoning');
assert.strictEqual(internal.proofStage.kind,'reasoning');
assert.strictEqual(internal.proofStage.apply,false);
assert.strictEqual(internal.presentation.metadata.showTutorMove,false);
assert.strictEqual(internal.move,'');
assert.strictEqual(internal.snapshot.state[0][0],1);
assert.strictEqual(internal.snapshot.state[3][5],0);
assert.strictEqual(action.pedagogyStageKind,'action');
assert.strictEqual(action.proofStage.apply,true);
assert.strictEqual(action.snapshot.state[0][0],0);
assert.strictEqual(session.moves.filter(m=>m.pedagogyStageKind==='action').length,1);
console.log('PASS HF3.9-R5.5 internal action continuity — only final action is real, branch snapshot preserved.');
