/*
 * QUADLUD — Soleil/Lune human proof cost and relation evidence bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const VERSION=2;
const ABSTRACT_HUMAN_RULES=new Set(['LINE_DOMAIN_SUPPORT']);
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function installRelationEvidence(){
  const Logic=root.TangoLogic||root.QuadludTangoLogic,Session=Logic?.Session;
  if(!Session?.prototype||typeof Session.prototype.relationPremise!=='function')return false;
  const current=Session.prototype.relationPremise;if(current.__quadludRelationEvidencePath===true)return true;
  const wrapped=function(f){const premise=current.call(this,f);if(premise&&Array.isArray(f?.path)&&f.path.length)premise.path=copy(f.path);return premise};
  wrapped.__quadludRelationEvidencePath=true;wrapped.__quadludPrevious=current;Session.prototype.relationPremise=wrapped;return true
}
function advancedTraceGroups(d){
  const x=d?.explanationData||{};
  if(d?.rule==='ASSUMPTION_CONTRADICTION')return [Array.isArray(x.causalTrace)?x.causalTrace:(x.trace||[])];
  if(d?.rule==='COMMON_CONSEQUENCE')return [x.moonCausalTrace||x.moonTrace||[],x.sunCausalTrace||x.sunTrace||[]];
  return []
}
function advancedHumanProofCost(source,session,d){
  const base=source?._test?.humanProofCost?source._test.humanProofCost(session,d?[d]:[]):[1,0,1,0,0,0],groups=advancedTraceGroups(d);
  if(!groups.length)return Array.isArray(base)?base.slice():[1,0,1,0,0,0];
  const trace=groups.flat().filter(Boolean),traceCost=source?._test?.humanProofCost?source._test.humanProofCost(session,trace):[trace.length,0,1,0,0,0];
  const atomicExtra=trace.reduce((sum,step)=>sum+(ABSTRACT_HUMAN_RULES.has(String(step?.rule||''))?Math.max(0,(step?.conclusions||[]).length-1):0),0);
  return [
    3+(Number(traceCost?.[0])||0)+atomicExtra,
    Math.max(Number(base?.[1])||0,Number(traceCost?.[1])||0),
    Math.max(Number(base?.[2])||1,Number(traceCost?.[2])||1),
    Math.max(Number(base?.[3])||0,Number(traceCost?.[3])||0),
    Math.max(Number(base?.[4])||0,Number(traceCost?.[4])||0),
    (Number(base?.[5])||0)+(Number(traceCost?.[5])||0)+atomicExtra
  ]
}
function install(){
  const relationInstalled=installRelationEvidence(),source=root.QuadludTangoPlayedMoveRuntime;
  if(!source||typeof source.selectDisplayProof!=='function')return relationInstalled;
  if(source.__quadludHumanCostCorrection===true)return true;
  const previous=source.selectDisplayProof;
  const replacement={...source,selectDisplayProof(session,plan){
    const proof=copy(previous.call(source,session,plan));
    if(proof?.deduction&&advancedTraceGroups(proof.deduction).length){proof.costVector=advancedHumanProofCost(source,session,proof.deduction);proof.humanStageCostCorrected=true}
    return Object.freeze(proof)
  },_test:Object.freeze({...source._test,advancedTraceGroups,advancedHumanProofCost}),__quadludHumanCostCorrection:true};
  root.QuadludTangoPlayedMoveRuntime=Object.freeze(replacement);return true
}
const api=Object.freeze({VERSION,install,installRelationEvidence,_test:Object.freeze({advancedTraceGroups,advancedHumanProofCost})});
root.QuadludTangoHumanCostBridge=api;
if(typeof document!=='undefined')install();
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
