/*
 * QUADLUD — Soleil/Lune Tutor single-planner owner R5.1b
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';

const VERSION=5;
const TOKEN='3.1.9-cognitive-r4-cache-contract-guard';
const DIFF_TO_TIER=Object.freeze({easy:0,medium:1,hard:2,expert:3,facile:0,moyen:1,difficile:2});
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function planner(){const p=root.QuadludTangoPlayedMovePlanner;if(!p||typeof p.nextPlayedMove!=='function'||typeof p.sessionFromPublicBoard!=='function')throw new Error('Soleil/Lune played-move planner unavailable');return p}
function runtime(){const r=root.QuadludTangoPlayedMoveRuntime;if(!r||typeof r.selectDisplayProof!=='function')throw new Error('Soleil/Lune played-move runtime unavailable');return r}
function pedagogy(){const h=root.QuadludTangoHumanPedagogyR4;if(!h||typeof h?._test?.proofStagesForDeduction!=='function')throw new Error('Soleil/Lune human pedagogy unavailable');return h}
function precomputedCache(){
  const c=root.QuadludTangoTutorPrecomputedCache;
  if(!c||typeof c.tryPlan!=='function'||typeof c.info!=='function')return null;
  let info=null;try{info=c.info()}catch(_){return null}
  const contract=info?.contract||null;
  if(info?.registered!==true||!contract)return null;
  if(Number(contract.tutorPlannerVersion)!==VERSION||String(contract.tutorPlannerToken||'')!==TOKEN)return null;
  return c
}
function tierIndex(diff){if(Number.isInteger(diff)&&diff>=0&&diff<=3)return diff;return DIFF_TO_TIER[String(diff||'').trim().toLowerCase()]}
function hasDirectVisibleDeduction(session,diff){
  const P=planner(),T=P._test,A=P._attentionTest,tier=tierIndex(diff);
  if(!Number.isInteger(tier)||typeof T?.allowedDirectDeductions!=='function'||typeof A?.directlyPlacesVisibleValue!=='function')return null;
  try{return (T.allowedDirectDeductions(session,tier)||[]).some(d=>A.directlyPlacesVisibleValue(session,d))}catch(_){return null}
}
function compareVector(a,b){for(let i=0;i<Math.max(a?.length||0,b?.length||0);i++){const x=Number(a?.[i])||0,y=Number(b?.[i])||0;if(x!==y)return x-y}return 0}
function relationPrunedHumanPlan(session,diff,options,H){
  const P=planner(),T=P._test,A=P._attentionTest,tier=tierIndex(diff);
  if(tier!==3||typeof T?.allowedDirectDeductions!=='function'||typeof A?.relationOnlyDeduction!=='function'||typeof A?.evaluateRelationFrontier!=='function')return null;
  let direct=[];try{direct=T.allowedDirectDeductions(session,tier)||[]}catch(_){return null}
  if(!direct.length||!direct.every(d=>A.relationOnlyDeduction(d)))return null;
  let evaluation=null;try{evaluation=A.evaluateRelationFrontier(session,tier,direct,{...options,initialStateValidated:true})}catch(_){return null}
  if(!evaluation?.plans?.length)return null;
  const scored=[];for(const plan of evaluation.plans){try{const x=H._test?.evaluatePlanHumanProof?.(session,plan);if(x)scored.push(x)}catch(_){}}
  if(!scored.length)return null;
  const cmp=typeof H._test?.compareHumanCandidate==='function'?H._test.compareHumanCandidate:(a,b)=>compareVector(a?.cost,b?.cost)||compareVector(a?.plannerCost,b?.plannerCost);
  scored.sort(cmp);const chosen=scored[0],plan=copy(chosen.plan),proof=copy(chosen.displayProof),displayDeduction=proof?.deduction||copy(plan.deduction);if(!displayDeduction)return null;
  const frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit;
  return {...plan,displayProof:proof,displayDeduction,selectionStatus:'cognitive-relation-frontier-pruned',candidateCount:scored.length,humanCandidateCount:scored.length,humanGlobalSelection:false,frontierComplete,budgetHit:!frontierComplete,relationFrontierPruned:true,relationFrontierEstimatedCandidateCount:Number(evaluation.estimatedCandidateCount)||direct.length,relationFrontierHydratedCandidateCount:Number(evaluation.hydratedCandidateCount)||evaluation.plans.length,relationFrontierPrunedCandidateCount:Number(evaluation.prunedCandidateCount)||0,relationFrontierMinimumEngineStepCount:Number(evaluation.provenMinimumEngineStepCount)||null};
}
function attachHumanProof(session,plan,H,R,mode){
  if(plan?.status!=='move')return plan||{status:'error',reason:'empty-plan'};
  let displayProof=plan.displayProof||null;
  if(!displayProof)try{displayProof=H._test?.evaluatePlanHumanProof?.(session,plan)?.displayProof||null}catch(_){displayProof=null}
  if(!displayProof)try{displayProof=R.selectDisplayProof(session,plan)}catch(_){displayProof=null}
  const displayDeduction=plan.displayDeduction||displayProof?.deduction||R._test?.minimalDisplayDeduction?.(plan.deduction)||copy(plan.deduction);
  if(!displayDeduction)return {status:'error',reason:'missing-display-deduction'};
  return {
    ...copy(plan),displayProof:copy(displayProof),displayDeduction:copy(displayDeduction),
    tutorPlannerMode:mode,
    humanSignature:`${plan.target?.join(',')||''}:${plan.value}|${plan.startingDeduction?.signature||plan.deduction?.signature||plan.deduction?.id||''}|${displayProof?.kind||'engine-proof'}|tutor-r5`
  }
}
function humanizeTutorPlan(session,diff,options={}){
  const P=planner(),R=runtime(),H=pedagogy();
  if(options.usePrecomputedCache!==false){const cache=precomputedCache();let cached=null;if(cache)try{cached=cache.tryPlan(session,diff)}catch(_){cached=null}if(cached){const out=attachHumanProof(session,cached,H,R,'precomputed-guarded');if(out?.status==='move')return out}}
  const directVisible=hasDirectVisibleDeduction(session,diff);
  // Preserve the validated human-global ordering while a directly playable
  // visible deduction exists. This is the cheap frontier that yields the
  // natural B4 -> C6 progression. If only invisible relation starts remain,
  // avoid rebuilding the exhaustive human frontier and delegate exactly once
  // to the R5 pruned planner (D5 class of states).
  if(directVisible!==false&&typeof H.chooseGloballySimplestPlan==='function'){
    let globalPlan=null;try{globalPlan=H.chooseGloballySimplestPlan(session,diff,options)}catch(_){globalPlan=null}
    if(globalPlan)return attachHumanProof(session,globalPlan,H,R,'direct-human-global')
  }
  if(directVisible===false){let pruned=null;try{pruned=relationPrunedHumanPlan(session,diff,options,H)}catch(_){pruned=null}if(pruned)return attachHumanProof(session,pruned,H,R,'relation-cognitive-pruned')}
  const plan=P.nextPlayedMove(session,diff,options),out=attachHumanProof(session,plan,H,R,'relation-pruned-single');
  if(out?.status==='move'){
    out.humanGlobalSelection=false;
    out.humanCandidateCount=Number(out.candidateCount)||0;
  }
  return out
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
      metrics:{plannerStatus:'move',selectionStatus:plan.selectionStatus||null,candidateCount:Number(plan.candidateCount)||0,humanCandidateCount:Number(plan.humanCandidateCount)||0,humanGlobalSelection:!!plan.humanGlobalSelection,frontierComplete:plan.frontierComplete!==false,humanProofPolicy:H.POLICY||runtime().HUMAN_PROOF_POLICY||null,humanProofKind:plan.displayProof?.kind||'engine-proof',humanProofCostVector:Array.isArray(plan.displayProof?.costVector)?plan.displayProof.costVector.slice():null,humanProofTraceCollapsed:!!plan.displayProof?.traceCollapsed,tutorPlannerMode:plan.tutorPlannerMode||null},
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
const api=Object.freeze({VERSION,TOKEN,install,humanizeTutorPlan,walkthroughGenerateTutorPlannerNext,_test:Object.freeze({tierIndex,hasDirectVisibleDeduction,compareVector,relationPrunedHumanPlan,attachHumanProof,humanizeTutorPlan,precomputedCache})});
root.QuadludTangoTutorSinglePlannerR5=api;
if(typeof document!=='undefined')install();
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
