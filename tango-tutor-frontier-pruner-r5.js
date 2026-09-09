/*
 * QUADLUD — Soleil/Lune Tutor relation-frontier pruner R5.1b
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';

const VERSION=1;
const ATTENTION_VERSION=11;
const Previous=root.QuadludTangoPlayedMovePlanner;
const Difficulty=root.TangoDifficulty;
if(!Previous||!Previous._test||typeof Previous.nextPlayedMove!=='function')return;
const A=Previous._attentionTest||{};
const previousNextPlayedMove=Previous.nextPlayedMove.bind(Previous);
const DIFF_TO_TIER=Object.freeze({easy:0,medium:1,hard:2,expert:3,facile:0,moyen:1,difficile:2});

function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function tierIndex(diff){if(Number.isInteger(diff)&&diff>=0&&diff<=3)return diff;return DIFF_TO_TIER[String(diff||'').trim().toLowerCase()]}
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1])}
function tutorActive(){if(typeof document==='undefined')return true;return !!document.body?.classList?.contains('tutor-active')}
function relationOnlyDeduction(deduction){
  const conclusions=deduction?.conclusions||[];
  return conclusions.length>0&&conclusions.every(c=>c?.type==='RELATION'&&Array.isArray(c.a)&&Array.isArray(c.b)&&c.a.length===2&&c.b.length===2)
}
function visibleValueConclusion(session,deduction){
  const state=session?.state;if(!Array.isArray(state))return null;
  const values=[];
  for(const c of deduction?.conclusions||[]){
    if(c?.type!=='VALUE'||!Array.isArray(c.cell)||c.cell.length!==2)continue;
    const r=Number(c.cell[0]),col=Number(c.cell[1]),value=Number(c.value);
    if(!Number.isInteger(r)||!Number.isInteger(col)||(value!==0&&value!==1)||state?.[r]?.[col]!==-1)continue;
    values.push({target:[r,col],value});
  }
  values.sort((a,b)=>a.target[0]-b.target[0]||a.target[1]-b.target[1]||a.value-b.value);
  return values[0]||null
}
function lightApplyRelationDeduction(session,deduction){
  if(!relationOnlyDeduction(deduction)||typeof session?.addBaseRelation!=='function'||typeof session?.rebuildRelationClosure!=='function')return false;
  const applied=copy(deduction);applied.id='D'+(++session.dedSeq);let changed=false;
  for(const c of applied.conclusions){
    const parity=Number(c.parity),rank=Number(applied.rank)||0,old=typeof session.relationBetween==='function'?session.relationBetween(c.a,c.b):null;
    if(old&&Number(old.parity)===parity&&Number(old.rank)<=rank)continue;
    const fact=session.addBaseRelation(c.a,c.b,parity,{rank,deductionId:applied.id,dependencies:[applied.id],source:'derived'});
    if(session.relationConflict)return false;
    if(fact)changed=true;
  }
  if(!changed)return false;
  if(Array.isArray(session.appliedDeductions))session.appliedDeductions.push(applied);
  session.rebuildRelationClosure();
  return !session.relationConflict
}
function relationPlanningStateKey(session){
  const values=(session?.state||[]).map(row=>row.join(',')).join('/');
  const closure=session?.relationClosure;
  if(!closure||typeof closure.values!=='function')return null;
  const relations=[...closure.values()].map(rel=>{
    const a=rel?.a||[],b=rel?.b||[];
    return `${Number(a[0])}:${Number(a[1])}|${Number(b[0])}:${Number(b[1])}=${Number(rel?.parity)}@${Number(rel?.rank)||0}`;
  }).sort().join(';');
  return `${values}#${relations}`
}
function advancedAvailabilityLowerBound(session,tier,cache){
  if(!Difficulty||typeof Difficulty.nextAllowedDeduction!=='function')return null;
  const key=relationPlanningStateKey(session);if(!key)return null;
  if(cache.has(key))return cache.get(key);
  let next=null;try{next=Difficulty.nextAllowedDeduction(session,tier,false)}catch(_){return null}
  // The cached value is intentionally structural only. It is used solely to
  // establish that at least one additional engine step is necessary. No proof,
  // target, rank or provenance is reused across branches.
  const result={key,hasDeduction:!!next?.deduction,budgetHit:!!next?.budgetHit};
  cache.set(key,result);return result
}
function maxEngineStepsFor(session,options){return Number.isInteger(options?.maxEngineSteps)&&options.maxEngineSteps>0?options.maxEngineSteps:Math.max(24,Number(session?.n||6)*Number(session?.n||6)*2)}
function relationChainLowerBound(session,tier,firstDeduction,options,advancedCache){
  if(!session||typeof session.clone!=='function'||!relationOnlyDeduction(firstDeduction))return null;
  const fork=session.clone(),limit=maxEngineStepsFor(fork,options);let deduction=copy(firstDeduction);
  for(let step=1;step<=limit;step++){
    const visible=visibleValueConclusion(fork,deduction);if(visible)return {lowerBoundSteps:step,kind:'direct-value'};
    if(!lightApplyRelationDeduction(fork,deduction))return null;
    const direct=Previous._test.allowedDirectDeductions(fork,tier)||[];
    if(direct.length){deduction=copy(direct[0]);continue}
    // Whatever advanced proof may be selected from this logical state, a real
    // move cannot occur before at least one more engine deduction. Availability
    // is deliberately verified only by certified hydration below: probing it
    // here would solve every discarded branch before the lower bound can prune.
    return {lowerBoundSteps:step+1,kind:'advanced-lower-bound'}
  }
  return null
}
function candidateLimitFor(session,options){
  if(typeof A.candidateLimitFor==='function')return A.candidateLimitFor(session,options);
  return Number.isInteger(options?.maxCandidatePlans)&&options.maxCandidatePlans>0?options.maxCandidatePlans:Math.max(24,Number(session?.n||6)*Number(session?.n||6)*2)
}
function evaluateRelationFrontier(session,tier,deductions,options={}){
  if(tier<3||!Difficulty||typeof Difficulty.nextAllowedDeduction!=='function'||typeof Previous._test.planFromFirstDeduction!=='function'||typeof Previous._test.selectPlans!=='function')return null;
  const limit=candidateLimitFor(session,options),chosen=(deductions||[]).slice(0,limit);
  if(!chosen.length||!chosen.every(relationOnlyDeduction))return null;
  const advancedCache=new Map(),estimates=[];
  for(const deduction of chosen){
    const estimate=relationChainLowerBound(session,tier,deduction,options,advancedCache);if(!estimate)return null;
    estimates.push({deduction,lowerBoundSteps:estimate.lowerBoundSteps})
  }
  const bounds=[...new Set(estimates.map(x=>x.lowerBoundSteps))].sort((a,b)=>a-b),plans=[];let bestActual=Infinity,hydrated=0;
  for(const bound of bounds){
    if(bound>bestActual)break;
    for(const item of estimates.filter(x=>x.lowerBoundSteps===bound)){
      const plan=Previous._test.planFromFirstDeduction(session,tier,copy(item.deduction),{...options,advancedStart:false,initialStateValidated:true});hydrated++;
      if(plan?.status==='blocked')continue;
      if(plan?.status!=='move')return null;
      const actual=Math.max(1,Number(plan.engineStepCount)||1);
      if(actual<bound)return null;
      if(actual<bestActual){bestActual=actual;plans.length=0;plans.push(plan)}
      else if(actual===bestActual)plans.push(plan)
    }
  }
  if(!plans.length||!Number.isFinite(bestActual))return null;
  return {
    plans,
    truncated:(deductions||[]).length>chosen.length,
    branchBudgetHit:false,
    evaluated:chosen.length,
    total:(deductions||[]).length,
    relationFrontierPruned:true,
    estimatedCandidateCount:estimates.length,
    hydratedCandidateCount:hydrated,
    prunedCandidateCount:Math.max(0,estimates.length-hydrated),
    advancedStateCount:advancedCache.size,
    provenMinimumEngineStepCount:bestActual
  }
}
function optimizedTutorPlan(session,diff,options,context){
  if(!tutorActive()||!context||((context.pendingConclusions||[]).length>0))return null;
  const tier=tierIndex(diff);if(tier!==3)return null;
  const direct=Previous._test.allowedDirectDeductions(session,tier)||[];
  if(!direct.length||!direct.every(relationOnlyDeduction))return null;
  let bad=null;try{bad=typeof session.diagnose==='function'?session.diagnose():null}catch(_){return null}
  if(bad)return null;
  const evaluation=evaluateRelationFrontier(session,tier,direct,{...options,initialStateValidated:true});if(!evaluation?.plans?.length)return null;
  const frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit,selected=Previous._test.selectPlans(evaluation.plans,{frontierComplete});
  if(!selected?.plan||!selected?.selection?.selected)return null;
  return {
    ...copy(selected.plan),
    selectionStatus:selected.selection.status,
    selectedCostVector:copy(selected.selection.selected.costVector),
    candidateCount:selected.candidates.length,
    frontierComplete,
    budgetHit:!frontierComplete,
    relationFrontierPruned:true,
    relationFrontierEstimatedCandidateCount:evaluation.estimatedCandidateCount,
    relationFrontierHydratedCandidateCount:evaluation.hydratedCandidateCount,
    relationFrontierPrunedCandidateCount:evaluation.prunedCandidateCount,
    relationFrontierAdvancedStateCount:evaluation.advancedStateCount,
    relationFrontierMinimumEngineStepCount:evaluation.provenMinimumEngineStepCount
  }
}
function nextPlayedMove(session,diff,options={}){
  let context=null;try{context=typeof A.tutorRecentContext==='function'?A.tutorRecentContext():null}catch(_){context=null}
  if(!context||(!(context.recentCells||[]).length&&!(context.pendingConclusions||[]).length))return previousNextPlayedMove(session,diff,options);
  try{const optimized=optimizedTutorPlan(session,diff,options,context);if(optimized)return optimized}catch(_){/* fail safely to R5.1b bridge v10 */}
  return previousNextPlayedMove(session,diff,options)
}

root.QuadludTangoPlayedMovePlanner=Object.freeze({
  ...Previous,
  nextPlayedMove,
  attentionContinuityVersion:ATTENTION_VERSION,
  relationFrontierPrunerVersion:VERSION,
  _attentionTest:Object.freeze({...A,relationOnlyDeduction,visibleValueConclusion,lightApplyRelationDeduction,relationPlanningStateKey,advancedAvailabilityLowerBound,relationChainLowerBound,evaluateRelationFrontier,optimizedTutorPlan})
});
})(typeof globalThis!=='undefined'?globalThis:this);
