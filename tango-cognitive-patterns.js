/*
 * QUADLUD — Soleil-Lune cognitive pattern adapter
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const isNode=typeof module==='object'&&module.exports;
  const api=factory(isNode?require('./cognitive-cost.js'):root.QuadludCognitiveCost);
  if(isNode)module.exports=api;
  if(root)root.QuadludTangoCognitivePatterns=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Cognitive){
'use strict';
if(!Cognitive)throw new Error('QuadludCognitiveCost is required');

const VERSION=1;
const CATALOG_VERSION='tango-cognitive-patterns-v1';
const BASE=Object.freeze({
  T_RELATION_DIRECT:{recognitionCost:0.75,memoryWeight:1},
  T_RELATION_CHAIN:{recognitionCost:1.25,memoryWeight:1.25},
  T_NO_THREE:{recognitionCost:1,memoryWeight:1},
  T_BALANCE_QUOTA:{recognitionCost:1,memoryWeight:1},
  T_BALANCE_RELATION:{recognitionCost:1.25,memoryWeight:1.25},
  T_RELATION_BALANCE:{recognitionCost:1.5,memoryWeight:1.5},
  T_RELATION_COMPONENT:{recognitionCost:1.75,memoryWeight:1.5},
  T_LINE_DOMAIN:{recognitionCost:2.5,memoryWeight:2},
  T_HYPOTHESIS:{recognitionCost:1.5,memoryWeight:1.5},
  T_CONTRADICTION_WITNESS:{recognitionCost:1.5,memoryWeight:1.5},
  T_BRANCH_COMPARE:{recognitionCost:2,memoryWeight:1.5},
  T_UNKNOWN:{recognitionCost:2.5,memoryWeight:2}
});

const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const cellKey=c=>Array.isArray(c)&&c.length>=2?`${Number(c[0])},${Number(c[1])}`:'';
function unitKey(d){const u=d?.focusUnits?.[0]||(d?.explanationData?.family!=null?{family:d.explanationData.family,id:d.explanationData.id}:null);return u?`${u.family}:${u.id}`:''}
function sortedCells(d){const out=[],seen=new Set();for(const c of [...(d?.focusCells||[]),...(d?.premises||[]).flatMap(p=>[p?.cell,p?.a,p?.b]),...(d?.conclusions||[]).flatMap(c=>[c?.cell,c?.a,c?.b])]){const k=cellKey(c);if(k&&!seen.has(k)){seen.add(k);out.push(k)}}return out.sort()}
function localityKey(d){return unitKey(d)||sortedCells(d).join('|')||String(d?.rule||'unknown')}
function techniqueLevel(d){return Math.max(0,Number(d?.techniqueLevel)||0)}
function relationPathLength(d){
  const rel=(d?.premises||[]).find(p=>p?.kind==='RELATION'||(Array.isArray(p?.a)&&Array.isArray(p?.b))),path=rel?.path||d?.explanationData?.path;
  return Array.isArray(path)?Math.max(1,path.length):1;
}
function relationExplicit(d){const rel=(d?.premises||[]).find(p=>p?.kind==='RELATION'||(Array.isArray(p?.a)&&Array.isArray(p?.b)));return rel?.explicit===true||relationPathLength(d)<=1}
function descriptor(patternId,d,{branchKey='',localKey=null,attentionKey=null,mergeable=true,recognitionCost=null,memoryWeight=null,metadata=null}={}){
  const base=BASE[patternId]||BASE.T_UNKNOWN;
  return {
    patternId,
    recognitionCost:recognitionCost==null?base.recognitionCost:recognitionCost,
    memoryWeight:memoryWeight==null?base.memoryWeight:memoryWeight,
    techniqueLevel:techniqueLevel(d),
    localKey:localKey??localityKey(d),
    attentionKey:attentionKey??localityKey(d),
    branchKey,
    mergeable,
    dependencyKeys:[...(d?.dependencies||[])],
    metadata:{rule:d?.rule||null,signature:d?.signature||d?.id||null,...copy(metadata||{})}
  };
}

function directPattern(d,{branchKey=''}={}){
  const rule=String(d?.rule||'');
  if(rule==='RELATION_PROPAGATION'){
    const length=relationPathLength(d),explicit=relationExplicit(d),patternId=explicit?'T_RELATION_DIRECT':'T_RELATION_CHAIN';
    return descriptor(patternId,d,{branchKey,recognitionCost:explicit?BASE.T_RELATION_DIRECT.recognitionCost:BASE.T_RELATION_CHAIN.recognitionCost+Math.max(0,length-2)*0.25,memoryWeight:explicit?1:BASE.T_RELATION_CHAIN.memoryWeight+Math.max(0,length-2)*0.25,metadata:{relationPathLength:length,explicit}})
  }
  if(rule==='TRIPLE_CONSTRAINT')return descriptor('T_NO_THREE',d,{branchKey});
  if(rule==='BALANCE_QUOTA')return descriptor('T_BALANCE_QUOTA',d,{branchKey});
  if(rule==='BALANCE_RELATION')return descriptor('T_BALANCE_RELATION',d,{branchKey});
  if(rule==='RELATION_BALANCE')return descriptor('T_RELATION_BALANCE',d,{branchKey});
  if(rule==='RELATION_BALANCE_COMPONENT')return descriptor('T_RELATION_COMPONENT',d,{branchKey});
  if(rule==='LINE_DOMAIN_SUPPORT')return descriptor('T_LINE_DOMAIN',d,{branchKey,mergeable:false});
  return descriptor('T_UNKNOWN',d,{branchKey,mergeable:false,metadata:{unknownRule:rule}})
}

function hypothesisPattern(parent,cell,value,branchKey){
  return descriptor('T_HYPOTHESIS',parent,{branchKey,localKey:`cell:${cellKey(cell)}`,attentionKey:`cell:${cellKey(cell)}`,mergeable:false,metadata:{assumption:{cell:copy(cell),value:Number(value)}}});
}
function witnessPattern(parent,witness,branchKey){
  const local=witness?.family!=null&&witness?.id!=null?`${witness.family}:${witness.id}`:(witness?.cells||witness?.block||[]).map(cellKey).filter(Boolean).sort().join('|')||'contradiction';
  return descriptor('T_CONTRADICTION_WITNESS',parent,{branchKey,localKey:local,attentionKey:local,mergeable:false,metadata:{witnessKind:witness?.kind||null}})
}

function patternsForContradiction(d){
  const x=d?.explanationData||{},assumption=x.assumption||{},cell=assumption.cell||d?.focusCells?.[0],value=Number(assumption.value),branch=`hyp:${cellKey(cell)}=${value}`,out=[];
  if(Array.isArray(cell))out.push(hypothesisPattern(d,cell,value,branch));
  for(const step of x.causalTrace||x.trace||[])out.push(directPattern(step,{branchKey:branch}));
  out.push(witnessPattern(d,x.witness||{},branch));
  return out;
}

function patternsForCommonConsequence(d){
  const x=d?.explanationData||{},cell=x.branchCell,branches=[['moon',0,x.moonCausalTrace||x.moonTrace||[]],['sun',1,x.sunCausalTrace||x.sunTrace||[]]],out=[];
  for(const [name,value,trace] of branches){const branch=`branch:${cellKey(cell)}=${value}`;if(Array.isArray(cell))out.push(hypothesisPattern(d,cell,value,branch));for(const step of trace||[])out.push(directPattern(step,{branchKey:branch}))}
  out.push(descriptor('T_BRANCH_COMPARE',d,{branchKey:'compare',localKey:`cell:${cellKey(cell)}`,attentionKey:`cell:${cellKey(cell)}`,mergeable:false,metadata:{branches:branches.map(x=>x[0])}}));
  return out;
}

function patternsForDeduction(d){
  if(!d)return [];
  if(d.rule==='ASSUMPTION_CONTRADICTION')return patternsForContradiction(d);
  if(d.rule==='COMMON_CONSEQUENCE')return patternsForCommonConsequence(d);
  return [directPattern(d)];
}
function profileForDeduction(d,options={}){return Cognitive.profileFromPatterns(patternsForDeduction(d),options)}
function costVectorForDeduction(d,legacy=[],options={}){return Cognitive.costVector(profileForDeduction(d,options),legacy)}

return Object.freeze({VERSION,CATALOG_VERSION,BASE,directPattern,patternsForContradiction,patternsForCommonConsequence,patternsForDeduction,profileForDeduction,costVectorForDeduction,_test:Object.freeze({cellKey,unitKey,sortedCells,localityKey,relationPathLength,relationExplicit,descriptor,hypothesisPattern,witnessPattern})});
});
