'use strict';
const assert=require('assert');
let currentLang='fr';
global.lang=()=>currentLang;
global.pieceName=(_game,value)=>Number(value)===1?(currentLang==='fr'?'soleil ☀':'sun ☀'):(currentLang==='fr'?'lune ☾':'moon ☾');
const Bridge=require('../GitHub/tango-progressive-proof-bridge.js');

function entryWithRelation(relation){
  return {
    deduction:{
      rule:'RELATION_PROPAGATION',
      premises:[
        {kind:'VALUE',cell:[0,0],value:1,hypothesis:false},
        relation
      ],
      conclusions:[{type:'VALUE',cell:[0,2],value:0}],
      explanationData:{source:[0,0],target:[0,2],sourceValue:1,parity:1}
    },
    presentation:{explanation:{where:'old where',why:'old why',move:'old move'},metadata:{}},
    where:'old where',why:'old why',move:'old move'
  };
}

const missing=Bridge._test.clarifyDerivedRelation(entryWithRelation({kind:'RELATION',a:[0,0],b:[0,2],relation:'OPPOSITE',explicit:false}));
assert(!/déjà déduite|déjà démontrée/i.test(missing.why+' '+missing.where),missing.why);
for(const token of ['A1','A3','dérivée','preuve','disponible'])assert((missing.why+' '+missing.where).toLowerCase().includes(token.toLowerCase()),`missing-provenance message must contain ${token}: ${missing.why}`);
assert(!/donc\s+A3\s*=|par conséquent\s+A3\s*=/i.test(missing.why),'an unsupported derived relation must not present its consequence as demonstrated');
assert.strictEqual(missing.presentation.metadata.proofCompleteness,'missing-relation-provenance');
assert.strictEqual(missing.presentation.metadata.showTutorMove,false);

const explicitPath=[
  {a:[0,0],b:[0,1],parity:0,explicit:true},
  {a:[0,1],b:[0,2],parity:1,explicit:true}
];
const demonstrated=Bridge._test.clarifyDerivedRelation(entryWithRelation({kind:'RELATION',a:[0,0],b:[0,2],relation:'OPPOSITE',explicit:false,path:explicitPath}));
assert(!/déjà déduite|déjà démontrée/i.test(demonstrated.why+' '+demonstrated.where),demonstrated.why);
for(const token of ['A1 = A2','A2 × A3','A1','A3','opposées','donc','lune'])assert((demonstrated.why+' '+demonstrated.where).toLowerCase().includes(token.toLowerCase()),`explicit relation path must contain ${token}: ${demonstrated.why}`);
assert.strictEqual(demonstrated.presentation.metadata.proofCompleteness,'complete-explicit-relation-path');

currentLang='en';
const missingEn=Bridge._test.clarifyDerivedRelation(entryWithRelation({kind:'RELATION',a:[0,0],b:[0,2],relation:'OPPOSITE',explicit:false}));
assert(!/already deduced|already proved/i.test(missingEn.why+' '+missingEn.where),missingEn.why);
for(const token of ['A1','A3','derived','proof','available'])assert((missingEn.why+' '+missingEn.where).toLowerCase().includes(token.toLowerCase()),`English missing-provenance message must contain ${token}: ${missingEn.why}`);
assert(!/therefore\s+A3\s*=/i.test(missingEn.why),'unsupported English relation must not claim the consequence');
assert(!/soleil|lune/i.test(missingEn.why+' '+missingEn.where),'language change must not retain French piece names');

console.log('v319-r3ui-tango-derived-relation-temporal-truth.test.js: PASS');
