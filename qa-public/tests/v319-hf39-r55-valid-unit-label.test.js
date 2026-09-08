/* QUADLUD — HF3.9-R5.5 invalid unit-label regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const TangoPresenter=require(path.join(__dirname,'..','GitHub','tango-reasoning-presentation.js'));
const labels={rowLabel:'ligne',columnLabel:'colonne',tlgOrientRelationBalance:'Regarde la relation surlignée avec l’équilibre de {unit}.',tlgExplainRelationBalance:'La relation surlignée apporte une contribution déterminée à l’équilibre de {unit}. {conclusion}',tlgRelationBalance:'Relation et équilibre'};
const presenter=TangoPresenter.createPresenter({tr:k=>labels[k]||k,lang:()=> 'fr',cellName:(r,c)=>`${String.fromCharCode(65+r)}${c+1}`,pieceName:(_,v)=>v===1?'soleil':'lune',isDetailedLanguage:()=>true});
const d={rule:'RELATION_BALANCE',rank:1,focusCells:[[2,1],[2,2],[2,3]],premises:[{kind:'RELATION',a:[2,2],b:[2,3],parity:0}],conclusions:[{type:'VALUE',cell:[2,2],value:0},{type:'VALUE',cell:[2,3],value:0}],explanationData:{family:'column'}};
assert.deepStrictEqual(presenter.inferredUnit(d),{family:'row',id:2});
const where=presenter.orientation(d),why=presenter.explanation(d);
assert.match(where,/ligne C/);assert.match(why,/ligne C/);assert.doesNotMatch(where+why,/NaN/);
const malformed={rule:'RELATION_BALANCE',focusCells:[[2,2],[2,3]],premises:[],conclusions:[{type:'VALUE',cell:[2,2],value:0},{type:'VALUE',cell:[2,3],value:0}],explanationData:{family:'column',id:NaN}};
assert.deepStrictEqual(presenter.inferredUnit(malformed),{family:'row',id:2});
assert.doesNotMatch(presenter.orientation(malformed)+presenter.explanation(malformed),/NaN/);
console.log('PASS HF3.9-R5.5 invalid unit label regression: inferred visible unit, no NaN.');