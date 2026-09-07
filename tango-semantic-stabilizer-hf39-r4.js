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

const VERSION=1;
const TOKEN='3.1.9-hf3.9-r4';

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

function stabilize(){
  if(!isTangoTutor())return false;
  try{root.QuadludTangoSemanticCoherenceHF39?.decorate?.()}catch(_){ }
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

function install(){return installRender()&&installNavigation()}

function scheduleInstall(){
  let tries=320,timer=null;
  const retry=()=>{const ok=install();if(ok){if(timer!=null)clearTimeout(timer);stabilize();return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};
  retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}

return Object.freeze({VERSION,TOKEN,install,installRender,installNavigation,scheduleInstall,stabilize,_test:Object.freeze({locale,isTangoTutor,normalizeLateText,finalizePanelText,ensureActionVisible})});
});
