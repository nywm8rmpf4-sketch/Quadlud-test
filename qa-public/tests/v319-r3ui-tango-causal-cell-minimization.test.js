#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const RUNTIME=path.join(ROOT,'GitHub');
const UnitFocus=require(path.join(RUNTIME,'tango-pedagogy-unit-focus.js'));
const TangoPresenter=require(path.join(RUNTIME,'tango-reasoning-presentation.js'));
const TangoI18n=require(path.join(RUNTIME,'tango-i18n.js'));

const broadRelationBalance={id:'D1',rule:'RELATION_BALANCE',premises:[{kind:'RELATION',a:[3,3],b:[4,3]},{kind:'VALUE',cell:[0,3],value:1},{kind:'VALUE',cell:[1,3],value:1},{kind:'VALUE',cell:[2,3],value:0},{kind:'VALUE',cell:[4,2],value:0}],focusCells:[[3,3],[4,3]],focusRelations:[{a:[3,3],b:[4,3],parity:0}],focusUnits:[],conclusions:[{type:'VALUE',cell:[3,3],value:0},{type:'VALUE',cell:[4,3],value:0}],explanationData:{mode:'SAME_ORIENTATION',rejected:{kind:'BALANCE_OVERFLOW',family:'column',id:3,cells:[[0,3],[1,3],[2,3],[3,3],[4,3],[5,3]],value:1}}};
const triple={id:'D2',rule:'TRIPLE_CONSTRAINT',premises:[{kind:'VALUE',cell:[2,3],value:0},{kind:'VALUE',cell:[3,3],value:0}],focusCells:[[2,3],[3,3],[4,3]],focusUnits:[{family:'column',id:3}],conclusions:[{type:'VALUE',cell:[4,3],value:1}],explanationData:{family:'column',id:3}};
const contradiction={rule:'ASSUMPTION_CONTRADICTION',premises:[{kind:'ASSUMPTION',cell:[1,3],value:1,hypothesis:true},{kind:'VALUE',cell:[0,3],value:1},{kind:'VALUE',cell:[2,3],value:0},{kind:'VALUE',cell:[4,2],value:0}],focusCells:[[1,3],[2,3],[3,3],[4,3]],focusUnits:[{family:'column',id:3}],conclusions:[{type:'VALUE',cell:[1,3],value:0}],explanationData:{assumption:{cell:[1,3],value:1},witness:{kind:'TRIPLE_OVERFLOW',family:'column',id:3,cells:[[2,3],[3,3],[4,3]],value:0},causalTrace:[broadRelationBalance,triple]}};

const causal=new Set(UnitFocus._test.causalEvidenceCells(contradiction).map(c=>c.join(',')));
for(const key of ['0,3','1,3','2,3','3,3','4,3'])assert(causal.has(key),`minimal causal projection must retain ${key}`);
assert(!causal.has('4,2'),'E3 is an engine-internal broad premise and must not be highlighted when the contradiction witness is in column 4');

const normalized=UnitFocus._test.normalizePresentationDeduction(contradiction),normalizedStep=normalized.explanationData.causalTrace[0];
assert.deepStrictEqual(normalizedStep.focusUnits,[{family:'column',id:3}]);
assert.strictEqual(normalizedStep.explanationData.family,'column');assert.strictEqual(normalizedStep.explanationData.id,3);
const game=TangoI18n.translations.fr,tr=key=>Object.prototype.hasOwnProperty.call(game,key)?game[key]:({rowLabel:'ligne',columnLabel:'colonne',hypothesis:'Hypothèse',consequence:'Conséquence',deadend:'Impasse',conclusion:'Conclusion'}[key]||key);
const presenter=TangoPresenter.createPresenter({tr,lang:()=> 'fr',isDetailedLanguage:()=>true,cellName:(r,c)=>`${String.fromCharCode(65+r)}${c+1}`,pieceName:(_g,v)=>Number(v)===0?'moon ☾':'sun ☀'});
const text=presenter.explanation(normalizedStep);assert(!text.includes('NaN'));assert(text.includes('colonne 4'),text);
console.log('v319-r3ui-tango-causal-cell-minimization.test.js: PASS');
