/*
 * QUADLUD — Soleil/Lune Coach/Tutor played-move runtime
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
(function(root){
'use strict';
const VERSION=4;
const HUMAN_PROOF_POLICY='tango-human-proof-minimal-v1';
const ABSTRACT_DISPLAY_RULES=new Set(['LINE_DOMAIN_SUPPORT']);
const CONCRETE_WITNESSES=new Set(['TRIPLE_OVERFLOW','BALANCE_OVERFLOW','BALANCE_DEFICIT','RELATION_CONFLICT','VALUE_CONFLICT']);
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function deductionKey(d){return String(d?.signature||d?.id||JSON.stringify([d?.rule,d?.conclusions||[]]))}
function proofDeductions(plan){const source=plan?.deduction||null,input=Array.isArray(plan?.proofChain)?plan.proofChain.filter(Boolean):[],seen=new Set(),out=[];for(const d of input){const k=deductionKey(d);if(seen.has(k))continue;seen.add(k);out.push(d)}if(source){const key=deductionKey(source),index=out.findIndex(d=>deductionKey(d)===key);if(index>=0)out.splice(index,1);out.push(source)}return out.length?out:(source?[source]:[])}
function firstValueTarget(d){const c=(d?.conclusions||[]).find(x=>x?.type==='VALUE'&&Array.isArray(x.cell));return c?c.cell.slice():null}
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&a[0]===b[0]&&a[1]===b[1]}
function concludesMove(d,target,value){return !!(d?.conclusions||[]).some(c=>c?.type==='VALUE'&&sameCell(c.cell,target)&&Number(c.value)===Number(value))}
function planner(){const p=root.QuadludTangoPlayedMovePlanner;if(!p||typeof p.sessionFromPublicBoard!=='function'||typeof p.nextPlayedMove!=='function')throw new Error('Soleil/Lune played-move planner unavailable');return p}
function concreteContradictionForMove(session,target,value){
  if(!session||typeof session.hypothesisResult!=='function'||typeof session.contradictionDeduction!=='function'||!Array.isArray(target)||(value!==0&&value!==1))return null;
  const rejected=1-value,result=session.hypothesisResult(target,rejected);
  if(!result||result.budgetHit||!result.contradiction||!CONCRETE_WITNESSES.has(String(result.contradiction.kind||'')))return null;
  const deduction=session.contradictionDeduction(target,rejected,result);
  if(!deduction||deduction.rule!=='ASSUMPTION_CONTRADICTION'||!concludesMove(deduction,target,value))return null;
  return {deduction:copy(deduction),witness:copy(result.contradiction)}
}
function selectDisplayProof(session,plan){
  const base={schema:1,policy:HUMAN_PROOF_POLICY,kind:'engine-proof',target:Array.isArray(plan?.target)?plan.target.slice():null,value:plan?.value,deduction:copy(plan?.deduction||null),displayDeductions:proofDeductions(plan).map(copy),replaced:false,witness:null};
  if(plan?.status!=='move'||!Array.isArray(plan.target)||(plan.value!==0&&plan.value!==1)||!plan.deduction)return Object.freeze(base);
  if(!ABSTRACT_DISPLAY_RULES.has(String(plan.deduction.rule||'')))return Object.freeze(base);
  const alternative=concreteContradictionForMove(session,plan.target,plan.value);
  if(!alternative)return Object.freeze(base);
  return Object.freeze({schema:1,policy:HUMAN_PROOF_POLICY,kind:'concrete-contradiction',target:plan.target.slice(),value:plan.value,deduction:alternative.deduction,displayDeductions:Object.freeze([alternative.deduction]),replaced:true,witness:alternative.witness,replacedRule:String(plan.deduction.rule||'')})
}
function planHumanMove(session,diff){
  let plan;try{plan=planner().nextPlayedMove(session,diff)}catch(error){return {status:'error',error}}
  if(plan?.status!=='move')return plan||{status:'error',reason:'empty-plan'};
  const displayProof=selectDisplayProof(session,plan),displayDeduction=displayProof?.deduction||plan.deduction;
  if(!displayDeduction)return {status:'error',reason:'missing-display-deduction'};
  return {...copy(plan),displayProof:copy(displayProof),displayDeduction:copy(displayDeduction),humanSignature:`${plan.target?.join(',')||''}:${plan.value}|${plan.startingDeduction?.signature||plan.deduction?.signature||plan.deduction?.id||''}|${displayProof?.kind||'engine-proof'}`}
}
function walkthroughGenerateTangoPlannedNext(){let s=typeof walkthroughSession!=='undefined'?walkthroughSession:null;if(!s||s.base?.game!=='tango'||s.done||s.stalled)return false;if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length;return false}const P=planner(),publicPuzzle={n:s.work?.n||s.base?.n||6,state:copy(s.work?.state),edges:copy(s.work?.edges||s.base?.edges||[])};let engine,plan;try{engine=P.sessionFromPublicBoard(publicPuzzle,s.work.state);plan=planHumanMove(engine,s.base.diff)}catch(error){s.stalled=true;s.tangoTutorStatus='planner-error';s.logicContradiction={message:String(error?.message||error)};return false}if(plan?.status==='solved'){s.done=true;s.total=s.moves.length;s.tangoTutorStatus='solved';return false}if(plan?.status!=='move'||!Array.isArray(plan.target)){s.stalled=true;s.tangoTutorStatus=`planner-${plan?.status||'invalid'}`;if(plan?.contradiction)s.logicContradiction=copy(plan.contradiction);return false}const [r,c]=plan.target,value=plan.value;if(!Number.isInteger(r)||!Number.isInteger(c)||(value!==0&&value!==1)||s.work?.state?.[r]?.[c]!==-1){s.stalled=true;s.tangoTutorStatus='planner-invalid-move';return false}const beforeSnapshot=walkthroughSnapshot(s.work),proof=(plan.displayProof?.displayDeductions||[]).filter(Boolean),presenter=tangoReasoningPresenter();s.work.state[r][c]=value;s.work.tangoDerivedRelations=[];s.tangoLogic=null;const finalSnapshot=walkthroughSnapshot(s.work),usable=proof.length?proof:proofDeductions(plan);if(!usable.length){s.stalled=true;s.tangoTutorStatus='planner-empty-proof';s.work.state=copy(beforeSnapshot.state);return false}usable.forEach((d,index)=>{const last=index===usable.length-1,presentation=presenter.presentation(d),reasoning=presenter.legacyReasoning(d),target=last?[r,c]:(firstValueTarget(d)||[r,c]);const info={rule:presentation.rule,technique:presentation.technique,rank:presentation.rank,techniqueLevel:presentation.techniqueLevel,target:target.slice(),presentation,deduction:reasoning,where:presentation.explanation.where,why:presentation.explanation.why,move:last?presentation.explanation.move:'',automatic:[],metrics:{plannerStatus:'move',engineVisiblePlacementCount:Number(plan.engineVisiblePlacementCount)||1,selectionStatus:plan.selectionStatus||null,candidateCount:Number(plan.candidateCount)||0,frontierComplete:plan.frontierComplete!==false,selectedCostVector:Array.isArray(plan.selectedCostVector)?plan.selectedCostVector.slice():null,humanProofPolicy:plan.displayProof?.policy||null,humanProofKind:plan.displayProof?.kind||'engine-proof',humanProofReplaced:!!plan.displayProof?.replaced},beforeSnapshot:copy(beforeSnapshot)};info.snapshot=copy(last?finalSnapshot:beforeSnapshot);s.moves.push(info)});s.tangoTutorStatus='planned-move';s.tangoTutorSelectionStatus=plan.selectionStatus||null;if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length}return true}
function sectionMap(sections){return Object.fromEntries((sections||[]).map(section=>[section.id,section]))}
function showCoach(html){showHintNotice(html);root.QuadludCoachPresentationRuntime?.decorateCoachNotice?.('tango')}
function coachPlanFailure(plan,presenter){current.hintFlow=null;clearHintFocus();if(plan?.status==='contradictory'||plan?.status==='contradiction')return showCoach(`<b>⚠ ${tr('contradictionFound')}</b><br>${presenter?.contradictionText?.(plan.contradiction)||tr('errorDetected')}`);if(plan?.status==='blocked'||plan?.status==='stuck')return showCoach(`<b>${tr('noLogicalHint')}</b>`);if(plan?.status==='solved')return showCoach(`<b>${tr('congrats')}</b>`);console.error('tango Coach coherent next-action planning failed',plan?.reason||plan?.error||plan);return showCoach(`<b>${tr('hintError')}</b>`)}
function applyVisibleMove(plan){if(!plan||plan.status!=='move'||!Array.isArray(plan.target)||(plan.value!==0&&plan.value!==1))return false;const [r,c]=plan.target;if(current?.state?.[r]?.[c]!==-1)return false;current.tangoPendingCell=null;current.tangoDerivedRelations=[];current.state[r][c]=plan.value;return true}
function installCoachBridge(){
  if(typeof document==='undefined'||typeof tangoCoachHandleDeduction!=='function')return false;
  if(tangoCoachHandleDeduction.__quadludA13R4Coherent===true)return true;
  const coherent=function(_rawDeduction){
    let engine;try{engine=tangoLogicSession()}catch(error){return coachPlanFailure({status:'error',error},null)}
    const presenter=tangoReasoningPresenter(),plan=planHumanMove(engine,current?.diff);if(plan?.status!=='move')return coachPlanFailure(plan,presenter);
    const d=plan.displayDeduction,presentation=presenter.presentation(d),shared=root.QuadludCoachPresentationRuntime,projection=shared?.coachProjection?.(presentation),by=sectionMap(projection?.sections||[]),boardKey=historySnapshotKey(),sig=plan.humanSignature,flow=current.hintFlow,isSame=flow?.kind==='tango-coherent-proof'&&flow.boardKey===boardKey&&flow.signature===sig;
    if(!projection)return coachPlanFailure({status:'error',reason:'missing-shared-coach-projection'},presenter);
    if(!isSame){current.hintFlow={kind:'tango-coherent-proof',boardKey,signature:sig,stage:1,flowVersion:5,plan:copy(plan),pedagogyView:projection.view,coachSections:projection.sections};coachUsage(1,presentation.technique);tangoFocusDeduction(d,false);showCoach(`<span class="coach-progress">1/2</span><b>${tr('where')} :</b> ${by.where?.text||presentation.explanation?.where||''}`);saveCurrent();return}
    const active=flow.plan||plan,activeDeduction=active.displayDeduction||d,activePresentation=presenter.presentation(activeDeduction),activeProjection=shared.coachProjection(activePresentation),activeBy=sectionMap(activeProjection.sections),before=historySnapshotKey();
    coachUsage(2,activePresentation.technique);coachUsage(3,activePresentation.technique);markHintUsed();updateScoreFlags();tangoFocusDeduction(activeDeduction,true);
    if(!applyVisibleMove(active)){current.hintFlow=null;showCoach(`<b>${tr('hintError')}</b>`);return}
    drawGameUi();const reasoning={...presenter.legacyReasoning(activeDeduction,[]),humanProofPolicy:active.displayProof?.policy||null,humanProofKind:active.displayProof?.kind||'engine-proof',selectedMove:{target:copy(active.target),value:active.value}};historyRecord({type:'COACH_APPLY',reasoning,coachStage:2,coachFlowVersion:5},before);current.hintFlow=null;
    const rule=activeBy.rule?.text||activePresentation.explanation?.title||'',why=activeBy.why?.text||activePresentation.explanation?.why||'',action=activeBy.action?.text||activePresentation.explanation?.move||'';showCoach(`<span class="coach-progress">2/2</span>${rule?`<b>${tr('rulesTitle')} :</b> ${rule}`:''}${rule&&why?'<br>':''}${why?`<b>${tr('hintWhy')} :</b> ${why}`:''}${(rule||why)&&action?'<br>':''}${action?`<b>${tr('hintMove')} :</b> ${action}`:''}`);maybeAutoFinish();saveCurrent();haptic(12)
  };
  coherent.__quadludA13R4Coherent=true;tangoCoachHandleDeduction=coherent;return true
}
function scheduleCoachBridge(){if(typeof document==='undefined')return;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installCoachBridge(),{once:true});else setTimeout(()=>installCoachBridge(),0)}
const api=Object.freeze({VERSION,HUMAN_PROOF_POLICY,walkthroughGenerateTangoPlannedNext,selectDisplayProof,planHumanMove,installCoachBridge,_test:Object.freeze({proofDeductions,firstValueTarget,concludesMove,concreteContradictionForMove,selectDisplayProof,applyVisibleMove,ABSTRACT_DISPLAY_RULES,CONCRETE_WITNESSES})});
root.walkthroughGenerateTangoNext=walkthroughGenerateTangoPlannedNext;root.QuadludTangoPlayedMoveRuntime=api;scheduleCoachBridge();
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
