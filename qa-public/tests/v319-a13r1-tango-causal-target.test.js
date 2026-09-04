#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Planner=require(path.join(ROOT,'GitHub','tango-played-move-planner.js'));

// Human pilot regression captured 2026-09-05.
// Visible state before the Tutor preview: C3=C4=moon, so C5=sun is a direct
// Rule-of-three move. Because B5 x C5, the engine simulation also derives
// B5=moon automatically. The Tutor must play the direct premise C5 first,
// never the downstream B5 consequence.
const state=[
  [1,-1,-1,1,0,0],
  [1,-1,-1,0,-1,1],
  [0,1,0,0,-1,1],
  [1,0,1,1,0,0],
  [0,0,1,0,1,1],
  [0,1,0,1,1,0]
];
const puzzle={
  n:6,
  state:state.map(row=>row.slice()),
  edges:[
    [1,4,'d','×'],
    [3,1,'r','×'],
    [3,2,'r','='],
    [3,1,'d','='],
    [4,4,'d','=']
  ]
};

const session=Planner.sessionFromPublicBoard(puzzle);
const direct=Planner._test.allowedDirectDeductions(session,1);
const c5Direct=direct.find(d=>(d.conclusions||[]).some(c=>c.type==='VALUE'&&c.cell?.[0]===2&&c.cell?.[1]===4&&c.value===1));
assert(c5Direct,'C5=sun must exist as a direct visible-state deduction');

const branch=Planner._test.planFromFirstDeduction(session,1,c5Direct,{maxEngineSteps:24});
assert.strictEqual(branch.status,'move');
assert(branch.engineVisiblePlacements.some(x=>x.cell?.[0]===2&&x.cell?.[1]===4&&x.to===1),'engine simulation must contain direct C5=sun');
assert(branch.engineVisiblePlacements.some(x=>x.cell?.[0]===1&&x.cell?.[1]===4&&x.to===0),'engine simulation must also expose downstream B5=moon');
assert.deepStrictEqual(branch.target,[2,4],'causal target must be direct C5, not row-major downstream B5');
assert.strictEqual(branch.value,1);
assert((branch.deduction?.conclusions||[]).some(c=>c.type==='VALUE'&&c.cell?.[0]===2&&c.cell?.[1]===4&&c.value===1),'selected proof source must directly conclude C5=sun');

const selected=Planner.nextPlayedMove(session,'medium',{maxEngineSteps:48,maxCandidatePlans:128});
assert.strictEqual(selected.status,'move');
assert.deepStrictEqual(selected.target,[2,4],'Tutor must propose C5 before dependent B5 in the human-pilot state');
assert.strictEqual(selected.value,1);
assert.notDeepStrictEqual(selected.target,[1,4]);

console.log('v319-a13r1-tango-causal-target.test.js: PASS');
