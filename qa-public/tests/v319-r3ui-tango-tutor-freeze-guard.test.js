/* QUADLUD HF3.6-A — Tutor cycle guard regression */
'use strict';
const path=require('path');
const pedagogy=require(path.join(__dirname,'..','..','tango-pedagogy.js'));

const work={n:6,state:Array.from({length:6},()=>Array(6).fill(-1)),tangoDerivedRelations:[]};
const session={work,moves:[],done:false,stalled:false};
let generationCalls=0,logicSessionCalls=0;
const engineFactory=()=>{logicSessionCalls++;return {applyDeduction(){return {deduction:null,automatic:[]}}}};
const adapter=pedagogy.createAdapter({
  common:{cloneGrid:g=>g.map(r=>r.slice())},
  runtime:{
    tangoLogicSession:engineFactory,
    walkthroughGenerateTangoNext:()=>{
      generationCalls++;
      session.moves.push({snapshot:{state:work.state.map(r=>r.slice()),tangoDerivedRelations:[]}});
      return true;
    }
  }
});

const before=JSON.stringify(work);
const result=adapter.walkthroughGenerateNext(session);
if(result!==false)throw new Error('cycle guard must stop a non-progress Tutor generation');
if(session.tangoTutorStatus!=='proof-cycle')throw new Error(`expected proof-cycle, got ${session.tangoTutorStatus}`);
if(generationCalls!==1)throw new Error(`expected one generation call before cycle stop, got ${generationCalls}`);
if(session.moves.length!==0)throw new Error('rollback must remove provisional Tutor moves');
if(JSON.stringify(work)!==before)throw new Error('rollback must restore visible/logical work state');
if(session.tangoTutorGenerating!==false)throw new Error('reentrancy guard must be released');
if(session.tangoTutorDiagnostics?.iterations!==1)throw new Error('diagnostics must expose iteration count');
if(logicSessionCalls<1)throw new Error('Tutor logic session was not created');
console.log('v319-r3ui-tango-tutor-freeze-guard.test.js: PASS');
