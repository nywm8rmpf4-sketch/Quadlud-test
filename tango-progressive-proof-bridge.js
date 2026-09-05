/*
 * QUADLUD — Soleil/Lune progressive proof compatibility bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const VERSION=3;
function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1])}
function session(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function presenter(){try{return typeof tangoReasoningPresenter==='function'?tangoReasoningPresenter():null}catch(_){return null}}
function locale(){try{return String(typeof lang==='function'?lang():'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function humanCell(cell){if(!Array.isArray(cell))return'';return `${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`}
function humanPiece(value){try{if(typeof pieceName==='function')return pieceName('tango',Number(value))}catch(_){ }const fr=locale()==='fr';return Number(value)===1?(fr?'soleil ☀':'sun ☀'):(fr?'lune ☾':'moon ☾')}
function entryDeduction(entry){return entry?.deduction||entry?.presentation?.evidence?.primary||null}
function proofStages(d,p){
  const fn=root.QuadludTangoHumanPedagogyR4?._test?.proofStagesForDeduction;
  if(typeof fn!=='function'||!d||!p)return [];
  try{return fn(d,p)||[]}catch(_){return []}
}
function stageKind(entry){return String(entry?.pedagogyStageKind||entry?.proofStage?.kind||'reasoning')}
function sanitizeStageEntry(entry){
  const next=copy(entry),kind=stageKind(next),d=entryDeduction(next),q=next?.presentation;
  if(!q||kind==='action')return next;
  if(q.explanation)q.explanation.move='';
  q.metadata={...(q.metadata||{}),showTutorMove:false};
  if(kind==='hypothesis'||kind==='contradiction'){
    q.action={...(q.action||{}),conclusions:[]};
    if(q.evidence&&d){q.evidence.primary=copy(d);q.evidence.final=copy(d);q.evidence.supports=[]}
  }
  next.move='';
  if(next.beforeSnapshot){next.proofSnapshot=copy(next.beforeSnapshot);next.snapshot=copy(next.beforeSnapshot)}
  return next
}
function unitRef(d){return d?.focusUnits?.[0]||(d?.explanationData?.family!=null?{family:d.explanationData.family,id:d.explanationData.id}:null)}
function unitName(d){const ref=unitRef(d);if(!ref)return locale()==='fr'?'la ligne ou la colonne':'the row or column';if(ref.family==='row')return locale()==='fr'?`ligne ${String.fromCharCode(65+Number(ref.id))}`:`row ${String.fromCharCode(65+Number(ref.id))}`;return locale()==='fr'?`colonne ${Number(ref.id)+1}`:`column ${Number(ref.id)+1}`}
function lineDomainText(d,p){
  const fr=locale()==='fr',count=Number(d?.explanationData?.domainCount),unit=unitName(d),conclusion=p?.conclusionText?.(d)||'';
  const countText=Number.isFinite(count)&&count>0?(fr?`${count} façon${count===1?'':'s'} de compléter ${unit}`:`${count} way${count===1?'':'s'} to complete ${unit}`):(fr?`les façons encore possibles de compléter ${unit}`:`the remaining ways to complete ${unit}`);
  return fr?`${countText} respectent encore l’équilibre, la règle des trois et les relations déjà établies. Dans ${count===1?'ce cas':'tous ces cas'}, ${conclusion}. Cette conclusion est donc forcée.`:`${countText} still satisfy balance, the no-three rule and the established relations. In ${count===1?'that case':'all of them'}, ${conclusion}. This conclusion is therefore forced.`
}
function lineDomainTitle(d){const ref=unitRef(d),fr=locale()==='fr';if(ref?.family==='column')return fr?'Contraintes combinées de la colonne':'Combined column constraints';if(ref?.family==='row')return fr?'Contraintes combinées de la ligne':'Combined row constraints';return fr?'Contraintes combinées':'Combined constraints'}
function atomicLineEntries(entry,p){
  const d=entryDeduction(entry),conclusions=Array.isArray(d?.conclusions)?d.conclusions:[];
  if(String(d?.rule||'')!=='LINE_DOMAIN_SUPPORT'||conclusions.length<=1)return [entry];
  return conclusions.map((conclusion,index)=>{
    const atomic=copy(d);atomic.id=`${d.id||d.signature||d.rule}:presentation:${index+1}`;atomic.signature=`${d.signature||d.id||d.rule}|presentation:${index+1}`;atomic.conclusions=[copy(conclusion)];
    let presentation=null;try{presentation=p?.presentation?.(atomic)||copy(entry.presentation)}catch(_){presentation=copy(entry.presentation)}
    presentation=copy(presentation)||{};presentation.explanation={...(presentation.explanation||{}),title:lineDomainTitle(atomic),where:locale()==='fr'?`Regarde ${unitName(atomic)}.`:`Look at ${unitName(atomic)}.`,why:lineDomainText(atomic,p),move:''};presentation.metadata={...(presentation.metadata||{}),showTutorMove:false};
    const reasoning=typeof p?.legacyReasoning==='function'?p.legacyReasoning(atomic):atomic,next={...copy(entry),deduction:reasoning,presentation,where:presentation.explanation.where,why:presentation.explanation.why,move:'',pedagogyStageKind:'reasoning'};
    if(next.beforeSnapshot){next.proofSnapshot=copy(next.beforeSnapshot);next.snapshot=copy(next.beforeSnapshot)}
    return next
  })
}
function relationPremise(d){return (d?.premises||[]).find(x=>x?.kind==='RELATION'||(Array.isArray(x?.a)&&Array.isArray(x?.b)))||null}
function valuePremise(d,cell){return (d?.premises||[]).find(x=>x?.kind==='VALUE'&&Array.isArray(x.cell)&&sameCell(x.cell,cell))||null}
function orderedRelationPath(source,target,path){
  if(!Array.isArray(source)||!Array.isArray(target)||!Array.isArray(path)||!path.length)return [];
  const unused=path.map((edge,index)=>({edge,index})),out=[];let current=source.slice();
  while(unused.length&&!sameCell(current,target)){
    const i=unused.findIndex(x=>sameCell(x.edge?.a,current)||sameCell(x.edge?.b,current));if(i<0)return [];
    const [{edge}]=unused.splice(i,1),next=sameCell(edge.a,current)?edge.b:edge.a;if(!Array.isArray(next))return [];
    out.push({from:current.slice(),to:next.slice(),parity:Number(edge.parity)||0,explicit:!!edge.explicit});current=next.slice()
  }
  return sameCell(current,target)?out:[]
}
function relationPathText(source,target,path){
  const ordered=orderedRelationPath(source,target,path);if(ordered.length<2)return'';const fr=locale()==='fr';return ordered.map((edge,index)=>`${index&&fr?'puis ':index&&!fr?'then ':''}${humanCell(edge.from)} ${edge.parity===0?'=':'×'} ${humanCell(edge.to)}`).join(fr?', ':', ')
}
function clarifyDerivedRelation(entry){
  const next=copy(entry),d=entryDeduction(next);if(String(d?.rule||'')!=='RELATION_PROPAGATION')return next;
  const rel=relationPremise(d);if(!rel||rel.explicit===true)return next;
  const x=d?.explanationData||{},source=x.source,target=x.target||(d?.conclusions||[]).find(c=>c?.type==='VALUE')?.cell,conclusion=(d?.conclusions||[]).find(c=>c?.type==='VALUE');if(!Array.isArray(source)||!Array.isArray(target)||!conclusion)return next;
  const fr=locale()==='fr',sourceName=humanCell(source),targetName=humanCell(target),sourceValue=Number(x.sourceValue),targetValue=Number(conclusion.value),parity=Number(x.parity),hypothesis=!!valuePremise(d,source)?.hypothesis,relation=parity===0?(fr?'identiques':'the same'):(fr?'opposées':'opposite'),pathText=relationPathText(source,target,rel.path);
  const where=pathText?(fr?`Regarde le chemin relationnel de ${sourceName} à ${targetName}.`:`Look at the relation path from ${sourceName} to ${targetName}.`):(fr?`Regarde ${sourceName} et ${targetName}. Utilise la relation déjà déduite entre ces deux cases.`:`Look at ${sourceName} and ${targetName}. Use the relation already deduced between these two cells.`);
  const relationReason=pathText?(fr?`La relation n’est pas directe : ${pathText}. En les combinant, ${sourceName} et ${targetName} sont ${relation}.`:`The relation is not direct: ${pathText}. Combining these relations, ${sourceName} and ${targetName} are ${relation}.`):(fr?`${sourceName} et ${targetName} sont ${relation} d’après une relation déjà démontrée.`:`${sourceName} and ${targetName} are ${relation} from an already proved relation.`);
  const why=fr?`${relationReason} ${hypothesis?'Sous l’hypothèse,':'Comme'} ${sourceName} = ${humanPiece(sourceValue)}, donc ${targetName} = ${humanPiece(targetValue)}.`:`${relationReason} ${hypothesis?'Under the assumption,':'Since'} ${sourceName} = ${humanPiece(sourceValue)}, therefore ${targetName} = ${humanPiece(targetValue)}.`;
  if(next.presentation?.explanation){next.presentation.explanation.where=where;next.presentation.explanation.why=why;next.presentation.explanation.move=''}next.where=where;next.why=why;next.move='';return next
}
function postProcessGeneratedEntries(s,start){
  if(!s||!Array.isArray(s.moves)||start<0||start>=s.moves.length)return false;const p=presenter(),raw=s.moves.splice(start),out=[];
  for(const entry of raw){const sanitized=sanitizeStageEntry(entry);for(const atomic of atomicLineEntries(sanitized,p))out.push(clarifyDerivedRelation(atomic))}
  s.moves.push(...out);if(s.done)s.total=s.moves.length;return true
}
function expandSingleAdvancedEntry(s,start){
  if(!s||!Array.isArray(s.moves)||s.moves.length-start!==1)return false;
  const original=s.moves[start],d=entryDeduction(original);
  if(!d||!['ASSUMPTION_CONTRADICTION','COMMON_CONSEQUENCE'].includes(String(d.rule||'')))return false;
  const p=presenter(),stages=proofStages(d,p);if(stages.length<=1)return false;
  const before=copy(original.beforeSnapshot||original.proofSnapshot||s.initial),final=copy(original.snapshot),target=Array.isArray(original.target)?original.target.slice():null;
  const replacements=stages.map((stage,index)=>{
    const last=index===stages.length-1,presentation=stage.presentation||p.presentation(stage.deduction),reasoning=p.legacyReasoning(stage.deduction),next={...copy(original),presentation,deduction:reasoning,where:presentation?.explanation?.where||'',why:presentation?.explanation?.why||'',move:last?(presentation?.explanation?.move||original.move||''):'',pedagogyStageKind:stage.kind||'reasoning',beforeSnapshot:copy(before),proofSnapshot:copy(last?final:before),snapshot:copy(last?final:before)};
    if(target)next.target=target.slice();return next
  });
  s.moves.splice(start,1,...replacements);s.tangoTutorStatus='human-progressive-bridge';return true
}
function installGenerator(){
  const previous=root.walkthroughGenerateTangoNext;if(typeof previous!=='function')return false;if(previous.__quadludProgressiveProofBridgeV2===true)return true;
  const wrapped=function(){const s=session(),start=Array.isArray(s?.moves)?s.moves.length:0,ok=previous();if(ok&&s?.base?.game==='tango'){expandSingleAdvancedEntry(s,start);postProcessGeneratedEntries(s,start)}return ok};
  wrapped.__quadludProgressiveProofBridge=true;wrapped.__quadludProgressiveProofBridgeV2=true;wrapped.__quadludPrevious=previous;root.walkthroughGenerateTangoNext=wrapped;return true
}
function currentTutorStageKind(){let s,group;try{s=session();group=typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}if(!s||!group?.entries?.length)return null;const index=Math.max(0,Math.min(group.entries.length-1,Number(s.navigation?.proofStepIndex)||0));return stageKind(group.entries[index])}
function scrubPrematureAction(){const kind=currentTutorStageKind();if(!kind||kind==='action')return false;const board=root.document?.querySelector?.('.walkthrough-board');if(!board)return false;board.querySelectorAll?.('.walkthrough-current-action').forEach(el=>el.classList.remove('walkthrough-current-action'));return true}
function installRender(){
  const previous=root.renderWalkthrough;if(typeof previous!=='function'||previous.__quadludHumanProgressiveV4!==true)return false;if(previous.__quadludProofCoherenceRender===true)return true;
  const wrapped=function(options={}){const result=previous(options);scrubPrematureAction();return result};wrapped.__quadludProofCoherenceRender=true;wrapped.__quadludHumanProgressiveV4=true;wrapped.__quadludPrevious=previous;root.renderWalkthrough=wrapped;return true
}
function install(){return installGenerator()}
function scheduleInstall(){
  let tries=240,timer=null;const retry=()=>{const generatorOk=installGenerator(),renderOk=installRender();if(generatorOk&&renderOk){if(timer!=null)clearTimeout(timer);return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}
const api=Object.freeze({VERSION,install,installGenerator,installRender,scheduleInstall,_test:Object.freeze({expandSingleAdvancedEntry,proofStages,sanitizeStageEntry,atomicLineEntries,clarifyDerivedRelation,postProcessGeneratedEntries,lineDomainText,lineDomainTitle,orderedRelationPath,relationPathText,currentTutorStageKind,scrubPrematureAction})});root.QuadludTangoProgressiveProofBridge=api;if(typeof document!=='undefined')scheduleInstall();if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);