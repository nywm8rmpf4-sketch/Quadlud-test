/*
 * QUADLUD — Soleil/Lune pilot for human-oriented next-move selection
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
(function(root){
'use strict';

const VERSION=1;
const Planner=root.QuadludTangoPlayedMovePlanner;
const Policy=root.QuadludPedagogyNextMovePolicy;
// The pilot is an optional Tango overlay. Partial game/runtime loaders used by
// another game must remain valid when Tango planning dependencies are absent.
if(!Planner||!Planner._test||typeof Planner.nextPlayedMove!=='function'||!Policy||typeof Policy.rank!=='function')return;
const originalNextPlayedMove=Planner.nextPlayedMove.bind(Planner);
const DIFF_TO_TIER=Object.freeze({easy:0,medium:1,hard:2,expert:3,facile:0,moyen:1,difficile:2});

function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function stateKey(state){return JSON.stringify(state||null)}
function changedVisibleCells(before,after){
  const out=[];if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length)return out;
  for(let r=0;r<before.length;r++)for(let c=0;c<(before[r]?.length||0);c++)if(before[r]?.[c]!==after[r]?.[c]&&(after[r]?.[c]===0||after[r]?.[c]===1))out.push([r,c]);
  return out
}
function tutorRecentCells(){
  let s=null;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return []}
  if(!s||s.base?.game!=='tango'||!Array.isArray(s.work?.state))return [];
  const current=s.work.state,currentKey=stateKey(current),moves=Array.isArray(s.moves)?s.moves:[];
  let previous=null;
  for(let i=moves.length-1;i>=0;i--){const candidate=moves[i]?.snapshot?.state;if(Array.isArray(candidate)&&stateKey(candidate)!==currentKey){previous=candidate;break}}
  if(!previous&&Array.isArray(s.initial?.state))previous=s.initial.state;
  const changed=changedVisibleCells(previous,current);if(changed.length)return changed;
  const targets=[];for(let i=moves.length-1;i>=0&&targets.length<4;i--){const target=moves[i]?.target;if(Array.isArray(target)&&target.length===2)targets.push(target.slice())}
  return Policy._test.uniqCells(targets)
}
function tierIndex(diff){if(Number.isInteger(diff)&&diff>=0&&diff<=3)return diff;return DIFF_TO_TIER[String(diff||'').trim().toLowerCase()]}
function addCell(out,cell){if(Array.isArray(cell)&&cell.length>=2&&Number.isInteger(Number(cell[0]))&&Number.isInteger(Number(cell[1])))out.push([Number(cell[0]),Number(cell[1])])}
function collectCells(value,out,depth=0){
  if(value==null||depth>6)return;if(Array.isArray(value)){if(value.length>=2&&Number.isInteger(Number(value[0]))&&Number.isInteger(Number(value[1]))){addCell(out,value);return}for(const child of value)collectCells(child,out,depth+1);return}if(typeof value!=='object')return;
  for(const key of ['cell','a','b','target','source'])addCell(out,value[key]);for(const key of ['cells','focusCells','window','pair','targets'])if(Array.isArray(value[key]))for(const child of value[key])collectCells(child,out,depth+1)
}
function planCells(plan){
  const premises=[],focus=[];for(const deduction of plan?.proofChain||[]){for(const p of deduction?.premises||[])collectCells(p,premises);for(const c of deduction?.focusCells||[])addCell(focus,c)}
  if(plan?.deduction){for(const p of plan.deduction.premises||[])collectCells(p,premises);for(const c of plan.deduction.focusCells||[])addCell(focus,c)}
  return {premiseCells:Policy._test.uniqCells(premises),focusCells:Policy._test.uniqCells(focus)}
}
function contextualDirectPlan(session,diff,options,contextCells){
  const tier=tierIndex(diff);if(!Number.isInteger(tier)||!contextCells.length)return null;
  const direct=Planner._test.allowedDirectDeductions(session,tier),evaluation=Planner._test.evaluateStartingDeductions(session,tier,direct,options,false);if(!evaluation.plans.length)return null;
  const selectorCandidates=Planner._test.buildSelectorCandidates(evaluation.plans),activeIds=new Set(selectorCandidates.map(c=>c.id)),blocked=new Set(selectorCandidates.filter(c=>(c.blockedBy||[]).some(id=>activeIds.has(id))).map(c=>c.id));
  const frontier=selectorCandidates.filter(c=>!blocked.has(c.id));if(!frontier.length)return null;
  const policyCandidates=frontier.map(c=>{const cells=planCells(c.plan);return {id:c.id,stableKey:c.stableKey,baseCost:Planner._test.planCostVector(c.plan),target:c.plan.target,premiseCells:cells.premiseCells,focusCells:cells.focusCells,payload:c.plan}});
  const ranked=Policy.rank(policyCandidates,{recentCells:contextCells}),selected=ranked.selected;if(!selected?.payload)return null;
  const frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit;
  return {...copy(selected.payload),selectionStatus:frontierComplete?'PROVEN_MINIMUM_CONTEXTUAL':'BEST_AVAILABLE_CONTEXTUAL_BUDGET_LIMITED',selectedCostVector:selected.costVector.slice(),candidateCount:frontier.length,frontierComplete,budgetHit:!frontierComplete,humanNextMovePolicy:ranked.costModel,humanNextMoveMetrics:copy(selected.metrics),humanRecentCells:copy(contextCells)}
}
function nextPlayedMove(session,diff,options={}){
  const context=tutorRecentCells();if(!context.length)return originalNextPlayedMove(session,diff,options);
  try{const contextual=contextualDirectPlan(session,diff,options,context);if(contextual)return contextual}catch(_){/* fail safely to certified baseline planner */}
  return originalNextPlayedMove(session,diff,options)
}

root.QuadludTangoPlayedMovePlanner=Object.freeze({...Planner,nextPlayedMove,attentionContinuityVersion:VERSION,_attentionTest:Object.freeze({tutorRecentCells,changedVisibleCells,planCells,contextualDirectPlan})});
})(typeof globalThis!=='undefined'?globalThis:this);
