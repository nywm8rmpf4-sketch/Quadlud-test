/*
 * QUADLUD — product semantic audio bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludAudioEventBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1;
  const EVENT_KEYS=Object.freeze(['MOVE_ACCEPTED','IMPORTANT_PLACEMENT','ERASE','INVALID','CONTRADICTION','UNDO','REDO','COACH_HINT','LOGIC_STEP','TUTOR_START','TUTOR_CONCLUSION','NEW_GAME','RESET','VICTORY','MILESTONE']);
  function createBridge({audio,service,getPreferences=()=>({})}={}){
    if(!audio||!service)throw new Error('audio and service are required');
    function sync(){const p=getPreferences()||{};service.setEnabled(p.sound!==false);service.setPedagogicalEnabled(p.soundPedagogy!==false);service.setMasterVolume(p.soundVolume);return service.snapshot()}
    function eventValue(name){const key=String(name||'').toUpperCase().replace(/-/g,'_');return EVENT_KEYS.includes(key)?audio.EVENTS[key]:null}
    function emit(name,options={}){const event=eventValue(name);if(!event)return false;sync();return service.play(event,options)}
    function classifyAction({applied=false,error=null,action=null,important=false}={}){
      if(!applied)return 'INVALID';
      if(error)return 'CONTRADICTION';
      const type=String(action?.type||action||'').toUpperCase();
      if(type==='ERASE'||type==='CLEAR'||type==='REMOVE'||type.includes('ERASE'))return 'ERASE';
      if(important===true||action?.important===true)return 'IMPORTANT_PLACEMENT';
      return 'MOVE_ACCEPTED'
    }
    function action(detail={}){return emit(classifyAction(detail),detail.options||{})}
    function unlock(){sync();return service.unlock()}
    function diagnostics(){return Object.freeze({version:VERSION,events:[...EVENT_KEYS],preferences:sync(),service:service.diagnostics()})}
    return Object.freeze({sync,emit,action,unlock,diagnostics,classifyAction})
  }
  return Object.freeze({VERSION,EVENT_KEYS,createBridge})
});
