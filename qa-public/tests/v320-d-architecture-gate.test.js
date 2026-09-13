'use strict';
const assert=require('assert');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'../GitHub');
const ux=['victory-insight.js','progression-profile.js','progression-profile-ui.js'];
const forbiddenUx=['localStorage','sessionStorage','indexedDB','IndexedDB','XMLHttpRequest','WebSocket','fetch(','writeStats(','PersistentData.stats.write','PersistentData.save.write','PersistentData.daily.write','PersistentData.preferences.write'];
for(const file of ux){const src=fs.readFileSync(path.join(ROOT,file),'utf8');for(const token of forbiddenUx)assert(!src.includes(token),`${file}: forbidden direct platform/write dependency ${token}`)}
const directStorage=[];for(const file of fs.readdirSync(ROOT).filter(x=>x.endsWith('.js')&&x!=='web-storage.js')){const src=fs.readFileSync(path.join(ROOT,file),'utf8');if(src.includes('localStorage'))directStorage.push(file)}assert.deepStrictEqual(directStorage,[],'web-storage.js must remain the only direct localStorage owner');
const serializer=fs.readFileSync(path.join(ROOT,'data-serialization.js'),'utf8');for(const token of ['localStorage','sessionStorage','indexedDB','XMLHttpRequest','WebSocket','fetch('])assert(!serializer.includes(token),`serializer platform/network leak: ${token}`);
const D=require(path.join(ROOT,'data-serialization.js'));assert.strictEqual(D.EXPORT_SCHEMA,2);assert.deepStrictEqual(D.IMPORT_POLICY,{mode:'replace',merge:false});
const build=JSON.parse(fs.readFileSync(path.join(ROOT,'build-info.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8')),index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
assert.strictEqual(build.version,'3.2.0');assert.strictEqual(build.candidate,'RELEASE-CERTIFICATION-R1');assert.strictEqual(manifest.version,'3.2.0');assert(index.includes('3.2.0 · RELEASE-CERTIFICATION-R1 · candidate'));assert(sw.includes("const CACHE='quadlud-v3.2.0-release-r1-v1'"));
console.log('v3.2.0 architecture gate PASS — local-first boundaries, replace-only portability, release identity');
