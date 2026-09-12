/*
 * QUADLUD — semantic audio service
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludAudioService=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION=2;
  const EVENTS=Object.freeze({
    MOVE_ACCEPTED:'move-accepted', IMPORTANT_PLACEMENT:'important-placement', ERASE:'erase', INVALID:'invalid',
    CONTRADICTION:'contradiction', UNDO:'undo', REDO:'redo', COACH_HINT:'coach-hint', LOGIC_STEP:'logic-step',
    TUTOR_START:'tutor-start', TUTOR_CONCLUSION:'tutor-conclusion', NEW_GAME:'new-game', RESET:'reset',
    VICTORY:'victory', MILESTONE:'milestone'
  });
  const CATEGORIES=Object.freeze({INTERACTION:'interaction',PEDAGOGY:'pedagogy',SYSTEM:'system',REWARD:'reward'});
  const PEDAGOGICAL_EVENTS=new Set([EVENTS.COACH_HINT,EVENTS.LOGIC_STEP,EVENTS.TUTOR_START,EVENTS.TUTOR_CONCLUSION]);
  const voice=(frequency,durationMs,offsetMs=0,gain=0.15,wave='sine')=>Object.freeze({frequency,durationMs,offsetMs,gain,wave});
  const program=(category,priority,minIntervalMs,voices)=>Object.freeze({category,priority,minIntervalMs,voices:Object.freeze(voices)});
  const I=CATEGORIES.INTERACTION,P=CATEGORIES.PEDAGOGY,S=CATEGORIES.SYSTEM,R=CATEGORIES.REWARD;
  const PROGRAMS=Object.freeze({
    [EVENTS.MOVE_ACCEPTED]:program(I,1,28,[voice(740,70,0,0.08,'triangle')]),
    [EVENTS.IMPORTANT_PLACEMENT]:program(I,2,45,[voice(880,115,0,0.10),voice(1320,80,25,0.035)]),
    [EVENTS.ERASE]:program(I,1,35,[voice(660,55,0,0.065,'triangle'),voice(520,65,42,0.045,'triangle')]),
    [EVENTS.INVALID]:program(I,3,95,[voice(185,115,0,0.075,'triangle')]),
    [EVENTS.CONTRADICTION]:program(P,4,140,[voice(260,115,0,0.085,'triangle'),voice(196,145,105,0.075,'triangle')]),
    [EVENTS.UNDO]:program(I,2,55,[voice(620,70,0,0.06),voice(470,85,55,0.055)]),
    [EVENTS.REDO]:program(I,2,55,[voice(470,70,0,0.055),voice(620,85,55,0.06)]),
    [EVENTS.COACH_HINT]:program(P,3,120,[voice(1047,150,0,0.075),voice(1568,90,22,0.025)]),
    [EVENTS.LOGIC_STEP]:program(P,1,45,[voice(988,65,0,0.045)]),
    [EVENTS.TUTOR_START]:program(P,3,120,[voice(659,105,0,0.055),voice(784,120,95,0.06)]),
    [EVENTS.TUTOR_CONCLUSION]:program(P,4,120,[voice(784,100,0,0.055),voice(988,145,90,0.07)]),
    [EVENTS.NEW_GAME]:program(S,2,180,[voice(523,100,0,0.055,'triangle'),voice(659,115,90,0.06,'triangle')]),
    [EVENTS.RESET]:program(S,2,180,[voice(659,75,0,0.045,'triangle'),voice(523,90,58,0.045,'triangle'),voice(392,110,125,0.04,'triangle')]),
    [EVENTS.VICTORY]:program(R,5,500,[voice(523,160,0,0.07),voice(659,160,135,0.07),voice(784,180,270,0.075),voice(1047,360,420,0.09)]),
    [EVENTS.MILESTONE]:program(R,5,500,[voice(523,140,0,0.065),voice(659,140,115,0.065),voice(784,160,230,0.07),voice(1047,260,360,0.08),voice(1319,300,500,0.055)])
  });
  function clamp01(value,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback}
  function durationMs(program){return program.voices.reduce((m,v)=>Math.max(m,(Number(v.offsetMs)||0)+(Number(v.durationMs)||0)),0)}
  function validatePrograms(programs=PROGRAMS){
    const errors=[];
    for(const [event,p] of Object.entries(programs)){
      if(!Object.values(EVENTS).includes(event))errors.push(`${event}: unknown event`);
      if(!Object.values(CATEGORIES).includes(p.category))errors.push(`${event}: invalid category`);
      if(!Number.isInteger(p.priority)||p.priority<0||p.priority>5)errors.push(`${event}: invalid priority`);
      if(!(Number(p.minIntervalMs)>=0))errors.push(`${event}: invalid minIntervalMs`);
      if(!Array.isArray(p.voices)||!p.voices.length)errors.push(`${event}: voices required`);
      for(const [i,v] of (p.voices||[]).entries()){
        if(!(Number(v.frequency)>0))errors.push(`${event}[${i}]: invalid frequency`);
        if(!(Number(v.durationMs)>0))errors.push(`${event}[${i}]: invalid duration`);
        if(!(Number(v.gain)>0&&Number(v.gain)<=1))errors.push(`${event}[${i}]: invalid gain`);
      }
    }
    return Object.freeze(errors)
  }
  function createAudioService(options={}){
    const backend=options.backend||null;
    const now=typeof options.nowMs==='function'?options.nowMs:()=>Date.now();
    let enabled=options.enabled!==false,pedagogicalEnabled=options.pedagogicalEnabled!==false,masterVolume=clamp01(options.masterVolume,0.72);
    const lastPlayed=new Map();
    const stats={requested:0,played:0,suppressedDisabled:0,suppressedPedagogy:0,suppressedCooldown:0,suppressedVolume:0,backendRejected:0};
    function play(event,opts={}){
      stats.requested++;
      const p=PROGRAMS[event];
      if(!p||!backend||typeof backend.play!=='function'){stats.backendRejected++;return false}
      if(!enabled){stats.suppressedDisabled++;return false}
      if(PEDAGOGICAL_EVENTS.has(event)&&!pedagogicalEnabled){stats.suppressedPedagogy++;return false}
      const intensity=clamp01(opts.intensity,1);
      if(intensity<=0||masterVolume<=0){stats.suppressedVolume++;return false}
      const t=Number(now());
      const previous=lastPlayed.get(event);
      const bypassCooldown=opts.bypassCooldown===true;
      if(!bypassCooldown&&Number.isFinite(t)&&Number.isFinite(previous)&&t-previous<p.minIntervalMs){stats.suppressedCooldown++;return false}
      try{
        const ok=backend.play(p,{volume:masterVolume*intensity,event,priority:p.priority})!==false;
        if(!ok){stats.backendRejected++;return false}
        if(Number.isFinite(t))lastPlayed.set(event,t);
        stats.played++;return true
      }catch(_){stats.backendRejected++;return false}
    }
    function unlock(){try{return !!(backend&&typeof backend.unlock==='function'&&backend.unlock())}catch(_){return false}}
    function setEnabled(value){enabled=!!value;return enabled}
    function setPedagogicalEnabled(value){pedagogicalEnabled=!!value;return pedagogicalEnabled}
    function setMasterVolume(value){masterVolume=clamp01(value,masterVolume);return masterVolume}
    function snapshot(){return Object.freeze({enabled,pedagogicalEnabled,masterVolume})}
    function diagnostics(){return Object.freeze({...stats,lastPlayedCount:lastPlayed.size,backend:backend&&typeof backend.diagnostics==='function'?backend.diagnostics():null})}
    function dispose(){lastPlayed.clear();try{if(backend&&typeof backend.dispose==='function')backend.dispose()}catch(_){}}
    return Object.freeze({play,unlock,setEnabled,setPedagogicalEnabled,setMasterVolume,snapshot,diagnostics,dispose})
  }
  return Object.freeze({VERSION,EVENTS,CATEGORIES,PROGRAMS,durationMs,validatePrograms,createAudioService})
});
