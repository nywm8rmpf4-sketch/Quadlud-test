/*
 * QUADLUD — Tutor action-first logical move navigation
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludTutorActionFirstNavigation=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const SEMANTIC_CLASSES=Object.freeze(['walkthrough-unit-context','walkthrough-reasoning-context','walkthrough-current-focus','walkthrough-current-action']);
  const UNIT_FAMILIES=Object.freeze(['row','column','region']);
  let installed=false,proofNavigationActive=false;
  let previousBoardHtml=null,previousRender=null,previousProofNavigate=null;

  function session(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
  function groups(){try{return typeof walkthroughGroups==='function'?walkthroughGroups(session()):[]}catch(_){return []}}
  function currentGroup(){try{return typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}}
  function currentEntry(group){
    const entries=Array.isArray(group?.entries)?group.entries:[],nav=session()?.navigation,index=Number(nav?.proofStepIndex);
    return entries[Math.max(0,Math.min(entries.length-1,Number.isInteger(index)?index:0))]||null
  }
  function isActionMove(move){
    if(!move)return false;
    if(move.proofStage?.kind==='action'||move.proofStage?.apply===true)return true;
    if(move.presentation?.metadata?.showTutorMove===true)return true;
    return false
  }
  function actionEntry(group){
    const entries=Array.isArray(group?.entries)?group.entries:[];
    for(let i=entries.length-1;i>=0;i--)if(isActionMove(entries[i]?.move))return entries[i];
    return entries.length?entries[entries.length-1]:null
  }
  function groupIndex(group,list=groups()){return !group?-1:list.findIndex(x=>x===group||x.logicalMoveIndex===group.logicalMoveIndex)}
  function previousActionSnapshot(group){
    const list=groups(),i=groupIndex(group,list);if(i<=0)return session()?.initial||null;
    return actionEntry(list[i-1])?.move?.snapshot||session()?.initial||null
  }
  function projectedAction(group){
    const entry=actionEntry(group),move=entry?.move;
    return move?{entry,move,snapshot:move.snapshot||null,target:move.target??null}:null
  }

  function keyCoord(r,c){return `${Number(r)},${Number(c)}`}
  function listify(value){return Array.isArray(value)?value:(value&&typeof value==='object'?[value]:[])}
  function parseEntityCell(value){
    if(value?.kind!=='cell')return null;
    const match=/^r(\d+)c(\d+)$/.exec(String(value.id||''));return match?[Number(match[1]),Number(match[2])]:null
  }
  function collectCoords(value,out,depth=0){
    if(value==null||depth>7)return;
    if(Array.isArray(value)){
      if(value.length>=2&&Number.isInteger(Number(value[0]))&&Number.isInteger(Number(value[1]))&&Number(value[0])>=0&&Number(value[1])>=0){out.add(keyCoord(value[0],value[1]));return}
      for(const item of value)collectCoords(item,out,depth+1);return
    }
    if(typeof value!=='object')return;
    const entityCell=parseEntityCell(value);if(entityCell){out.add(keyCoord(...entityCell));return}
    if(Number.isInteger(Number(value.row))&&Number.isInteger(Number(value.column)))out.add(keyCoord(value.row,value.column));
    if(Number.isInteger(Number(value.r))&&Number.isInteger(Number(value.c)))out.add(keyCoord(value.r,value.c));
    if(Array.isArray(value.cell)||value.cell?.kind==='cell')collectCoords(value.cell,out,depth+1);
    for(const key of ['a','b','target','targets','cells','changes','conclusions','action','actions','focusCells','focusRelations','walkthroughTemporaryCells','walkthroughHypothesisCell','clues','visible'])if(value[key]!=null)collectCoords(value[key],out,depth+1)
  }
  function normalizeUnitRef(ref){
    if(!ref||typeof ref!=='object')return null;
    const family=String(ref.family||''),id=Number(ref.id);
    if(!UNIT_FAMILIES.includes(family)||!Number.isInteger(id)||id<0)return null;
    return Object.freeze({family,id,key:`${family}:${id}`})
  }
  function addUnitRef(ref,out){const unit=normalizeUnitRef(ref);if(unit)out.set(unit.key,unit)}
  function collectUnitCoords(ref,out,base=session()?.base){
    const unit=normalizeUnitRef(ref);if(!unit||!base)return out;const n=Number(base.n)||Number(base.puzzle?.rows)||0;if(!n)return out;
    if(unit.family==='row')for(let c=0;c<n;c++)out.add(keyCoord(unit.id,c));
    else if(unit.family==='column')for(let r=0;r<n;r++)out.add(keyCoord(r,unit.id));
    else if(unit.family==='region'&&Array.isArray(base.reg))for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(Number(base.reg[r]?.[c])===unit.id)out.add(keyCoord(r,c));
    return out
  }
  function collectDeductionUnits(d,out=new Map()){
    if(!d||typeof d!=='object')return out;
    for(const unit of listify(d.focusUnits))addUnitRef(unit,out);
    for(const premise of listify(d.premises)){for(const unit of listify(premise?.unit))addUnitRef(unit,out);for(const unit of listify(premise?.units))addUnitRef(unit,out)}
    const witness=d.explanationData?.witness;
    if(witness){for(const unit of [...listify(witness.sourceUnits),...listify(witness.targetUnits),...listify(witness.unit)])addUnitRef(unit,out);if(witness.family!=null&&witness.id!=null)addUnitRef({family:witness.family,id:witness.id},out)}
    if(d.explanationData?.family!=null&&d.explanationData?.id!=null)addUnitRef({family:d.explanationData.family,id:d.explanationData.id},out);
    return out
  }
  function collectPremiseCoords(d,out){
    if(!d||typeof d!=='object')return out;
    collectCoords(d.focusCells,out);collectCoords(d.focusRelations,out);collectCoords(d.walkthroughTemporaryCells,out);collectCoords(d.walkthroughHypothesisCell,out);
    for(const premise of listify(d.premises))collectCoords(premise,out);
    if(d.explanationData?.assumption?.cell)collectCoords(d.explanationData.assumption.cell,out);
    if(d.explanationData?.witness){const witness=d.explanationData.witness;collectCoords(witness.cells,out);collectCoords(witness.block,out)}
    return out
  }
  function collectDeductionCoords(d,out){collectPremiseCoords(d,out);if(d&&typeof d==='object')collectCoords(d.conclusions,out);return out}
  function reasoningDeduction(entry){const move=entry?.move||{};return move.deduction||move.presentation?.evidence?.primary||move.presentation?.proofDetails?.primary||null}
  function entryReasoningCoords(entry){const out=new Set(),d=reasoningDeduction(entry);collectPremiseCoords(d,out);return out}
  function groupReasoningCoords(group){const out=new Set();for(const entry of group?.entries||[])for(const key of entryReasoningCoords(entry))out.add(key);return out}
  function entryUnits(entry){return [...collectDeductionUnits(reasoningDeduction(entry)).values()]}
  function groupUnits(group){const out=new Map();for(const entry of group?.entries||[])for(const unit of entryUnits(entry))out.set(unit.key,unit);return [...out.values()]}
  function actionCoords(entry){
    const out=new Set(),move=entry?.move||{};
    collectCoords(move.target,out);collectCoords(move.deduction?.conclusions,out);collectCoords(move.presentation?.action?.target,out);collectCoords(move.presentation?.action,out);
    return [...out].map(key=>key.split(',').map(Number))
  }
  function focusItemsFrom(value,out=[]){
    if(!value||typeof value!=='object')return out;
    for(const list of [value.focus,value.move?.focus])if(Array.isArray(list))for(const item of list)if(item?.entity?.kind&&item?.entity?.id)out.push(item);
    return out
  }
  function entryFocusItems(entry){const move=entry?.move||{},out=[];focusItemsFrom(move.deduction,out);focusItemsFrom(move.presentation,out);focusItemsFrom(move.presentation?.evidence?.primary,out);focusItemsFrom(move.presentation?.action,out);return out}
  function itemKey(item){return `${item?.entity?.kind||''}:${item?.entity?.id||''}`}
  function mergeFocusItems(entries){const map=new Map();for(const entry of entries||[])for(const item of entryFocusItems(entry)){const key=itemKey(item);if(key!==':')map.set(key,item)}return [...map.values()]}
  function semanticRoles(group){
    const context=[...groupReasoningCoords(group)].map(key=>key.split(',').map(Number)),focus=[...entryReasoningCoords(currentEntry(group))].map(key=>key.split(',').map(Number)),action=actionCoords(actionEntry(group)),unitContext=groupUnits(group),currentUnits=entryUnits(currentEntry(group));
    return Object.freeze({unitContext,currentUnits,context,premiseCells:context,focus,currentFocus:focus,action,contextEntities:mergeFocusItems(group?.entries||[]),focusEntities:mergeFocusItems(currentEntry(group)?[currentEntry(group)]:[]),actionEntities:mergeFocusItems(actionEntry(group)?[actionEntry(group)]:[]).filter(item=>String(item.role||'').toLowerCase()==='target')})
  }
  function attributeEscape(value){return String(value??'').replace(/\\/g,'\\\\').replace(/"/g,'\\"')}
  function entityElements(scope,item){const e=item?.entity;if(!scope||!e?.kind||!e?.id)return [];return [...scope.querySelectorAll(`[data-entity-kind="${attributeEscape(e.kind)}"][data-entity-id="${attributeEscape(e.id)}"]`)]}
  function applyEntityClass(scope,items,cls){for(const item of items||[])for(const el of entityElements(scope,item))el.classList.add(cls)}
  function applyCoordClass(board,coords,cls){for(const [r,c] of coords||[]){const el=board.querySelector(`[data-r="${Number(r)}"][data-c="${Number(c)}"]`);if(el)el.classList.add(cls)}}
  function applyUnitClass(board,units,cls,base=session()?.base){
    for(const unit of units||[]){const coords=new Set();collectUnitCoords(unit,coords,base);for(const key of coords){const [r,c]=key.split(',').map(Number),el=board.querySelector(`[data-r="${r}"][data-c="${c}"]`);if(el){el.classList.add(cls,`${cls}-${unit.family}`);el.dataset.pedagogyUnit=(el.dataset.pedagogyUnit?el.dataset.pedagogyUnit+' ':'')+unit.key}}}
  }
  function clearSemanticRoles(scope){
    if(!scope)return;for(const cls of SEMANTIC_CLASSES)scope.querySelectorAll(`.${cls}`).forEach(el=>el.classList.remove(cls));
    for(const family of UNIT_FAMILIES)scope.querySelectorAll(`.walkthrough-unit-context-${family}`).forEach(el=>el.classList.remove(`walkthrough-unit-context-${family}`));
    scope.querySelectorAll('[data-pedagogy-unit]').forEach(el=>el.removeAttribute('data-pedagogy-unit'))
  }
  function findActionElements(entry){
    const doc=root?.document,board=doc?.querySelector?.('.walkthrough-board');if(!board)return [];
    const coords=actionCoords(entry),elements=[];for(const [r,c] of coords){const el=board.querySelector(`[data-r="${r}"][data-c="${c}"]`);if(el&&!elements.includes(el))elements.push(el)}
    if(!elements.length)for(const el of board.querySelectorAll('.walkthrough-target'))if(!elements.includes(el))elements.push(el);return elements
  }
  function decorateCurrentAction(){
    const group=currentGroup(),doc=root?.document;if(!group||!doc)return false;
    const chain=(group.entries?.length||0)>1,entry=actionEntry(group),board=doc.querySelector('.walkthrough-board');if(!board||!entry)return false;
    const scope=doc.querySelector('.walkthrough-panel')||board.parentElement||board,roles=semanticRoles(group);clearSemanticRoles(scope);
    applyUnitClass(board,roles.unitContext,'walkthrough-unit-context');
    applyCoordClass(board,roles.context,'walkthrough-reasoning-context');applyEntityClass(scope,roles.contextEntities,'walkthrough-reasoning-context');
    applyCoordClass(board,roles.focus,'walkthrough-current-focus');applyEntityClass(scope,roles.focusEntities,'walkthrough-current-focus');
    applyCoordClass(board,roles.action,'walkthrough-current-action');applyEntityClass(scope,roles.actionEntities,'walkthrough-current-action');
    board.classList.toggle('walkthrough-proof-chain-active',chain);board.dataset.proofSteps=String(group.entries?.length||1);board.dataset.pedagogyHierarchy='unit-context-premise-focus-action';
    for(const el of findActionElements(entry)){
      el.classList.add('walkthrough-current-action');
      if(chain){el.classList.add('walkthrough-current-action-chain');if(!el.querySelector(':scope > .walkthrough-chain-badge')){const badge=doc.createElement('span');badge.className='walkthrough-chain-badge';badge.setAttribute('aria-hidden','true');badge.textContent='⋯';el.appendChild(badge)}}
    }
    return true
  }

  function installBoardProjection(){
    if(typeof walkthroughBoardHtml!=='function'||walkthroughBoardHtml.__quadludActionFirst)return false;previousBoardHtml=walkthroughBoardHtml;
    const wrapped=function(snapshot,target,deduction,options={}){const s=session(),group=currentGroup(),projection=projectedAction(group);if(!s||s.atStart||!projection?.snapshot)return previousBoardHtml(snapshot,target,deduction,options);const nextOptions={...options,previousSnapshot:previousActionSnapshot(group)};if(proofNavigationActive)nextOptions.animatePlacement=false;return previousBoardHtml(projection.snapshot,projection.target??target,deduction,nextOptions)};
    wrapped.__quadludActionFirst=true;walkthroughBoardHtml=wrapped;return true
  }
  function installRenderProjection(){
    if(typeof renderWalkthrough!=='function'||renderWalkthrough.__quadludActionFirst)return false;previousRender=renderWalkthrough;
    const wrapped=function(options={}){const next=proofNavigationActive?{...options,animatePlacement:false}:options,result=previousRender(next);decorateCurrentAction();return result};wrapped.__quadludActionFirst=true;renderWalkthrough=wrapped;return true
  }
  function installProofNavigationProjection(){
    if(typeof walkthroughNavigateProof!=='function'||walkthroughNavigateProof.__quadludActionFirst)return false;previousProofNavigate=walkthroughNavigateProof;
    const wrapped=function(delta){proofNavigationActive=true;try{return previousProofNavigate(delta)}finally{proofNavigationActive=false}};wrapped.__quadludActionFirst=true;walkthroughNavigateProof=wrapped;return true
  }
  function install(){if(installed)return true;const ok=installBoardProjection()&&installRenderProjection()&&installProofNavigationProjection();installed=ok;if(ok)decorateCurrentAction();return ok}

  return Object.freeze({install,actionEntry,actionCoords,decorateCurrentAction,_test:Object.freeze({isActionMove,collectCoords,collectUnitCoords,collectDeductionUnits,collectPremiseCoords,collectDeductionCoords,currentEntry,entryReasoningCoords,groupReasoningCoords,entryUnits,groupUnits,semanticRoles,projectedAction})})
});
