/*
 * QUADLUD — Soleil/Lune human proof cost and relation evidence bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const VERSION=3;
const ABSTRACT_HUMAN_RULES=new Set(['LINE_DOMAIN_SUPPORT']);
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1])}
function sameEdge(a,b){return a&&b&&Number(a.parity)===Number(b.parity)&&((sameCell(a.a,b.a)&&sameCell(a.b,b.b))||(sameCell(a.a,b.b)&&sameCell(a.b,b.a)))}
function deductionKey(d){return String(d?.signature||d?.id||JSON.stringify([d?.rule,d?.conclusions||[]]))}
function concludesMove(d,target,value){return !!(d?.conclusions||[]).some(c=>c?.type==='VALUE'&&sameCell(c.cell,target)&&Number(c.value)===Number(value))}
function relationFactForEdge(session,edge){
  if(!session?.relationFacts?.values||!edge)return null;
  for(const fact of session.relationFacts.values())if(sameEdge(fact,edge))return fact;
  return null
}
function enrichedRelationPath(session,path){
  return (path||[]).map(raw=>{
    const edge=copy(raw),fact=relationFactForEdge(session,raw);if(!fact)return edge;
    edge.explicit=!!fact.explicit;edge.source=fact.source||null;edge.deductionId=fact.deductionId||null;edge.dependencies=[...(fact.dependencies||[])];
    if(edge.deductionId&&Array.isArray(session?.appliedDeductions)){
      const support=session.appliedDeductions.find(d=>String(d?.id||'')===String(edge.deductionId));if(support)edge.support=copy(support)
    }
    return edge
  })
}
function installRelationEvidence(){
  const Logic=root.TangoLogic||root.QuadludTangoLogic,Session=Logic?.Session;
  if(!Session?.prototype||typeof Session.prototype.relationPremise!=='function')return false;
  const current=Session.prototype.relationPremise;if(current.__quadludRelationEvidencePath===true)return true;
  const wrapped=function(f){
    const premise=current.call(this,f);if(!premise)return premise;
    if(Array.isArray(f?.path)&&f.path.length)premise.path=enrichedRelationPath(this,f.path);
    if(!premise.explicit&&f?.baseId){premise.baseId=f.baseId}
    return premise
  };
  wrapped.__quadludRelationEvidencePath=true;wrapped.__quadludPrevious=current;Session.prototype.relationPremise=wrapped;return true
}
function relationForDeduction(session,d){
  if(d?.rule!=='RELATION_PROPAGATION'||typeof session?.relationBetween!=='function')return null;
  const source=d?.explanationData?.source,target=d?.explanationData?.target;if(!Array.isArray(source)||!Array.isArray(target))return null;
  return session.relationBetween(source,target)||null
}
function relationDerivedSupportPenalty(session,d){
  const rel=relationForDeduction(session,d);if(!rel)return 0;
  const path=Array.isArray(rel.path)?rel.path:[];
  if(!path.length)return rel.explicit===false?1:0;
  return path.reduce((sum,edge)=>sum+(edge?.explicit===false?1:0),0)
}
function baseHumanProofCost(source,session,d){
  const value=source?._test?.humanProofCost?source._test.humanProofCost(session,d?[d]:[]):[1,0,1,0,0,0];return Array.isArray(value)?value.slice():[1,0,1,0,0,0]
}
function relationAwareHumanProofCost(source,session,d){
  const cost=baseHumanProofCost(source,session,d),support=relationDerivedSupportPenalty(session,d);if(!support)return cost;
  cost[0]=(Number(cost[0])||0)+support;cost[1]=(Number(cost[1])||0)+support;cost[5]=(Number(cost[5])||0)+support;return cost
}
function advancedTraceGroups(d){
  const x=d?.explanationData||{};
  if(d?.rule==='ASSUMPTION_CONTRADICTION')return [Array.isArray(x.causalTrace)?x.causalTrace:(x.trace||[])];
  if(d?.rule==='COMMON_CONSEQUENCE')return [x.moonCausalTrace||x.moonTrace||[],x.sunCausalTrace||x.sunTrace||[]];
  return []
}
function advancedHumanProofCost(source,session,d){
  const base=relationAwareHumanProofCost(source,session,d),groups=advancedTraceGroups(d);
  if(!groups.length)return base;
  const trace=groups.flat().filter(Boolean),traceCost=source?._test?.humanProofCost?source._test.humanProofCost(session,trace):[trace.length,0,1,0,0,0];
  const atomicExtra=trace.reduce((sum,step)=>sum+(ABSTRACT_HUMAN_RULES.has(String(step?.rule||''))?Math.max(0,(step?.conclusions||[]).length-1):0)+relationDerivedSupportPenalty(session,step),0);
  return [
    3+(Number(traceCost?.[0])||0)+atomicExtra,
    Math.max(Number(base?.[1])||0,Number(traceCost?.[1])||0),
    Math.max(Number(base?.[2])||1,Number(traceCost?.[2])||1),
    Math.max(Number(base?.[3])||0,Number(traceCost?.[3])||0),
    Math.max(Number(base?.[4])||0,Number(traceCost?.[4])||0),
    (Number(base?.[5])||0)+(Number(traceCost?.[5])||0)+atomicExtra
  ]
}
function compareCosts(source,a,b){return typeof source?._test?.compareCostVector==='function'?source._test.compareCostVector(a,b):(()=>{for(let i=0;i<Math.max(a?.length||0,b?.length||0);i++){const x=Number(a?.[i])||0,y=Number(b?.[i])||0;if(x!==y)return x-y}return 0})()}
function displayDeduction(source,d){return typeof source?._test?.minimalDisplayDeduction==='function'?source._test.minimalDisplayDeduction(d):copy(d)}
function selfContainedDirectCandidates(source,session,target,value){
  if(!session||typeof session.directDeductions!=='function'||!Array.isArray(target)||(value!==0&&value!==1))return [];
  const seen=new Set(),out=[];for(const raw of session.directDeductions()||[]){if(!raw||!concludesMove(raw,target,value))continue;const key=deductionKey(raw);if(seen.has(key))continue;seen.add(key);const deduction=displayDeduction(source,raw),cost=relationAwareHumanProofCost(source,session,deduction);out.push({deduction,cost})}
  return out.sort((a,b)=>compareCosts(source,a.cost,b.cost)||deductionKey(a.deduction).localeCompare(deductionKey(b.deduction)))
}
function correctedProof(source,session,plan,rawProof){
  const proof=copy(rawProof)||{};if(!proof?.deduction)return proof;
  const currentCost=advancedTraceGroups(proof.deduction).length?advancedHumanProofCost(source,session,proof.deduction):relationAwareHumanProofCost(source,session,proof.deduction);
  proof.costVector=currentCost;proof.humanRelationSupportCostCorrected=true;
  if(plan?.status!=='move'||!Array.isArray(plan.target)||(plan.value!==0&&plan.value!==1))return proof;
  const best=selfContainedDirectCandidates(source,session,plan.target,plan.value)[0]||null;if(!best||compareCosts(source,best.cost,currentCost)>=0||deductionKey(best.deduction)===deductionKey(proof.deduction))return proof;
  return {...proof,kind:'simpler-self-contained-direct-proof',target:plan.target.slice(),value:plan.value,deduction:copy(best.deduction),displayDeductions:[copy(best.deduction)],replaced:true,replacedRule:String(proof.deduction?.rule||''),replacedCostVector:currentCost,costVector:best.cost,humanRelationSupportCostCorrected:true}
}
function install(){
  const relationInstalled=installRelationEvidence(),source=root.QuadludTangoPlayedMoveRuntime;
  if(!source||typeof source.selectDisplayProof!=='function')return relationInstalled;
  if(source.__quadludHumanCostCorrectionV3===true)return true;
  const previous=source.selectDisplayProof;
  const replacement={...source,selectDisplayProof(session,plan){return Object.freeze(correctedProof(source,session,plan,previous.call(source,session,plan)))},_test:Object.freeze({...source._test,advancedTraceGroups,advancedHumanProofCost,relationDerivedSupportPenalty,relationAwareHumanProofCost,selfContainedDirectCandidates,correctedProof,enrichedRelationPath,relationFactForEdge}),__quadludHumanCostCorrection:true,__quadludHumanCostCorrectionV3:true};
  root.QuadludTangoPlayedMoveRuntime=Object.freeze(replacement);return true
}
const api=Object.freeze({VERSION,install,installRelationEvidence,_test:Object.freeze({advancedTraceGroups,advancedHumanProofCost,relationDerivedSupportPenalty,relationAwareHumanProofCost,selfContainedDirectCandidates,correctedProof,enrichedRelationPath,relationFactForEdge})});
root.QuadludTangoHumanCostBridge=api;
if(typeof document!=='undefined')install();
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
