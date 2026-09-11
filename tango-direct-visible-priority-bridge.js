/*
 * QUADLUD — Soleil-Lune direct-visible Tutor priority bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const VERSION=1;
const TOKEN='3.1.9-direct-visible-priority-r1';
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const moveKey=p=>Array.isArray(p?.target)?`${Number(p.target[0])},${Number(p.target[1])}:${Number(p.value)}`:'';
const stableKey=p=>`${String(p?.target?.[0]??999).padStart(3,'0')}:${String(p?.target?.[1]??999).padStart(3,'0')}:${Number(p?.value)}|${String(p?.startingDeduction?.signature||p?.deduction?.signature||p?.deduction?.id||'')}`;
function compareVector(a,b){for(let i=0;i<Math.max(a?.length||0,b?.length||0);i++){const x=Number(a?.[i])||0,y=Number(b?.[i])||0;if(x!==y)return x-y}return 0}
function directVisiblePlans(session,diff,options={}){
  const P=root.QuadludTangoPlayedMovePlanner,A=P?._attentionTest,T=P?._test;
  if(!P||!A||!T||typeof T.allowedDirectDeductions!=='function'||typeof A.directlyPlacesVisibleValue!=='function'||typeof A.directVisiblePlacements!=='function')return null;
  const tier=P.tierIndexForDifficulty(diff),direct=T.allowedDirectDeductions(session,tier),visible=direct.filter(d=>A.directlyPlacesVisibleValue(session,d)),plans=[];
  for(const deduction of visible){
    const placements=A.directVisiblePlacements(session,deduction)||[];
    for(const placement of placements){
      plans.push({status:'move',tierIndex:tier,...copy(placement),engineStepCount:1,advancedStart:false,startingDeduction:copy(deduction),directVisibleFastPath:true});
    }
  }
  return {tier,directCount:direct.length,visibleDeductionCount:visible.length,plans};
}
function scoreVisiblePlan(H,session,plan){
  const evaluate=H?._test?.evaluatePlanHumanProof;
  if(typeof evaluate!=='function')return null;
  const scored=evaluate(session,plan);if(!scored)return null;
  return {...scored,stableKey:scored.stableKey||stableKey(plan)};
}
function compareScored(a,b){return compareVector(a?.cost,b?.cost)||compareVector(a?.plannerCost,b?.plannerCost)||String(a?.stableKey||'').localeCompare(String(b?.stableKey||''))}
function chooseDirectVisible(H,session,diff,options={}){
  const frontier=directVisiblePlans(session,diff,options);if(!frontier||!frontier.plans.length)return null;
  const bestByMove=new Map();
  for(const plan of frontier.plans){const scored=scoreVisiblePlan(H,session,plan);if(!scored)continue;const key=moveKey(plan),old=bestByMove.get(key);if(!old||compareScored(scored,old)<0)bestByMove.set(key,scored)}
  const ranked=[...bestByMove.values()].sort(compareScored),chosen=ranked[0];if(!chosen)return null;
  const plan=copy(chosen.plan),proof=copy(chosen.displayProof),displayDeduction=proof?.deduction||copy(plan.deduction);
  return {...plan,displayProof:proof,displayDeduction,selectionStatus:'direct-visible-cognitive-minimum',selectedCostVector:Array.isArray(chosen.plannerCost)?chosen.plannerCost.slice():[],candidateCount:ranked.length,frontierComplete:true,budgetHit:false,humanGlobalSelection:true,humanCandidateCount:ranked.length,directVisibleFastPath:true,directVisibleDeductionCount:frontier.visibleDeductionCount,directVisibleOriginalDeductionCount:frontier.directCount,humanSignature:`${plan.target?.join(',')||''}:${plan.value}|${plan.startingDeduction?.signature||plan.deduction?.signature||plan.deduction?.id||''}|${proof?.kind||'engine-proof'}|direct-visible`}
}
function install(){
  const H=root.QuadludTangoHumanPedagogyR4;if(!H||typeof H.chooseGloballySimplestPlan!=='function')return false;if(H.__quadludDirectVisiblePriorityR1===true)return true;
  const previous=H.chooseGloballySimplestPlan.bind(H);
  const wrapped=function(session,diff,options={}){const fast=chooseDirectVisible(H,session,diff,options);return fast||previous(session,diff,options)};
  root.QuadludTangoHumanPedagogyR4=Object.freeze({...H,chooseGloballySimplestPlan:wrapped,_test:Object.freeze({...H._test,directVisiblePriorityPlans:directVisiblePlans,chooseDirectVisiblePriority:(session,diff,options={})=>chooseDirectVisible(H,session,diff,options)}),__quadludDirectVisiblePriorityR1:true,directVisiblePriorityToken:TOKEN});
  return true
}
const api=Object.freeze({VERSION,TOKEN,install,_test:Object.freeze({compareVector,directVisiblePlans,scoreVisiblePlan,compareScored,chooseDirectVisible})});
root.QuadludTangoDirectVisiblePriorityBridge=api;
if(typeof document!=='undefined')install();
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
