'use strict';
const assert=require('assert');
const M=require('../GitHub/tango-tutor-clarity.js');
const d={
  rule:'RELATION_PROPAGATION',
  premises:[
    {kind:'VALUE',cell:[2,2],value:1},
    {kind:'RELATION',a:[2,2],b:[3,3],parity:0,explicit:false,path:[
      {a:[2,2],b:[3,2],parity:1},
      {a:[3,2],b:[3,3],parity:1}
    ]}
  ],
  conclusions:[{type:'VALUE',cell:[3,3],value:1}],
  explanationData:{source:[2,2],target:[3,3],sourceValue:1,parity:0}
};
const x=M._test.relationExplanation(d,'fr');
assert.strictEqual(x.where,'Suis le chemin C3 → D3 → D4.');
assert.strictEqual(x.steps[0],'1. C3 × D3 : C3 et D3 sont opposées.');
assert.strictEqual(x.steps[1],'2. D3 × D4 : D3 et D4 sont opposées.');
assert.strictEqual(x.steps[2],"3. Deux oppositions successives s’annulent : D4 a le même symbole que C3.");
assert.strictEqual(x.steps[3],'4. C3 est un soleil 🌞.');
assert.strictEqual(x.conclusion,'Conclusion intermédiaire : D4 est donc un soleil 🌞.');
assert.deepStrictEqual(M._test.relationPathCells([2,2],[3,3],d.premises[1].path),[[2,2],[3,2],[3,3]]);
assert.deepStrictEqual(M._test.relationFocusCells(d),[[2,2],[3,2],[3,3]]);
console.log('v319-r3ui-tango-tutor-clarity.test.js: PASS');
