/*
 * QUADLUD — Soleil/Lune causal pedagogical proof model
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoCausalProofModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=1;
const SCHEMA='quadlud-pedagogical-proof-v1';
const KINDS=Object.freeze(['premise','hypothesis','deduction','contradiction','rollback','conclusion']);
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
function cell(value){return Array.isArray(value)&&value.length>=2?[Number(value[0]),Number(value[1])]:null}
function uniqueCells(values){const out=[],seen=new Set();for(const value of values||[]){const c=cell(value);if(!c)continue;const key=c.join(',');if(seen.has(key))continue;seen.add(key);out.push(c)}return out}
function premiseCells(p){if(!p)return[];if(Array.isArray(p.cell))return[p.cell];return[p.a,p.b].filter(Array.isArray)}
function conclusionCells(c){if(!c)return[];if(Array.isArray(c.cell))return[c.cell];return[c.a,c.b].filter(Array.isArray)}
function deductionOf(entry){return entry?.deduction||entry?.presentation?.evidence?.primary||null}
function legacyKind(entry){return String(entry?.pedagogyStageKind||entry?.proofStage?.kind||'action')}
function canonicalKind(entry){const kind=legacyKind(entry);if(kind==='hypothesis')return'hypothesis';if(kind==='contradiction')return'contradiction';if(kind==='rollback')return'rollback';if(kind==='action'||kind==='conclusion')return'conclusion';if(kind==='premise')return'premise';return'deduction'}
function isHypothesisPremise(p){return p?.hypothesis===true||String(p?.kind||'').toUpperCase()==='ASSUMPTION'}
function factKey(p){return JSON.stringify([p?.kind||'',cell(p?.cell),cell(p?.a),cell(p?.b),p?.value??null,p?.parity??p?.relation??null])}
function semanticStep(kind,deduction,{sourceEntryIndex=null,hypothetical=false,sequenceIndex=null,synthetic=false}={}){
  const premises=Array.isArray(deduction?.premises)?copy(deduction.premises):[],conclusions=Array.isArray(deduction?.conclusions)?copy(deduction.conclusions):[];
  const focus=uniqueCells([...(deduction?.focusCells||[]),...premises.flatMap(premiseCells)]),produced=uniqueCells(conclusions.flatMap(conclusionCells));
  const hypothesis=uniqueCells(premises.filter(isHypothesisPremise).flatMap(premiseCells));
  const contradiction=kind==='contradiction'?uniqueCells([...(deduction?.focusCells||[]),...(deduction?.explanationData?.witness?.cells||[]),...(deduction?.explanationData?.witness?.block||[])]):[];
  const conclusion=kind==='conclusion'?produced:[];
  return {id:'',kind,sourceEntryIndex,hypothetical:!!hypothetical,sequenceIndex:Number.isInteger(sequenceIndex)?sequenceIndex:null,synthetic:!!synthetic,rule:deduction?.rule||null,rank:Number.isFinite(Number(deduction?.rank))?Number(deduction.rank):null,involvedCells:focus,producedCells:produced,cellRoles:{premiseCells:uniqueCells(premises.filter(p=>!isHypothesisPremise(p)).flatMap(premiseCells)),focusCells:uniqueCells(deduction?.focusCells||[]),hypothesisCells:hypothesis,contradictionCells:contradiction,conclusionCells:conclusion},premises,conclusions};
}
function fromEntries(entries){
  const source=Array.isArray(entries)?entries:[],steps=[],entryStepIds=Array(source.length).fill(null),premises=[],seenFacts=new Set();
  for(const entry of source){const d=deductionOf(entry);for(const p of d?.premises||[]){if(isHypothesisPremise(p))continue;const key=factKey(p);if(seenFacts.has(key))continue;seenFacts.add(key);premises.push(copy(p))}}
  premises.forEach((p,index)=>{const d={rule:'VISIBLE_PREMISE',premises:[p],focusCells:premiseCells(p),conclusions:[]};steps.push(semanticStep('premise',d,{synthetic:true,sequenceIndex:index+1}))});
  let hypothetical=false,hypothesisSequence=0,contradictionSeen=false,hasExplicitDeduction=false;
  source.forEach((entry,index)=>{
    const d=deductionOf(entry)||{},kind=canonicalKind(entry);
    if(kind==='hypothesis'){hypothetical=true;hypothesisSequence=0;contradictionSeen=false}
    if(kind==='deduction'){hasExplicitDeduction=true;hypothesisSequence+=hypothetical?1:0}
    if(kind==='contradiction'){contradictionSeen=true;hypothesisSequence+=hypothetical?1:0}
    if(kind==='conclusion'&&contradictionSeen){const rollback=semanticStep('rollback',{rule:d?.rule,premises:[],focusCells:[],conclusions:[]},{synthetic:true,hypothetical:true,sequenceIndex:hypothesisSequence+1});steps.push(rollback);hypothetical=false}
    if(kind==='conclusion'&&source.length===1&&!hasExplicitDeduction){const deduction=semanticStep('deduction',d,{sourceEntryIndex:index,hypothetical:false});steps.push(deduction)}
    const sequenceIndex=hypothetical?(kind==='hypothesis'?0:hypothesisSequence):null,step=semanticStep(kind,d,{sourceEntryIndex:index,hypothetical:kind==='conclusion'?false:hypothetical,sequenceIndex});steps.push(step);entryStepIds[index]=step.id;
    if(kind==='conclusion'){hypothetical=false;contradictionSeen=false}
  });
  steps.forEach((step,index)=>step.id=`cp${index+1}`);
  source.forEach((_,index)=>{const candidates=steps.filter(step=>step.sourceEntryIndex===index);if(candidates.length)entryStepIds[index]=candidates[candidates.length-1].id});
  const finalStep=[...steps].reverse().find(step=>step.kind==='conclusion')||null;
  return {schema:SCHEMA,version:VERSION,premises,steps,entryStepIds,conclusion:finalStep?copy(finalStep.conclusions):[],complete:!!finalStep};
}
return Object.freeze({VERSION,SCHEMA,KINDS,fromEntries,_test:Object.freeze({canonicalKind,semanticStep,uniqueCells,premiseCells,conclusionCells,isHypothesisPremise})});
});
