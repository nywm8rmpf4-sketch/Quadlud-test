'use strict';
const assert=require('assert');
const Logic=require('../GitHub/tango-logic.js');
global.TangoLogic=Logic;
const Base=require('../GitHub/tango-played-move-runtime.js');
const Bridge=require('../GitHub/tango-human-cost-bridge.js');
const Human=require('../GitHub/tango-human-pedagogy-r4.js');

Bridge.installRelationEvidence();
const cellName=(r,c)=>`${String.fromCharCode(65+Number(r))}${Number(c)+1}`;
const state=Array.from({length:6},()=>Array(6).fill(-1));
state[0][2]=1;
const session=Logic.createSession({n:6,state,edges:[[0,0,'r','=']]});
const direct=Bridge._test.selfContainedDirectCandidates(Base,session,[0,0],0)[0]?.deduction;
assert(direct,'fixture must expose a direct A1=moon proof');
assert.strictEqual(direct.rule,'RELATION_BALANCE');
assert.strictEqual(direct.explanationData?.rejected?.kind,'TRIPLE_OVERFLOW');
assert.deepStrictEqual(direct.explanationData.rejected.cells,[[0,0],[0,1],[0,2]]);

let currentLang='fr';
const piece=value=>Number(value)===1?(currentLang==='fr'?'soleil ☀':'sun ☀'):(currentLang==='fr'?'lune ☾':'moon ☾');
const helpers={
  lang:()=>currentLang,
  cellName,
  pieceName:(_game,value)=>piece(value),
  tr:key=>currentLang==='fr'?(key==='rowLabel'?'ligne':'colonne'):(key==='rowLabel'?'row':'column')
};
const presenter={
  conclusionText(d){return (d?.conclusions||[]).filter(c=>c?.type==='VALUE').map(c=>`${cellName(...c.cell)} = ${piece(c.value)}`).join(', ')},
  explanation(){return 'GENERIC_FALLBACK'}
};

const fr=Human._test.concreteExplanation(presenter,direct,helpers);
for(const token of ['A1','A2','A3','soleil','trois','interdit','lune'])assert(fr.toLowerCase().includes(token.toLowerCase()),`French explanation must contain ${token}: ${fr}`);
assert(!fr.includes('GENERIC_FALLBACK'),fr);
assert(!/une seule orientation[^.]*équilibre/i.test(fr),`French explanation must name the actual no-three witness: ${fr}`);
assert(!/\bsun\b|\bmoon\b/i.test(fr),`French explanation must not leak English piece names: ${fr}`);

currentLang='en';
const en=Human._test.concreteExplanation(presenter,direct,helpers);
for(const token of ['A1','A2','A3','sun','three','forbidden','moon'])assert(en.toLowerCase().includes(token.toLowerCase()),`English explanation must contain ${token}: ${en}`);
assert(!en.includes('GENERIC_FALLBACK'),en);
assert(!/only one orientation[^.]*balance/i.test(en),`English explanation must name the actual no-three witness: ${en}`);
assert(!/soleil|lune/i.test(en),`English explanation must not retain French piece names after a language change: ${en}`);

console.log('v319-r3ui-tango-a1a2a3-explanation.test.js: PASS');
