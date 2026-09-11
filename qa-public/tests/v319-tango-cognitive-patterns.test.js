#!/usr/bin/env node
'use strict';
const assert=require('assert');
const P=require('../../tango-cognitive-patterns.js');

function d(rule,{focusCells=[[0,0]],focusUnits=[],premises=[],conclusions=[{type:'VALUE',cell:[0,1],value:1}],explanationData={},techniqueLevel=1}={}){
  return {rule,focusCells,focusUnits,premises,conclusions,explanationData,techniqueLevel,dependencies:[],signature:`${rule}:${Math.random()}`};
}

const directRel=d('RELATION_PROPAGATION',{premises:[{kind:'RELATION',a:[0,0],b:[0,1],parity:0,explicit:true}],explanationData:{source:[0,0],target:[0,1]}});
const direct=P.directPattern(directRel);
assert.strictEqual(direct.patternId,'T_RELATION_DIRECT');
assert.strictEqual(direct.memoryWeight,1);

const chainRel=d('RELATION_PROPAGATION',{premises:[{kind:'RELATION',a:[0,0],b:[0,3],parity:1,explicit:false,path:[{a:[0,0],b:[0,1]},{a:[0,1],b:[0,2]},{a:[0,2],b:[0,3]}]}],explanationData:{source:[0,0],target:[0,3]}});
const chain=P.directPattern(chainRel);
assert.strictEqual(chain.patternId,'T_RELATION_CHAIN');
assert(chain.memoryWeight>1.25);

const shortContradiction=d('ASSUMPTION_CONTRADICTION',{
  focusCells:[[0,1]],
  conclusions:[{type:'VALUE',cell:[0,1],value:0}],
  explanationData:{
    assumption:{cell:[0,1],value:1},
    causalTrace:[
      d('TRIPLE_CONSTRAINT',{focusUnits:[{family:'row',id:0}],focusCells:[[0,0],[0,1],[0,2]]}),
      d('TRIPLE_CONSTRAINT',{focusUnits:[{family:'row',id:0}],focusCells:[[0,1],[0,2],[0,3]]})
    ],
    witness:{kind:'NO_LINE_COMPLETION',family:'row',id:0,cells:[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]]}
  }
});
const shortPatterns=P.patternsForDeduction(shortContradiction);
assert.strictEqual(shortPatterns[0].patternId,'T_HYPOTHESIS');
assert.strictEqual(shortPatterns.at(-1).patternId,'T_CONTRADICTION_WITNESS');
const shortProfile=P.profileForDeduction(shortContradiction);
assert(shortProfile.rawDepth>=4);
assert(shortProfile.chunkCount<=4);

const longTrace=[];
for(let i=0;i<12;i++)longTrace.push(d('TRIPLE_CONSTRAINT',{focusUnits:[{family:'row',id:i%6}],focusCells:[[i%6,0],[i%6,1],[i%6,2]]}));
const longContradiction=d('ASSUMPTION_CONTRADICTION',{
  focusCells:[[0,1]],
  conclusions:[{type:'VALUE',cell:[0,1],value:0}],
  explanationData:{assumption:{cell:[0,1],value:1},causalTrace:longTrace,witness:{kind:'NO_LINE_COMPLETION',family:'row',id:5,cells:[[5,0],[5,1],[5,2],[5,3],[5,4],[5,5]]}}
});
const longProfile=P.profileForDeduction(longContradiction);
assert.strictEqual(longProfile.loadBand,4);
assert(longProfile.depthPenalty>shortProfile.depthPenalty);
assert(longProfile.attentionSwitches>shortProfile.attentionSwitches);

const compressibleTrace=Array.from({length:99},()=>d('TRIPLE_CONSTRAINT',{focusUnits:[{family:'row',id:0}],focusCells:[[0,0],[0,1],[0,2]]}));
const compressible=d('ASSUMPTION_CONTRADICTION',{
  focusCells:[[0,1]],
  conclusions:[{type:'VALUE',cell:[0,1],value:0}],
  explanationData:{assumption:{cell:[0,1],value:1},causalTrace:compressibleTrace,witness:{kind:'NO_LINE_COMPLETION',family:'row',id:0,cells:[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]]}}
});
const compressed=P.profileForDeduction(compressible);
assert.strictEqual(compressed.rawDepth,101);
assert.strictEqual(compressed.chunkCount,3);
assert(compressed.displaySteps<10);

console.log('PASS v319-tango-cognitive-patterns',JSON.stringify({short:shortProfile,long:longProfile,compressed:{raw:compressed.rawDepth,chunks:compressed.chunkCount,depth:compressed.effectiveDepth}}));
