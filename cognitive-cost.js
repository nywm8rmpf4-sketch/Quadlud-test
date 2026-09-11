/*
 * QUADLUD — Generic cognitive chunk/cost model
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludCognitiveCost=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION=1;
const MODEL_ID='quadlud-cognitive-load-v1';
const DEFAULTS=Object.freeze({
  zeroCostDepth:3,
  quadraticThreshold:9,
  quadraticCoefficient:2,
  hypothesisBranchWeight:1
});

const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const nonNegative=(v,fallback=0)=>Math.max(0,finite(v,fallback));

function config(options={}){
  return Object.freeze({
    zeroCostDepth:nonNegative(options.zeroCostDepth,DEFAULTS.zeroCostDepth),
    quadraticThreshold:Math.max(nonNegative(options.zeroCostDepth,DEFAULTS.zeroCostDepth),nonNegative(options.quadraticThreshold,DEFAULTS.quadraticThreshold)),
    quadraticCoefficient:nonNegative(options.quadraticCoefficient,DEFAULTS.quadraticCoefficient),
    hypothesisBranchWeight:nonNegative(options.hypothesisBranchWeight,DEFAULTS.hypothesisBranchWeight)
  });
}

function depthPenalty(depth,options={}){
  const c=config(options),d=nonNegative(depth,0),a=c.zeroCostDepth,b=c.quadraticThreshold;
  if(d<=a)return 0;
  if(d<=b)return d-a;
  const x=d-b,linearAtThreshold=b-a;
  return linearAtThreshold+x+c.quadraticCoefficient*x*x;
}

function loadBand(depth){
  const d=nonNegative(depth,0);
  if(d<=3)return 0;
  if(d<=5)return 1;
  if(d<=7)return 2;
  if(d<=9)return 3;
  return 4;
}

function normalizePattern(raw,index=0){
  if(!raw||typeof raw!=='object')throw new Error(`Invalid cognitive pattern at ${index}`);
  const patternId=String(raw.patternId||raw.id||'').trim();
  if(!patternId)throw new Error(`Missing cognitive pattern id at ${index}`);
  return Object.freeze({
    patternId,
    recognitionCost:nonNegative(raw.recognitionCost,1),
    memoryWeight:nonNegative(raw.memoryWeight,1),
    techniqueLevel:nonNegative(raw.techniqueLevel,0),
    localKey:String(raw.localKey??''),
    branchKey:String(raw.branchKey??''),
    attentionKey:String(raw.attentionKey??raw.localKey??''),
    mergeable:raw.mergeable!==false,
    dependencyKeys:Array.isArray(raw.dependencyKeys)?raw.dependencyKeys.map(String).filter(Boolean):[],
    sourceIndex:Number.isInteger(raw.sourceIndex)?raw.sourceIndex:index,
    metadata:copy(raw.metadata||null)
  });
}

function canMerge(a,b){
  return !!a&&!!b&&a.mergeable&&b.mergeable&&
    a.patternId===b.patternId&&a.branchKey===b.branchKey&&a.localKey===b.localKey;
}

function chunkPatterns(patterns){
  const normalized=(patterns||[]).map(normalizePattern),chunks=[];
  for(const p of normalized){
    const previous=chunks[chunks.length-1];
    if(previous&&canMerge(previous,p)){
      previous.sourceIndices.push(p.sourceIndex);
      previous.rawCount++;
      previous.recognitionCost=Math.max(previous.recognitionCost,p.recognitionCost);
      previous.memoryWeight=Math.max(previous.memoryWeight,p.memoryWeight);
      previous.techniqueLevel=Math.max(previous.techniqueLevel,p.techniqueLevel);
      previous.dependencyKeys=[...new Set(previous.dependencyKeys.concat(p.dependencyKeys))];
      continue;
    }
    chunks.push({
      id:`chunk-${chunks.length+1}`,
      patternId:p.patternId,
      recognitionCost:p.recognitionCost,
      memoryWeight:p.memoryWeight,
      techniqueLevel:p.techniqueLevel,
      localKey:p.localKey,
      branchKey:p.branchKey,
      attentionKey:p.attentionKey,
      dependencyKeys:p.dependencyKeys.slice(),
      sourceIndices:[p.sourceIndex],
      rawCount:1
    });
  }
  return chunks.map(c=>Object.freeze({...c,sourceIndices:Object.freeze(c.sourceIndices.slice()),dependencyKeys:Object.freeze(c.dependencyKeys.slice())}));
}

function attentionSwitchCount(chunks){
  let previous=null,count=0;
  for(const chunk of chunks||[]){
    const key=String(chunk?.attentionKey||'');
    if(!key)continue;
    if(previous!==null&&key!==previous)count++;
    previous=key;
  }
  return count;
}

function branchCount(chunks){return new Set((chunks||[]).map(c=>String(c?.branchKey||'')).filter(Boolean)).size}

function longestWeightedPath(chunks){
  const list=chunks||[];
  if(!list.length)return 0;
  // v1 supports explicit chunk dependencies when available. A flat proof falls
  // back to the ordered causal chain, which is conservative and deterministic.
  const byKey=new Map(),scores=new Map();
  list.forEach((chunk,index)=>{byKey.set(chunk.id,chunk);byKey.set(String(index),chunk)});
  let running=0,max=0;
  for(let i=0;i<list.length;i++){
    const chunk=list[i],weight=nonNegative(chunk.memoryWeight,1),deps=chunk.dependencyKeys||[];
    let base=0,matched=false;
    for(const key of deps){
      if(scores.has(String(key))){base=Math.max(base,scores.get(String(key)));matched=true}
    }
    if(!matched)base=running;
    const score=base+weight;
    scores.set(chunk.id,score);scores.set(String(i),score);
    running=score;max=Math.max(max,score);
  }
  return max;
}

function profileFromPatterns(patterns,options={}){
  const chunks=chunkPatterns(patterns),hypothesisBranches=Number.isInteger(options.hypothesisBranches)?Math.max(0,options.hypothesisBranches):branchCount(chunks),c=config(options),hypothesisLoad=Math.max(0,hypothesisBranches-1)*c.hypothesisBranchWeight;
  const weightedPath=longestWeightedPath(chunks),effectiveDepth=weightedPath+hypothesisLoad,recognitionCost=chunks.reduce((s,x)=>s+nonNegative(x.recognitionCost,0),0),attentionSwitches=attentionSwitchCount(chunks),penalty=depthPenalty(effectiveDepth,c);
  return Object.freeze({
    schema:1,
    modelId:MODEL_ID,
    rawDepth:(patterns||[]).length,
    chunkCount:chunks.length,
    displaySteps:Number.isInteger(options.displaySteps)?Math.max(0,options.displaySteps):chunks.length,
    effectiveDepth,
    weightedPath,
    hypothesisLoad,
    hypothesisBranches,
    recognitionCost,
    attentionSwitches,
    depthPenalty:penalty,
    loadBand:loadBand(effectiveDepth),
    chunks:Object.freeze(chunks.slice())
  });
}

function costVector(profile,legacy=[]){
  const p=profile||{};
  return Object.freeze([
    nonNegative(p.loadBand,0),
    nonNegative(p.depthPenalty,0),
    nonNegative(p.recognitionCost,0),
    Math.max(0,nonNegative(p.hypothesisBranches,0)-1),
    nonNegative(p.attentionSwitches,0),
    ...(Array.isArray(legacy)?legacy.map(x=>finite(x,0)):[])
  ]);
}

function compareCostVector(a,b){
  for(let i=0;i<Math.max(a?.length||0,b?.length||0);i++){
    const x=finite(a?.[i],0),y=finite(b?.[i],0);if(x!==y)return x-y;
  }
  return 0;
}

return Object.freeze({VERSION,MODEL_ID,DEFAULTS,config,depthPenalty,loadBand,normalizePattern,canMerge,chunkPatterns,attentionSwitchCount,branchCount,longestWeightedPath,profileFromPatterns,costVector,compareCostVector});
});
