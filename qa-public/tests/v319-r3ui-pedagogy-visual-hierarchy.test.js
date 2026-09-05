#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');

global.walkthroughSession={navigation:{proofStepIndex:1},base:{n:4,reg:[[0,0,1,1],[0,0,1,1],[2,2,3,3],[2,2,3,3]]}};
const Navigation=require(path.join(ROOT,'tutor-action-first-navigation.js'));
const T=Navigation._test;
const keys=cells=>new Set((cells||[]).map(c=>c.join(',')));

const group={logicalMoveIndex:0,entries:[
  {move:{deduction:{focusCells:[[0,0],[0,1]],conclusions:[]},target:[0,3],proofStage:{kind:'where'}}},
  {move:{deduction:{focusCells:[[0,1],[0,2]],focusRelations:[{a:[0,2],b:[1,2]}],conclusions:[]},target:[0,3],proofStage:{kind:'consequence'}}},
  {move:{deduction:{focusCells:[[0,2]],conclusions:[{type:'VALUE',cell:[0,3],value:1}]},target:[0,3],proofStage:{kind:'action',apply:true},presentation:{metadata:{showTutorMove:true}}}}
]};
const roles=T.semanticRoles(group),context=keys(roles.context),focus=keys(roles.focus),action=keys(roles.action);
for(const key of ['0,0','0,1','0,2','1,2','0,3'])assert(context.has(key),`complete reasoning context must contain ${key}`);
for(const key of ['0,1','0,2','1,2'])assert(focus.has(key),`current proof focus must contain ${key}`);
assert(!focus.has('0,0'),'current proof focus must evolve and exclude prior-only premise');
assert(action.has('0,3'),'final action must identify the played/advised cell');
assert.strictEqual(action.size,1,'single-cell move must have one semantic action target');

const collected=new Set();
T.collectDeductionCoords({focusRelations:[{a:[1,0],b:[1,1]}],focusUnits:[{family:'row',id:2},{family:'column',id:3},{family:'region',id:0}],premises:[{kind:'VISIBLE_CELL',cell:{kind:'cell',id:'r3c2'}}]},collected,global.walkthroughSession.base);
for(const key of ['1,0','1,1','2,0','2,1','2,2','2,3','0,3','1,3','3,3','0,0','0,1','3,2'])assert(collected.has(key),`generic semantic resolver must contain ${key}`);
const ng=new Set();T.collectCoords({kind:'cell',id:'r2c3'},ng);assert(ng.has('2,3'),'Mosaïque cell EntityRef must resolve to a grid coordinate');

const css=fs.readFileSync(path.join(ROOT,'tutor-action-first-navigation.css'),'utf8');
assert(css.includes('.walkthrough-reasoning-context'),'context style missing');
assert(css.includes('.walkthrough-current-focus'),'current-focus style missing');
assert(css.includes('.walkthrough-current-action'),'action style missing');
assert(/walkthrough-reasoning-context[\s\S]*?outline:2px dashed/.test(css),'context must use dashed geometry');
assert(/walkthrough-current-focus[^\{]*\{[\s\S]*?outline:3px solid/.test(css),'current focus must use solid geometry');
assert(/walkthrough-current-action[^\{]*\{[\s\S]*?outline:5px double/.test(css),'action must use double geometry');
assert(css.includes('@media(forced-colors:active)'),'forced-colors hierarchy must be defined');
assert(css.includes('.ng-focus-target{outline-style:double'),'Mosaïque target must share double-action grammar');

const token='3.1.9-r3ui-focus-hierarchy';
const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
for(const asset of ['tutor-action-first-navigation.css','tutor-action-first-navigation.js']){
  assert(index.includes(`${asset}?v=${token}`),`${asset} cache-bust missing from index`);
  assert(sw.includes(`./${asset}?v=${token}`),`${asset} cache-bust missing from service worker`);
}
assert(sw.includes("const CACHE='quadlud-v3.1.9-r3ui-focus-hierarchy'"),'R3UI service-worker cache identity missing');
console.log('v319-r3ui-pedagogy-visual-hierarchy.test.js: PASS');