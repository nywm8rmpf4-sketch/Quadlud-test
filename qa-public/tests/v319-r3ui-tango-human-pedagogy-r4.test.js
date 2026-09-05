#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Human=require(path.join(ROOT,'GitHub','tango-human-pedagogy-r4.js'));

assert.strictEqual(Human.VERSION,1);
assert.strictEqual(Human.POLICY,'tango-human-proof-minimal-v4');

const fakePresenter={
  presentation(d){return {rule:d.rule,rank:d.rank||0,technique:d.rule,techniqueLevel:d.techniqueLevel||0,explanation:{title:d.rule,where:`where:${d.rule}`,why:`why:${d.rule}`,move:this.conclusionText(d)},metadata:{showTutorMove:false}}},
  conclusionText(d){return (d.conclusions||[]).filter(c=>c.type==='VALUE').map(c=>`${String.fromCharCode(65+c.cell[0])}${c.cell[1]+1}=${c.value}`).join(' · ')},
  contradictionText(w){return `${w.family||''}:${w.id??''}:${w.kind||''}`}
};
const irrelevant={id:'irrelevant',signature:'irrelevant',rule:'BALANCE_QUOTA',premises:[],focusCells:[[5,5]],conclusions:[{type:'VALUE',cell:[5,5],value:1}]};
const step1={id:'s1',signature:'s1',rule:'TRIPLE_CONSTRAINT',premises:[{kind:'VALUE',cell:[0,0],value:0},{kind:'VALUE',cell:[0,2],value:0}],focusCells:[[0,0],[0,1],[0,2]],conclusions:[{type:'VALUE',cell:[0,1],value:1}]};
const step2={id:'s2',signature:'s2',rule:'RELATION_PROPAGATION',premises:[{kind:'VALUE',cell:[0,1],value:1},{kind:'RELATION',a:[0,1],b:[2,1],parity:1}],focusCells:[[0,1],[2,1]],conclusions:[{type:'VALUE',cell:[2,1],value:0}],explanationData:{source:[0,1],target:[2,1],sourceValue:1,parity:1}};
const contradiction={
  id:'c',signature:'c',rule:'ASSUMPTION_CONTRADICTION',rank:2,techniqueLevel:2,
  premises:[{kind:'ASSUMPTION',cell:[0,4],value:0}],focusCells:[[0,4]],
  conclusions:[{type:'VALUE',cell:[0,4],value:1}],
  explanationData:{assumption:{cell:[0,4],value:0},witness:{kind:'TRIPLE_OVERFLOW',family:'column',id:1,cells:[[2,1],[3,1],[4,1]]},trace:[irrelevant,step1,step2],causalTrace:[step1,step2]}
};
const stages=Human.proofStagesForDeduction(contradiction,fakePresenter);
assert.deepStrictEqual(stages.map(s=>s.kind),['hypothesis','reasoning','reasoning','contradiction','action'],'long contradiction must become a progressive human proof');
assert.strictEqual(stages[1].deduction.id,'s1');
assert.strictEqual(stages[2].deduction.id,'s2');
assert(!JSON.stringify(stages).includes('irrelevant'),'future/exploration trace outside causalTrace must not become a Tutor sub-step');
assert.deepStrictEqual(stages[0].deduction.focusCells,[[0,4]],'hypothesis stage must focus only the assumed cell');
assert.deepStrictEqual(stages[3].deduction.focusCells,[[2,1],[3,1],[4,1]],'dead-end stage must focus only the concrete witness');
assert.deepStrictEqual(stages.at(-1).deduction.conclusions,[{type:'VALUE',cell:[0,4],value:1}],'action stage must contain only the advised conclusion');

const helperPresenter={
  explanation:()=> 'fallback',
  conclusionText:d=>(d.conclusions||[]).filter(c=>c.type==='VALUE').map(c=>`${String.fromCharCode(65+c.cell[0])}${c.cell[1]+1} = ${c.value===1?'sun ☀':'moon ☾'}`).join(' · ')
};
const h={lang:()=> 'fr',tr:k=>k==='rowLabel'?'ligne':k==='columnLabel'?'colonne':k,cellName:(r,c)=>`${String.fromCharCode(65+r)}${c+1}`,pieceName:(_g,v)=>v===1?'sun ☀':'moon ☾'};
const triple={rule:'TRIPLE_CONSTRAINT',focusUnits:[{family:'column',id:0}],premises:[{kind:'VALUE',cell:[2,0],value:1},{kind:'VALUE',cell:[4,0],value:1}],conclusions:[{type:'VALUE',cell:[3,0],value:0}]};
const tripleText=Human._test.concreteExplanation(helperPresenter,triple,h);
assert(tripleText.includes('C1')&&tripleText.includes('E1')&&tripleText.includes('D1'),'rule-of-three explanation must name the concrete cells');
assert(tripleText.includes('trois')&&tripleText.includes('interdit'),'rule-of-three explanation must state the concrete forbidden pattern');
assert(!/surlign/i.test(tripleText),'human explanation must not depend on vague “highlighted cells” wording');

const relationBalance={rule:'RELATION_BALANCE',focusUnits:[{family:'column',id:0}],premises:[{kind:'VALUE',cell:[1,0],value:0},{kind:'VALUE',cell:[2,0],value:0},{kind:'RELATION',a:[4,0],b:[5,0],parity:0,relation:'SAME'}],conclusions:[{type:'VALUE',cell:[4,0],value:1},{type:'VALUE',cell:[5,0],value:1}]};
const relationText=Human._test.concreteExplanation(helperPresenter,relationBalance,h);
for(const coord of ['B1','C1','E1','F1'])assert(relationText.includes(coord),`relation/balance explanation must name ${coord}`);
assert(relationText.includes('=')&&relationText.includes('équilibre'),'relation/balance explanation must state the visible relation and balance reason');
assert(!/contribution déterminée/i.test(relationText),'abstract relation/balance wording must not survive');

const runtime=fs.readFileSync(path.join(ROOT,'GitHub','tango-human-pedagogy-r4.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'GitHub','tango-human-pedagogy-r4.css'),'utf8');
assert(runtime.includes("selectionStatus:'human-proof-global-minimum'"),'move selection must explicitly use the global human-proof minimum policy');
assert(runtime.includes('bestByMove'),'the runtime must minimize the proof per move before comparing different moves');
assert(runtime.includes("pedagogyProgression='past-current-future-hidden'"),'Tutor progression must hide future proof cells');
assert(css.includes('.walkthrough-past-proof'),'past proof cells need a distinct attenuated role');
assert(css.includes('[data-proof-stage-kind="reasoning"] .walkthrough-move'),'intermediate Tutor stages must not repeat the final move text');
assert(!/hidden solution|final solution|backtrack/i.test(runtime),'human-first orchestration must not consult or describe hidden-solution reasoning');

console.log('v319-r3ui-tango-human-pedagogy-r4.test.js: PASS');
