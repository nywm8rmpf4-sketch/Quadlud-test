'use strict';
const assert=require('assert');
const path=require('path');
const Audio=require(path.resolve(__dirname,'..','GitHub','audio-service.js'));
const Web=require(path.resolve(__dirname,'..','GitHub','audio-web.js'));
assert.equal(Audio.VERSION,2);assert.equal(Web.VERSION,2);assert.deepEqual(Audio.validatePrograms(),[]);
assert.equal(Object.keys(Audio.PROGRAMS).length,Object.keys(Audio.EVENTS).length);
for(const p of Object.values(Audio.PROGRAMS)){assert(p.priority>=0&&p.priority<=5);assert(p.minIntervalMs>=0);assert(Audio.durationMs(p)>0)}
let now=1000,calls=[];
const backend={play:(p,o)=>{calls.push({p,o});return true},unlock:()=>true,diagnostics:()=>({ok:true}),dispose(){calls.push('dispose')}};
const service=Audio.createAudioService({backend,nowMs:()=>now,masterVolume:.5});
assert(service.unlock());assert(service.play(Audio.EVENTS.MOVE_ACCEPTED));
assert.equal(service.play(Audio.EVENTS.MOVE_ACCEPTED),false);now+=28;assert(service.play(Audio.EVENTS.MOVE_ACCEPTED));
service.setPedagogicalEnabled(false);assert.equal(service.play(Audio.EVENTS.COACH_HINT),false);service.setPedagogicalEnabled(true);assert(service.play(Audio.EVENTS.COACH_HINT));
service.setEnabled(false);assert.equal(service.play(Audio.EVENTS.ERASE),false);service.setEnabled(true);service.setMasterVolume(0);assert.equal(service.play(Audio.EVENTS.ERASE),false);service.setMasterVolume(.7);assert(service.play(Audio.EVENTS.ERASE));
const d=service.diagnostics();assert.equal(d.requested,8);assert.equal(d.played,4);assert.equal(d.suppressedCooldown,1);assert.equal(d.suppressedPedagogy,1);assert.equal(d.suppressedDisabled,1);assert.equal(d.suppressedVolume,1);assert.deepEqual(d.backend,{ok:true});
service.dispose();assert(calls.includes('dispose'));

function fakeEnv(){
  const oscillators=[];
  class AC{constructor(){this.state='suspended';this.currentTime=2;this.destination={};this.closed=false}resume(){this.state='running';return Promise.resolve()}close(){this.closed=true;return Promise.resolve()}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}createOscillator(){const o={type:'',frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){if(o.onended)o.onended()},onended:null};oscillators.push(o);return o}}
  return {AudioContext:AC,oscillators};
}
const f=fakeEnv(),wb=Web.createWebAudioBackend(f,{maxVoices:2});assert(wb.supported());assert.equal(wb.diagnostics().contextCreated,false);assert(wb.unlock());assert.equal(wb.diagnostics().contextCreated,true);
const low={voices:[{frequency:440,durationMs:200,offsetMs:0,gain:.1,wave:'sine'},{frequency:550,durationMs:200,offsetMs:0,gain:.1,wave:'sine'}]};
const high={voices:[{frequency:880,durationMs:200,offsetMs:0,gain:.1,wave:'sine'}]};
assert(wb.play(low,{volume:1,priority:1}));
const f2=fakeEnv();f2.AudioContext.prototype.createOscillator=function(){const o={type:'',frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){},onended:null};return o};
const wb2=Web.createWebAudioBackend(f2,{maxVoices:2});assert(wb2.play(low,{volume:1,priority:1}));assert.equal(wb2.diagnostics().activeVoices,2);assert(wb2.play(high,{volume:1,priority:5}));assert.equal(wb2.diagnostics().preempted,1);assert.equal(wb2.diagnostics().activeVoices,2);wb2.stopAll();assert.equal(wb2.diagnostics().activeVoices,0);wb2.dispose();
const unsupported=Web.createWebAudioBackend({});assert.equal(unsupported.supported(),false);assert.equal(unsupported.unlock(),false);assert.equal(unsupported.play(low,{volume:1}),false);
console.log('SND-3 semantic audio service + Web Audio backend: PASS');
