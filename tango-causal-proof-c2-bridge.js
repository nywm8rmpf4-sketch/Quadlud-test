/*
 * QUADLUD — Soleil/Lune causal proof C2 bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoCausalProofC2Bridge=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const VERSION=1;
const COACH_CLASSES=Object.freeze(['hint-causal-context','hint-causal-focus','hint-causal-hypothesis','hint-causal-hypothetical-move','hint-causal-contradiction','hint-causal-conclusion']);
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
function model(){return root.QuadludTangoCausalProofModel||null}
function projector(){return root.QuadludTangoCausalProofProjection||null}
function presenter(){try{return typeof tangoReasoningPresenter==='function'?tangoReasoningPresenter():null}catch(_){return null}}
function proofStages(d){const fn=root.QuadludTangoHumanPedagogyR4?._test?.proofStagesForDeduction,p=presenter();if(typeof fn!=='function'||!p||!d)return[];try{return fn(d,p)||[]}catch(_){return[]}}
function entriesForCoach(flow,d,stages=[]){
  const out=[];for(const item of flow?.proofChain||[])out.push({pedagogyStageKind:'reasoning',deduction:copy(item)});
  if(Array.isArray(stages)&&stages.length>1){for(const stage of stages)out.push({pedagogyStageKind:stage?.kind||'reasoning',deduction:copy(stage?.deduction||d)})}
  else out.push({pedagogyStageKind:'action',deduction:copy(d)});
  return out
}
function coachProjection(flow,d,reveal=false,stages=null){
  const m=model(),p=projector();if(typeof m?.fromEntries!=='function'||typeof p?.projectionForMove!=='function'||!d)return null;
  let proof;try{proof=m.fromEntries(entriesForCoach(flow,d,stages==null?proofStages(d):stages))}catch(_){return null}
  const candidates=(proof.steps||[]).filter(step=>step.kind!=='premise');if(!candidates.length)return null;
  const step=reveal?([...candidates].reverse().find(x=>x.kind==='conclusion')||candidates[candidates.length-1]):(candidates.find(x=>x.kind!=='conclusion'&&x.kind!=='rollback')||candidates[0]);
  const projection=p.projectionForMove({causalProof:proof,causalStepId:step.id});return projection?{proof,step,projection}:null
}
function board(){return root.document?.querySelector?.('#tboard')||root.document?.querySelector?.('.board')||null}
function cellElement(boardNode,cell){return boardNode?.querySelector?.(`[data-r="${Number(cell?.[0])}"][data-c="${Number(cell?.[1])}"]`)||null}
function clearCoach(boardNode){if(!boardNode)return;for(const cls of COACH_CLASSES)boardNode.querySelectorAll?.(`.${cls}`).forEach(el=>el.classList.remove(cls));boardNode.querySelectorAll?.('.hint-hypothetical-badge').forEach(el=>el.remove())}
function apply(boardNode,cells,cls){for(const cell of cells||[]){const el=cellElement(boardNode,cell);if(el)el.classList.add(cls)}}
function badge(boardNode,item){const el=cellElement(boardNode,item?.cell);if(!el||!Number.isInteger(item?.sequenceIndex)||item.sequenceIndex<1)return;const b=root.document.createElement('span');b.className='hint-hypothetical-badge';b.setAttribute('aria-hidden','true');b.textContent=String(item.sequenceIndex);el.appendChild(b)}
function decorateCoach(d,reveal=false){
  let flow=null;try{flow=typeof current!=='undefined'?current?.hintFlow:null}catch(_){ }
  if(flow?.kind!=='tango-proof')return false;const result=coachProjection(flow,d,reveal),boardNode=board();if(!result||!boardNode)return false;const q=result.projection;clearCoach(boardNode);
  apply(boardNode,q.contextCells,'hint-causal-context');apply(boardNode,q.focusCells,'hint-causal-focus');apply(boardNode,q.hypothesisCells,'hint-causal-hypothesis');apply(boardNode,q.hypotheticalMoves.map(x=>x.cell),'hint-causal-hypothetical-move');apply(boardNode,q.contradictionCells,'hint-causal-contradiction');apply(boardNode,q.conclusionCells,'hint-causal-conclusion');for(const item of q.hypotheticalMoves)badge(boardNode,item);boardNode.dataset.coachCausalProofKind=q.kind;return true
}
function rollbackEntriesForProof(proof){return (proof?.steps||[]).filter(step=>step?.kind==='rollback'&&step?.synthetic===true)}
function mappedStepIds(moves){return new Set((moves||[]).map(move=>move?.causalStepId).filter(Boolean))}
function rollbackEntryFrom(conclusion,rollback){
  const next=copy(conclusion)||{};next.pedagogyStageKind='rollback';next.proofStage={kind:'rollback',apply:false};next.causalStepId=rollback.id;next.move='';next.target=null;next.deduction={rule:'ROLLBACK',rank:null,premises:[],focusCells:[],conclusions:[]};next._causalRollbackInjected=true;
  if(next.presentation){next.presentation.metadata={...(next.presentation.metadata||{}),showTutorMove:false};if(next.presentation.explanation)next.presentation.explanation.move='';if(next.presentation.action)next.presentation.action={...(next.presentation.action||{}),conclusions:[]}}
  const before=copy(conclusion?.beforeSnapshot||conclusion?.proofSnapshot||conclusion?.snapshot);if(before){next.proofSnapshot=copy(before);next.snapshot=copy(before)}return next
}
function injectRollbackEntries(s,start=0){
  if(!s||!Array.isArray(s.moves)||s?.base?.game!=='tango')return 0;let inserted=0,index=Math.max(0,start);
  while(index<s.moves.length){const move=s.moves[index],proof=move?.causalProof;if(!proof){index++;continue}const mapped=mappedStepIds(s.moves.filter(x=>x?.causalProof?.schema===proof.schema&&JSON.stringify(x.causalProof?.steps)===JSON.stringify(proof.steps)));const rollbacks=rollbackEntriesForProof(proof).filter(r=>!mapped.has(r.id));if(!rollbacks.length){index++;continue}
    const step=(proof.steps||[]).find(x=>x.id===move.causalStepId);if(step?.kind!=='conclusion'){index++;continue}
    for(const rollback of rollbacks){s.moves.splice(index,0,rollbackEntryFrom(move,rollback));index++;inserted++}index++
  }
  if(inserted&&s.done)s.total=s.moves.length;return inserted
}
let installed=false,previousFocus=null,previousGenerator=null;
function install(){
  if(installed)return true;let ok=false;
  if(typeof root.tangoFocusDeduction==='function'&&!root.tangoFocusDeduction.__quadludCausalCoachProjection){previousFocus=root.tangoFocusDeduction;const wrapped=function(d,reveal=false){const result=previousFocus(d,reveal);decorateCoach(d,reveal);return result};wrapped.__quadludCausalCoachProjection=true;wrapped.__quadludPrevious=previousFocus;root.tangoFocusDeduction=wrapped;ok=true}
  if(typeof root.walkthroughGenerateTangoNext==='function'&&!root.walkthroughGenerateTangoNext.__quadludCausalRollbackNavigation){previousGenerator=root.walkthroughGenerateTangoNext;const wrapped=function(){let s=null;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){ }const start=Array.isArray(s?.moves)?s.moves.length:0,result=previousGenerator();if(result)injectRollbackEntries(s,start);return result};wrapped.__quadludCausalRollbackNavigation=true;wrapped.__quadludPrevious=previousGenerator;root.walkthroughGenerateTangoNext=wrapped;ok=true}
  installed=ok;return ok
}
return Object.freeze({VERSION,install,entriesForCoach,coachProjection,injectRollbackEntries,_test:Object.freeze({entriesForCoach,rollbackEntriesForProof,mappedStepIds,rollbackEntryFrom,injectRollbackEntries})});
});
