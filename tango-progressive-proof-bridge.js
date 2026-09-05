/*
 * QUADLUD — Soleil/Lune progressive proof compatibility bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const VERSION=1;
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function session(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function presenter(){try{return typeof tangoReasoningPresenter==='function'?tangoReasoningPresenter():null}catch(_){return null}}
function proofStages(d,p){
  const fn=root.QuadludTangoHumanPedagogyR4?._test?.proofStagesForDeduction;
  if(typeof fn!=='function'||!d||!p)return [];
  try{return fn(d,p)||[]}catch(_){return []}
}
function expandSingleAdvancedEntry(s,start){
  if(!s||!Array.isArray(s.moves)||s.moves.length-start!==1)return false;
  const original=s.moves[start],d=original?.deduction||original?.presentation?.evidence?.primary||null;
  if(!d||!['ASSUMPTION_CONTRADICTION','COMMON_CONSEQUENCE'].includes(String(d.rule||'')))return false;
  const p=presenter(),stages=proofStages(d,p);if(stages.length<=1)return false;
  const before=copy(original.beforeSnapshot||original.proofSnapshot||s.initial),final=copy(original.snapshot),target=Array.isArray(original.target)?original.target.slice():null;
  const replacements=stages.map((stage,index)=>{
    const last=index===stages.length-1,presentation=stage.presentation||p.presentation(stage.deduction),reasoning=p.legacyReasoning(stage.deduction),next={...copy(original),presentation,deduction:reasoning,where:presentation?.explanation?.where||'',why:presentation?.explanation?.why||'',move:last?(presentation?.explanation?.move||original.move||''):'',pedagogyStageKind:stage.kind||'reasoning',beforeSnapshot:copy(before),proofSnapshot:copy(last?final:before),snapshot:copy(last?final:before)};
    if(target)next.target=target.slice();return next
  });
  s.moves.splice(start,1,...replacements);s.tangoTutorStatus='human-progressive-bridge';return true
}
function install(){
  const previous=root.walkthroughGenerateTangoNext;if(typeof previous!=='function')return false;if(previous.__quadludProgressiveProofBridge===true)return true;
  const wrapped=function(){const s=session(),start=Array.isArray(s?.moves)?s.moves.length:0,ok=previous();if(ok&&s?.base?.game==='tango')expandSingleAdvancedEntry(s,start);return ok};
  wrapped.__quadludProgressiveProofBridge=true;wrapped.__quadludPrevious=previous;root.walkthroughGenerateTangoNext=wrapped;return true
}
function scheduleInstall(){
  let tries=180,timer=null;const retry=()=>{if(install()){if(timer!=null)clearTimeout(timer);return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}
const api=Object.freeze({VERSION,install,scheduleInstall,_test:Object.freeze({expandSingleAdvancedEntry,proofStages})});root.QuadludTangoProgressiveProofBridge=api;if(typeof document!=='undefined')scheduleInstall();if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
