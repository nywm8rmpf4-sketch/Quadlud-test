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
const TangoI18n=require(path.join(RUNTIME,'tango-i18n.js'));

function presenter(locale){
  const game=TangoI18n.translations[locale]||TangoI18n.translations.en;
  const shell=locale==='fr'
    ? {rowLabel:'ligne',columnLabel:'colonne',contradictionFound:'contradiction'}
    : {rowLabel:'row',columnLabel:'column',contradictionFound:'contradiction'};
  const tr=key=>Object.prototype.hasOwnProperty.call(game,key)?game[key]:(shell[key]??key);
  return TangoPresenter.createPresenter({
    tr,
    lang:()=>locale,
    isDetailedLanguage:()=>true,
    cellName:(r,c)=>`${String.fromCharCode(65+r)}${c+1}`,
    pieceName:(_game,value)=>Number(value)===0?'moon ☾':'sun ☀'
  });
}

const fr=presenter('fr');
assert.strictEqual(
  fr.contradictionText({kind:'TRIPLE_OVERFLOW',family:'column',id:3,value:0}),
  'colonne 4 : moon ☾ × 3 — trois symboles identiques consécutifs.',
  'R3 human feedback: the dead-end must name/draw the moon witness instead of only saying “three identical symbols”'
);
assert.strictEqual(
  fr.contradictionText({kind:'TRIPLE_OVERFLOW',family:'row',id:1,value:1}),
  'ligne 2 : sun ☀ × 3 — trois symboles identiques consécutifs.',
  'the same concrete wording must work for a sun triple'
);
assert.strictEqual(
  fr.contradictionReason({kind:'TRIPLE_OVERFLOW'}),
  'trois symboles identiques consécutifs',
  'legacy generic fallback must remain available when an old witness has no value'
);

const en=presenter('en');
assert.strictEqual(
  en.contradictionText({kind:'TRIPLE_OVERFLOW',family:'column',id:3,value:0}),
  'column 4 : moon ☾ × 3 — three identical consecutive symbols.',
  'English detailed presentation must carry the same concrete witness semantics'
);

const source=fs.readFileSync(path.join(RUNTIME,'tango-reasoning-presentation.js'),'utf8');
assert(source.includes("valueHuman(w.value)} × 3 — ${tr('tlgContrTriple')}"),'presenter must render the engine-provided triple value');
const token='3.1.9-r3ui-contradiction-symbol';
const index=fs.readFileSync(path.join(RUNTIME,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(RUNTIME,'sw.js'),'utf8');
assert(index.includes(`tango-reasoning-presentation.js?v=${token}`),'presenter cache-bust missing from index');
assert(sw.includes(`./tango-reasoning-presentation.js?v=${token}`),'presenter cache-bust missing from service worker');
const cacheMatch=sw.match(/const CACHE='([^']+)'/);
assert(cacheMatch,'service-worker cache identity missing');
assert(/^quadlud-v3\.1\.9-/.test(cacheMatch[1]),'service-worker cache must stay on the v3.1.9 candidate family');
assert.notStrictEqual(cacheMatch[1],'quadlud-v3.1.8','service-worker cache must not regress to certified v3.1.8');
assert.notStrictEqual(cacheMatch[1],`quadlud-v${token}`,'later UI delivery must be allowed to advance beyond the contradiction-only cache identity');

console.log('v319-r3ui-tango-contradiction-symbol.test.js: PASS');
