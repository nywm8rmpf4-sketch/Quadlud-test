'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'GitHub');
const DataSerialization=require(path.join(runtime,'data-serialization.js'));
const DifficultyRating=require(path.join(runtime,'difficulty-rating.js'));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','persistence-v223-baseline.json'),'utf8'));

function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object'){return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'}return JSON.stringify(value)}
function canonicalSha(value){return crypto.createHash('sha256').update(canonical(value)).digest('hex')}
function semanticSnapshot(value){
  if(value instanceof Set)return {__set:[...value].map(semanticSnapshot)};
  if(Array.isArray(value))return value.map(semanticSnapshot);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).map(k=>[k,semanticSnapshot(value[k])]));
  return value
}
function publicPuzzleFromSavedCurrent(c){
  const rootSnapshot=c.moveHistory.nodes.h0.snapshot;
  if(c.game==='queens')return {game:'queens',n:c.n,reg:c.reg};
  if(c.game==='tango')return {game:'tango',n:c.n||6,state:rootSnapshot.state,edges:c.edges||[]};
  if(c.game==='sudoku')return {game:'sudoku',n:6,state:rootSnapshot.state};
  if(c.game==='patches')return {game:'patches',n:c.n,ids:c.ids,clues:c.clues};
  throw new Error('unsupported fixture game');
}

(function pureModuleHasNoPlatformStorageDependency(){
  const source=fs.readFileSync(path.join(runtime,'data-serialization.js'),'utf8');
  for(const forbidden of ['localStorage','sessionStorage','indexedDB','document.','document[','window.','window[']){
    assert(!source.includes(forbidden),`pure serializer must not depend on ${forbidden}`);
  }
})();

(function baselineSectionsRoundTripWithoutDrift(){
  const storage=fixture.storage;
  const before=semanticSnapshot(storage);

  const save=DataSerialization.deserializeSaveEnvelope(DataSerialization.parse(DataSerialization.stringify(storage['logic4-save-v2'])));
  const stats=DataSerialization.normalizeStats(
    DataSerialization.parse(DataSerialization.stringify(storage['logic4-stats-v2'])),
    {schema:5,baseline:'v2.23',started:0,solved:0,revealed:0,totalSolvedSeconds:0,byGame:{},history:[],mastery:{schema:1,byTechnique:{},updatedAt:null},training:{schema:1,byTechnique:{}},learning:{schema:1,byTechnique:{}}},
    {schema:5,baseline:'v2.23',historyLimit:200,validGames:['queens','tango','sudoku','patches'],validDifficulties:['easy','medium','hard','expert']}
  );
  const daily=DataSerialization.normalizeDailyState(DataSerialization.parse(DataSerialization.stringify(storage['logic4-daily-v2'])));
  const preferences=DataSerialization.normalizePreferences(
    DataSerialization.parse(DataSerialization.stringify(storage['logic4-prefs-v1'])),
    {defaultLang:'fr',supportedLangs:['fr','en','zh','hi','es','ar','bn','pt','id','ur','bg','hr','cs','da','nl','et','fi','de','el','hu','ga','it','lv','lt','mt','pl','ro','sk','sl','sv']}
  );

  assert.deepStrictEqual(save,storage['logic4-save-v2']);
  assert.deepStrictEqual(stats,storage['logic4-stats-v2']);
  assert.deepStrictEqual(daily,storage['logic4-daily-v2']);
  assert.deepStrictEqual(preferences,{...storage['logic4-prefs-v1'],soundPedagogy:true,soundVolume:0.72});
  assert.deepStrictEqual(semanticSnapshot(storage),before,'serialization must not mutate source fixture');

  for(const [key,value] of Object.entries({
    'logic4-save-v2':save,
    'logic4-stats-v2':stats,
    'logic4-daily-v2':daily,
    'logic4-prefs-v1':preferences
  })){
    if(key==='logic4-prefs-v1')continue; // SND-3 intentionally migrates the legacy preference payload.
    assert.strictEqual(canonicalSha(value),fixture.canonicalSha256[key],`${key} canonical SHA drift`)
  }
})();

