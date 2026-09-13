'use strict';
const assert=require('assert');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'../GitHub');
const progressionUx=['victory-insight.js','progression-profile.js','progression-profile-ui.js','progression-stats.js','mastery-model.js'];
const forbiddenPlatform=['localStorage','sessionStorage','indexedDB','IndexedDB','XMLHttpRequest','WebSocket','fetch('];
for(const file of progressionUx){const src=fs.readFileSync(path.join(ROOT,file),'utf8');for(const token of forbiddenPlatform)assert(!src.includes(token),`${file}: forbidden direct platform/network dependency ${token}`)}
const uiUx=['victory-insight.js','progression-profile.js','progression-profile-ui.js'];
const forbiddenDirectWrites=['writeStats(','PersistentData.stats.write','PersistentData.save.write','PersistentData.daily.write','PersistentData.preferences.write'];
for(const file of uiUx){const src=fs.readFileSync(path.join(ROOT,file),'utf8');for(const token of forbiddenDirectWrites)assert(!src.includes(token),`${file}: forbidden direct persistence write ${token}`)}
const serializer=fs.readFileSync(path.join(ROOT,'data-serialization.js'),'utf8');for(const token of forbiddenPlatform)assert(!serializer.includes(token),`serializer platform/network leak: ${token}`);
const D=require(path.join(ROOT,'data-serialization.js'));assert.strictEqual(D.EXPORT_SCHEMA,2);assert.deepStrictEqual(D.IMPORT_POLICY,{mode:'replace',merge:false});
const build=JSON.parse(fs.readFileSync(path.join(ROOT,'build-info.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8')),index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
assert.strictEqual(build.version,'3.2.0');assert.strictEqual(build.candidate,'RELEASE-CERTIFICATION-R1');assert.strictEqual(manifest.version,'3.2.0');assert(index.includes('3.2.0 · RELEASE-CERTIFICATION-R1 · candidate'));assert(sw.includes("const CACHE='quadlud-v3.2.0-release-r1-v1'"));
console.log('v3.2.0 architecture gate PASS — v3.2 UX/progression local-first boundaries, replace-only portability, release identity');
