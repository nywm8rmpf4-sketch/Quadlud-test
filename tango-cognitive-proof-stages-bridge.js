/*
 * QUADLUD — Soleil-Lune cognitive proof-stage compaction
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const isNode=typeof module==='object'&&module.exports;
const Cognitive=isNode?require('./cognitive-cost.js'):root.QuadludCognitiveCost;
const Patterns=isNode?require('./tango-cognitive-patterns.js'):root.QuadludTangoCognitivePatterns;
const VERSION=1,TOKEN='3.1.9-cognitive-proof-stages-r1';
if(!Cognitive||!Patterns)throw new Error('Soleil-Lune cognitive proof-stage dependencies unavailable');
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const cellKey=c=>Array.isArray(c)?`${Number(c[0])},${Number(c[1])}`:'';
function locale(){try{return String(typeof lang==='function'?lang():root.document?.documentElement?.lang||'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function cellName(c){return Array.isArray(c)?`${String.fromCharCode(65+Number(c[0]))}${Number(c[1])+1}`:''}
function pieceName(v,fr=locale()==='fr'){return Number(v)===1?(fr?'soleil ☀':'sun ☀'):(fr?'lune ☾':'moon ☾')}
function valueConclusions(d){return (d?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&(Number(c.value)===0||Number(c.value)===1))}
function uniqueValueConclusions(deductions){const out=[],seen=new Set();for(const d of deductions||[])for(const c of valueConclusions(d)){const k=`${cellKey(c.cell)}:${Number(c.value)}`;if(seen.has(k))continue;seen.add(k);out.push(copy(c))}return out}
function unionCells(deductions){const out=[],seen=new Set();for(const d of deductions||[])for(const c of d?.focusCells||[]){const k=cellKey(c);if(!k||seen.has(k))continue;seen.add(k);out.push(copy(c))}return out}
function chunkText(chunk,members){
  const fr=locale()==='fr',values=uniqueValueConclusions(members),parts=values.map(c=>`${cellName(c.cell)} = ${pieceName(c.value,fr)}`);
  if(parts.length){const sequence=parts.join(fr?' ; puis ':'; then ');return fr?`Même motif logique dans cette zone : ${sequence}.`:`Same logical pattern in this area: ${sequence}.`}
  return fr?`Ces ${chunk.rawCount} micro-déductions forment un même motif logique continu dans cette zone.`:`These ${chunk.rawCount} micro-deductions form one continuous logical pattern in this area.`
}
function aggregateReasoningStage(chunk,stages){
  const members=chunk.sourceIndices.map(i=>stages[i]).filter(Boolean),deductions=members.map(m=>m?.deduction).filter(Boolean);if(!members.length||!deductions.length)return null;
  const last=copy(members[members.length-1]),d=copy(last.deduction),p=copy(last.presentation)||{metadata:{},explanation:{}};
  d.focusCells=unionCells(deductions);d.explanationData={...(d.explanationData||{}),cognitiveChunk:{patternId:chunk.patternId,rawCount:chunk.rawCount,sourceIndices:chunk.sourceIndices.slice(),recognitionCost:chunk.recognitionCost,memoryWeight:chunk.memoryWeight},cognitiveChunkMembers:deductions.map(copy)};
  p.metadata={...(p.metadata||{}),cognitiveChunk:true,cognitivePatternId:chunk.patternId,cognitiveRawCount:chunk.rawCount};
  p.explanation={...(p.explanation||{}),why:chunkText(chunk,deductions),move:''};
  return {...last,kind:'reasoning',deduction:d,presentation:p,cognitiveChunk:copy(d.explanationData.cognitiveChunk)}
}
function compactContradictionStages(d,rawStages){
  if(d?.rule!=='ASSUMPTION_CONTRADICTION'||!Array.isArray(rawStages)||rawStages.length<4)return rawStages;
  const patterns=Patterns.patternsForDeduction(d),chunks=Cognitive.chunkPatterns(patterns);
  // For contradiction proofs, patterns map 1:1 to all stages except the final
  // real action: hypothesis + trace + contradiction, then the action follows.
  if(patterns.length+1!==rawStages.length)return rawStages;
  const traceFirst=1,traceLast=patterns.length-2,out=[];
  for(const chunk of chunks){
    const ids=chunk.sourceIndices;
    const isTrace=ids.length&&ids.every(i=>i>=traceFirst&&i<=traceLast);
    if(isTrace&&chunk.rawCount>1){const aggregated=aggregateReasoningStage(chunk,rawStages);if(aggregated){out.push(aggregated);continue}}
    for(const i of ids)if(rawStages[i])out.push(copy(rawStages[i]))
  }
  out.push(copy(rawStages[rawStages.length-1]));
  return out
}
function compactProofStages(d,rawStages){
  if(d?.rule==='ASSUMPTION_CONTRADICTION')return compactContradictionStages(d,rawStages);
  return rawStages
}
function install(){
  const H=root.QuadludTangoHumanPedagogyR4,previous=H?._test?.proofStagesForDeduction;if(!H||typeof previous!=='function')return false;
  if(H.__quadludCognitiveProofStagesR1===true)return true;
  const wrapped=function(d,presenter){return compactProofStages(d,previous(d,presenter))};
  const replacement=Object.freeze({...H,_test:Object.freeze({...H._test,proofStagesForDeduction:wrapped,rawProofStagesForDeduction:previous,compactCognitiveProofStages:compactProofStages}),__quadludCognitiveProofStagesR1:true});
  root.QuadludTangoHumanPedagogyR4=replacement;return true
}
const api=Object.freeze({VERSION,TOKEN,install,compactProofStages,_test:Object.freeze({valueConclusions,uniqueValueConclusions,unionCells,chunkText,aggregateReasoningStage,compactContradictionStages})});
root.QuadludTangoCognitiveProofStagesBridge=api;
if(typeof document!=='undefined')install();
if(isNode)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
