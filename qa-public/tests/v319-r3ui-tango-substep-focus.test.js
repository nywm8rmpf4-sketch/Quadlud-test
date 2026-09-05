#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');

const ProgressiveBridge=require(path.join(ROOT,'GitHub','tango-progressive-proof-bridge.js'));
const UnitFocus=require(path.join(ROOT,'GitHub','tango-pedagogy-unit-focus.js'));

const copy=v=>JSON.parse(JSON.stringify(v));
const presenter={
  presentation:d=>({explanation:{where:'',why:'',move:''},metadata:{showTutorMove:false},evidence:{primary:copy(d)}}),
  legacyReasoning:d=>copy(d),
  conclusionText:d=>{
    const c=(d?.conclusions||[])[0];
    if(c?.type==='VALUE')return `${c.cell.join(',')}=${c.value}`;
    return `${c?.a?.join(',')}~${c?.b?.join(',')}`;
  }
};

const column=2;
const broad={
  id:'line-domain-proof',rule:'LINE_DOMAIN_SUPPORT',
  focusUnits:[{family:'column',id:column}],
  focusCells:Array.from({length:6},(_,r)=>[r,column]),
  premises:[
    {kind:'VALUE',cell:[0,column],value:0},
    {kind:'VALUE',cell:[5,column],value:1},
    {kind:'RELATION',a:[0,column],b:[1,column],parity:1}
  ],
  conclusions:[
    {type:'VALUE',cell:[1,column],value:1},
    {type:'RELATION',a:[0,column],b:[1,column],parity:1},
    {type:'RELATION',a:[0,column],b:[4,column],parity:1},
    {type:'RELATION',a:[4,column],b:[5,column],parity:1}
  ],
  explanationData:{family:'column',id:column,domainCount:2}
};
const source={deduction:broad,presentation:presenter.presentation(broad),beforeSnapshot:{state:[]},snapshot:{state:[]}};
const atomic=ProgressiveBridge._test.atomicLineEntries(source,presenter);
assert.strictEqual(atomic.length,4,'one line-domain conclusion must become one pedagogical substep');
assert.deepStrictEqual(atomic[0].deduction.focusCells,[[1,column]],'value conclusion must focus only its own cell');
assert.deepStrictEqual(atomic[0].deduction.focusRelations,[]);
assert.deepStrictEqual(atomic[1].deduction.focusCells,[[0,column],[1,column]],'first relation must focus only its two endpoints');
assert.deepStrictEqual(atomic[1].deduction.focusRelations,[{a:[0,column],b:[1,column],parity:1}]);
assert.deepStrictEqual(atomic[2].deduction.focusCells,[[0,column],[4,column]],'second relation must move focus to its two endpoints');
assert.deepStrictEqual(atomic[3].deduction.focusCells,[[4,column],[5,column]],'third relation must move focus again');

const group={entries:atomic.map(move=>({move}))};
for(const [index,expected] of [
  [0,['1,2']],
  [1,['0,2','1,2']],
  [2,['0,2','4,2']],
  [3,['4,2','5,2']]
]){
  global.walkthroughSession={base:{game:'tango',n:6},navigation:{proofStepIndex:index}};
  const entry=UnitFocus._test.currentWalkthroughEntry(group);
  const actual=UnitFocus._test.currentFocusCells(entry,null).map(c=>c.join(',')).sort();
  assert.deepStrictEqual(actual,expected.slice().sort(),`focus must follow atomic substep ${index+1}`);
}

console.log('v319-r3ui-tango-substep-focus.test.js: PASS');
