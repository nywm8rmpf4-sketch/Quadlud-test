'use strict';
const assert=require('assert');
global.lang=()=> 'fr';
const M=require('../GitHub/tango-tutor-clarity.js');
const P=require('../GitHub/tango-progressive-proof-bridge.js');

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

// Progressive Tutor projection must reuse the same complete recursive provenance,
// rather than replacing it with a false "proof chain unavailable" message.
const projected=P._test.clarifyDerivedRelation({
  pedagogyStageKind:'reasoning',deduction:derived,
  presentation:{metadata:{},explanation:{where:'',why:'',move:''}}
});
assert.strictEqual(projected.proofCompleteness,'complete-derived-relation-provenance');
assert.strictEqual(projected.presentation.metadata.proofCompleteness,'complete-derived-relation-provenance');
assert(projected.why.includes('règle des trois'),projected.why);
assert(!projected.why.includes('chaîne de preuve complète n’est pas disponible'),projected.why);

// Missing provenance must be surfaced honestly, never disguised as a proof.
const missing=JSON.parse(JSON.stringify(derived));delete missing.premises[1].path[0].support;
const z=M._test.relationExplanation(missing,'fr');
assert.strictEqual(z.complete,false);
assert(z.steps.join(' ').includes('provenance nécessaire'));
assert(!z.steps.join(' ').toLowerCase().includes('déjà démontr'));
const projectedMissing=P._test.clarifyDerivedRelation({
  pedagogyStageKind:'reasoning',deduction:missing,
  presentation:{metadata:{},explanation:{where:'',why:'',move:''}}
});
assert.strictEqual(projectedMissing.proofCompleteness,'missing-relation-provenance');
assert(projectedMissing.why.includes('chaîne de preuve complète n’est pas disponible'));


// Semantic-review regression R8: a line-domain relation proof must stay local and compact.
// Nested relation provenance is still verified for completeness, but must not be replayed in
// the visible explanation where it created duplicated and even contextually contradictory chains.
const domainSupport={
  rule:'LINE_DOMAIN_SUPPORT',
  premises:[{kind:'RELATION',a:[1,3],b:[1,4],parity:0,explicit:false,path:[{a:[1,3],b:[1,4],parity:0,explicit:true}]}],
  conclusions:[{type:'RELATION',a:[1,0],b:[1,1],parity:1}],
  explanationData:{family:'row',id:1,domainCount:2,domains:[[1,0,0,1,1,0],[0,1,0,1,1,0]]}
};
const domainEdge={from:[1,0],to:[1,1],parity:1};
const domainProof=M._test.supportRelationLines(domainSupport,domainEdge,'fr');
assert.strictEqual(domainProof.complete,true);
assert(domainProof.lines.length<=3,domainProof.lines.join(' '));
const domainText=domainProof.lines.join(' ');
assert(domainText.includes('Configurations compatibles : ☀☾☾☀☀☾ ou ☾☀☾☀☀☾.'),domainText);
assert(domainText.includes('B1 et B2 sont opposées'),domainText);
assert(!domainText.includes('B4 = B5'),domainText);
const incompleteDomain=JSON.parse(JSON.stringify(domainSupport));
delete incompleteDomain.premises[0].path;
const incompleteDomainProof=M._test.supportRelationLines(incompleteDomain,domainEdge,'fr');
assert.strictEqual(incompleteDomainProof.complete,false);
assert(incompleteDomainProof.lines.join(' ').includes('provenance nécessaire'));

console.log('v319-r3ui-tango-tutor-clarity.test.js: PASS');
