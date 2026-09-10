'use strict';
const assert=require('assert'),R=require('../GitHub/tango-tutor-causal-atomic-r55.js'),T=R._test;
const rel=(source,target,value,sourceValue,path,seq)=>({pedagogyStageKind:'reasoning',deduction:{rule:'RELATION_PROPAGATION',premises:[{kind:'VALUE',cell:source,value:sourceValue,hypothesis:false},{kind:'RELATION',a:source,b:target,parity:sourceValue===value?0:1,path}],focusCells:[source,target],conclusions:[{type:'VALUE',cell:target,value}],explanationData:{source,target,sourceValue,parity:sourceValue===value?0:1}},causalStep:{kind:'deduction',hypothetical:true,sequenceIndex:seq,cellRoles:{premiseCells:[source]},producedCells:[target]}});
const support={rule:'LINE_DOMAIN_SUPPORT',premises:[{kind:'VALUE',cell:[0,2],value:1,hypothesis:true},{kind:'VALUE',cell:[5,2],value:1}],conclusions:[{type:'RELATION',a:[0,2],b:[4,2],parity:1}],explanationData:{family:'column',id:2,quota:3,domainCount:2,domains:[[1,0,1,0,0,1],[1,0,0,1,0,1]]}};
const known=new Map([['0,2',1],['1,2',0]]);
const a4=rel([1,2],[0,3],1,0,[{a:[1,2],b:[1,3],parity:1,explicit:true},{a:[1,3],b:[0,3],parity:0,explicit:true}],2),a4Atoms=T.atomizeRelationEntry(a4,known,null);assert.equal(a4Atoms.length,2);assert.deepEqual(a4Atoms.map(m=>T.valueFacts(T.deduction(m))[0]),[{cell:[1,3],value:1},{cell:[0,3],value:1}]);
const b5=rel([1,2],[1,4],0,0,[{a:[1,2],b:[1,3],parity:1,explicit:true},{a:[1,3],b:[1,4],parity:1,explicit:true}],3),b5Atoms=T.atomizeRelationEntry(b5,known,null);assert.equal(b5Atoms.length,1);assert.deepEqual(T.valueFacts(T.deduction(b5Atoms[0]))[0],{cell:[1,4],value:0});
const e5=rel([0,2],[4,4],1,1,[{a:[0,2],b:[4,2],parity:1,explicit:false,support},{a:[4,2],b:[4,4],parity:1,explicit:true}],4),e5Atoms=T.atomizeRelationEntry(e5,known,null);assert.equal(e5Atoms.length,3);assert.equal(T.deduction(e5Atoms[0]).rule,'LINE_DOMAIN_SUPPORT');assert.deepEqual(e5Atoms.slice(1).map(m=>T.valueFacts(T.deduction(m))[0]),[{cell:[4,2],value:0},{cell:[4,4],value:1}]);assert.deepEqual(T.deduction(e5Atoms[2]).premises.find(p=>p.kind==='VALUE').cell,[4,2]);
const unsupportedKnown=new Map([['0,5',0]]),unsupported=rel([0,5],[0,2],0,0,[{a:[0,5],b:[0,3],parity:1,explicit:false},{a:[0,3],b:[0,2],parity:1,explicit:false}],1),untouched=T.atomizeRelationEntry(unsupported,unsupportedKnown,null);assert.equal(untouched.length,1);assert.equal(untouched[0],unsupported);assert.equal(unsupportedKnown.size,1);
// Hidden-only preservation: if a path intermediate is already produced by
// another original proof entry, it is part of the planner's causal order and
// must not be materialized again by atomization.
const plannedB4=rel([2,3],[1,3],1,0,[{a:[2,3],b:[1,3],parity:1,explicit:true}],5);
const reserved=T.otherProducedCells([a4,plannedB4],0);assert(reserved.has('1,3'));
const preserveKnown=new Map([['1,2',0]]),preserved=T.atomizeRelationEntry(a4,preserveKnown,null,reserved);assert.equal(preserved.length,1);assert.equal(preserved[0],a4);assert.deepEqual([...preserveKnown],[['1,2',0]]);

// Semantic-review regression R8: French triple wording must be grammatical for "lune",
// and line-domain configurations must be rendered exactly once.
global.lang=()=> 'fr';
const tripleText=T.atomicText({rule:'TRIPLE_CONSTRAINT',current:{cell:[3,5],value:1},deduction:{rule:'TRIPLE_CONSTRAINT',premises:[{kind:'VALUE',cell:[1,5],value:0},{kind:'VALUE',cell:[2,5],value:0}],explanationData:{family:'column',id:5}}});
assert(tripleText.why.includes('Ajouter encore lune ☾ formerait trois symboles identiques consécutifs'),tripleText.why);
assert(!tripleText.why.includes('troisième lune'),tripleText.why);
assert(!tripleText.why.includes('lune ☾ consécutif'),tripleText.why);
global.QuadludTangoTutorClarity=require('../GitHub/tango-tutor-clarity.js');
const domainRendered=T.relationProofText(support).why;
assert.equal((domainRendered.match(/Configurations compatibles/g)||[]).length,1,domainRendered);
assert(domainRendered.length<700,domainRendered);

console.log('PASS HF3.9-R5.5 causal atomization: B4/E3 hidden nodes exposed, unsupported or already-planned intermediates preserved.');
