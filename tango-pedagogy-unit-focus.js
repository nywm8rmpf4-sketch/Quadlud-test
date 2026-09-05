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

const VERSION=6;
const UNIT_CLASS='hint-unit-context';
const SUBSTEP_CLASS='hint-substep-focus';
const TRACE_KEYS=['causalTrace','moonCausalTrace','sunCausalTrace'];
const RELATION_BALANCE_RULES=new Set(['RELATION_BALANCE','RELATION_BALANCE_COMPONENT']);
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length>=2&&b.length>=2&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1])}
function cellKey(cell){return Array.isArray(cell)?`${Number(cell[0])},${Number(cell[1])}`:''}
function addCell(out,cell){if(Array.isArray(cell)&&cell.length>=2&&Number.isInteger(Number(cell[0]))&&Number.isInteger(Number(cell[1])))out.set(cellKey(cell),[Number(cell[0]),Number(cell[1])])}
function validUnitRef(ref){const family=String(ref?.family||''),id=Number(ref?.id);return ['row','column','region'].includes(family)&&Number.isInteger(id)&&id>=0?{family,id}:null}
function unitRefs(d){
  const map=new Map(),add=ref=>{const unit=validUnitRef(ref);if(unit)map.set(`${unit.family}:${unit.id}`,unit)};
  for(const ref of d?.focusUnits||[])add(ref);
  const x=d?.explanationData||{},witness=x.witness,rejected=x.rejected;
  for(const w of [witness,rejected]){
    if(w?.family!=null&&w?.id!=null)add({family:w.family,id:w.id});
    for(const key of ['unit','sourceUnits','targetUnits']){const value=w?.[key],list=Array.isArray(value)?value:(value?[value]:[]);for(const ref of list)add(ref)}
  }
  if(x.family!=null&&x.id!=null)add({family:x.family,id:x.id});
  return [...map.values()]
}
function unitCells(ref,n,reg){
  const out=[],unit=validUnitRef(ref);if(!unit||!Number.isInteger(n)||n<1)return out;
  if(unit.family==='row')for(let c=0;c<n;c++)out.push([unit.id,c]);
  else if(unit.family==='column')for(let r=0;r<n;r++)out.push([r,unit.id]);
  else if(unit.family==='region'&&Array.isArray(reg))for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(Number(reg[r]?.[c])===Number(unit.id))out.push([r,c]);
  return out
}
function cellInUnit(cell,unit,reg){
  if(!Array.isArray(cell)||!unit)return false;
  if(unit.family==='row')return Number(cell[0])===unit.id;
  if(unit.family==='column')return Number(cell[1])===unit.id;
  return unit.family==='region'&&Array.isArray(reg)&&Number(reg[cell[0]]?.[cell[1]])===unit.id
}
function addPremiseCells(out,p,{restrictValueUnit=null,reg=null}={}){
  if(!p||typeof p!=='object')return;
  if(p.kind==='RELATION'||p.a||p.b){addCell(out,p.a);addCell(out,p.b);return}
  if(Array.isArray(p.cell)){
    if(!restrictValueUnit||cellInUnit(p.cell,restrictValueUnit,reg))addCell(out,p.cell);
    return
  }
  for(const key of ['cells','target','targets'])for(const cell of p[key]||[])addCell(out,cell)
}
function causalTraces(d){
  const x=d?.explanationData||{},out=[];
  for(const key of TRACE_KEYS)if(Array.isArray(x[key])&&x[key].length)out.push(...x[key]);
  return out
}
function minimalStepCells(step,reg=null){
  const out=new Map(),rejectedUnit=validUnitRef(step?.explanationData?.rejected),restrict=RELATION_BALANCE_RULES.has(String(step?.rule||''))?rejectedUnit:null;
  for(const premise of step?.premises||[])addPremiseCells(out,premise,{restrictValueUnit:restrict,reg});
  for(const rel of step?.focusRelations||[]){addCell(out,rel?.a);addCell(out,rel?.b)}
  for(const conclusion of step?.conclusions||[]){if(conclusion?.type==='VALUE')addCell(out,conclusion.cell);else{addCell(out,conclusion?.a);addCell(out,conclusion?.b)}}
  if(!out.size)for(const cell of step?.focusCells||[])addCell(out,cell);
  return [...out.values()]
}
function legacyEvidenceCells(d){
  const out=new Map();for(const cell of d?.focusCells||[])addCell(out,cell);for(const rel of d?.focusRelations||[]){addCell(out,rel?.a);addCell(out,rel?.b)}
  addCell(out,d?.walkthroughHypothesisCell);for(const cell of d?.walkthroughTemporaryCells||[])addCell(out,cell);
  addCell(out,d?.explanationData?.assumption?.cell);for(const cell of d?.explanationData?.witness?.cells||[])addCell(out,cell);
  return [...out.values()]
}
function causalEvidenceCells(d,reg=null){
  const trace=causalTraces(d);if(!trace.length)return legacyEvidenceCells(d);
  const out=new Map(),x=d?.explanationData||{};
  addCell(out,x.assumption?.cell);
  for(const cell of x.witness?.cells||[])addCell(out,cell);
  for(const cell of x.witness?.block||[])addCell(out,cell);
  for(const step of trace)for(const cell of minimalStepCells(step,reg))addCell(out,cell);
  return out.size?[...out.values()]:legacyEvidenceCells(d)
}
function evidenceCells(d){let gameState=null;try{gameState=typeof current!=='undefined'?current:null}catch(_){ }return causalEvidenceCells(d,gameState?.reg||null)}
function conclusionCells(d){
  const out=new Map();for(const conclusion of d?.conclusions||[]){if(conclusion?.type==='VALUE')addCell(out,conclusion.cell);else{addCell(out,conclusion?.a);addCell(out,conclusion?.b)}}return [...out.values()]
}
function normalizePresentationDeduction(d,depth=0,reg=null){
  if(!d||typeof d!=='object'||depth>6)return d;
  const out=copy(d),x=out.explanationData||{};
  if(RELATION_BALANCE_RULES.has(String(out.rule||''))){
    const rejected=validUnitRef(x.rejected),hasUnit=(out.focusUnits||[]).some(validUnitRef);
    if(rejected&&!hasUnit)out.focusUnits=[...(out.focusUnits||[]),rejected];
    if(rejected&&!validUnitRef({family:x.family,id:x.id})){x.family=rejected.family;x.id=rejected.id;out.explanationData=x}
  }
  if(out.explanationData){for(const key of ['causalTrace','trace','moonCausalTrace','sunCausalTrace','moonTrace','sunTrace'])if(Array.isArray(out.explanationData[key]))out.explanationData[key]=out.explanationData[key].map(step=>normalizePresentationDeduction(step,depth+1,reg))}
  const minimal=minimalStepCells(out,reg),original=Array.isArray(out.focusCells)?out.focusCells:[];
  if(minimal.length&&(!original.length||minimal.length<=original.length))out.focusCells=minimal;
  return out
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
  if(!board||!gameState||!d)return false;const n=Number(gameState.n)||6,normalized=normalizePresentationDeduction(d,0,gameState.reg||null);clearExtended(board);
  for(const unit of unitRefs(normalized))for(const cell of unitCells(unit,n,gameState.reg)){const el=boardCell(board,n,cell);if(el)el.classList.add(UNIT_CLASS)}
  const conclusions=conclusionCells(normalized),isConclusion=cell=>conclusions.some(x=>sameCell(x,cell));
  for(const cell of causalEvidenceCells(normalized,gameState.reg)){const el=boardCell(board,n,cell);if(!el)continue;if(reveal&&isConclusion(cell))el.classList.add('hint-focus');else el.classList.add(reveal?SUBSTEP_CLASS:'hint-context')}
  if(reveal)for(const cell of conclusions){const el=boardCell(board,n,cell);if(el)el.classList.add('hint-focus')}
  return true
}
function install(){
  const previous=root.tangoFocusDeduction;if(typeof previous!=='function')return false;if(previous.__quadludUnitCellSeparation===true)return true;
  const wrapped=function(d,reveal=false){return applyFocus(d,reveal)||previous(d,reveal)};wrapped.__quadludUnitCellSeparation=true;wrapped.__quadludPrevious=previous;root.tangoFocusDeduction=wrapped;return true
}
function installPresenterBridge(){
  const source=root.QuadludTangoReasoningPresenter;if(!source||typeof source.createPresenter!=='function')return false;if(source.__quadludCausalNormalization===true)return true;
  const previousCreate=source.createPresenter;
  const replacement={...source,createPresenter(h){const p=previousCreate(h),wrap=name=>(d,...args)=>p[name](normalizePresentationDeduction(d),...args);return Object.freeze({...p,orientation:wrap('orientation'),explanation:wrap('explanation'),advancedProofGroups:wrap('advancedProofGroups'),advancedSupports:wrap('advancedSupports'),legacyReasoning:wrap('legacyReasoning'),presentation:wrap('presentation')})},__quadludCausalNormalization:true};
  root.QuadludTangoReasoningPresenter=Object.freeze(replacement);return true
}
function walkthroughGroup(){try{return typeof root.walkthroughCurrentGroup==='function'?root.walkthroughCurrentGroup():null}catch(_){return null}}
function walkthroughEntryDeduction(entry){const move=entry?.move||entry||{};return move.deduction||move.presentation?.evidence?.primary||null}
function walkthroughStageKind(entry){const move=entry?.move||entry||{};return String(move.pedagogyStageKind||move.proofStage?.kind||'')}
function currentWalkthroughEntry(group=walkthroughGroup()){
  const entries=Array.isArray(group?.entries)?group.entries:[];let s=null;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){ }
  const index=Math.max(0,Math.min(entries.length-1,Number(s?.navigation?.proofStepIndex)||0));return entries[index]||null
}
function currentFocusCells(entry,reg=null){
  const d=walkthroughEntryDeduction(entry);if(!d)return [];
  const normalized=normalizePresentationDeduction(d,0,reg),out=new Map();
  for(const cell of normalized?.focusCells||[])addCell(out,cell);
  for(const rel of normalized?.focusRelations||[]){addCell(out,rel?.a);addCell(out,rel?.b)}
  addCell(out,normalized?.walkthroughHypothesisCell);for(const cell of normalized?.walkthroughTemporaryCells||[])addCell(out,cell);
  addCell(out,normalized?.explanationData?.assumption?.cell);
  for(const cell of normalized?.explanationData?.witness?.cells||[])addCell(out,cell);
  for(const cell of normalized?.explanationData?.witness?.block||[])addCell(out,cell);
  if(!out.size)for(const cell of conclusionCells(normalized))addCell(out,cell);
  return [...out.values()]
}
function proofContextCells(group,reg=null){
  const out=new Map();for(const entry of group?.entries||[]){if(walkthroughStageKind(entry)==='action')continue;const d=walkthroughEntryDeduction(entry);if(!d)continue;const normalized=normalizePresentationDeduction(d,0,reg),trace=causalTraces(normalized),cells=trace.length?causalEvidenceCells(normalized,reg):minimalStepCells(normalized,reg);for(const cell of cells)addCell(out,cell)}return [...out.values()]
}
function proofUnits(group){
  const out=new Map();for(const entry of group?.entries||[]){const d=walkthroughEntryDeduction(entry);for(const unit of unitRefs(d)){const ref=validUnitRef(unit);if(ref)out.set(`${ref.family}:${ref.id}`,ref)}}return [...out.values()]
}
function pruneWalkthrough(){
  const group=walkthroughGroup(),entry=currentWalkthroughEntry(group);if(!group||!entry)return false;
  const board=root.document?.querySelector?.('.walkthrough-board');if(!board)return false;
  const base=(()=>{try{return typeof walkthroughSession!=='undefined'?walkthroughSession?.base:null}catch(_){return null}})();if(base?.game!=='tango')return false;
  const n=Number(base?.n)||6,reg=base?.reg||null,contextAllowed=new Set(proofContextCells(group,reg).map(cellKey)),focusAllowed=new Set(currentFocusCells(entry,reg).map(cellKey)),kind=walkthroughStageKind(entry);
  for(const unit of proofUnits(group))for(const cell of unitCells(unit,n,reg)){
    const key=cellKey(cell),el=boardCell(board,n,cell);if(!el)continue;el.classList.add('walkthrough-unit-context',`walkthrough-unit-context-${unit.family}`);
    if(!contextAllowed.has(key)&&!el.classList.contains('walkthrough-current-action'))el.classList.remove('walkthrough-context','walkthrough-reasoning-context')
  }
  board.querySelectorAll('.walkthrough-reasoning-context').forEach(el=>{const key=`${Number(el.dataset.r)},${Number(el.dataset.c)}`;if(!contextAllowed.has(key)&&!el.classList.contains('walkthrough-current-action'))el.classList.remove('walkthrough-reasoning-context')});
  board.querySelectorAll('.walkthrough-current-focus').forEach(el=>el.classList.remove('walkthrough-current-focus'));
  if(kind!=='action')for(const key of focusAllowed){const [r,c]=key.split(',').map(Number),el=boardCell(board,n,[r,c]);if(el&&!el.classList.contains('walkthrough-current-action'))el.classList.add('walkthrough-current-focus')}
  board.dataset.pedagogyCausalProjection='minimal-current-substep';return true
}
function installWalkthroughBridge(){
  const previous=root.renderWalkthrough;if(typeof previous!=='function')return false;if(previous.__quadludCausalProjection===true)return true;
  const wrapped=function(options={}){const result=previous(options);pruneWalkthrough();return result};wrapped.__quadludCausalProjection=true;wrapped.__quadludPrevious=previous;root.renderWalkthrough=wrapped;return true
}
function scheduleInstall(){
  if(typeof document==='undefined')return false;
  let remaining=120,timer=null;
  const retry=()=>{const a=install(),b=installPresenterBridge(),c=installWalkthroughBridge();if(a&&b&&c){if(timer!=null)clearTimeout(timer);return true}if(remaining--<=0)return false;timer=setTimeout(retry,10);return true};
  retry();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}

return Object.freeze({VERSION,install,installPresenterBridge,installWalkthroughBridge,scheduleInstall,applyFocus,pruneWalkthrough,_test:Object.freeze({unitRefs,unitCells,evidenceCells,legacyEvidenceCells,causalTraces,minimalStepCells,causalEvidenceCells,conclusionCells,normalizePresentationDeduction,sameCell,cellInUnit,walkthroughEntryDeduction,walkthroughStageKind,currentWalkthroughEntry,currentFocusCells,proofContextCells,proofUnits})});
});
