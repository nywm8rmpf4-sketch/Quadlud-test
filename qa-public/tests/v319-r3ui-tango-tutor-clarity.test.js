'use strict';
const assert=require('assert');
const M=require('../GitHub/tango-tutor-clarity.js');

// Multi-edge relation: every edge is explicit, so the local proof can replay
// the whole path without depending on a previous Tutor page.
const multi={
  rule:'RELATION_PROPAGATION',
  premises:[
    {kind:'VALUE',cell:[2,2],value:1},
    {kind:'RELATION',a:[2,2],b:[3,3],parity:0,explicit:false,path:[
      {a:[2,2],b:[3,2],parity:1,explicit:true},
      {a:[3,2],b:[3,3],parity:1,explicit:true}
    ]}
  ],
  conclusions:[{type:'VALUE',cell:[3,3],value:1}],
  explanationData:{source:[2,2],target:[3,3],sourceValue:1,parity:0}
};
const x=M._test.relationExplanation(multi,'fr');
assert.strictEqual(x.complete,true);
assert.strictEqual(x.where,'Vérifie C3 → D3 → D4.');
assert.strictEqual(x.steps[0],'1. L’indice visible C3 × D3 : C3 et D3 sont opposées.');
assert.strictEqual(x.steps[1],'2. L’indice visible D3 × D4 : D3 et D4 sont opposées.');
assert.strictEqual(x.steps[2],'3. En combinant ces relations, C3 et D4 sont identiques.');
assert.strictEqual(x.steps[3],'4. C3 = soleil 🌞.');
assert.strictEqual(x.steps[4],'5. Comme C3 et D4 sont identiques, D4 = soleil 🌞.');
assert.strictEqual(x.conclusion,'Conclusion intermédiaire : D4 = soleil 🌞.');
assert.deepStrictEqual(M._test.relationPathCells([2,2],[3,3],multi.premises[1].path),[[2,2],[3,2],[3,3]]);

// Human-test regression: A6=C6 is not a visible clue. It was derived because
// A6=B6 is visible and the no-three rule forces C6 to be opposite.
const support={
  id:'D7',rule:'TRIPLE_CONSTRAINT',
  premises:[{kind:'RELATION',a:[0,5],b:[1,5],parity:0,explicit:true,path:[{a:[0,5],b:[1,5],parity:0,explicit:true}]}],
  conclusions:[{type:'RELATION',a:[2,5],b:[0,5],parity:1}],
  explanationData:{family:'column',id:5,window:[[0,5],[1,5],[2,5]],pair:[[0,5],[1,5]],target:[2,5],mode:'RELATION'}
};
const derived={
  rule:'RELATION_PROPAGATION',
  premises:[
    {kind:'VALUE',cell:[0,5],value:0},
    {kind:'RELATION',a:[0,5],b:[2,5],parity:1,explicit:false,path:[{a:[0,5],b:[2,5],parity:1,explicit:false,deductionId:'D7',support}]}
  ],
  conclusions:[{type:'VALUE',cell:[2,5],value:1}],
  explanationData:{source:[0,5],target:[2,5],sourceValue:0,parity:1}
};
const y=M._test.relationExplanation(derived,'fr');
assert.strictEqual(y.complete,true);
assert.strictEqual(y.where,'Vérifie A6 → C6.');
assert(y.steps.some(s=>s.includes('L’indice visible A6 = B6')));
assert(y.steps.some(s=>s.includes('A6–B6–C6')));
assert(y.steps.some(s=>s.includes('règle des trois')));
assert(y.steps.some(s=>s.includes('A6 = lune 🌙')));
assert(y.steps.some(s=>s.includes('C6 = soleil 🌞')));
assert.strictEqual(y.conclusion,'Conclusion intermédiaire : C6 = soleil 🌞.');
const wording=(y.steps.join(' ')+' '+y.conclusion).toLowerCase();
for(const banned of ['déjà démontr','déjà déduit','comme vu précédemment','résultat précédent'])assert(!wording.includes(banned),wording);
assert.deepStrictEqual(M._test.relationFocusCells(derived),[[0,5],[2,5]]);

// Missing provenance must be surfaced honestly, never disguised as a proof.
const missing=JSON.parse(JSON.stringify(derived));delete missing.premises[1].path[0].support;
const z=M._test.relationExplanation(missing,'fr');
assert.strictEqual(z.complete,false);
assert(z.steps.join(' ').includes('provenance nécessaire'));
assert(!z.steps.join(' ').toLowerCase().includes('déjà démontr'));

console.log('v319-r3ui-tango-tutor-clarity.test.js: PASS');
