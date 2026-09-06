/*
 * QUADLUD — Soleil/Lune semantic Tutor coherence HF3.9
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoSemanticCoherenceHF39=api;
  if(typeof document!=='undefined')api.scheduleInstall();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=1;
const TOKEN='3.1.9-hf3.9-r1';
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const cellKey=cell=>Array.isArray(cell)&&cell.length>=2?`${Number(cell[0])},${Number(cell[1])}`:'';
function locale(){try{return String(typeof lang==='function'?lang():root.document?.documentElement?.lang||'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function humanCell(cell){return Array.isArray(cell)?`${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`:''}
function humanPiece(value,loc=locale()){const sun=Number(value)===1;if(loc==='fr')return `${sun?'soleil':'lune'} ${sun?'☀':'☾'}`;return `${sun?'sun':'moon'} ${sun?'☀':'☾'}`}
function currentSession(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function currentGroup(){try{return typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}}
function entryDeduction(move){return move?.deduction||move?.presentation?.evidence?.primary||null}
function stageKind(move){
  const direct=String(move?.pedagogyStageKind||'');if(direct)return direct;
  const proof=String(move?.proofStage?.kind||'');if(proof)return proof;
  const causal=causalStep(move);return causal?.kind==='deduction'?'reasoning':causal?.kind||'action'
}
function causalStep(move){
  const proof=move?.causalProof,id=move?.causalStepId;if(!proof||!id||!Array.isArray(proof.steps))return null;
  return proof.steps.find(step=>step?.id===id)||null
}
function valueConclusions(d){return (d?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&(Number(c.value)===0||Number(c.value)===1))}
function assumptionOf(move){
  const d=entryDeduction(move),p=(d?.premises||[]).find(x=>(x?.kind==='ASSUMPTION'||x?.hypothesis===true)&&Array.isArray(x.cell));
  if(p&&(Number(p.value)===0||Number(p.value)===1))return {cell:copy(p.cell),value:Number(p.value)};
  const a=d?.explanationData?.assumption;return Array.isArray(a?.cell)&&(Number(a.value)===0||Number(a.value)===1)?{cell:copy(a.cell),value:Number(a.value)}:null
}
function snapshotValue(snapshot,cell){return Array.isArray(cell)?snapshot?.state?.[Number(cell[0])]?.[Number(cell[1])]:undefined}
function atomicAction(move){
  const target=Array.isArray(move?.target)?[Number(move.target[0]),Number(move.target[1])]:null;
  if(!target)return null;
  let value=snapshotValue(move?.snapshot,target);
  if(!(Number(value)===0||Number(value)===1)){const c=valueConclusions(entryDeduction(move)).find(x=>sameCell(x.cell,target));value=c?.value}
  return Number(value)===0||Number(value)===1?{cell:target,value:Number(value)}:null
}
function atomicActionText(move,loc=locale()){const action=atomicAction(move);return action?`${humanCell(action.cell)} = ${humanPiece(action.value,loc)}`:''}
function cellsOfDeduction(d){
  const out=[],seen=new Set(),add=c=>{if(!Array.isArray(c)||c.length<2)return;const x=[Number(c[0]),Number(c[1])],k=cellKey(x);if(!seen.has(k)){seen.add(k);out.push(x)}};
  for(const c of d?.focusCells||[])add(c);for(const p of d?.premises||[]){add(p?.cell);add(p?.a);add(p?.b)}for(const c of d?.conclusions||[]){add(c?.cell);add(c?.a);add(c?.b)}return out
}
function inferUnit(d){
  const refs=[...(d?.focusUnits||[])];if(d?.explanationData?.family!=null&&d?.explanationData?.id!=null)refs.push({family:d.explanationData.family,id:d.explanationData.id});
  for(const ref of refs){const id=Number(ref?.id),family=String(ref?.family||'');if(Number.isInteger(id)&&id>=0&&(family==='row'||family==='column'))return {family,id}}
  const cells=cellsOfDeduction(d);if(cells.length<2)return null;
  const row=cells[0][0],column=cells[0][1];if(cells.every(c=>c[0]===row))return {family:'row',id:row};if(cells.every(c=>c[1]===column))return {family:'column',id:column};return null
}
function unitName(unit,loc=locale()){if(!unit)return'';if(unit.family==='row')return loc==='fr'?`ligne ${String.fromCharCode(65+unit.id)}`:`row ${String.fromCharCode(65+unit.id)}`;return loc==='fr'?`colonne ${unit.id+1}`:`column ${unit.id+1}`}
function repairInvalidUnitText(text,d,loc=locale()){
  let source=String(text??'');if(!/\b(?:colonne|column|ligne|row)\s+NaN\b/i.test(source))return source;
  const name=unitName(inferUnit(d),loc);if(!name)return source.replace(/\b(?:colonne|column|ligne|row)\s+NaN\b/gi,loc==='fr'?'la ligne ou la colonne concernée':'the relevant row or column');
  return source.replace(/\b(?:colonne|column|ligne|row)\s+NaN\b/gi,name)
}
function normalizePresentation(move,{isFinal=false,bridgeConclusion=false}={}){
  const next=move,d=entryDeduction(next),loc=locale();if(!next.presentation)next.presentation={metadata:{},explanation:{}};
  next.presentation.metadata={...(next.presentation.metadata||{}),showTutorMove:!!isFinal,logicalMoveDisplayStable:true};
  next.presentation.explanation={...(next.presentation.explanation||{})};
  next.presentation.explanation.where=repairInvalidUnitText(next.presentation.explanation.where,d,loc);
  next.presentation.explanation.why=repairInvalidUnitText(next.presentation.explanation.why,d,loc);
  next.where=repairInvalidUnitText(next.where||next.presentation.explanation.where,d,loc);
  next.why=repairInvalidUnitText(next.why||next.presentation.explanation.why,d,loc);
  if(!isFinal){
    next.move='';next.presentation.explanation.move='';
    if(bridgeConclusion&&String(d?.rule||'')==='ASSUMPTION_CONTRADICTION'){
      next.pedagogyStageKind='reasoning';next.proofStage={...(next.proofStage||{}),kind:'reasoning',temporary:false,apply:false};
      next.where=loc==='fr'?`Reviens à l’hypothèse de départ.`:`Return to the starting assumption.`;
      next.why=loc==='fr'?`L’hypothèse conduit à l’impasse constatée : elle est donc impossible.`:`The assumption leads to the dead end just shown, so it is impossible.`;
      next.presentation.explanation.where=next.where;next.presentation.explanation.why=next.why
    }
    return next
  }
  const action=atomicAction(next),text=atomicActionText(next,loc);if(text){next.move=text;next.presentation.explanation.move=text}
  if(action&&next.presentation.action){const conclusions=(next.presentation.action.conclusions||[]).filter(c=>c?.type==='VALUE'&&sameCell(c.cell,action.cell)&&Number(c.value)===action.value);next.presentation.action={...next.presentation.action,conclusions:conclusions.length?copy(conclusions):[{type:'VALUE',cell:copy(action.cell),value:action.value}]}}
  return next
}
function normalizeGeneratedMoves(session,start){
  if(!session||session.base?.game!=='tango'||!Array.isArray(session.moves)||start<0||start>=session.moves.length)return false;
  const added=session.moves.slice(start),last=added.length-1;
  added.forEach((move,index)=>{
    const originalKind=String(move?.pedagogyStageKind||move?.proofStage?.kind||(index===last?'action':'reasoning')),isFinal=index===last,bridge=!isFinal&&originalKind==='action';
    if(!isFinal&&move?.proofSnapshot)move.snapshot=copy(move.proofSnapshot);
    if(!isFinal&&!bridge)move.proofStage={...(move.proofStage||{}),kind:originalKind,temporary:false,apply:false};
    normalizePresentation(move,{isFinal,bridgeConclusion:bridge});
    if(isFinal)move.proofStage={...(move.proofStage||{}),kind:'action',temporary:false,apply:true}
  });
  return true
}
function visible(el){if(!el)return false;const s=root.getComputedStyle?.(el),r=el.getBoundingClientRect?.();return !s||!r||(s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0)}
function clearSemanticOverlays(board){
  board?.querySelectorAll?.('.hf39-hypothetical-piece').forEach(el=>el.remove());
  board?.querySelectorAll?.('.hf39-hypothesis-cell,.hf39-hypothetical-cell').forEach(el=>el.classList.remove('hf39-hypothesis-cell','hf39-hypothetical-cell'))
}
function addMarker(board,marker,current=false){
  const cell=board?.querySelector?.(`[data-r="${Number(marker.cell?.[0])}"][data-c="${Number(marker.cell?.[1])}"]`);if(!cell)return false;
  cell.classList.add(marker.kind==='hypothesis'?'hf39-hypothesis-cell':'hf39-hypothetical-cell');
  const wrapper=root.document.createElement('span');wrapper.className=`walkthrough-hypothetical-piece hf39-hypothetical-piece ${marker.kind==='hypothesis'?'is-hypothesis':'is-consequence'}${current?' is-current':''}`;wrapper.setAttribute('aria-hidden','true');
  const symbol=root.document.createElement('span');symbol.className='walkthrough-hypothetical-symbol tango-symbol';symbol.textContent=Number(marker.value)===1?'☀':'☾';
  const badge=root.document.createElement('span');badge.className='walkthrough-hypothetical-badge';badge.textContent=marker.kind==='hypothesis'?'H':String(marker.sequence);
  wrapper.append(symbol,badge);cell.appendChild(wrapper);
  const loc=locale(),label=marker.kind==='hypothesis'?(loc==='fr'?`Hypothèse : ${humanPiece(marker.value,loc)}`:`Assumption: ${humanPiece(marker.value,loc)}`):(loc==='fr'?`Conséquence ${marker.sequence} : ${humanPiece(marker.value,loc)}`:`Consequence ${marker.sequence}: ${humanPiece(marker.value,loc)}`);
  const aria=String(cell.getAttribute('aria-label')||'');if(!aria.includes(label))cell.setAttribute('aria-label',aria?`${aria}, ${label}`:label);return true
}
function proofMarkers(group,index){
  const entries=Array.isArray(group?.entries)?group.entries:[],markers=[],seen=new Set();let sequence=0,hypothesisSeen=false;
  const add=(kind,cell,value,seq,current)=>{if(!Array.isArray(cell)||(Number(value)!==0&&Number(value)!==1))return;const key=`${kind}:${cellKey(cell)}:${Number(value)}`;if(seen.has(key))return;seen.add(key);markers.push({kind,cell:copy(cell),value:Number(value),sequence:seq,current})};
  for(let i=0;i<=Math.min(index,entries.length-1);i++){
    const move=entries[i]?.move,kind=stageKind(move);if(kind==='hypothesis'){const a=assumptionOf(move);if(a){add('hypothesis',a.cell,a.value,0,i===index);hypothesisSeen=true}continue}
    if(!hypothesisSeen||kind!=='reasoning')continue;
    const step=causalStep(move),suggested=Number.isInteger(step?.sequenceIndex)&&step.sequenceIndex>0?step.sequenceIndex:null;
    for(const conclusion of valueConclusions(entryDeduction(move))){sequence++;add('consequence',conclusion.cell,conclusion.value,suggested||sequence,i===index)}
  }
  return markers
}
function relationDetail(move){
  const d=entryDeduction(move),api=root.QuadludTangoTutorClarity?._test?.relationExplanation;if(String(d?.rule||'')!=='RELATION_PROPAGATION'||typeof api!=='function')return null;
  try{return api(d,locale())}catch(_){return null}
}
function repairRenderedUnitText(panel,move){
  const d=entryDeduction(move),loc=locale();if(!panel)return false;let changed=false;
  const walker=root.document.createTreeWalker(panel,root.NodeFilter?.SHOW_TEXT||4),nodes=[];let node;while((node=walker.nextNode()))nodes.push(node);
  for(const n of nodes){const next=repairInvalidUnitText(n.nodeValue,d,loc);if(next!==n.nodeValue){n.nodeValue=next;changed=true}}return changed
}
function renderRelationDetail(panel,move){
  const detail=relationDetail(move);if(!detail?.complete||!panel)return false;
  const ps=[...panel.querySelectorAll('p')],where=ps[0],why=ps[1],loc=locale();if(where)where.innerHTML=`<b>${loc==='fr'?'Où regarder':'Where to look'} :</b> ${escapeHtml(detail.where)}`;
  if(why){const label=loc==='fr'?'Raisonnement :':'Reasoning:',steps=(detail.steps||[]).map(x=>`<span class="reason-step">${escapeHtml(x)}</span>`).join('');why.innerHTML=`<b>${label}</b><br>${steps}`}
  return true
}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function decorate(){
  const s=currentSession(),g=currentGroup(),panel=root.document?.querySelector?.('.walkthrough-panel'),board=root.document?.querySelector?.('.walkthrough-board');if(!s||s.base?.game!=='tango'||!g||!panel||!board)return false;
  const index=Math.max(0,Math.min(g.entries.length-1,Number(s.navigation?.proofStepIndex)||0)),move=g.entries[index]?.move,kind=stageKind(move);if(!move)return false;
  panel.dataset.proofStageKind=kind;
  const moveP=panel.querySelector('.walkthrough-move');if(kind!=='action'&&moveP)moveP.remove();
  repairRenderedUnitText(panel,move);if(kind==='reasoning')renderRelationDetail(panel,move);
  clearSemanticOverlays(board);if(kind!=='action')for(const marker of proofMarkers(g,index))addMarker(board,marker,marker.current===true);
  return true
}
let generationInstalled=false,renderInstalled=false;
function installGeneration(){
  const previous=root.walkthroughGenerateNext;if(typeof previous!=='function')return false;if(previous.__quadludSemanticCoherenceHF39)return true;
  const wrapped=function(){const s=currentSession(),start=Array.isArray(s?.moves)?s.moves.length:0,ok=previous();if(ok&&s?.base?.game==='tango')normalizeGeneratedMoves(s,start);return ok};wrapped.__quadludSemanticCoherenceHF39=true;wrapped.__quadludPrevious=previous;root.walkthroughGenerateNext=wrapped;generationInstalled=true;return true
}
function installRender(){
  const previous=root.renderWalkthrough;if(typeof previous!=='function')return false;if(previous.__quadludSemanticCoherenceHF39)return true;
  const wrapped=function(options={}){const result=previous(options);decorate();return result};wrapped.__quadludSemanticCoherenceHF39=true;wrapped.__quadludPrevious=previous;root.renderWalkthrough=wrapped;renderInstalled=true;return true
}
function install(){return installGeneration()&&installRender()}
function scheduleInstall(){let tries=320,timer=null;const retry=()=>{const ok=install();if(ok){if(timer!=null)clearTimeout(timer);return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true}
return Object.freeze({VERSION,TOKEN,install,scheduleInstall,normalizeGeneratedMoves,decorate,_test:Object.freeze({sameCell,stageKind,causalStep,valueConclusions,assumptionOf,snapshotValue,atomicAction,atomicActionText,cellsOfDeduction,inferUnit,unitName,repairInvalidUnitText,normalizePresentation,proofMarkers,relationDetail})});
});
