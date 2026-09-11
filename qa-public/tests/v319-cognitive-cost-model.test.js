#!/usr/bin/env node
'use strict';
const assert=require('assert');
const C=require('../../cognitive-cost.js');

assert.strictEqual(C.VERSION,1);
assert.strictEqual(C.depthPenalty(0),0);
assert.strictEqual(C.depthPenalty(3),0);
assert.strictEqual(C.depthPenalty(4),1);
assert.strictEqual(C.depthPenalty(9),6);
assert.strictEqual(C.depthPenalty(10),9);
assert.strictEqual(C.depthPenalty(12),27);
for(let d=0;d<30;d+=0.25)assert(C.depthPenalty(d+0.25)>=C.depthPenalty(d),`non-monotonic at ${d}`);
assert.deepStrictEqual([0,3,4,5,6,7,8,9,10].map(C.loadBand),[0,0,1,1,2,2,3,3,4]);

const repeated=Array.from({length:99},(_,i)=>({
  patternId:'T_RELATION_CHAIN',recognitionCost:1,memoryWeight:1,techniqueLevel:1,
  localKey:'row:A',branchKey:'hyp:A2=sun',attentionKey:'row:A',sourceIndex:i
}));
const repeatedProfile=C.profileFromPatterns(repeated);
assert.strictEqual(repeatedProfile.rawDepth,99);
assert.strictEqual(repeatedProfile.chunkCount,1);
assert.strictEqual(repeatedProfile.effectiveDepth,1);
assert.strictEqual(repeatedProfile.depthPenalty,0);
assert.strictEqual(repeatedProfile.displaySteps,1);

const differentLocal=C.chunkPatterns([
  {patternId:'P',localKey:'row:A',branchKey:'h',memoryWeight:1,recognitionCost:1},
  {patternId:'P',localKey:'row:B',branchKey:'h',memoryWeight:1,recognitionCost:1}
]);
assert.strictEqual(differentLocal.length,2);

const differentBranch=C.chunkPatterns([
  {patternId:'P',localKey:'row:A',branchKey:'h0',memoryWeight:1,recognitionCost:1},
  {patternId:'P',localKey:'row:A',branchKey:'h1',memoryWeight:1,recognitionCost:1}
]);
assert.strictEqual(differentBranch.length,2);

const noMerge=C.chunkPatterns([
  {patternId:'P',localKey:'row:A',branchKey:'h',mergeable:false,memoryWeight:1,recognitionCost:1},
  {patternId:'P',localKey:'row:A',branchKey:'h',memoryWeight:1,recognitionCost:1}
]);
assert.strictEqual(noMerge.length,2);

const short=C.profileFromPatterns([
  {patternId:'A',localKey:'A',memoryWeight:1,recognitionCost:1},
  {patternId:'B',localKey:'A',memoryWeight:1,recognitionCost:1},
  {patternId:'C',localKey:'A',memoryWeight:1,recognitionCost:1}
]);
const deep=C.profileFromPatterns(Array.from({length:11},(_,i)=>({patternId:`P${i}`,localKey:`L${i}`,memoryWeight:1,recognitionCost:1})));
assert.strictEqual(short.loadBand,0);
assert.strictEqual(short.depthPenalty,0);
assert.strictEqual(deep.loadBand,4);
assert(deep.depthPenalty>6);
assert(C.compareCostVector(C.costVector(short),C.costVector(deep))<0);

const attention=C.profileFromPatterns([
  {patternId:'A',localKey:'A',attentionKey:'row:A',memoryWeight:1,recognitionCost:1},
  {patternId:'B',localKey:'B',attentionKey:'row:A',memoryWeight:1,recognitionCost:1},
  {patternId:'C',localKey:'C',attentionKey:'col:4',memoryWeight:1,recognitionCost:1},
  {patternId:'D',localKey:'D',attentionKey:'row:F',memoryWeight:1,recognitionCost:1}
]);
assert.strictEqual(attention.attentionSwitches,2);

console.log('PASS v319-cognitive-cost-model',JSON.stringify({model:C.MODEL_ID,deepPenalty:deep.depthPenalty,repeatedChunks:repeatedProfile.chunkCount}));