(function currentStateSetConversionIsPortableAndNonMutating(){
  const source={game:'sudoku',givens:new Set([1,4,8]),empty:new Set([2,3]),nested:{values:[1,2,3]}};
  const before=semanticSnapshot(source);
  const serialized=DataSerialization.serializeCurrentState(source);
  assert.deepStrictEqual(serialized,{game:'sudoku',givens:[1,4,8],empty:[2,3],nested:{values:[1,2,3]}});
  const restored=DataSerialization.deserializeCurrentState(serialized);
  assert(restored.givens instanceof Set);
  assert(restored.empty instanceof Set);
  assert.deepStrictEqual([...restored.givens],[1,4,8]);
  assert.deepStrictEqual([...restored.empty],[2,3]);
  assert.deepStrictEqual(DataSerialization.serializeCurrentState(restored),serialized);
  assert.deepStrictEqual(semanticSnapshot(source),before,'current source mutated');
})();

(function saveFingerprintSurvivesSerialization(){
  const original=fixture.storage['logic4-save-v2'];
  const roundTrip=DataSerialization.deserializeSaveEnvelope(DataSerialization.parse(DataSerialization.stringify(original)));
  const recalculated=DifficultyRating.fingerprintPublicPuzzle(publicPuzzleFromSavedCurrent(roundTrip.current));
  assert.strictEqual(recalculated,original.puzzleFingerprint);
  assert.strictEqual(roundTrip.current.difficultyProfile.fingerprint,original.puzzleFingerprint);
  assert.strictEqual(roundTrip.current.generationStats.fingerprint,original.puzzleFingerprint);
})();

(function userDataPackageSchemaAndRoundTrip(){
  const storage=fixture.storage;
  const packageInput={
    sourceVersion:fixture.productVersion,
    persistenceBaseline:fixture.persistenceBaseline,
    exportedAt:'2026-08-17T13:52:00.000Z',
    save:storage['logic4-save-v2'],
    stats:storage['logic4-stats-v2'],
    daily:storage['logic4-daily-v2'],
    preferences:storage['logic4-prefs-v1']
  };
  const before=semanticSnapshot(packageInput);
  const pkg=DataSerialization.createUserDataPackage(packageInput);
  assert.strictEqual(pkg.format,'quadlud-user-data');
  assert.strictEqual(pkg.schema,1);
  assert.strictEqual(pkg.source.product,'QUADLUD');
  assert.strictEqual(pkg.source.version,'2.23.0');
  assert.strictEqual(pkg.source.persistenceBaseline,'v2.23');
  assert.deepStrictEqual(Object.keys(pkg.sections),['save','stats','daily','preferences']);
  assert(!JSON.stringify(pkg).includes('logic4-save-v1'));
  assert(!JSON.stringify(pkg).includes('logic4-stats-v1'));
  assert(!JSON.stringify(pkg).includes('logic4-daily-v1'));

  const unpacked=DataSerialization.unpackUserDataPackage(DataSerialization.parse(DataSerialization.stringify(pkg)));
  assert.deepStrictEqual(unpacked.save,storage['logic4-save-v2']);
  assert.deepStrictEqual(unpacked.stats,storage['logic4-stats-v2']);
  assert.deepStrictEqual(unpacked.daily,storage['logic4-daily-v2']);
  assert.deepStrictEqual(unpacked.preferences,storage['logic4-prefs-v1']);
  assert.deepStrictEqual(semanticSnapshot(packageInput),before,'package creation mutated input');

  const bad={...pkg,schema:999};
  assert.throws(()=>DataSerialization.unpackUserDataPackage(bad),/Unsupported QUADLUD user data package/);
})();

console.log('data serialization: OK');
