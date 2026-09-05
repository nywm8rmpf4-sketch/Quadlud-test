/*
 * QUADLUD — Soleil/Lune contradiction proof visualisation
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoContradictionVisuals=api;
  if(typeof document!=='undefined')api.scheduleInstall();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=2;
const ACTIVE_STAGE_KINDS=new Set(['hypothesis','reasoning','contradiction']);
const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const cellKey=cell=>Array.isArray(cell)?`${Number(cell[0])},${Number(cell[1])}`:'';

function currentSession(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function currentGroup(){try{return typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}}
function stageKind(entry){return String(entry?.move?.pedagogyStageKind||entry?.move?.proofStage?.kind||'')}
function deduction(entry){return entry?.move?.deduction||entry?.move?.presentation?.evidence?.primary||null}
function assumptionOf(entry){
  const d=deduction(entry),fromPremise=(d?.premises||[]).find(p=>p?.kind==='ASSUMPTION'&&Array.isArray(p.cell));
  if(fromPremise)return {cell:copy(fromPremise.cell),value:Number(fromPremise.value)};
  const a=d?.explanationData?.assumption;
  return Array.isArray(a?.cell)?{cell:copy(a.cell),value:Number(a.value)}:null
}
function valueConclusions(entry){
  return (deduction(entry)?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&(Number(c.value)===0||Number(c.value)===1)).map(c=>({cell:copy(c.cell),value:Number(c.value)}))
}
function contradictionWitness(entry){
  const d=deduction(entry),out=new Map();
  const add=cell=>{const key=cellKey(cell);if(key)out.set(key,copy(cell))};
  for(const cell of d?.focusCells||[])add(cell);
  const w=d?.explanationData?.witness||{};
  for(const cell of w.cells||[])add(cell);
  for(const cell of w.block||[])add(cell);
  const units=[];
  for(const unit of d?.focusUnits||[])if(unit?.family!=null&&unit?.id!=null)units.push({family:String(unit.family),id:Number(unit.id)});
  if(w.family!=null&&w.id!=null)units.push({family:String(w.family),id:Number(w.id)});
  return {cells:[...out.values()],units}
}
function proofVisualState(group,index=0){
  const entries=Array.isArray(group?.entries)?group.entries:[];
  if(!entries.length)return Object.freeze({active:false,stageKind:'',markers:[],contradictionCells:[],contradictionUnits:[]});
  const safeIndex=Math.max(0,Math.min(entries.length-1,Number(index)||0)),kind=stageKind(entries[safeIndex]);
  const hypothesisIndex=entries.findIndex(entry=>stageKind(entry)==='hypothesis'&&assumptionOf(entry));
  const contradictionIndex=entries.findIndex(entry=>stageKind(entry)==='contradiction');
  const isContradictionProof=hypothesisIndex>=0&&contradictionIndex>hypothesisIndex;
  if(!isContradictionProof||!ACTIVE_STAGE_KINDS.has(kind))return Object.freeze({active:false,stageKind:kind,markers:[],contradictionCells:[],contradictionUnits:[]});

  const assumption=assumptionOf(entries[hypothesisIndex]),markers=[],seen=new Set();
  if(assumption){
    markers.push({kind:'hypothesis',cell:copy(assumption.cell),value:Number(assumption.value),label:'H',sequence:0,current:safeIndex===hypothesisIndex});
    seen.add(`${cellKey(assumption.cell)}:${Number(assumption.value)}`)
  }
  let sequence=0;
  for(let i=hypothesisIndex+1;i<=Math.min(safeIndex,contradictionIndex-1);i++){
    if(stageKind(entries[i])!=='reasoning')continue;
    for(const conclusion of valueConclusions(entries[i])){
      const key=`${cellKey(conclusion.cell)}:${conclusion.value}`;
      if(seen.has(key))continue;
      seen.add(key);sequence++;
      markers.push({kind:'consequence',cell:copy(conclusion.cell),value:conclusion.value,label:String(sequence),sequence,current:i===safeIndex})
    }
  }
  const witness=kind==='contradiction'?contradictionWitness(entries[safeIndex]):{cells:[],units:[]};
  return Object.freeze({active:true,stageKind:kind,markers:Object.freeze(markers.map(Object.freeze)),contradictionCells:Object.freeze(witness.cells.map(Object.freeze)),contradictionUnits:Object.freeze(witness.units.map(Object.freeze))})
}
function unitCells(unit,n=6){
  const out=[],id=Number(unit?.id),size=Math.max(1,Number(n)||6);
  if(!Number.isInteger(id)||id<0)return out;
  if(unit?.family==='row')for(let c=0;c<size;c++)out.push([id,c]);
  if(unit?.family==='column')for(let r=0;r<size;r++)out.push([r,id]);
  return out
}
function locale(){try{return String(typeof lang==='function'?lang():'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function pieceWord(value){const fr=locale()==='fr';return Number(value)===1?(fr?'soleil':'sun'):(fr?'lune':'moon')}
function rememberA11yBase(cell){
  if(!cell||cell.hasAttribute?.('data-contradiction-a11y-base'))return;
  const had=cell.hasAttribute?.('aria-label'),base=String(cell.getAttribute?.('aria-label')||'');
  cell.setAttribute?.('data-contradiction-a11y-base',base);
  cell.setAttribute?.('data-contradiction-a11y-had-label',had?'1':'0')
}
function appendA11y(cell,text){
  if(!cell||!text)return;rememberA11yBase(cell);const current=String(cell.getAttribute?.('aria-label')||'').trim();
  if(!current.includes(text))cell.setAttribute?.('aria-label',current?`${current}, ${text}`:text)
}
function restoreA11y(cell){
  if(!cell||!cell.hasAttribute?.('data-contradiction-a11y-base'))return;
  const base=String(cell.getAttribute('data-contradiction-a11y-base')||''),had=cell.getAttribute('data-contradiction-a11y-had-label')==='1';
  if(had)cell.setAttribute('aria-label',base);else cell.removeAttribute('aria-label');
  cell.removeAttribute('data-contradiction-a11y-base');cell.removeAttribute('data-contradiction-a11y-had-label')
}
function clearVisuals(board,panel){
  if(!board)return;
  board.querySelectorAll?.('.walkthrough-hypothetical-piece').forEach(el=>el.remove());
  board.querySelectorAll?.('.walkthrough-hypothesis-cell,.walkthrough-hypothetical-cell,.walkthrough-contradiction-cell').forEach(el=>el.classList.remove('walkthrough-hypothesis-cell','walkthrough-hypothetical-cell','walkthrough-contradiction-cell'));
  board.querySelectorAll?.('[data-contradiction-a11y-base]').forEach(restoreA11y);
  board.removeAttribute?.('data-contradiction-visual');
  panel?.removeAttribute?.('data-contradiction-visual')
}
function markerElement(marker,doc){
  const wrapper=doc.createElement('span');wrapper.className=`walkthrough-hypothetical-piece ${marker.kind==='hypothesis'?'is-hypothesis':'is-consequence'}${marker.current?' is-current':''}`;wrapper.setAttribute('aria-hidden','true');wrapper.dataset.hypotheticalStep=String(marker.label);
  const symbol=doc.createElement('span');symbol.className='walkthrough-hypothetical-symbol tango-symbol';symbol.textContent=Number(marker.value)===1?'☀':'☾';
  const badge=doc.createElement('span');badge.className='walkthrough-hypothetical-badge';badge.textContent=String(marker.label);
  wrapper.append(symbol,badge);return wrapper
}
function decorate(){
  const s=currentSession(),group=currentGroup(),doc=root.document,board=doc?.querySelector?.('.walkthrough-board'),panel=doc?.querySelector?.('.walkthrough-panel');
  if(!s||s.base?.game!=='tango'||!group||!board)return false;
  clearVisuals(board,panel);
  const index=Math.max(0,Math.min(group.entries.length-1,Number(s.navigation?.proofStepIndex)||0)),state=proofVisualState(group,index);
  if(!state.active)return false;
  const fr=locale()==='fr';
  for(const marker of state.markers){
    const [r,c]=marker.cell,cell=board.querySelector?.(`[data-r="${Number(r)}"][data-c="${Number(c)}"]`);if(!cell)continue;
    cell.classList.add(marker.kind==='hypothesis'?'walkthrough-hypothesis-cell':'walkthrough-hypothetical-cell');cell.appendChild(markerElement(marker,doc));
    const label=marker.kind==='hypothesis'?(fr?`Hypothèse : ${pieceWord(marker.value)}`:`Assumption: ${pieceWord(marker.value)}`):(fr?`Conséquence ${marker.sequence} : ${pieceWord(marker.value)}`:`Consequence ${marker.sequence}: ${pieceWord(marker.value)}`);appendA11y(cell,label)
  }
  if(state.stageKind==='contradiction'){
    const contradiction=new Map();for(const cell of state.contradictionCells)contradiction.set(cellKey(cell),cell);
    if(!contradiction.size)for(const unit of state.contradictionUnits)for(const cell of unitCells(unit,s.base?.n||6))contradiction.set(cellKey(cell),cell);
    for(const cellRef of contradiction.values()){
      const [r,c]=cellRef,cell=board.querySelector?.(`[data-r="${Number(r)}"][data-c="${Number(c)}"]`);if(!cell)continue;cell.classList.add('walkthrough-contradiction-cell');appendA11y(cell,fr?'Contradiction':'Contradiction')
    }
  }
  board.dataset.contradictionVisual=state.stageKind;panel?.setAttribute?.('data-contradiction-visual',state.stageKind);return true
}
function install(){
  if(typeof renderWalkthrough!=='function'||renderWalkthrough.__quadludContradictionVisuals===true)return false;
  if(renderWalkthrough.__quadludHumanProgressiveV4!==true)return false;
  const previous=renderWalkthrough;const wrapped=function(options={}){const result=previous(options);decorate();return result};
  wrapped.__quadludContradictionVisuals=true;wrapped.__quadludHumanProgressiveV4=true;wrapped.__quadludPrevious=previous;renderWalkthrough=wrapped;return true
}
function scheduleInstall(){
  let tries=240,timer=null;const retry=()=>{if(install()){if(timer!=null)clearTimeout(timer);return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};
  retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}

return Object.freeze({VERSION,install,scheduleInstall,decorate,_test:Object.freeze({stageKind,assumptionOf,valueConclusions,contradictionWitness,proofVisualState,unitCells,sameCell,rememberA11yBase,restoreA11y})})
});
