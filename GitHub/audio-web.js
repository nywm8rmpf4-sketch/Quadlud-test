/*
 * QUADLUD — Web Audio backend
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludWebAudio=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=2;
  function createWebAudioBackend(env,options={}){
    const scope=env||((typeof globalThis!=='undefined')?globalThis:null);
    const maxVoices=Math.max(1,Math.min(64,Number(options.maxVoices)||24));
    let context=null,disposed=false,serial=0;
    const active=new Map();
    const counters={playCalls:0,scheduled:0,dropped:0,preempted:0,resumeRequests:0,errors:0};
    function AudioContextCtor(){return scope&&(scope.AudioContext||scope.webkitAudioContext)||null}
    function supported(){return typeof AudioContextCtor()==='function'}
    function ensureContext(){if(disposed||context)return context;const Ctor=AudioContextCtor();if(typeof Ctor!=='function')return null;try{context=new Ctor();return context}catch(_){counters.errors++;return null}}
    function resume(ctx){if(!ctx||ctx.state!=='suspended'||typeof ctx.resume!=='function')return;try{counters.resumeRequests++;const p=ctx.resume();if(p&&typeof p.catch==='function')p.catch(()=>{})}catch(_){counters.errors++}}
    function unlock(){const ctx=ensureContext();if(!ctx)return false;resume(ctx);return true}
    function finish(id){const item=active.get(id);if(!item)return;active.delete(id);try{item.osc.disconnect();item.gain.disconnect()}catch(_){}}
    function preemptOne(priority){
      let candidate=null;
      for(const [id,item] of active){if(item.priority>=priority)continue;if(!candidate||item.priority<candidate.item.priority||(item.priority===candidate.item.priority&&id<candidate.id))candidate={id,item}}
      if(!candidate)return false;
      try{candidate.item.osc.stop()}catch(_){}
      finish(candidate.id);counters.preempted++;return true
    }
    function play(program,{volume=1,priority=0}={}){
      counters.playCalls++;
      const ctx=ensureContext();
      if(!ctx||!program||!Array.isArray(program.voices)||!program.voices.length)return false;
      resume(ctx);
      const master=Math.max(0,Math.min(1,Number(volume)||0));if(master<=0)return false;
      const p=Math.max(0,Math.min(5,Number(priority)||0)),now=Number(ctx.currentTime)||0;
      let scheduled=0;
      for(const spec of program.voices){
        if(active.size>=maxVoices&&!preemptOne(p)){counters.dropped++;continue}
        const frequency=Number(spec.frequency),durationMs=Number(spec.durationMs),offsetMs=Number(spec.offsetMs)||0,gainValue=Math.max(0,Math.min(1,Number(spec.gain)||0))*master;
        if(!(frequency>0)||!(durationMs>0)||gainValue<=0)continue;
        try{
          const osc=ctx.createOscillator(),gain=ctx.createGain(),start=now+Math.max(0,offsetMs)/1000,end=start+durationMs/1000,id=++serial;
          osc.type=String(spec.wave||'sine');osc.frequency.setValueAtTime(frequency,start);
          gain.gain.setValueAtTime(0.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,gainValue),start+Math.min(0.012,durationMs/4000));gain.gain.exponentialRampToValueAtTime(0.0001,end);
          osc.connect(gain);gain.connect(ctx.destination);active.set(id,{osc,gain,priority:p});scheduled++;counters.scheduled++;
          osc.onended=()=>finish(id);osc.start(start);osc.stop(end+0.008);
        }catch(_){counters.errors++}
      }
      return scheduled>0
    }
    function stopAll(){for(const [id,item] of [...active]){try{item.osc.stop()}catch(_){}finish(id)}return true}
    function dispose(){if(disposed)return;disposed=true;stopAll();const ctx=context;context=null;if(ctx&&typeof ctx.close==='function'){try{const p=ctx.close();if(p&&typeof p.catch==='function')p.catch(()=>{})}catch(_){counters.errors++}}}
    function diagnostics(){return Object.freeze({supported:supported(),contextCreated:!!context,activeVoices:active.size,maxVoices,disposed,...counters})}
    return Object.freeze({supported,unlock,play,stopAll,dispose,diagnostics})
  }
  return Object.freeze({VERSION,createWebAudioBackend})
});
