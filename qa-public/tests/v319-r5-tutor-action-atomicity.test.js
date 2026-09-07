#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');

const Navigation=require(path.resolve(__dirname,'../GitHub/tutor-action-first-navigation.js'));
const T=Navigation._test;

const multiConclusion={move:{
  target:[1,4],
  deduction:{conclusions:[
    {type:'VALUE',cell:[1,4],value:0},
    {type:'VALUE',cell:[1,5],value:0}
  ]},
  presentation:{action:{target:[1,5]}}
}};
assert.deepStrictEqual(Navigation.actionCoords(multiConclusion),[[1,4]],'explicit move.target must be the unique canonical action');

const presentationOnly={move:{
  deduction:{conclusions:[{type:'VALUE',cell:[2,1],value:1},{type:'VALUE',cell:[2,2],value:1}]},
  presentation:{action:{target:[2,2]}}
}};
assert.deepStrictEqual(Navigation.actionCoords(presentationOnly),[[2,2]],'presentation action target must remain the fallback when no move.target exists');

function fakeElement(){
  const removed=[];
  return {removed,classList:{remove(cls){removed.push(cls)}}};
}
const canonical=fakeElement(),stale=fakeElement();
const board={querySelectorAll(selector){assert.strictEqual(selector,'.walkthrough-target');return [canonical,stale]}};
T.normalizeLegacyTargets(board,[canonical],true);
assert.deepStrictEqual(canonical.removed,[],'canonical action must retain the legacy target class used by the base renderer');
assert.deepStrictEqual(stale.removed,['walkthrough-target'],'secondary/stale target must be visually demoted to its context/focus roles');

const hiddenA=fakeElement(),hiddenB=fakeElement();
T.normalizeLegacyTargets({querySelectorAll(){return [hiddenA,hiddenB]}},[],false);
assert.deepStrictEqual(hiddenA.removed,['walkthrough-target']);
assert.deepStrictEqual(hiddenB.removed,['walkthrough-target'],'non-action proof substeps must expose no legacy action target');

console.log('v319-r5-tutor-action-atomicity.test.js: PASS — one explicit move.target owns the real Tutor action; secondary conclusions stay contextual');
