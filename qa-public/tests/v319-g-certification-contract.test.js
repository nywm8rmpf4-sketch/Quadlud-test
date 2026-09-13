'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'../GitHub');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const build=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8'));
const serialization=require(path.join(root,'data-serialization.js'));
const Audio=require(path.join(root,'audio-service.js'));
const Bridge=require(path.join(root,'audio-event-bridge.js'));

const defaults=serialization.normalizePreferences({},{defaultLang:'fr',supportedLangs:['fr']});
assert.deepStrictEqual({sound:defaults.sound,pedagogy:defaults.soundPedagogy,volume:defaults.soundVolume},{sound:true,pedagogy:true,volume:.72});
const normalized=serialization.normalizePreferences({sound:false,soundPedagogy:false,soundVolume:4},{defaultLang:'fr',supportedLangs:['fr']});
assert.deepStrictEqual({sound:normalized.sound,pedagogy:normalized.soundPedagogy,volume:normalized.soundVolume},{sound:false,pedagogy:false,volume:1});

let played=0;
const service=Audio.createAudioService({backend:{play(){played++;return true}},nowMs:()=>1000});
let preferences={sound:true,soundPedagogy:false,soundVolume:.35};
const bridge=Bridge.createBridge({audio:Audio,service,getPreferences:()=>preferences});
assert.strictEqual(bridge.emit('COACH_HINT'),false);
assert.strictEqual(bridge.emit('MOVE_ACCEPTED'),true);
assert.deepStrictEqual(bridge.diagnostics().preferences,{enabled:true,pedagogicalEnabled:false,masterVolume:.35});
preferences={sound:false,soundPedagogy:true,soundVolume:.8};
assert.strictEqual(bridge.emit('VICTORY'),false);
assert.strictEqual(played,1);

for(const token of ["id=\"soundPedagogyToggle\"","id=\"soundVolume\"","aria-valuetext","togglePedagogicalSound","setSoundVolume"])assert(app.includes(token),token);
assert(app.includes("if(!current||current.completed||paused||current.training)return false"),'single victory guard missing');
assert.strictEqual((app.match(/AudioEvents\.emit\('VICTORY'\)/g)||[]).length,1,'victory semantic event must have one owner');
assert.strictEqual(manifest.version,'3.1.9-G');
assert.deepStrictEqual({version:build.version,candidate:build.candidate,channel:build.channel},{version:'3.1.9-G',candidate:'ACCESSIBILITY-PERFORMANCE-CERTIFICATION-R1',channel:'Quadlud-test'});
assert(index.includes('3.1.9-G · ACCESSIBILITY-PERFORMANCE-CERTIFICATION-R1 · publié'));
const assets=vm.runInNewContext(sw.match(/const ASSETS=(\[[\s\S]*?\]);/)[1]);
assert.strictEqual(new Set(assets).size,assets.length,'PWA precache contains duplicates');
for(const asset of ['./index.html','./manifest.webmanifest','./build-info.json','./app.js?v=3.1.9-g-certification-r1','./styles-core.css?v=3.1.9-g-certification-r1'])assert(assets.includes(asset),asset);
assert(sw.includes("const CACHE='quadlud-v3.1.9-g-certification-r1-v28'"));
console.log('v3.1.9-G certification contract: audio preferences, single victory, identity and PWA PASS');
