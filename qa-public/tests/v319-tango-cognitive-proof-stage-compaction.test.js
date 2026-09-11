#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Bridge=require('../../tango-cognitive-proof-stages-bridge.js');

function deduction(i){return {
  rule:'TRIPLE_CONSTRAINT',signature:`t-${i}`,focusUnits:[{family:'row',id:0}],focusCells:[[0,0],[0,1],[0,2]],
  premises:[{kind:'VALUE',cell:[0,0],value:0},{kind:'VALUE',cell:[0,1],value:0}],
  conclusions:[{type:'VALUE',cell:[0,2],value:1}],explanationData:{family:'row',id:0}
}}
const trace=Array.from({length:99},(_,i)=>deduction(i));
const advanced={
  rule:'ASSUMPTION_CONTRADICTION',signature:'advanced-99',focusCells:[[0,1]],
  premises:[{kind:'ASSUMPTION',cell:[0,1],value:1,hypothesis:true}],conclusions:[{type:'VALUE',cell:[0,1],value:0}],
  explanationData:{assumption:{cell:[0,1],value:1},causalTrace:trace,witness:{kind:'NO_LINE_COMPLETION',family:'row',id:0,cells:[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]]}}
};
const hypothesis={kind:'hypothesis',deduction:{rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:[0,1],value:1,hypothesis:true}],conclusions:[]},presentation:{metadata:{},explanation:{why:'hyp'}}};
const reasoning=trace.map((d,i)=>({kind:'reasoning',deduction:d,presentation:{metadata:{},explanation:{why:`step ${i+1}`}}}));
const contradiction={kind:'contradiction',deduction:{rule:'ASSUMPTION_CONTRADICTION',focusCells:[[0,0],[0,1],[0,2]],conclusions:[]},presentation:{metadata:{},explanation:{why:'dead end'}}};
const action={kind:'action',deduction:{rule:'ASSUMPTION_CONTRADICTION',conclusions:[{type:'VALUE',cell:[0,1],value:0}]},presentation:{metadata:{},explanation:{why:'conclusion',move:'A2'}}};
const raw=[hypothesis,...reasoning,contradiction,action];
assert.strictEqual(raw.length,102);
const compact=Bridge.compactProofStages(advanced,raw);
assert.strictEqual(compact.length,4,'99 same-pattern micro-stages should become one reasoning chunk between hypothesis and contradiction/action');
assert.strictEqual(compact[0].kind,'hypothesis');
assert.strictEqual(compact[1].kind,'reasoning');
assert.strictEqual(compact[2].kind,'contradiction');
assert.strictEqual(compact[3].kind,'action');
assert.strictEqual(compact[1].cognitiveChunk.rawCount,99);
assert.strictEqual(compact[1].deduction.explanationData.cognitiveChunkMembers.length,99,'all machine proof members must remain available for validation/audit');
assert(compact[1].presentation.metadata.cognitiveChunk);
assert(!compact[1].presentation.explanation.why.includes('step 98'),'raw screen-by-screen text must not leak into compact presentation');
assert.deepStrictEqual(raw[1].deduction,trace[0],'compaction must not mutate source proof');

const variedTrace=Array.from({length:12},(_,i)=>({...deduction(i),focusUnits:[{family:'row',id:i%6}],focusCells:[[i%6,0],[i%6,1],[i%6,2]]}));
const varied={...advanced,signature:'advanced-varied',explanationData:{...advanced.explanationData,causalTrace:variedTrace}};
const variedRaw=[hypothesis,...variedTrace.map((d,i)=>({kind:'reasoning',deduction:d,presentation:{metadata:{},explanation:{why:`v${i}`}}})),contradiction,action];
const variedCompact=Bridge.compactProofStages(varied,variedRaw);
assert(variedCompact.length>4,'different attention zones must not collapse into one chunk');
assert(variedCompact.length<variedRaw.length+1);

console.log('PASS v319-tango-cognitive-proof-stage-compaction',JSON.stringify({raw:raw.length,compact:compact.length,members:compact[1].cognitiveChunk.rawCount,variedRaw:variedRaw.length,variedCompact:variedCompact.length}));
