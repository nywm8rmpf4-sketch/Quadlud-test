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
const RUNTIME=candidates.find(base=>fs.existsSync(path.join(base,'tango-reasoning-presentation.js')));
assert(RUNTIME,'cannot locate QUADLUD runtime');
const TangoPresenter=require(path.join(RUNTIME,'tango-reasoning-presentation.js'));

const strings={
  rowLabel:'ligne',
  columnLabel:'colonne',
  tlgOrientRelationBalance:'Regarde la relation surlignée avec l’équilibre de {unit}.',
  tlgExplainRelationBalance:'La relation surlignée contribue à l’équilibre de {unit}. {conclusion}',
  tlgRelationBalance:'Relation et équilibre',
  tlgSame:'identiques',
  tlgOpposite:'opposées',
  visibleOnly:'visible'
};
const presenter=TangoPresenter.createPresenter({
  tr:key=>strings[key]??key,
  lang:()=> 'fr',
  isDetailedLanguage:()=>true,
  cellName:(r,c)=>`${String.fromCharCode(65+r)}${c+1}`,
  pieceName:(_game,value)=>Number(value)===0?'moon ☾':'sun ☀'
});

const rowF={
  rule:'RELATION_BALANCE',
  rank:1,
  focusUnits:[{family:'row',id:5}],
  conclusions:[{type:'VALUE',cell:[5,0],value:1}],
  explanationData:{}
};
assert.strictEqual(
  presenter.orientation(rowF),
  'Regarde la relation surlignée avec l’équilibre de ligne F.',
  'Tutor/Coach messages must use the visible board row letter F, never numeric “ligne 6”'
);
assert.strictEqual(
  presenter.explanation(rowF),
  'La relation surlignée contribue à l’équilibre de ligne F. F1 = sun ☀',
  'explanation body must use the same visible row coordinate convention'
);

const column6={...rowF,focusUnits:[{family:'column',id:5}]};
assert.strictEqual(
  presenter.orientation(column6),
  'Regarde la relation surlignée avec l’équilibre de colonne 6.',
  'column coordinates must remain numeric'
);

const rowA={...rowF,focusUnits:[{family:'row',id:0}]};
assert(presenter.orientation(rowA).includes('ligne A'),'row id 0 must map to visible row A');

const source=fs.readFileSync(path.join(RUNTIME,'tango-reasoning-presentation.js'),'utf8');
assert(source.includes("ref.family==='row'?rowHuman(ref.id):Number(ref.id)+1"),'unit formatter must distinguish row letters from numeric columns');

console.log('v319-r3ui-tango-visible-unit-labels.test.js: PASS');
