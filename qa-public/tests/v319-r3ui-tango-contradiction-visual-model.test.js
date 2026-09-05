#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const candidates=[
  path.resolve(__dirname,'../GitHub'),
  path.resolve(__dirname,'../../GitHub'),
  path.resolve(__dirname,'../..'),
  path.resolve(__dirname,'..')
];
const RUNTIME=candidates.find(base=>fs.existsSync(path.join(base,'tango-contradiction-visuals.js')));
assert(RUNTIME,'cannot locate QUADLUD runtime');
const Visuals=require(path.join(RUNTIME,'tango-contradiction-visuals.js'));
const T=Visuals._test;

function entry(kind,deduction){return {move:{pedagogyStageKind:kind,deduction}}}
const group={entries:[
  entry('hypothesis',{premises:[{kind:'ASSUMPTION',cell:[0,2],value:0,hypothesis:true}],conclusions:[]}),
  entry('reasoning',{premises:[],conclusions:[{type:'VALUE',cell:[1,2],value:1}]}),
  entry('reasoning',{premises:[],conclusions:[{type:'RELATION',a:[1,2],b:[2,2],parity:1}]}),
  entry('reasoning',{premises:[],conclusions:[{type:'VALUE',cell:[2,2],value:0},{type:'VALUE',cell:[3,2],value:1}]}),
  entry('contradiction',{focusCells:[[2,2],[3,2]],focusUnits:[{family:'column',id:2}],explanationData:{witness:{cells:[[3,2]],family:'column',id:2}}}),
  entry('action',{conclusions:[{type:'VALUE',cell:[0,2],value:1}]})
]};

let state=T.proofVisualState(group,0);
assert.strictEqual(state.active,true,'hypothesis stage must activate contradiction visual mode');
assert.strictEqual(state.stageKind,'hypothesis');
assert.deepStrictEqual(state.markers.map(m=>[m.kind,m.cell,m.value,m.label,m.current]),[
  ['hypothesis',[0,2],0,'H',true]
]);

state=T.proofVisualState(group,1);
assert.deepStrictEqual(state.markers.map(m=>[m.kind,m.cell,m.value,m.label,m.current]),[
  ['hypothesis',[0,2],0,'H',false],
  ['consequence',[1,2],1,'1',true]
],'first derived value must be consequence 1 while the hypothesis remains visible');

state=T.proofVisualState(group,2);
assert.strictEqual(state.markers.length,2,'relation-only reasoning must not invent a sun/moon hypothetical move');
assert.strictEqual(state.markers[1].label,'1','numbering must stay tied to visible hypothetical value consequences');

state=T.proofVisualState(group,3);
assert.deepStrictEqual(state.markers.map(m=>[m.cell,m.value,m.label,m.current]),[
  [[0,2],0,'H',false],
  [[1,2],1,'1',false],
  [[2,2],0,'2',true],
  [[3,2],1,'3',true]
],'multiple value consequences in one reasoning stage must receive stable consecutive numbers');

state=T.proofVisualState(group,4);
assert.strictEqual(state.stageKind,'contradiction');
assert.deepStrictEqual(state.markers.map(m=>m.label),['H','1','2','3'],'all hypothetical assignments must remain visible at contradiction');
assert.deepStrictEqual(state.contradictionCells,[[2,2],[3,2]],'contradiction halo must target the explicit witness cells without duplicates');
assert.deepStrictEqual(state.contradictionUnits,[{family:'column',id:2},{family:'column',id:2}],'unit evidence remains available as a fallback when cell witnesses are absent');

state=T.proofVisualState(group,5);
assert.strictEqual(state.active,false,'real conclusion stage must clear all hypothetical visuals');
assert.deepStrictEqual(state.markers,[]);
assert.deepStrictEqual(state.contradictionCells,[]);

const direct={entries:[entry('action',{conclusions:[{type:'VALUE',cell:[0,0],value:1}]})]};
assert.strictEqual(T.proofVisualState(direct,0).active,false,'direct deductions must remain visually unchanged');
assert.deepStrictEqual(T.unitCells({family:'row',id:1},6),[[1,0],[1,1],[1,2],[1,3],[1,4],[1,5]]);
assert.deepStrictEqual(T.unitCells({family:'column',id:2},3),[[0,2],[1,2],[2,2]]);

console.log('v319-r3ui-tango-contradiction-visual-model.test.js: PASS');
