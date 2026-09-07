/*
 * QUADLUD — Soleil/Lune Tutor attention orchestration R5
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoTutorAttentionOrchestratorR5=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=3;
const TOKEN='3.1.9-hf3.9-r5.1b';
let previousGenerate=null;

function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function cellKey(cell){return Array.isArray(cell)&&cell.length>=2?`${Number(cell[0])}:${Number(cell[1])}`:''}
function fallbackSnapshot(work){return {state:copy(work?.state||[]),tangoDerivedRelations:copy(work?.tangoDerivedRelations||[])}}
function snapshot(work){try{return typeof walkthroughSnapshot==='function'?copy(walkthroughSnapshot(work)):fallbackSnapshot(work)}catch(_){return fallbackSnapshot(work)}}
function currentTutor(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function planner(){const p=root.QuadludTangoPlayedMovePlanner;return p&&typeof p.sessionFromPublicBoard==='function'?p:null}
function runtime(){const r=root.QuadludTangoPlayedMoveRuntime;return r&&typeof r.selectDisplayProof==='function'?r:null}
function human(){const h=root.QuadludTangoHumanPedagogyR4;return h&&typeof h.proofStagesForDeduction==='function'?h:null}
function presenter(){try{return typeof tangoReasoningPresenter==='function'?tangoReasoningPresenter():null}catch(_){return null}}
function complete(){try{return typeof walkthroughComplete==='function'&&walkthroughComplete()}catch(_){return false}}
function firstValueTarget(d){const c=(d?.conclusions||[]).find(x=>x?.type==='VALUE'&&Array.isArray(x.cell));return c?c.cell.slice():null}
function isR5Continuation(plan){return !!(plan?.status==='move'&&plan?.recentDependencyContinuation===true&&plan?.localAttentionContinuation===true&&Array.isArray(plan?.target))}

function needsDependencyProbe(context,localContext){
  if(!localContext?.localExpansionApplied)return false;
  const recent=new Set((context?.recentCells||[]).map(cellKey).filter(Boolean));
  return (context?.recentActionCells||[]).some(cell=>{const key=cellKey(cell);return !!key&&!recent.has(key)})
}

function dependencyProbeContext(session,P){
  const A=P?._attentionTest;if(!A||typeof A.tutorRecentContext!=='function'||typeof A.expandContextAlongAxis!=='function'||typeof A.contextualDependencyPlan!=='function')return null;
  try{
    const context=A.tutorRecentContext(),localContext=A.expandContextAlongAxis(context,session?.work?.state,A.LOCAL_AXIS_RADIUS);
    return needsDependencyProbe(context,localContext)?{A,context,localContext}:null
  }catch(_){return null}
}

function contextualContinuation(session){
  const P=planner();if(!P||!session?.work?.state)return null;
  const probe=dependencyProbeContext(session,P);if(!probe)return null;
  const publicPuzzle={n:session.work?.n||session.base?.n||6,state:copy(session.work.state),edges:copy(session.work?.edges||session.base?.edges||[])};
  try{
    const engine=P.sessionFromPublicBoard(publicPuzzle,session.work.state),plan=probe.A.contextualDependencyPlan(engine,session.base?.diff,{},probe.context,probe.localContext);
    return isR5Continuation(plan)?{engine,plan}:null
  }catch(_){return null}
}

function materializeContinuation(session,engine,rawPlan){
  const R=runtime(),H=human(),P=presenter();if(!R||!H||!P)return false;
  const displayProof=R.selectDisplayProof(engine,rawPlan),displayDeduction=displayProof?.deduction||rawPlan?.deduction;
  if(!displayDeduction)return false;
  const plan={...copy(rawPlan),displayProof:copy(displayProof),displayDeduction:copy(displayDeduction)};
  const stages=H.proofStagesForDeduction(displayDeduction,P);if(!Array.isArray(stages)||!stages.length)return false;
  const [r,c]=plan.target||[],value=plan.value;
  if(!Number.isInteger(r)||!Number.isInteger(c)||(value!==0&&value!==1)||session.work?.state?.[r]?.[c]!==-1)return false;

  const beforeSnapshot=snapshot(session.work);
  session.work.state[r][c]=value;session.work.tangoDerivedRelations=[];session.tangoLogic=null;
  const finalSnapshot=snapshot(session.work);
  stages.forEach((stage,index)=>{
    const last=index===stages.length-1,presentation=stage.presentation||P.presentation(stage.deduction),reasoning=P.legacyReasoning(stage.deduction),stageTarget=last?[r,c]:(firstValueTarget(stage.deduction)||[r,c]);
    const info={
      rule:presentation?.rule||displayDeduction.rule,
      technique:presentation?.technique,
      rank:presentation?.rank??displayDeduction.rank,
      techniqueLevel:presentation?.techniqueLevel??displayDeduction.techniqueLevel,
      target:[r,c],
      presentation,
      deduction:reasoning,
      where:presentation?.explanation?.where||'',
      why:presentation?.explanation?.why||'',
      move:last?(presentation?.explanation?.move||P.conclusionText(displayDeduction)):'',
      automatic:[],
      pedagogyStageKind:stage.kind,
      metrics:{
        plannerStatus:'move',selectionStatus:plan.selectionStatus||null,candidateCount:Number(plan.candidateCount)||0,
        humanCandidateCount:Number(plan.humanCandidateCount)||0,humanGlobalSelection:false,frontierComplete:plan.frontierComplete!==false,
        humanProofPolicy:H.POLICY||displayProof?.policy||null,humanProofKind:displayProof?.kind||'engine-proof',
        humanProofCostVector:Array.isArray(displayProof?.costVector)?displayProof.costVector.slice():null,
        humanProofTraceCollapsed:!!displayProof?.traceCollapsed,localAttentionContinuation:true,recentDependencyContinuation:true,
        localAttentionAxis:copy(plan.localAttentionAxis||null),recentActionCells:copy(plan.recentActionCells||[])
      },
      beforeSnapshot:copy(beforeSnapshot)
    };
    info.proofTarget=stageTarget;info.snapshot=copy(last?finalSnapshot:beforeSnapshot);session.moves.push(info)
  });
  session.tangoTutorStatus='human-progressive-move';session.tangoTutorSelectionStatus=plan.selectionStatus||null;
  if(complete()){session.done=true;session.total=session.moves.length}
  return true
}

function install(){
  const current=root.walkthroughGenerateTangoNext;if(typeof current!=='function')return false;
  if(current.__quadludTutorAttentionOrchestratorR5===true)return true;
  previousGenerate=current;
  const wrapped=function(...args){
    const session=currentTutor();if(!session||session.base?.game!=='tango'||session.done||session.stalled)return previousGenerate(...args);
    const selected=contextualContinuation(session);if(!selected)return previousGenerate(...args);
    return materializeContinuation(session,selected.engine,selected.plan)||previousGenerate(...args)
  };
  wrapped.__quadludTutorAttentionOrchestratorR5=true;wrapped.__quadludPrevious=current;root.walkthroughGenerateTangoNext=wrapped;return true
}

return Object.freeze({VERSION,TOKEN,install,isR5Continuation,needsDependencyProbe,dependencyProbeContext,contextualContinuation,materializeContinuation,_test:Object.freeze({snapshot,fallbackSnapshot,firstValueTarget,isR5Continuation,needsDependencyProbe,dependencyProbeContext})});
});
