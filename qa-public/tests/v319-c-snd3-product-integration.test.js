'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Audio=require('../GitHub/audio-service.js');
const Web=require('../GitHub/audio-web.js');
const Bridge=require('../GitHub/audio-event-bridge.js');

assert.strictEqual(Audio.VERSION,2);assert.strictEqual(Web.VERSION,2);assert.strictEqual(Bridge.VERSION,1);
assert.deepStrictEqual(Bridge.EVENT_KEYS,Object.keys(Audio.EVENTS));assert.strictEqual(Bridge.EVENT_KEYS.length,15);

const index=read('GitHub/index.html'),sw=read('GitHub/sw.js'),app=read('GitHub/app.js'),victory=read('GitHub/victory-presentation.js');
const ordered=['audio-web.js?v=3.1.9-c-snd3-r1','audio-service.js?v=3.1.9-c-snd3-r1','audio-event-bridge.js?v=3.1.9-c-snd3-r1','app.js?v=3.1.9-c-snd3-r1'];
for(const asset of ordered){assert(index.includes(asset),`${asset} absent from index`);assert(sw.includes(`./${asset}`),`${asset} absent from service worker`)}
for(let i=1;i<ordered.length;i++)assert(index.indexOf(ordered[i-1])<index.indexOf(ordered[i]),'SND-3 load order invalid');
assert(!/playTone|playApplause/.test(app));assert(!/AudioContext|webkitAudioContext/.test(app));assert(!/AudioContext|webkitAudioContext|playApplause|buildApplausePlan/.test(victory));
assert.strictEqual((app.match(/AudioEvents\.emit\('VICTORY'\)/g)||[]).length,1,'victory must emit exactly once from finish');
for(const event of ['NEW_GAME','UNDO','REDO','RESET','INVALID','COACH_HINT','LOGIC_STEP','TUTOR_START','TUTOR_CONCLUSION'])assert(app.includes(`'${event}'`),`${event} product integration missing`);
assert(app.includes('semanticAudioForLogicalMove(move,applied)'),'LogicalTransaction path, including Mosaïque, must reach SND-3');
for(const file of fs.readdirSync(path.join(root,'GitHub')).filter(x=>/-ui\.js$|-runtime\.js$|-logic\.js$/.test(x))){const src=read(`GitHub/${file}`);assert(!/AudioEvents|SemanticAudio|QuadludAudioService/.test(src),`${file} bypasses transverse bridge`)}
for(const file of fs.readdirSync(path.join(root,'GitHub')).filter(x=>x.endsWith('.js')&&x!=='audio-web.js'))assert(!/new\s+(?:scope\.)?(?:AudioContext|webkitAudioContext)\b/.test(read(`GitHub/${file}`)),`${file} creates AudioContext outside backend`);

let calls=[],now=1000;
const backend={play:(program,options)=>{calls.push({program,options});return true},unlock:()=>true};
const service=Audio.createAudioService({backend,nowMs:()=>now});let preferences={sound:true,soundPedagogy:true,soundVolume:.72};
const bridge=Bridge.createBridge({audio:Audio,service,getPreferences:()=>preferences});
assert.strictEqual(bridge.classifyAction({applied:false,action:{type:'MOVE'}}),'INVALID');
assert.strictEqual(bridge.classifyAction({applied:true,error:{kind:'x'},action:{type:'MOVE'}}),'CONTRADICTION');
assert.strictEqual(bridge.classifyAction({applied:true,action:{type:'ERASE'}}),'ERASE');
assert.strictEqual(bridge.classifyAction({applied:true,action:{type:'MOVE',important:true}}),'IMPORTANT_PLACEMENT');
assert.strictEqual(bridge.classifyAction({applied:true,action:{type:'MOVE'}}),'MOVE_ACCEPTED');
assert(bridge.emit('VICTORY',{bypassCooldown:true}));assert.strictEqual(calls.at(-1).options.event,Audio.EVENTS.VICTORY);
preferences={...preferences,sound:false};assert.strictEqual(bridge.emit('RESET',{bypassCooldown:true}),false);
preferences={...preferences,sound:true,soundPedagogy:false};assert.strictEqual(bridge.emit('COACH_HINT',{bypassCooldown:true}),false);assert(bridge.emit('NEW_GAME',{bypassCooldown:true}));

const serialization=read('GitHub/data-serialization.js');assert(serialization.includes('soundPedagogy:p.soundPedagogy!==false'));assert(serialization.includes(':0.72'));
assert(!/\.(?:mp3|wav|ogg|m4a)(?:[?'"`]|$)/i.test(index+sw),'network media asset present');
console.log('v3.1.9-C SND-3 product integration: PASS');
