/*
 * QUADLUD — Soleil/Lune Coach/Tutor played-move runtime
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
(function(root){
'use strict';
const VERSION=6;
const HUMAN_PROOF_POLICY='tango-human-proof-minimal-v3';
const ABSTRACT_DISPLAY_RULES=new Set(['LINE_DOMAIN_SUPPORT']);
const CONCRETE_WITNESSES=new Set(['TRIPLE_OVERFLOW','BALANCE_OVERFLOW','BALANCE_DEFICIT','RELATION_CONFLICT','VALUE_CONFLICT']);
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function deductionKey(d){return String(d?.signature||d?.id||JSON.stringify([d?.rule,d?.conclusions||[]]))}
function proofDeductions(plan){const source=plan?.deduction||null,input=Array.isArray(plan?.proofChain)?plan.proofChain.filter(Boolean):[],seen=new Set(),out=[];for(const d of input){const k=deductionKey(d);if(seen.has(k))continue;seen.add(k);out.push(d)}if(source){const key=deductionKey(source),index=out.findIndex(d=>deductionKey(d)===key);if(index>=0)out.splice(index,1);out.push(source)}return out.length?out:(source?[source]:[])}
function dedupeTrace(trace){const seen=new Set(),out=[];for(const d of trace||[]){if(!d)continue;const key=deductionKey(d);if(seen.has(key))continue;seen.add(key);out.push(copy(d))}return out}
function minimalDisplayDeduction(d){
  const out=copy(d);if(!out||typeof out!=='object')return out;const x=out.explanationData;if(!x||typeof x!=='object')return out;
  // The engine may retain a wider exploration trace for audit. The pedagogical
  // clone must expose only the causal closure already demonstrated by the engine.
  if(out.rule==='ASSUMPTION_CONTRADICTION'&&Array.isArray(x.causalTrace))x.trace=dedupeTrace(x.causalTrace);
  if(out.rule==='COMMON_CONSEQUENCE'){
    if(Array.isArray(x.moonCausalTrace))x.moonTrace=dedupeTrace(x.moonCausalTrace);
    if(Array.isArray(x.sunCausalTrace))x.sunTrace=dedupeTrace(x.sunCausalTrace)
  }
  return out
}
function firstValueTarget(d){const c=(d?.conclusions||[]).find(x=>x?.type==='VALUE'&&Array.isArray(x.cell));return c?c.cell.slice():null}
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&a[0]===b[0]&&a[1]===b[1]}
function concludesMove(d,target,value){return !!(d?.conclusions||[]).some(c=>c?.type==='VALUE'&&sameCell(c.cell,target)&&Number(c.value)===Number(value))}
function planner(){const p=root.QuadludTangoPlayedMovePlanner;if(!p||typeof p.sessionFromPublicBoard!=='function'||typeof p.nextPlayedMove!=='function')throw new Error('Soleil/Lune played-move planner unavailable');return p}
function addCostCell(out,cell){if(Array.isArray(cell)&&cell.length>=2&&Number.isInteger(Number(cell[0]))&&Number.isInteger(Number(cell[1])))out.add(`${Number(cell[0])},${Number(cell[1])}`)}
function collectCostCells(value,out,depth=0){
  if(value==null||depth>6)return;
  if(Array.isArray(value)){
    if(value.length>=2&&Number.isInteger(Number(value[0]))&&Number.isInteger(Number(value[1]))){addCostCell(out,value);return}
    for(const item of value)collectCostCells(item,out,depth+1);return
  }
  if(typeof value!=='object')return;
  for(const key of ['cell','a','b','target','source'])addCostCell(out,value[key]);
  for(const key of ['cells','focusCells','window','pair','remaining','targets'])if(Array.isArray(value[key]))for(const item of value[key])collectCostCells(item,out,depth+1)
}
function relationHumanPathLength(session,d){
  if(d?.rule!=='RELATION_PROPAGATION'||typeof session?.relationBetween!=='function')return 0;
  const source=d?.explanationData?.source,target=d?.explanationData?.target;if(!Array.isArray(source)||!Array.isArray(target))return 0;
  const rel=session.relationBetween(source,target),length=Array.isArray(rel?.path)?rel.path.length:0;return Math.max(1,length||1)
}
function humanProofCost(session,deductions){
  const list=(deductions||[]).filter(Boolean),cells=new Set();let premiseCount=0,techniqueLevel=0,rank=0,relationExtra=0,abstractPenalty=0;
  for(const d of list){premiseCount+=(d?.premises||[]).length;techniqueLevel=Math.max(techniqueLevel,Number(d?.techniqueLevel)||0);rank=Math.max(rank,Number(d?.rank)||0);abstractPenalty+=ABSTRACT_DISPLAY_RULES.has(String(d?.rule||''))?1:0;relationExtra+=Math.max(0,relationHumanPathLength(session,d)-1);collectCostCells(d,cells);for(const p of d?.premises||[])collectCostCells(p,cells);for(const c of d?.conclusions||[])collectCostCells(c,cells)}
  // Abstract line-domain support is an additional human indirection layer: it
  // must not masquerade as a one-step local proof merely because the engine
  // emits it as one deduction object.
  return Object.freeze([Math.max(1,list.length)+relationExtra+abstractPenalty,premiseCount+relationExtra,Math.max(1,cells.size),techniqueLevel,rank,abstractPenalty])
}
function compareCostVector(a,b){for(let i=0;i<Math.max(a?.length||0,b?.length||0);i++){const x=Number(a?.[i])||0,y=Number(b?.[i])||0;if(x!==y)return x-y}return 0}
function directProofCandidates(session,target,value){
  if(!session||typeof session.directDeductions!=='function'||!Array.isArray(target)||(value!==0&&value!==1))return [];
  const seen=new Set(),out=[];for(const raw of session.directDeductions()||[]){if(!raw||!concludesMove(raw,target,value))continue;const key=deductionKey(raw);if(seen.has(key))continue;seen.add(key);const deduction=minimalDisplayDeduction(raw);out.push({deduction,cost:humanProofCost(session,[deduction])})}
  return out.sort((a,b)=>compareCostVector(a.cost,b.cost)||deductionKey(a.deduction).localeCompare(deductionKey(b.deduction)))
}
function sessionStateKey(session){
  const snap=typeof session?.snapshot==='function'?session.snapshot():{state:session?.state,derivedRelations:[]};
  const relations=(snap?.derivedRelations||[]).map(r=>[r?.a,r?.b,Number(r?.parity)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({state:snap?.state||null,relations})
}
function touchesTarget(d,target){
  if(!Array.isArray(target))return false;
  if((d?.focusCells||[]).some(c=>sameCell(c,target)))return true;
  if((d?.conclusions||[]).some(c=>c?.type==='VALUE'&&sameCell(c.cell,target)))return true;
  return false
}
function concreteHumanContradictionSearch(session,target,rejected,{maxDepth=3,maxNodes=96,maxBranch=24}={}){
  if(!session||typeof session.clone!=='function'||typeof session.assume!=='function'||typeof session.directViolations!=='function'||typeof session.directDeductions!=='function'||typeof session.applyDeduction!=='function')return null;
  const seed=session.clone();
  if(!seed.assume(target,rejected))return {contradiction:{kind:'VALUE_CONFLICT',cells:[target.slice()]},trace:[],session:seed,budgetHit:false};
  const queue=[{session:seed,trace:[],depth:0}],seen=new Set([sessionStateKey(seed)]);let visited=0;
  while(queue.length&&visited++<maxNodes){
    const node=queue.shift(),violations=node.session.directViolations().filter(v=>CONCRETE_WITNESSES.has(String(v?.kind||'')));
    if(violations.length)return {contradiction:copy(violations[0]),trace:node.trace.map(copy),session:node.session,budgetHit:false};
    if(node.depth>=maxDepth)continue;
    const raw=node.session.directDeductions().filter(d=>d&&!ABSTRACT_DISPLAY_RULES.has(String(d.rule||'')));
    const relevant=raw.filter(d=>touchesTarget(d,target)),other=raw.filter(d=>!touchesTarget(d,target)),candidates=relevant.concat(other).slice(0,maxBranch);
    for(const d of candidates){
      const child=node.session.clone(),applied=child.applyDeduction(d,{close:false});
      if(!applied?.deduction)continue;
      const key=sessionStateKey(child);if(seen.has(key))continue;seen.add(key);
      queue.push({session:child,trace:node.trace.concat([applied.deduction],applied.automatic||[]),depth:node.depth+1})
    }
  }
  return null
}
function concreteContradictionForMove(session,target,value){
  if(!session||typeof session.hypothesisResult!=='function'||typeof session.contradictionDeduction!=='function'||!Array.isArray(target)||(value!==0&&value!==1))return null;
  const rejected=1-value;let result=session.hypothesisResult(target,rejected);
  if(!result||result.budgetHit||!result.contradiction||!CONCRETE_WITNESSES.has(String(result.contradiction.kind||'')))result=concreteHumanContradictionSearch(session,target,rejected)||result;
  if(!result||result.budgetHit||!result.contradiction||!CONCRETE_WITNESSES.has(String(result.contradiction.kind||'')))return null;
  const deduction=session.contradictionDeduction(target,rejected,result);
  if(!deduction||deduction.rule!=='ASSUMPTION_CONTRADICTION'||!concludesMove(deduction,target,value))return null;
  return {deduction:minimalDisplayDeduction(deduction),witness:copy(result.contradiction)}
}
function selectDisplayProof(session,plan){
  const engineTrace=proofDeductions(plan),chosen=minimalDisplayDeduction(plan?.deduction||null),baseCost=chosen?humanProofCost(session,[chosen]):Object.freeze([1,0,1,0,0,0]),discardedAlternativeCount=Math.max(0,engineTrace.length-(chosen?1:0));
  const base={schema:3,policy:HUMAN_PROOF_POLICY,kind:'engine-proof',target:Array.isArray(plan?.target)?plan.target.slice():null,value:plan?.value,deduction:chosen,displayDeductions:chosen?Object.freeze([chosen]):Object.freeze([]),replaced:false,witness:null,costVector:baseCost,traceCollapsed:discardedAlternativeCount>0,discardedAlternativeCount};
  if(plan?.status!=='move'||!Array.isArray(plan.target)||(plan.value!==0&&plan.value!==1)||!plan.deduction)return Object.freeze(base);

  // A selected move and its pedagogical proof are separate decisions. Search all
  // currently direct visible proofs for this exact target/value and let the
  // shortest sufficient human proof beat the selected engine proof.
  const direct=directProofCandidates(session,plan.target,plan.value)[0]||null;
  if(direct&&compareCostVector(direct.cost,baseCost)<0){
    return Object.freeze({schema:3,policy:HUMAN_PROOF_POLICY,kind:'simpler-direct-proof',target:plan.target.slice(),value:plan.value,deduction:direct.deduction,displayDeductions:Object.freeze([direct.deduction]),replaced:true,witness:null,replacedRule:String(plan.deduction.rule||''),costVector:direct.cost,replacedCostVector:baseCost,traceCollapsed:engineTrace.length>1,discardedAlternativeCount:Math.max(0,engineTrace.length-1)})
  }

  if(!ABSTRACT_DISPLAY_RULES.has(String(plan.deduction.rule||'')))return Object.freeze(base);
  const alternative=concreteContradictionForMove(session,plan.target,plan.value);
  if(!alternative)return Object.freeze(base);
  const contradictionCost=humanProofCost(session,[alternative.deduction]);
  // Preserve the validated R4 policy: a concrete visible contradiction is a
  // better human explanation than abstract line-domain enumeration when no
  // simpler direct proof exists, even if the engine encodes both as one object.
  return Object.freeze({schema:3,policy:HUMAN_PROOF_POLICY,kind:'concrete-contradiction',target:plan.target.slice(),value:plan.value,deduction:alternative.deduction,displayDeductions:Object.freeze([alternative.deduction]),replaced:true,witness:alternative.witness,replacedRule:String(plan.deduction.rule||''),costVector:contradictionCost,replacedCostVector:baseCost,traceCollapsed:engineTrace.length>1,discardedAlternativeCount:Math.max(0,engineTrace.length-1)})
}
function planHumanMove(session,diff){
  let plan;try{plan=planner().nextPlayedMove(session,diff)}catch(error){return {status:'error',error}}
  if(plan?.status!=='move')return plan||{status:'error',reason:'empty-plan'};
  const displayProof=selectDisplayProof(session,plan),displayDeduction=displayProof?.deduction||minimalDisplayDeduction(plan.deduction);
  if(!displayDeduction)return {status:'error',reason:'missing-display-deduction'};
  return {...copy(plan),displayProof:copy(displayProof),displayDeduction:copy(displayDeduction),humanSignature:`${plan.target?.join(',')||''}:${plan.value}|${plan.startingDeduction?.signature||plan.deduction?.signature||plan.deduction?.id||''}|${displayProof?.kind||'engine-proof'}`}
}
function walkthroughGenerateTangoPlannedNext(){let s=typeof walkthroughSession!=='undefined'?walkthroughSession:null;if(!s||s.base?.game!=='tango'||s.done||s.stalled)return false;if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length;return false}const P=planner(),publicPuzzle={n:s.work?.n||s.base?.n||6,state:copy(s.work?.state),edges:copy(s.work?.edges||s.base?.edges||[])};let engine,plan;try{engine=P.sessionFromPublicBoard(publicPuzzle,s.work.state);plan=planHumanMove(engine,s.base.diff)}catch(error){s.stalled=true;s.tangoTutorStatus='planner-error';s.logicContradiction={message:String(error?.message||error)};return false}if(plan?.status==='solved'){s.done=true;s.total=s.moves.length;s.tangoTutorStatus='solved';return false}if(plan?.status!=='move'||!Array.isArray(plan.target)){s.stalled=true;s.tangoTutorStatus=`planner-${plan?.status||'invalid'}`;if(plan?.contradiction)s.logicContradiction=copy(plan.contradiction);return false}const [r,c]=plan.target,value=plan.value;if(!Number.isInteger(r)||!Number.isInteger(c)||(value!==0&&value!==1)||s.work?.state?.[r]?.[c]!==-1){s.stalled=true;s.tangoTutorStatus='planner-invalid-move';return false}const beforeSnapshot=walkthroughSnapshot(s.work),proof=(plan.displayProof?.displayDeductions||[]).filter(Boolean),presenter=tangoReasoningPresenter();s.work.state[r][c]=value;s.work.tangoDerivedRelations=[];s.tangoLogic=null;const finalSnapshot=walkthroughSnapshot(s.work),usable=proof.length?proof:[plan.displayDeduction||minimalDisplayDeduction(plan.deduction)].filter(Boolean);if(!usable.length){s.stalled=true;s.tangoTutorStatus='planner-empty-proof';s.work.state=copy(beforeSnapshot.state);return false}usable.forEach((d,index)=>{const last=index===usable.length-1,presentation=presenter.presentation(d),reasoning=presenter.legacyReasoning(d),target=last?[r,c]:(firstValueTarget(d)||[r,c]);const info={rule:presentation.rule,technique:presentation.technique,rank:presentation.rank,techniqueLevel:presentation.techniqueLevel,target:target.slice(),presentation,deduction:reasoning,where:presentation.explanation.where,why:presentation.explanation.why,move:last?presentation.explanation.move:'',automatic:[],metrics:{plannerStatus:'move',engineVisiblePlacementCount:Number(plan.engineVisiblePlacementCount)||1,selectionStatus:plan.selectionStatus||null,candidateCount:Number(plan.candidateCount)||0,frontierComplete:plan.frontierComplete!==false,selectedCostVector:Array.isArray(plan.selectedCostVector)?plan.selectedCostVector.slice():null,humanProofPolicy:plan.displayProof?.policy||null,humanProofKind:plan.displayProof?.kind||'engine-proof',humanProofReplaced:!!plan.displayProof?.replaced,humanProofCostVector:Array.isArray(plan.displayProof?.costVector)?plan.displayProof.costVector.slice():null,humanProofTraceCollapsed:!!plan.displayProof?.traceCollapsed,humanProofDiscardedAlternatives:Number(plan.displayProof?.discardedAlternativeCount)||0},beforeSnapshot:copy(beforeSnapshot)};info.snapshot=copy(last?finalSnapshot:beforeSnapshot);s.moves.push(info)});s.tangoTutorStatus='planned-move';s.tangoTutorSelectionStatus=plan.selectionStatus||null;if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length}return true}
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
    if(!isSame){current.hintFlow={kind:'tango-coherent-proof',boardKey,signature:sig,stage:1,flowVersion:7,plan:copy(plan),pedagogyView:projection.view,coachSections:projection.sections};coachUsage(1,presentation.technique);tangoFocusDeduction(d,false);showCoach(`<span class="coach-progress">1/2</span><b>${tr('where')} :</b> ${by.where?.text||presentation.explanation?.where||''}`);saveCurrent();return}
    const active=flow.plan||plan,activeDeduction=active.displayDeduction||d,activePresentation=presenter.presentation(activeDeduction),activeProjection=shared.coachProjection(activePresentation),activeBy=sectionMap(activeProjection.sections),before=historySnapshotKey();
    coachUsage(2,activePresentation.technique);coachUsage(3,activePresentation.technique);markHintUsed();updateScoreFlags();tangoFocusDeduction(activeDeduction,true);
    if(!applyVisibleMove(active)){current.hintFlow=null;showCoach(`<b>${tr('hintError')}</b>`);return}
    drawGameUi();const reasoning={...presenter.legacyReasoning(activeDeduction,[]),humanProofPolicy:active.displayProof?.policy||null,humanProofKind:active.displayProof?.kind||'engine-proof',selectedMove:{target:copy(active.target),value:active.value}};historyRecord({type:'COACH_APPLY',reasoning,coachStage:2,coachFlowVersion:7},before);current.hintFlow=null;
    const rule=activeBy.rule?.text||activePresentation.explanation?.title||'',why=activeBy.why?.text||activePresentation.explanation?.why||'',action=activeBy.action?.text||activePresentation.explanation?.move||'';showCoach(`<span class="coach-progress">2/2</span>${rule?`<b>${tr('rulesTitle')} :</b> ${rule}`:''}${rule&&why?'<br>':''}${why?`<b>${tr('hintWhy')} :</b> ${why}`:''}${(rule||why)&&action?'<br>':''}${action?`<b>${tr('hintMove')} :</b> ${action}`:''}`);maybeAutoFinish();saveCurrent();haptic(12)
  };
  coherent.__quadludA13R4Coherent=true;tangoCoachHandleDeduction=coherent;return true
}
function scheduleCoachBridge(){if(typeof document==='undefined')return;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installCoachBridge(),{once:true});else setTimeout(()=>installCoachBridge(),0)}
const api=Object.freeze({VERSION,HUMAN_PROOF_POLICY,walkthroughGenerateTangoPlannedNext,selectDisplayProof,planHumanMove,installCoachBridge,_test:Object.freeze({proofDeductions,dedupeTrace,minimalDisplayDeduction,firstValueTarget,concludesMove,humanProofCost,compareCostVector,directProofCandidates,relationHumanPathLength,sessionStateKey,touchesTarget,concreteHumanContradictionSearch,concreteContradictionForMove,selectDisplayProof,applyVisibleMove,ABSTRACT_DISPLAY_RULES,CONCRETE_WITNESSES})});
root.walkthroughGenerateTangoNext=walkthroughGenerateTangoPlannedNext;root.QuadludTangoPlayedMoveRuntime=api;scheduleCoachBridge();
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
