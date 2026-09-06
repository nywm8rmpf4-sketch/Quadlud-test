/*
 * QUADLUD — generic human-oriented next-move policy
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludPedagogyNextMovePolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION=1;
const COST_MODEL='pedagogy-easiest-next-attention-v1';

function isCell(cell){return Array.isArray(cell)&&cell.length>=2&&Number.isInteger(Number(cell[0]))&&Number.isInteger(Number(cell[1]))}
function cellKey(cell){return `${Number(cell[0])}:${Number(cell[1])}`}
function uniqCells(cells){const seen=new Set(),out=[];for(const cell of cells||[]){if(!isCell(cell))continue;const normalized=[Number(cell[0]),Number(cell[1])],key=cellKey(normalized);if(seen.has(key))continue;seen.add(key);out.push(normalized)}return out}
function compareStrings(a,b){return String(a||'').localeCompare(String(b||''))}
function compareVectors(a,b){for(let i=0;i<Math.max(a?.length||0,b?.length||0);i++){const x=Number(a?.[i])||0,y=Number(b?.[i])||0;if(x!==y)return x-y}return 0}
function manhattan(a,b){return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])}
function minAttentionDistance(target,focusCells,recentCells){
  if(!recentCells.length)return 0;
  const probes=uniqCells([...(isCell(target)?[target]:[]),...(focusCells||[])]);
  if(!probes.length)return 999;
  let best=999;for(const probe of probes)for(const recent of recentCells)best=Math.min(best,manhattan(probe,recent));return best
}
function contextualMetrics(candidate,context={}){
  const recentCells=uniqCells(context.recentCells||[]),premiseCells=uniqCells(candidate.premiseCells||[]),focusCells=uniqCells(candidate.focusCells||[]),recentKeys=new Set(recentCells.map(cellKey));
  const reusedPremiseCount=premiseCells.filter(cell=>recentKeys.has(cellKey(cell))).length;
  const novelPremiseCount=Math.max(0,premiseCells.length-reusedPremiseCount);
  const continuityPenalty=recentCells.length?(reusedPremiseCount>0?0:1):0;
  const attentionDistance=minAttentionDistance(candidate.target,focusCells,recentCells);
  return Object.freeze({recentCellCount:recentCells.length,premiseCount:premiseCells.length,reusedPremiseCount,novelPremiseCount,continuityPenalty,attentionDistance});
}
function contextualCost(candidate,context={}){
  const base=(candidate.baseCost||[]).map(x=>Math.max(0,Number(x)||0)),m=contextualMetrics(candidate,context);
  // Structural proof complexity stays first. Once comparable, prefer a proof
  // reusing the immediately demonstrated facts, then minimize attention shift.
  const structural=[base[0]||0,base[1]||0,base[2]||0];
  const residual=base.slice(4);
  return Object.freeze([...structural,m.continuityPenalty,m.novelPremiseCount,m.attentionDistance,...residual,base[3]||0]);
}
function rank(candidates,context={}){
  if(!Array.isArray(candidates))throw new TypeError('Pedagogy next-move candidates must be an array');
  const scored=candidates.map((candidate,index)=>{
    if(!candidate||typeof candidate!=='object')throw new TypeError(`Pedagogy next-move candidate ${index} must be an object`);
    if(!Array.isArray(candidate.baseCost)||!candidate.baseCost.length)throw new TypeError(`Pedagogy next-move candidate ${index} must expose baseCost`);
    const metrics=contextualMetrics(candidate,context),costVector=contextualCost(candidate,context);
    return Object.freeze({...candidate,metrics,costModel:COST_MODEL,costVector});
  }).sort((a,b)=>compareVectors(a.costVector,b.costVector)||compareStrings(a.stableKey||a.id,b.stableKey||b.id));
  return Object.freeze({schema:1,costModel:COST_MODEL,selected:scored[0]||null,ranked:Object.freeze(scored)});
}

return Object.freeze({VERSION,COST_MODEL,rank,contextualCost,contextualMetrics,_test:Object.freeze({uniqCells,minAttentionDistance,compareVectors})});
});
