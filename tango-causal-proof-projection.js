/*
 * QUADLUD — Soleil/Lune causal proof visual projection
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoCausalProofProjection=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const VERSION=1;
const ROLE_CLASSES=Object.freeze(['walkthrough-causal-context','walkthrough-causal-focus','walkthrough-causal-hypothesis','walkthrough-causal-hypothetical-move','walkthrough-causal-contradiction','walkthrough-causal-conclusion']);
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
function uniqueCells(values){const out=[],seen=new Set();for(const value of values||[]){if(!Array.isArray(value)||value.length<2)continue;const c=[Number(value[0]),Number(value[1])],key=c.join(',');if(seen.has(key))continue;seen.add(key);out.push(c)}return out}
function entryMove(entry){return entry?.move||entry||null}
function causalStep(move){const proof=move?.causalProof,id=move?.causalStepId;if(!proof||!id||!Array.isArray(proof.steps))return null;return proof.steps.find(step=>step?.id===id)||null}
function premiseCells(proof){const out=[];for(const p of proof?.premises||[]){if(Array.isArray(p?.cell))out.push(p.cell);if(Array.isArray(p?.a))out.push(p.a);if(Array.isArray(p?.b))out.push(p.b)}return uniqueCells(out)}
function projectionForMove(move){const proof=move?.causalProof,step=causalStep(move);if(!proof||!step)return null;const roles=step.cellRoles||{},hypotheticalMoves=[];if(step.hypothetical&&step.kind==='deduction')for(const cell of step.producedCells||[])hypotheticalMoves.push({cell:copy(cell),sequenceIndex:Number.isInteger(step.sequenceIndex)?step.sequenceIndex:null});return Object.freeze({proofSchema:proof.schema||null,stepId:step.id,kind:step.kind,hypothetical:step.hypothetical===true,contextCells:premiseCells(proof),focusCells:uniqueCells(roles.focusCells||step.involvedCells||[]),hypothesisCells:uniqueCells(roles.hypothesisCells||[]),contradictionCells:uniqueCells(roles.contradictionCells||[]),conclusionCells:uniqueCells(roles.conclusionCells||[]),hypotheticalMoves:Object.freeze(hypotheticalMoves),sequenceIndex:Number.isInteger(step.sequenceIndex)?step.sequenceIndex:null})}
function session(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function currentGroup(){try{return typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}}
function currentEntry(){const group=currentGroup(),entries=Array.isArray(group?.entries)?group.entries:[],index=Number(session()?.navigation?.proofStepIndex)||0;return entries[Math.max(0,Math.min(entries.length-1,index))]||null}
function board(){return root?.document?.querySelector?.('.walkthrough-board')||null}
function cellElement(boardNode,cell){return boardNode?.querySelector?.(`[data-r="${Number(cell?.[0])}"][data-c="${Number(cell?.[1])}"]`)||null}
function clear(boardNode){if(!boardNode)return;for(const cls of ROLE_CLASSES)boardNode.querySelectorAll?.(`.${cls}`).forEach(el=>el.classList.remove(cls));boardNode.querySelectorAll?.('.walkthrough-hypothetical-badge').forEach(el=>el.remove());boardNode.removeAttribute?.('data-causal-proof-kind');boardNode.removeAttribute?.('data-causal-proof-step')}
function applyCells(boardNode,cells,cls){for(const c of cells||[]){const el=cellElement(boardNode,c);if(el)el.classList.add(cls)}}
function addHypotheticalBadge(boardNode,item){const el=cellElement(boardNode,item?.cell);if(!el||!Number.isInteger(item?.sequenceIndex)||item.sequenceIndex<1)return;let badge=el.querySelector?.(':scope > .walkthrough-hypothetical-badge');if(!badge){badge=root.document.createElement('span');badge.className='walkthrough-hypothetical-badge';badge.setAttribute('aria-hidden','true');el.appendChild(badge)}badge.textContent=String(item.sequenceIndex)}
function decorate(){const boardNode=board();if(!boardNode)return false;clear(boardNode);const move=entryMove(currentEntry()),projection=projectionForMove(move);if(!projection)return false;applyCells(boardNode,projection.contextCells,'walkthrough-causal-context');applyCells(boardNode,projection.focusCells,'walkthrough-causal-focus');applyCells(boardNode,projection.hypothesisCells,'walkthrough-causal-hypothesis');applyCells(boardNode,projection.hypotheticalMoves.map(x=>x.cell),'walkthrough-causal-hypothetical-move');applyCells(boardNode,projection.contradictionCells,'walkthrough-causal-contradiction');applyCells(boardNode,projection.conclusionCells,'walkthrough-causal-conclusion');for(const item of projection.hypotheticalMoves)addHypotheticalBadge(boardNode,item);boardNode.dataset.causalProofKind=projection.kind;boardNode.dataset.causalProofStep=projection.stepId;return true}
let installed=false,previousRender=null,previousNavigate=null;
function install(){if(installed)return true;if(typeof renderWalkthrough!=='function')return false;previousRender=renderWalkthrough;const wrapped=function(options={}){const result=previousRender(options);decorate();return result};wrapped.__quadludCausalProofProjection=true;renderWalkthrough=wrapped;if(typeof walkthroughNavigateProof==='function'){previousNavigate=walkthroughNavigateProof;const nav=function(delta){const result=previousNavigate(delta);decorate();return result};nav.__quadludCausalProofProjection=true;walkthroughNavigateProof=nav}installed=true;decorate();return true}
return Object.freeze({VERSION,install,decorate,projectionForMove,_test:Object.freeze({causalStep,premiseCells,uniqueCells,projectionForMove,sameCell})});
});
