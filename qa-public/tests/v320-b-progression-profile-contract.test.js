'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../GitHub');
const Profile=require(path.join(ROOT,'progression-profile.js'));
const Mastery=require(path.join(ROOT,'mastery-model.js'));

assert.strictEqual(Profile.VERSION,1);assert.strictEqual(Profile.SCHEMA,1);
const catalog={q0:{game:'queens',rank:0},q2:{game:'queens',rank:2},t1:{game:'tango',rank:1}};
const stats={schema:5,started:6,solved:4,revealed:1,byGame:{queens:{easy:{started:2,solved:2,revealed:0,best:30},hard:{started:2,solved:1,revealed:1,best:90}},tango:{medium:{started:2,solved:1,revealed:0,best:70}}},history:[{outcome:'solved',game:'queens',diff:'easy',hintUsed:false,walkthroughUsed:false},{outcome:'solved',game:'queens',diff:'hard',hintUsed:true,walkthroughUsed:false},{outcome:'solved',game:'tango',diff:'medium',hintUsed:false,walkthroughUsed:false}],mastery:{schema:1,byTechnique:{}}};
const effective={q0:{encountered:5,solo:4},q2:{encountered:4,solo:3},t1:{encountered:3,solo:1,where3:1}};
const p=Profile.deriveProfile({stats,effectiveMastery:effective,gameIds:['queens','tango','sudoku'],catalog,masteryModel:Mastery});
assert.strictEqual(p.schema,1);assert.strictEqual(p.source,'derived-existing-persistence');assert.strictEqual(p.totals.solved,4);assert.strictEqual(p.games.solvedCount,2);assert.strictEqual(p.games.solvedByDifficulty.easy,2);assert.strictEqual(p.games.solvedByDifficulty.hard,1);assert.strictEqual(p.helpFreeSolved,2);assert(p.mastery.advancedSoloTechniques>=1);assert(p.achievements.find(x=>x.id==='first-solve').unlocked);assert(p.achievements.find(x=>x.id==='no-help').unlocked);assert(p.achievements.find(x=>x.id==='advanced-solo').unlocked);assert(!p.achievements.find(x=>x.id==='all-games').unlocked);assert(p.nextAchievement);
const blank=Profile.deriveProfile({stats:{},effectiveMastery:{},gameIds:['queens'],catalog:{},masteryModel:Mastery});assert.strictEqual(blank.totals.solved,0);assert.strictEqual(blank.games.solvedCount,0);assert.strictEqual(blank.helpFreeSolved,0);assert(blank.achievements.every(x=>!x.unlocked));

for(const file of ['progression-profile.js','progression-profile-ui.js']){
  const src=fs.readFileSync(path.join(ROOT,file),'utf8');
  for(const forbidden of ['localStorage','sessionStorage','indexedDB','IndexedDB','PersistentData.stats.write','writeStats(','fetch(','XMLHttpRequest','WebSocket'])assert(!src.includes(forbidden),`${file}: forbidden direct persistence/network dependency ${forbidden}`);
}
const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'styles-v32-ux2.css'),'utf8'),build=JSON.parse(fs.readFileSync(path.join(ROOT,'build-info.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
assert(index.includes('styles-v32-ux2.css?v=3.2-b-ux2-r1'));assert(index.includes('progression-profile.js?v=3.2-b-ux2-r1'));assert(index.includes('progression-profile-ui.js?v=3.2-b-ux2-r1'));
assert(index.indexOf('progression-profile.js?v=3.2-b-ux2-r1')<index.indexOf('app.js?v=3.1.9-g-certification-r1'));assert(index.indexOf('progression-profile-ui.js?v=3.2-b-ux2-r1')>index.indexOf('app.js?v=3.1.9-g-certification-r1'));
assert(sw.includes("quadlud-v3.2-b-ux2-r1-v1"));for(const asset of ['styles-v32-ux2.css?v=3.2-b-ux2-r1','progression-profile.js?v=3.2-b-ux2-r1','progression-profile-ui.js?v=3.2-b-ux2-r1'])assert(sw.includes(asset),asset);
assert.strictEqual(build.version,'3.2-B');assert.strictEqual(build.candidate,'UX2-LOCAL-PROGRESSION-R1');assert.strictEqual(manifest.version,'3.2-B');assert(css.includes('prefers-reduced-motion'));assert(css.includes('forced-colors'));
console.log('v3.2-B UX-2 derived local progression contract: PASS');
