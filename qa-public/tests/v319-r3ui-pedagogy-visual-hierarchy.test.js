#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const RUNTIME=path.join(ROOT,'GitHub');

global.walkthroughSession={navigation:{proofStepIndex:1},base:{n:4,reg:[[0,0,1,1],[0,0,1,1],[2,2,3,3],[2,2,3,3]]}};
const Navigation=require(path.join(RUNTIME,'tutor-action-first-navigation.js'));
const TangoUnitFocus=require(path.join(RUNTIME,'tango-pedagogy-unit-focus.js'));
const T=Navigation._test;
const keys=cells=>new Set((cells||[]).map(c=>c.join(',')));

const group={logicalMoveIndex:0,entries:[
  {move:{deduction:{focusCells:[[0,0],[0,1]],focusUnits:[{family:'row',id:0}],conclusions:[]},target:[0,3],proofStage:{kind:'where'}}},
  {move:{deduction:{focusCells:[[0,1],[0,2]],focusRelations:[{a:[0,2],b:[1,2]}],focusUnits:[{family:'row',id:0}],conclusions:[]},target:[0,3],proofStage:{kind:'consequence'}}},
  {move:{deduction:{focusCells:[[0,2]],focusUnits:[{family:'row',id:0}],conclusions:[{type:'VALUE',cell:[0,3],value:1}]},target:[0,3],proofStage:{kind:'action',apply:true},presentation:{metadata:{showTutorMove:true}}}}
]};
const roles=T.semanticRoles(group),context=keys(roles.context),focus=keys(roles.focus),action=keys(roles.action);
for(const key of ['0,0','0,1','0,2','1,2'])assert(context.has(key),`complete reasoning cell context must contain ${key}`);
assert(!context.has('0,3'),'final action must not be counted as a premise cell merely because it is the target');
for(const key of ['0,1','0,2','1,2'])assert(focus.has(key),`current proof focus must contain ${key}`);
assert(!focus.has('0,0'),'current proof focus must evolve and exclude prior-only premise');
assert(action.has('0,3'),'final action must identify the played/advised cell');
assert.strictEqual(action.size,1,'single-cell move must have one semantic action target');
assert.deepStrictEqual(roles.unitContext.map(u=>u.key),['row:0'],'logical unit must remain one UnitRef instead of four selected cells');

const deduction={focusCells:[[1,0]],focusRelations:[{a:[1,0],b:[1,1]}],focusUnits:[{family:'row',id:2},{family:'column',id:3},{family:'region',id:0}],premises:[{kind:'VISIBLE_CELL',cell:{kind:'cell',id:'r3c2'}}]};
const collected=new Set();T.collectDeductionCoords(deduction,collected,global.walkthroughSession.base);
for(const key of ['1,0','1,1','3,2'])assert(collected.has(key),`actual cell evidence must contain ${key}`);
for(const key of ['2,0','2,1','2,2','2,3','0,3','3,3','0,0','0,1'])assert(!collected.has(key),`UnitRef member ${key} must not become semantic cell evidence`);
const units=[...T.collectDeductionUnits(deduction).values()].map(u=>u.key).sort();
assert.deepStrictEqual(units,['column:3','region:0','row:2']);
const rowCoords=new Set();T.collectUnitCoords({family:'row',id:2},rowCoords,global.walkthroughSession.base);assert.deepStrictEqual([...rowCoords].sort(),['2,0','2,1','2,2','2,3'],'renderer must still be able to paint the unit surface');
const ng=new Set();T.collectCoords({kind:'cell',id:'r2c3'},ng);assert(ng.has('2,3'),'Mosaïque cell EntityRef must resolve to a grid coordinate');

const rawNg=new Set();
T.collectDeductionCoords({premises:{clues:[{index:0,entity:{kind:'clue',id:'row-0'}}],visible:[{index:1,cell:{kind:'cell',id:'r1c2'}}]},conclusions:[{cell:{kind:'cell',id:'r1c3'},state:1}]},rawNg);
assert(rawNg.has('1,2'),'structured Mosaïque visible premise must resolve without iterable assumptions');
assert(rawNg.has('1,3'),'structured Mosaïque conclusion must remain a visible target');

const tangoDeduction={focusCells:[[0,3],[2,3],[3,3],[4,3]],focusUnits:[{family:'column',id:3}],conclusions:[{type:'VALUE',cell:[0,3],value:0}],explanationData:{witness:{kind:'TRIPLE_OVERFLOW',family:'column',id:3,cells:[[2,3],[3,3],[4,3]]}}};
assert.deepStrictEqual(TangoUnitFocus._test.unitRefs(tangoDeduction).map(u=>`${u.family}:${u.id}`),['column:3']);
assert.strictEqual(TangoUnitFocus._test.unitCells({family:'column',id:3},6,null).length,6,'Coach unit context may paint six cells as one surface');
assert.strictEqual(TangoUnitFocus._test.evidenceCells(tangoDeduction).length,4,'Coach semantic evidence must remain the four causal cells, not six column cells');
assert.deepStrictEqual(TangoUnitFocus._test.conclusionCells(tangoDeduction),[[0,3]],'Coach final action remains unique');

const css=fs.readFileSync(path.join(RUNTIME,'tutor-action-first-navigation.css'),'utf8');
assert(css.includes('.walkthrough-unit-context'),'unit-context style missing');
assert(css.includes('.hint-unit-context'),'Coach unit-context style missing');
assert(css.includes('.walkthrough-reasoning-context'),'premise style missing');
assert(css.includes('.walkthrough-current-focus'),'current-focus style missing');
assert(css.includes('.walkthrough-current-action'),'action style missing');
assert(/walkthrough-unit-context[\s\S]*?outline:none/.test(css),'unit context must not look like a selected cell');
assert(/walkthrough-reasoning-context[\s\S]*?outline:2px dashed/.test(css),'premises must use dashed geometry');
assert(/walkthrough-current-focus[^\{]*\{[\s\S]*?outline:3px solid/.test(css),'current focus must use solid geometry');
assert(/walkthrough-current-action[^\{]*\{[\s\S]*?outline:5px double/.test(css),'action must use double geometry');
assert(css.includes('@media(forced-colors:active)'),'forced-colors hierarchy must be defined');
assert(css.includes('.ng-focus-target{outline-style:double'),'Mosaïque target must share double-action grammar');

const token='3.1.9-r3ui-unit-context-r1';
const index=fs.readFileSync(path.join(RUNTIME,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(RUNTIME,'sw.js'),'utf8');
assert(index.includes(`tutor-action-first-navigation.css?v=${token}`));
assert(sw.includes(`./tutor-action-first-navigation.css?v=${token}`));
assert(index.includes(`tutor-action-first-navigation.js?v=${token}`));
assert(sw.includes(`./tutor-action-first-navigation.js?v=${token}`));
assert(index.includes(`tango-pedagogy-unit-focus.js?v=${token}`));
assert(sw.includes(`./tango-pedagogy-unit-focus.js?v=${token}`));
assert(sw.includes("const CACHE='quadlud-v3.1.9-r3ui-unit-context-r1'"));
console.log('v319-r3ui-pedagogy-visual-hierarchy.test.js: PASS');