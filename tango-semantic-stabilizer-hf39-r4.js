/*
 * QUADLUD — Soleil/Lune final semantic stabilizer HF3.9-R4
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoSemanticStabilizerHF39R4=api;
  if(typeof document!=='undefined')api.scheduleInstall();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=3;
const TOKEN='3.1.9-hf3.9-r4-marker-projection-v3-causal-closure';

function locale(){
  try{return String(typeof lang==='function'?lang():root.document?.documentElement?.lang||'en').toLowerCase().split('-')[0]}
  catch(_){return'en'}
}

function isTangoTutor(){
  try{return typeof walkthroughSession!=='undefined'&&walkthroughSession?.base?.game==='tango'}
  catch(_){return false}
}

function normalizeLateText(text){
  let source=String(text??'');
  const finalizer=root.QuadludTangoPedagogyTextFinalizer?._test?.finalizeInlineText;
  if(typeof finalizer==='function'){
    try{source=finalizer(source)}catch(_){ }
  }
  if(locale()!=='fr')return source;
  source=source.replace(/\b(Une\s+troisième\s+lune\b[^.!?;]*?)\best interdit\b/giu,'$1est interdite');
  source=source.replace(/^(\s*)la\s+(ligne|colonne)\b/iu,(_,space,noun)=>`${space}La ${String(noun).toLowerCase()}`);
  return source
}

function finalizePanelText(panel){
  if(!panel||!root.document?.createTreeWalker)return false;
  const walker=root.document.createTreeWalker(panel,root.NodeFilter?.SHOW_TEXT||4),nodes=[];let node;
  while((node=walker.nextNode()))nodes.push(node);
  let changed=false;
  for(const n of nodes){const next=normalizeLateText(n.nodeValue);if(next!==n.nodeValue){n.nodeValue=next;changed=true}}
  return changed
}

function ensureActionVisible(panel){
  if(!panel||String(panel.dataset?.proofStageKind||'')!=='action')return false;
  const scroll=panel.querySelector?.('.walkthrough-scroll'),move=panel.querySelector?.('.walkthrough-move');
  if(!scroll||!move||typeof scroll.getBoundingClientRect!=='function'||typeof move.getBoundingClientRect!=='function')return false;
  const sr=scroll.getBoundingClientRect(),mr=move.getBoundingClientRect(),margin=8;
  if(!sr||!mr||!(Number(mr.height)>0))return false;
  const current=Number(scroll.scrollTop)||0,max=Math.max(0,(Number(scroll.scrollHeight)||0)-(Number(scroll.clientHeight)||0));
  let next=current;
  if(Number(mr.bottom)>Number(sr.bottom)-margin)next+=Number(mr.bottom)-(Number(sr.bottom)-margin);
  else if(Number(mr.top)<Number(sr.top)+margin)next-=Number(sr.top)+margin-Number(mr.top);
  next=Math.max(0,Math.min(max,next));
  if(Math.abs(next-current)>=1)scroll.scrollTop=next;
  return true
}

function entryDeduction(entry){return entry?.deduction||entry?.presentation?.evidence?.primary||null}
function stageKind(entry){return String(entry?.pedagogyStageKind||entry?.proofStage?.kind||'')}
function causalAtomicTest(){return root.QuadludTangoTutorCausalAtomicR55?._test||null}
function presenter(){try{return typeof tangoReasoningPresenter==='function'?tangoReasoningPresenter():null}catch(_){return null}}
function addAvailableRelations(entry,available,test){
  const d=entryDeduction(entry);if(!d||!available||typeof test?.relationKey!=='function')return false;let changed=false;
  for(const c of d.conclusions||[]){if(c?.type!=='RELATION'||!Array.isArray(c.a)||!Array.isArray(c.b))continue;const parity=typeof test.relationParity==='function'?test.relationParity(c):Number(c.parity);if(parity!==0&&parity!==1)continue;const key=test.relationKey(c.a,c.b,parity);if(!available.has(key)){available.add(key);changed=true}}
  return changed
}
function refreshSupportedPropagation(entry,p,test){
  const d=entryDeduction(entry);if(stageKind(entry)!=='reasoning'||String(d?.rule||'')!=='RELATION_PROPAGATION'||!p)return entry;
  let complete=null;try{complete=typeof test?.clarityComplete==='function'?test.clarityComplete(d):null}catch(_){complete=false}if(complete!==true)return entry;
  let presentation=null,reasoning=d;try{presentation=p.presentation?.(d)||entry.presentation}catch(_){presentation=entry.presentation}try{reasoning=p.legacyReasoning?.(d)||d}catch(_){reasoning=d}
  const next={...entry,deduction:reasoning,presentation:JSON.parse(JSON.stringify(presentation||entry.presentation||{})),proofCompleteness:'complete-derived-relation-provenance'};
  next.presentation.metadata={...(next.presentation.metadata||{}),proofCompleteness:'complete-derived-relation-provenance',localProvenanceComplete:true};
  next.where=next.presentation?.explanation?.where||entry.where||'';next.why=next.presentation?.explanation?.why||entry.why||'';
  return next
}
function closeSupportedDerivedRelations(s,start){
  if(!s||s.base?.game!=='tango'||!Array.isArray(s.moves)||start<0||start>=s.moves.length)return false;
  const test=causalAtomicTest(),p=presenter();if(typeof test?.planRelationProofs!=='function'||typeof test?.attachCausalProof!=='function'||!p)return false;
  const prefix=s.moves.slice(0,start),raw=s.moves.slice(start),available=new Set();for(const entry of prefix)addAvailableRelations(entry,available,test);
  const out=[];let changed=false;
  for(const original of raw){
    const d=entryDeduction(original);let expanded=[original];
    if(stageKind(original)==='reasoning'&&String(d?.rule||'')==='RELATION_PROPAGATION'){
      try{expanded=test.planRelationProofs(original,available,p)||[original]}catch(_){expanded=[original]}
      if(expanded.length!==1||expanded[0]!==original)changed=true;
    }
    for(let i=0;i<expanded.length;i++){
      let entry=expanded[i];if(i===expanded.length-1){const refreshed=refreshSupportedPropagation(entry,p,test);if(refreshed!==entry){entry=refreshed;changed=true}}
      out.push(entry);addAvailableRelations(entry,available,test)
    }
  }
  if(!changed)return false;let rebuilt=out;try{rebuilt=test.attachCausalProof(out)}catch(_){rebuilt=out}s.moves.splice(start,raw.length,...rebuilt);if(s.done)s.total=s.moves.length;return true
}
function chainHas(fn,marker){let current=fn,guard=0;while(typeof current==='function'&&guard++<40){if(current[marker]===true)return true;current=current.__quadludPrevious}return false}
function installCausalClosure(){
  const previous=root.walkthroughGenerateTangoNext;if(typeof previous!=='function'||!root.QuadludTangoTutorCausalAtomicR55)return false;if(chainHas(previous,'__quadludSemanticCausalClosureHF39R4'))return true;if(!chainHas(previous,'__quadludTutorCausalAtomicR55'))return false;
  const wrapped=function(...args){let s=null;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){s=null}const start=Array.isArray(s?.moves)?s.moves.length:0,result=previous(...args);if(result&&s?.base?.game==='tango')closeSupportedDerivedRelations(s,start);return result};
  wrapped.__quadludSemanticCausalClosureHF39R4=true;wrapped.__quadludPrevious=previous;root.walkthroughGenerateTangoNext=wrapped;return true
}

function stabilize(){
  if(!isTangoTutor())return false;
  try{root.QuadludTangoSemanticCoherenceHF39?.decorate?.()}catch(_){ }
  // Semantic coherence rebuilds the canonical overlay first. Reapply the
  // non-mutating R5.4 causal projection afterwards so an implicit consequence
  // keeps its chronological badge (for example the explicit-relation sibling
  // inserted between two engine trace entries).
  try{root.QuadludTangoTutorHumanRegressionR54?.decorate?.()}catch(_){ }
  const panel=root.document?.querySelector?.('.walkthrough-panel');if(!panel)return false;
  finalizePanelText(panel);
  ensureActionVisible(panel);
  return true
}

function installRender(){
  const previous=root.renderWalkthrough;if(typeof previous!=='function')return false;
  if(previous.__quadludSemanticStabilizerHF39R4===true)return true;
  const wrapped=function(...args){const result=previous(...args);stabilize();return result};
  wrapped.__quadludSemanticStabilizerHF39R4=true;wrapped.__quadludPrevious=previous;root.renderWalkthrough=wrapped;return true
}

function installNavigation(){
  const previous=root.walkthroughNavigateProof;if(typeof previous!=='function')return false;
  if(previous.__quadludSemanticStabilizerHF39R4===true)return true;
  const wrapped=function(...args){const result=previous(...args);stabilize();return result};
  wrapped.__quadludSemanticStabilizerHF39R4=true;wrapped.__quadludPrevious=previous;root.walkthroughNavigateProof=wrapped;return true
}

function install(){const stable=installRender()&&installNavigation();installCausalClosure();return stable}

function scheduleInstall(){
  let tries=320,timer=null;
  const retry=()=>{const ok=install();if(ok){if(timer!=null)clearTimeout(timer);stabilize();return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};
  retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}

return Object.freeze({VERSION,TOKEN,install,installRender,installNavigation,installCausalClosure,scheduleInstall,stabilize,closeSupportedDerivedRelations,_test:Object.freeze({locale,isTangoTutor,normalizeLateText,finalizePanelText,ensureActionVisible,entryDeduction,stageKind,addAvailableRelations,refreshSupportedPropagation,closeSupportedDerivedRelations,chainHas})});
});
