/*
 * QUADLUD — Soleil/Lune proof-contract reducer (HF3.7+)
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const VERSION=2;
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const cellKey=c=>Array.isArray(c)&&c.length>=2?`${Number(c[0])},${Number(c[1])}`:'';
function locale(){try{return String(typeof lang==='function'?lang():'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function humanPiece(value){try{if(typeof pieceName==='function')return pieceName('tango',Number(value))}catch(_){}return Number(value)===1?(locale()==='fr'?'soleil ☀':'sun ☀'):(locale()==='fr'?'lune ☾':'moon ☾')}
function humanCell(cell){if(!Array.isArray(cell))return'';return `${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`}
function entryDeduction(entry){return entry?.deduction||entry?.presentation?.evidence?.primary||null}
function isValuePremise(p){return p?.kind==='VALUE'&&Array.isArray(p?.cell)}
function isRelationPremise(p){return p?.kind==='RELATION'||(Array.isArray(p?.a)&&Array.isArray(p?.b))}
function witnessValueNeeded(witness){
  const kind=String(witness?.kind||'');
  if(kind==='BALANCE_OVERFLOW'||kind==='TRIPLE_OVERFLOW')return Number(witness?.value);
  if(kind==='BALANCE_DEFICIT')return 1-Number(witness?.value);
  return null
}
function reduceWitnessPremises(d){
  if(!d||!['RELATION_BALANCE','RELATION_BALANCE_COMPONENT'].includes(String(d.rule||'')))return d;
  const witness=d?.explanationData?.rejected;if(!witness)return d;
  const witnessCells=new Set((witness.cells||[]).map(cellKey).filter(Boolean)),needed=witnessValueNeeded(witness);
  const original=Array.isArray(d.premises)?d.premises:[],relations=original.filter(isRelationPremise),values=original.filter(isValuePremise),other=original.filter(p=>!isRelationPremise(p)&&!isValuePremise(p));
  let keptValues=values;
  if(witnessCells.size){
    keptValues=values.filter(p=>witnessCells.has(cellKey(p.cell))&&(needed==null||Number(p.value)===needed));
    if(!keptValues.length)keptValues=values.filter(p=>witnessCells.has(cellKey(p.cell)));
  }
  const reduced={...copy(d),premises:copy([...relations,...keptValues,...other])};
  reduced.dependencies=[...new Set((reduced.premises||[]).flatMap(p=>p?.dependencies||[]))];
  reduced.proofReduction={contract:'ADR-011',kind:'witness-causal-premises',removedPremiseCount:Math.max(0,original.length-reduced.premises.length)};
  return reduced
}
function patchEntryDeduction(entry,d){
  const next=copy(entry);next.deduction=copy(d);
  if(next.presentation?.evidence){next.presentation.evidence.primary=copy(d);next.presentation.evidence.final=copy(d)}
  return next
}
function reduceCausalPremises(entry){const d=entryDeduction(entry);if(!d)return copy(entry);const reduced=reduceWitnessPremises(d);return patchEntryDeduction(entry,reduced)}
function valueConclusions(d){return (d?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c?.cell)&&(Number(c.value)===0||Number(c.value)===1))}
function stateValue(state,cell){return Array.isArray(cell)?state?.[Number(cell[0])]?.[Number(cell[1])]:undefined}
function reduceAlreadyVisibleConclusions(entry){
  const d0=entryDeduction(entry),before=entry?.beforeSnapshot?.state;if(!d0||!Array.isArray(before))return copy(entry);
  const values=valueConclusions(d0);if(values.length<2)return copy(entry);
  const fresh=values.filter(c=>stateValue(before,c.cell)!==Number(c.value));
  const established=values.filter(c=>stateValue(before,c.cell)===Number(c.value));
  if(!fresh.length||!established.length)return copy(entry);
  const d={...copy(d0),conclusions:copy(fresh),focusCells:copy(fresh.map(c=>c.cell))};
  d.proofReduction={...(d.proofReduction||{}),contract:'ADR-011',knownConclusionsRemoved:established.length,kind:'remove-already-visible-conclusions'};
  let next=patchEntryDeduction(entry,d),chosen=fresh.find(c=>sameCell(c.cell,next.target))||fresh[0],prop=`${humanCell(chosen.cell)} = ${humanPiece(chosen.value)}`;
  next.target=copy(chosen.cell);next.move=prop;
  if(next.presentation){next.presentation.action={...(next.presentation.action||{}),conclusions:copy(fresh)};next.presentation.metadata={...(next.presentation.metadata||{}),showTutorMove:true};next.presentation.explanation={...(next.presentation.explanation||{}),move:prop}}
  return next
}
function inferUnit(d,target,relation,before){
  const ref=d?.focusUnits?.[0];if(ref&&(ref.family==='column'||ref.family==='row'))return {family:ref.family,id:Number(ref.id)};
  const rejected=d?.explanationData?.rejected;if(rejected&&(rejected.family==='column'||rejected.family==='row'))return {family:rejected.family,id:Number(rejected.id)};
  if(relation&&sameCell(relation.a,target)===false&&sameCell(relation.b,target)===false){
    if(Number(relation.a?.[1])===Number(relation.b?.[1])&&Number(target?.[1])===Number(relation.a?.[1]))return {family:'column',id:Number(target[1])};
    if(Number(relation.a?.[0])===Number(relation.b?.[0])&&Number(target?.[0])===Number(relation.a?.[0]))return {family:'row',id:Number(target[0])};
  }
  if(Array.isArray(before)&&Array.isArray(target))return {family:'row',id:Number(target[0])};
  return null
}
function unitCells(before,unit){
  const n=Array.isArray(before)?before.length:0,out=[];if(!n||!unit)return out;
  for(let i=0;i<n;i++)out.push(unit.family==='column'?[i,unit.id]:[unit.id,i]);return out
}
function relationInvariantData(entry,d){
  const before=entry?.beforeSnapshot?.state,conclusions=valueConclusions(d);if(!Array.isArray(before)||conclusions.length!==1)return null;
  const conclusion=conclusions[0],relation=(d?.premises||[]).find(p=>isRelationPremise(p)&&Number(p.parity)===1&&Array.isArray(p.a)&&Array.isArray(p.b));if(!relation)return null;
  const unit=inferUnit(d,conclusion.cell,relation,before),cells=unitCells(before,unit),n=cells.length;if(!unit||!n||n%2!==0)return null;
  if(!cells.some(c=>sameCell(c,relation.a))||!cells.some(c=>sameCell(c,relation.b))||!cells.some(c=>sameCell(c,conclusion.cell)))return null;
  let sun=1,moon=1,unresolved=0;
  for(const cell of cells){if(sameCell(cell,relation.a)||sameCell(cell,relation.b)||sameCell(cell,conclusion.cell))continue;const v=stateValue(before,cell);if(v===1)sun++;else if(v===0)moon++;else unresolved++}
  const required=n/2,targetValue=Number(conclusion.value),forced=(unresolved===0&&((targetValue===0&&sun===required&&moon===required-1)||(targetValue===1&&moon===required&&sun===required-1)));
  if(!forced)return null;
  return {unit,relation:copy(relation),conclusion:copy(conclusion),sun,moon,required,n}
}
function relationInvariantText(data){
  const fr=locale()==='fr',a=humanCell(data.relation.a),b=humanCell(data.relation.b),target=humanCell(data.conclusion.cell),piece=humanPiece(data.conclusion.value),unitLabel=data.unit.family==='column'?(fr?`colonne ${data.unit.id+1}`:`column ${data.unit.id+1}`):(fr?`ligne ${String.fromCharCode(65+data.unit.id)}`:`row ${String.fromCharCode(65+data.unit.id)}`);
  if(fr)return `L’indice ${a} × ${b} impose que ces deux cases contiennent un Soleil et une Lune. Quelle que soit leur disposition, la ${unitLabel} contient donc déjà ${data.sun} Soleil${data.sun>1?'s':''} et ${data.moon} Lune${data.moon>1?'s':''}. Une ${data.unit.family==='column'?'colonne':'ligne'} doit contenir ${data.required} Soleils et ${data.required} Lunes. La dernière case restante ${target} est donc forcément ${piece}.`;
  return `The ${a} × ${b} clue means these two cells contain one Sun and one Moon. Whatever their order, ${unitLabel} therefore already contains ${data.sun} Sun${data.sun===1?'':'s'} and ${data.moon} Moon${data.moon===1?'':'s'}. A ${data.unit.family} must contain ${data.required} Suns and ${data.required} Moons. The last remaining cell ${target} is therefore ${piece}.`
}
function explainRelationInvariant(entry){
  const d=entryDeduction(entry);if(!d||!['RELATION_BALANCE','RELATION_BALANCE_COMPONENT'].includes(String(d.rule||'')))return copy(entry);
  const data=relationInvariantData(entry,d);if(!data)return copy(entry);
  const next=copy(entry),why=relationInvariantText(data),target=data.conclusion.cell,prop=`${humanCell(target)} = ${humanPiece(data.conclusion.value)}`;
  next.target=copy(target);next.move=prop;next.where=locale()==='fr'?`Regarde l’indice ${humanCell(data.relation.a)} × ${humanCell(data.relation.b)} et la ${data.unit.family==='column'?`colonne ${data.unit.id+1}`:`ligne ${String.fromCharCode(65+data.unit.id)}`}.`:`Look at the ${humanCell(data.relation.a)} × ${humanCell(data.relation.b)} clue and ${data.unit.family} ${data.unit.id+1}.`;next.why=why;
  if(next.presentation){next.presentation.explanation={...(next.presentation.explanation||{}),title:locale()==='fr'?'Relation et équilibre':'Relation and balance',where:next.where,why,move:prop};next.presentation.metadata={...(next.presentation.metadata||{}),proofCompleteness:'relation-invariant-final-action',showTutorMove:true}}
  return next
}
function targetConclusion(entries){
  const list=Array.isArray(entries)?entries:[],target=list.find(e=>Array.isArray(e?.target))?.target||null;
  if(target){for(const e of list){const d=entryDeduction(e),c=(d?.conclusions||[]).find(x=>x?.type==='VALUE'&&sameCell(x.cell,target));if(c)return {entry:e,conclusion:c}}}
  for(const e of list){const d=entryDeduction(e),c=(d?.conclusions||[]).find(x=>x?.type==='VALUE');if(c)return {entry:e,conclusion:c}}
  return null
}
function finalSnapshot(s){return {state:copy(s?.work?.state||[]),tangoDerivedRelations:copy(s?.work?.tangoDerivedRelations||[])} }
function caseProofText(d,conclusion){
  const fr=locale()==='fr',count=Number(d?.explanationData?.domainCount),ref=d?.focusUnits?.[0],unit=ref?.family==='column'?(fr?`colonne ${Number(ref.id)+1}`:`column ${Number(ref.id)+1}`):ref?.family==='row'?(fr?`ligne ${String.fromCharCode(65+Number(ref.id))}`:`row ${String.fromCharCode(65+Number(ref.id))}`):(fr?'ligne ou colonne':'row or column'),prop=`${humanCell(conclusion.cell)} = ${humanPiece(conclusion.value)}`;
  if(fr)return `${Number.isFinite(count)&&count>0?`${count} complétion${count===1?'':'s'} de la ${unit} reste${count===1?'':'nt'} possible${count===1?'':'s'}`:`Plusieurs complétions de la ${unit} restent possibles`}. Dans ${count===1?'cette possibilité':'toutes ces possibilités'}, ${prop}. Donc ${prop}.`;
  return `${Number.isFinite(count)&&count>0?`${count} completion${count===1?'':'s'} of the ${unit} remain possible`:`Several completions of the ${unit} remain possible`}. In ${count===1?'that completion':'all of them'}, ${prop}. Therefore ${prop}.`
}
function collapseLineDomainCase(s,entries){
  const lineEntries=(entries||[]).filter(e=>String(entryDeduction(e)?.rule||'')==='LINE_DOMAIN_SUPPORT');if(lineEntries.length<=1)return entries;
  const chosen=targetConclusion(lineEntries);if(!chosen)return entries;
  const source=chosen.entry,d0=entryDeduction(source),conclusion=copy(chosen.conclusion),d={...copy(d0),conclusions:[conclusion],focusCells:[copy(conclusion.cell)],focusRelations:[]};
  d.signature=`${d0.signature||d0.id||d0.rule}|pedagogical-final-action`;d.id=`${d0.id||d0.signature||d0.rule}:pedagogical-final-action`;d.proofReduction={contract:'ADR-011',kind:'case-common-invariant-to-final-action',discardedTechnicalConclusions:Math.max(0,lineEntries.length-1)};
  let next=patchEntryDeduction(source,d),prop=`${humanCell(conclusion.cell)} = ${humanPiece(conclusion.value)}`;
  next.pedagogyStageKind='action';next.proofStage={kind:'action',temporary:false,apply:true};next.move=prop;next.target=copy(conclusion.cell);next.snapshot=finalSnapshot(s);next.proofSnapshot=copy(next.snapshot);
  if(next.presentation){next.presentation.action={...(next.presentation.action||{}),conclusions:[copy(conclusion)]};next.presentation.metadata={...(next.presentation.metadata||{}),showTutorMove:true,proofCompleteness:'complete-case-invariant-final-action'};next.presentation.explanation={...(next.presentation.explanation||{}),why:caseProofText(d,conclusion),move:prop}}
  next.where=next.presentation?.explanation?.where||next.where||'';next.why=next.presentation?.explanation?.why||caseProofText(d,conclusion);
  const firstIndex=entries.indexOf(lineEntries[0]),lastSet=new Set(lineEntries),out=[];for(let i=0;i<entries.length;i++){if(i===firstIndex)out.push(next);if(lastSet.has(entries[i]))continue;out.push(entries[i])}return out
}
function rebuildCausal(entries){
  const model=root.QuadludTangoCausalProofModel;if(typeof model?.fromEntries!=='function'||!Array.isArray(entries)||!entries.length)return entries;
  let proof;try{proof=model.fromEntries(entries)}catch(_){return entries}
  return entries.map((entry,index)=>({...entry,causalProof:copy(proof),causalStepId:proof?.entryStepIds?.[index]||null}))
}
function postProcess(s,start){
  if(!s||!Array.isArray(s.moves)||start<0||start>=s.moves.length)return false;
  const prefix=s.moves.slice(0,start),raw=s.moves.slice(start),causal=raw.map(reduceCausalPremises).map(reduceAlreadyVisibleConclusions).map(explainRelationInvariant),collapsed=collapseLineDomainCase(s,causal),rebuilt=rebuildCausal(collapsed);s.moves.splice(0,s.moves.length,...prefix,...rebuilt);if(s.done)s.total=s.moves.length;return true
}
function session(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
let installed=false;
function install(){
  const previous=root.walkthroughGenerateTangoNext;if(typeof previous!=='function'||previous.__quadludProgressiveProofBridgeV2!==true)return false;if(previous.__quadludProofContractHF37===true)return true;
  const wrapped=function(){const s=session(),start=Array.isArray(s?.moves)?s.moves.length:0,ok=previous();if(ok&&s?.base?.game==='tango')postProcess(s,start);return ok};wrapped.__quadludProofContractHF37=true;wrapped.__quadludPrevious=previous;root.walkthroughGenerateTangoNext=wrapped;installed=true;return true
}
function scheduleInstall(){let tries=320,timer=null;const retry=()=>{if(install()){if(timer!=null)clearTimeout(timer);return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true}
const api=Object.freeze({VERSION,install,scheduleInstall,_test:Object.freeze({reduceWitnessPremises,reduceCausalPremises,reduceAlreadyVisibleConclusions,relationInvariantData,relationInvariantText,explainRelationInvariant,targetConclusion,caseProofText,collapseLineDomainCase,rebuildCausal,postProcess,witnessValueNeeded})});root.QuadludTangoProofContractHF37=api;if(typeof document!=='undefined')scheduleInstall();if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
