/*
 * QUADLUD — Soleil/Lune final pedagogical text projection
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoPedagogyTextFinalizer=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const VERSION=1;
const RAW_PIECE_RE=/(\bsun\b\s*[☀🌞]?|\bmoon\b\s*[☾🌙]?)/gi;
const INTERMEDIATE_RE=/(?:\s|^)(?:Conclusion intermédiaire|Intermediate conclusion)\s*:\s*[^.!?<]*(?:[.!?](?=\s|$)|$)/gi;
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
function locale(){try{return String(typeof lang==='function'?lang():root.document?.documentElement?.lang||'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function piece(value){try{if(typeof pieceName==='function'){const label=pieceName('tango',Number(value));if(label!=null&&String(label).trim())return String(label)}}catch(_){ }return Number(value)===1?(locale()==='fr'?'soleil ☀':'sun ☀'):(locale()==='fr'?'lune ☾':'moon ☾')}
function replaceRawPieces(text){return String(text??'').replace(RAW_PIECE_RE,match=>/^\s*sun\b/i.test(match)?piece(1):piece(0))}
function propositionKey(text){const m=String(text??'').match(/\b([A-Z]\d+)\s*=\s*([^.,;:<>]+)/i);if(!m)return null;let value=replaceRawPieces(m[2]).toLowerCase().replace(/[☀☾🌞🌙\s]/g,'');return `${m[1].toUpperCase()}=${value}`}
function stripIntermediate(text){return String(text??'').replace(INTERMEDIATE_RE,' ').replace(/\s{2,}/g,' ').trim()}
function dedupSemanticSentences(text){
  const source=String(text??''),parts=source.split(/(?<=[.!?])\s+/),out=[],seen=new Set();
  for(const part of parts){const key=propositionKey(part),isIntermediate=/\b(?:Conclusion intermédiaire|Intermediate conclusion)\b/i.test(part),isRepeatedConclusion=/^\s*(?:Donc|Therefore|Conclusion|Coup conseillé|Suggested move)(?:\s*:|\s|$)/i.test(part);if(isIntermediate)continue;if(key&&seen.has(key)&&isRepeatedConclusion)continue;if(key)seen.add(key);out.push(part)}
  return out.join(' ')
}
function finalizeText(text){return dedupSemanticSentences(stripIntermediate(replaceRawPieces(text)))}
function finalizeHtml(html){
  let source=String(html??'');source=source.replace(/<span\b[^>]*class=["'][^"']*\bconclusion\b[^"']*["'][^>]*>\s*(?:<b>)?\s*(?:Conclusion intermédiaire|Intermediate conclusion)[\s\S]*?<\/span>/gi,'');
  source=source.replace(/<p\b[^>]*>[\s\S]*?(?:Conclusion intermédiaire|Intermediate conclusion)[\s\S]*?<\/p>/gi,block=>{const plain=block.replace(/<[^>]+>/g,' ');return /(?:Conclusion intermédiaire|Intermediate conclusion)/i.test(plain)&&!/(?:Pourquoi|Why|Raisonnement|Reasoning)/i.test(plain)?'':block});
  return source.split(/(<[^>]+>)/g).map(part=>part.startsWith('<')?part:finalizeText(part)).join('')
}
function finalizeValue(value,depth=0){
  if(depth>8||value==null)return value;if(typeof value==='string')return finalizeText(value);if(Array.isArray(value))return value.map(v=>finalizeValue(v,depth+1));if(typeof value!=='object')return value;
  const out={};for(const [k,v] of Object.entries(value))out[k]=finalizeValue(v,depth+1);return out
}
function sanitizePresentation(presentation){return presentation&&typeof presentation==='object'?finalizeValue(copy(presentation)):presentation}
function currentTango(){try{return typeof current!=='undefined'&&current?.game==='tango'}catch(_){return false}}
function walkthroughIsTango(){try{return typeof walkthroughSession!=='undefined'&&walkthroughSession?.base?.game==='tango'}catch(_){return false}}
function finalizeTextNodes(scope){
  if(!scope||!root.document?.createTreeWalker)return false;const walker=root.document.createTreeWalker(scope,root.NodeFilter?.SHOW_TEXT||4),nodes=[];let node;while((node=walker.nextNode()))nodes.push(node);let changed=false;
  for(const n of nodes){const next=finalizeText(n.nodeValue);if(next!==n.nodeValue){n.nodeValue=next;changed=true}}
  scope.querySelectorAll?.('.reason-step.conclusion').forEach(el=>{if(/\b(?:Conclusion intermédiaire|Intermediate conclusion)\b/i.test(el.textContent||'')){el.remove();changed=true}});return changed
}
function finalizeRenderedDom(){
  let changed=false;if(walkthroughIsTango())changed=finalizeTextNodes(root.document?.querySelector?.('.walkthrough-explanation'))||changed;if(currentTango())changed=finalizeTextNodes(root.document?.querySelector?.('#hintNotice .hint-notice-text'))||changed;return changed
}
let installed=false;
function install(){
  if(installed)return true;let ok=false;
  try{if(typeof tangoReasoningPresenter==='function'&&!tangoReasoningPresenter.__quadludTextFinalizer){const previous=tangoReasoningPresenter,wrapped=function(...args){const base=previous(...args);if(!base||typeof base.presentation!=='function')return base;const original=base.presentation.bind(base);return Object.freeze({...base,presentation(d,...rest){return sanitizePresentation(original(d,...rest))}})};wrapped.__quadludTextFinalizer=true;wrapped.__quadludPrevious=previous;tangoReasoningPresenter=wrapped;ok=true}}catch(_){ }
  try{if(typeof walkthroughExplanationHtml==='function'&&!walkthroughExplanationHtml.__quadludTextFinalizer){const previous=walkthroughExplanationHtml,wrapped=function(...args){const html=previous(...args);return walkthroughIsTango()?finalizeHtml(html):html};wrapped.__quadludTextFinalizer=true;wrapped.__quadludPrevious=previous;walkthroughExplanationHtml=wrapped;ok=true}}catch(_){ }
  try{if(typeof showHintNotice==='function'&&!showHintNotice.__quadludTextFinalizer){const previous=showHintNotice,wrapped=function(html,...args){return previous(currentTango()?finalizeHtml(html):html,...args)};wrapped.__quadludTextFinalizer=true;wrapped.__quadludPrevious=previous;showHintNotice=wrapped;ok=true}}catch(_){ }
  try{if(typeof renderWalkthrough==='function'&&!renderWalkthrough.__quadludTextFinalizer){const previous=renderWalkthrough,wrapped=function(...args){const result=previous(...args);finalizeRenderedDom();return result};wrapped.__quadludTextFinalizer=true;wrapped.__quadludPrevious=previous;renderWalkthrough=wrapped;ok=true}}catch(_){ }
  installed=ok;if(ok)finalizeRenderedDom();return ok
}
return Object.freeze({VERSION,install,finalizeText,finalizeHtml,sanitizePresentation,dedupSemanticSentences,propositionKey,_test:Object.freeze({replaceRawPieces,stripIntermediate,finalizeValue})});
});
