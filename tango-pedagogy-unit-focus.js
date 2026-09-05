/*
 * QUADLUD — Soleil/Lune pedagogical unit/cell focus adapter
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoPedagogyUnitFocus=api;
  if(typeof document!=='undefined')api.scheduleInstall();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=3;
const UNIT_CLASS='hint-unit-context';
const SUBSTEP_CLASS='hint-substep-focus';
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length>=2&&b.length>=2&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1])}
function cellKey(cell){return Array.isArray(cell)?`${Number(cell[0])},${Number(cell[1])}`:''}
function addCell(out,cell){if(Array.isArray(cell)&&cell.length>=2&&Number.isInteger(Number(cell[0]))&&Number.isInteger(Number(cell[1])))out.set(cellKey(cell),[Number(cell[0]),Number(cell[1])])}
function unitRefs(d){
  const map=new Map(),add=ref=>{const family=String(ref?.family||''),id=Number(ref?.id);if(['row','column','region'].includes(family)&&Number.isInteger(id)&&id>=0)map.set(`${family}:${id}`,{family,id})};
  for(const ref of d?.focusUnits||[])add(ref);
  const witness=d?.explanationData?.witness;if(witness?.family!=null&&witness?.id!=null)add({family:witness.family,id:witness.id});
  for(const key of ['unit','sourceUnits','targetUnits']){const value=witness?.[key],list=Array.isArray(value)?value:(value?[value]:[]);for(const ref of list)add(ref)}
  if(d?.explanationData?.family!=null&&d?.explanationData?.id!=null)add({family:d.explanationData.family,id:d.explanationData.id});
  return [...map.values()]
}
function unitCells(ref,n,reg){
  const out=[];if(!ref||!Number.isInteger(n)||n<1)return out;
  if(ref.family==='row')for(let c=0;c<n;c++)out.push([ref.id,c]);
  else if(ref.family==='column')for(let r=0;r<n;r++)out.push([r,ref.id]);
  else if(ref.family==='region'&&Array.isArray(reg))for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(Number(reg[r]?.[c])===Number(ref.id))out.push([r,c]);
  return out
}
function evidenceCells(d){
  const out=new Map();for(const cell of d?.focusCells||[])addCell(out,cell);for(const rel of d?.focusRelations||[]){addCell(out,rel?.a);addCell(out,rel?.b)}
  addCell(out,d?.walkthroughHypothesisCell);for(const cell of d?.walkthroughTemporaryCells||[])addCell(out,cell);
  addCell(out,d?.explanationData?.assumption?.cell);for(const cell of d?.explanationData?.witness?.cells||[])addCell(out,cell);
  return [...out.values()]
}
function conclusionCells(d){
  const out=new Map();for(const conclusion of d?.conclusions||[]){if(conclusion?.type==='VALUE')addCell(out,conclusion.cell);else{addCell(out,conclusion?.a);addCell(out,conclusion?.b)}}return [...out.values()]
}
function boardCell(board,n,cell){
  if(!board||!Array.isArray(cell))return null;
  return board.querySelector?.(`[data-r="${cell[0]}"][data-c="${cell[1]}"]`)||board.children?.[cell[0]*n+cell[1]]||null
}
function clearExtended(board){
  try{if(typeof clearHintFocus==='function')clearHintFocus()}catch(_){ }
  if(!board?.querySelectorAll)return;board.querySelectorAll(`.${UNIT_CLASS},.${SUBSTEP_CLASS}`).forEach(el=>el.classList.remove(UNIT_CLASS,SUBSTEP_CLASS))
}
function applyFocus(d,reveal=false){
  const board=(root.document?.querySelector?.('#tboard')||root.document?.querySelector?.('.board'));let gameState=null;try{gameState=typeof current!=='undefined'?current:null}catch(_){ }
  if(!board||!gameState||!d)return false;const n=Number(gameState.n)||6;clearExtended(board);
  for(const unit of unitRefs(d))for(const cell of unitCells(unit,n,gameState.reg)){const el=boardCell(board,n,cell);if(el)el.classList.add(UNIT_CLASS)}
  const conclusions=conclusionCells(d),isConclusion=cell=>conclusions.some(x=>sameCell(x,cell));
  for(const cell of evidenceCells(d)){const el=boardCell(board,n,cell);if(!el)continue;if(reveal&&isConclusion(cell))el.classList.add('hint-focus');else el.classList.add(reveal?SUBSTEP_CLASS:'hint-context')}
  if(reveal)for(const cell of conclusions){const el=boardCell(board,n,cell);if(el)el.classList.add('hint-focus')}
  return true
}
function install(){
  const previous=root.tangoFocusDeduction;if(typeof previous!=='function')return false;if(previous.__quadludUnitCellSeparation===true)return true;
  const wrapped=function(d,reveal=false){return applyFocus(d,reveal)||previous(d,reveal)};wrapped.__quadludUnitCellSeparation=true;wrapped.__quadludPrevious=previous;root.tangoFocusDeduction=wrapped;return true
}
function scheduleInstall(){
  if(typeof document==='undefined')return false;
  let remaining=60,timer=null;
  const retry=()=>{if(install()){if(timer!=null)clearTimeout(timer);return true}if(remaining--<=0)return false;timer=setTimeout(retry,10);return true};
  retry();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});
  return true
}

return Object.freeze({VERSION,install,scheduleInstall,applyFocus,_test:Object.freeze({unitRefs,unitCells,evidenceCells,conclusionCells,sameCell})});
});
