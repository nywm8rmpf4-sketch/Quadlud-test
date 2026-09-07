/*
 * QUADLUD — Soleil/Lune Tutor single-planner owner R5.1b
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';

const VERSION=1;
const TOKEN='3.1.9-hf3.9-r5.1b-single-planner-v1';
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function planner(){const p=root.QuadludTangoPlayedMovePlanner;if(!p||typeof p.nextPlayedMove!=='function'||typeof p.sessionFromPublicBoard!=='function')throw new Error('Soleil/Lune played-move planner unavailable');return p}
function runtime(){const r=root.QuadludTangoPlayedMoveRuntime;if(!r||typeof r.selectDisplayProof!=='function')throw new Error('Soleil/Lune played-move runtime unavailable');return r}
function pedagogy(){const h=root.QuadludTangoHumanPedagogyR4;if(!h||typeof h?._test?.proofStagesForDeduction!=='function')throw new Error('Soleil/Lune human pedagogy unavailable');return h}
function humanizeTutorPlan(session,diff,options={}){
  const P=planner(),R=runtime(),H=pedagogy(),plan=P.nextPlayedMove(session,diff,options);
  if(plan?.status!=='move')return plan||{status:'error',reason:'empty-plan'};
  let displayProof=null;
  try{displayProof=H._test?.evaluatePlanHumanProof?.(session,plan)?.displayProof||null}catch(_){displayProof=null}
  if(!displayProof)try{displayProof=R.selectDisplayProof(session,plan)}catch(_){displayProof=null}
  const displayDeduction=displayProof?.deduction||R._test?.minimalDisplayDeduction?.(plan.deduction)||copy(plan.deduction);
  if(!displayDeduction)return {status:'error',reason:'missing-display-deduction'};
  return {
    ...copy(plan),
    displayProof:copy(displayProof),
    displayDeduction:copy(displayDeduction),
    humanGlobalSelection:false,
    humanCandidateCount:Number(plan.candidateCount)||0,
    humanSignature:`${plan.target?.join(',')||''}:${plan.value}|${plan.startingDeduction?.signature||plan.deduction?.signature||plan.deduction?.id||''}|${displayProof?.kind||'engine-proof'}|tutor-r5`
  }
}
function walkthroughGenerateTutorPlannerNext(){
  let s=null;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){s=null}
  if(!s||s.base?.game!=='tango'||s.done||s.stalled)return false;
  if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length;return false}
  const P=planner(),H=pedagogy(),publicPuzzle={n:s.work?.n||s.base?.n||6,state:copy(s.work?.state),edges:copy(s.work?.edges||s.base?.edges||[])};
  let engine,plan;
  try{engine=P.sessionFromPublicBoard(publicPuzzle,s.work.state);plan=humanizeTutorPlan(engine,s.base.diff)}catch(error){s.stalled=true;s.tangoTutorStatus='planner-error';s.logicContradiction={message:String(error?.message||error)};return false}
  if(plan?.status==='solved'){s.done=true;s.total=s.moves.length;s.tangoTutorStatus='solved';return false}
  if(plan?.status!=='move'||!Array.isArray(plan.target)){s.stalled=true;s.tangoTutorStatus=`planner-${plan?.status||'invalid'}`;if(plan?.contradiction)s.logicContradiction=copy(plan.contradiction);return false}
  const [r,c]=plan.target,value=plan.value;
  if(!Number.isInteger(r)||!Number.isInteger(c)||(value!==0&&value!==1)||s.work?.state?.[r]?.[c]!==-1){s.stalled=true;s.tangoTutorStatus='planner-invalid-move';return false}
  const beforeSnapshot=walkthroughSnapshot(s.work),presenter=tangoReasoningPresenter(),d=plan.displayDeduction||plan.deduction,stages=H._test.proofStagesForDeduction(d,presenter);
  s.work.state[r][c]=value;s.work.tangoDerivedRelations=[];s.tangoLogic=null;
  const finalSnapshot=walkthroughSnapshot(s.work);
  if(!stages.length){s.stalled=true;s.tangoTutorStatus='planner-empty-proof';s.work.state=copy(beforeSnapshot.state);return false}
  stages.forEach((stage,index)=>{
    const last=index===stages.length-1,reasoning=presenter.legacyReasoning(stage.deduction),presentation=stage.presentation;
    const info={
      rule:presentation.rule||d.rule,technique:presentation.technique,rank:presentation.rank??d.rank,techniqueLevel:presentation.techniqueLevel??d.techniqueLevel,target:[r,c],presentation,deduction:reasoning,
      where:presentation.explanation?.where||'',why:presentation.explanation?.why||'',move:last?(presentation.explanation?.move||presenter.conclusionText(d)):'',automatic:[],pedagogyStageKind:stage.kind,
      metrics:{plannerStatus:'move',selectionStatus:plan.selectionStatus||null,candidateCount:Number(plan.candidateCount)||0,humanCandidateCount:Number(plan.humanCandidateCount)||0,humanGlobalSelection:false,frontierComplete:plan.frontierComplete!==false,humanProofPolicy:H.POLICY||runtime().HUMAN_PROOF_POLICY||null,humanProofKind:plan.displayProof?.kind||'engine-proof',humanProofCostVector:Array.isArray(plan.displayProof?.costVector)?plan.displayProof.costVector.slice():null,humanProofTraceCollapsed:!!plan.displayProof?.traceCollapsed},
      beforeSnapshot:copy(beforeSnapshot)
    };
    info.snapshot=copy(last?finalSnapshot:beforeSnapshot);s.moves.push(info)
  });
  s.tangoTutorStatus='human-progressive-move';s.tangoTutorSelectionStatus=plan.selectionStatus||null;
  if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length}
  return true
}
function install(){
  const previous=root.walkthroughGenerateTangoNext;
  if(typeof previous!=='function')return false;
  if(previous.__quadludTutorSinglePlannerR5===true)return true;
  walkthroughGenerateTutorPlannerNext.__quadludTutorSinglePlannerR5=true;
  walkthroughGenerateTutorPlannerNext.__quadludTutorSinglePlannerToken=TOKEN;
  walkthroughGenerateTutorPlannerNext.__quadludPrevious=previous;
  root.walkthroughGenerateTangoNext=walkthroughGenerateTutorPlannerNext;
  return true
}
const api=Object.freeze({VERSION,TOKEN,install,humanizeTutorPlan,walkthroughGenerateTutorPlannerNext,_test:Object.freeze({humanizeTutorPlan})});
root.QuadludTangoTutorSinglePlannerR5=api;
if(typeof document!=='undefined')install();
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
