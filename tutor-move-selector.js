/*
 * QUADLUD — generic Tutor move selector
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTutorMoveSelector=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION=1;
  const CANDIDATE_SCHEMA=1;
  const RESULT_SCHEMA=1;
  const STATUS=Object.freeze({
    PROVEN_MINIMUM:'PROVEN_MINIMUM',
    BEST_AVAILABLE_BUDGET_LIMITED:'BEST_AVAILABLE_BUDGET_LIMITED',
    NO_PLAYABLE_CANDIDATE:'NO_PLAYABLE_CANDIDATE',
    INVALID_CANDIDATE_SET:'INVALID_CANDIDATE_SET'
  });

  function isPlainObject(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const proto=Object.getPrototypeOf(value);
    return proto===Object.prototype||proto===null;
  }
  function nonEmptyString(value){return typeof value==='string'&&value.length>0}
  function compareStrings(a,b){return a<b?-1:a>b?1:0}
  function compareCostVectors(a,b){
    for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];
    return 0
  }
  function compareCandidates(a,b){
    return compareCostVectors(a.costVector,b.costVector)
      ||compareStrings(a.stableKey,b.stableKey)
      ||compareStrings(a.id,b.id)
  }
  function validateCandidate(candidate,index){
    if(!isPlainObject(candidate))throw new TypeError(`Tutor move candidate ${index} must be a plain object`);
    if(candidate.schema!==CANDIDATE_SCHEMA)throw new TypeError(`Tutor move candidate ${index} must use schema ${CANDIDATE_SCHEMA}`);
    if(!nonEmptyString(candidate.id))throw new TypeError(`Tutor move candidate ${index} id must be a non-empty string`);
    if(!nonEmptyString(candidate.game))throw new TypeError(`Tutor move candidate ${candidate.id} game must be a non-empty string`);
    if(candidate.deduction==null||typeof candidate.deduction!=='object')throw new TypeError(`Tutor move candidate ${candidate.id} deduction must be an opaque object`);
    if(typeof candidate.playable!=='boolean')throw new TypeError(`Tutor move candidate ${candidate.id} playable must be boolean`);
    if(typeof candidate.validated!=='boolean')throw new TypeError(`Tutor move candidate ${candidate.id} validated must be boolean`);
    if(!nonEmptyString(candidate.costModel))throw new TypeError(`Tutor move candidate ${candidate.id} costModel must be a non-empty string`);
    if(!Array.isArray(candidate.costVector)||candidate.costVector.length===0||candidate.costVector.some(value=>!Number.isInteger(value)||value<0))throw new TypeError(`Tutor move candidate ${candidate.id} costVector must contain non-negative integers`);
    if(!Array.isArray(candidate.blockedBy)||candidate.blockedBy.some(id=>!nonEmptyString(id))||new Set(candidate.blockedBy).size!==candidate.blockedBy.length)throw new TypeError(`Tutor move candidate ${candidate.id} blockedBy must contain unique non-empty ids`);
    if(!nonEmptyString(candidate.stableKey))throw new TypeError(`Tutor move candidate ${candidate.id} stableKey must be a non-empty string`);
    return candidate
  }
  function result(status,fields={}){
    return Object.freeze({
      schema:RESULT_SCHEMA,
      status,
      selected:fields.selected||null,
      selectedId:fields.selected?.id||null,
      frontierIds:Object.freeze((fields.frontierIds||[]).slice()),
      discardedDominatedIds:Object.freeze((fields.discardedDominatedIds||[]).slice()),
      frontierComplete:fields.frontierComplete!==false,
      errorCode:fields.errorCode||null
    })
  }
  function invalid(errorCode,frontierComplete=true){return result(STATUS.INVALID_CANDIDATE_SET,{frontierComplete,errorCode})}
  function dominanceCycle(active){
    const byId=new Map(active.map(candidate=>[candidate.id,candidate]));
    const visiting=new Set(),visited=new Set();
    function visit(id){
      if(visiting.has(id))return true;
      if(visited.has(id))return false;
      visiting.add(id);
      const candidate=byId.get(id);
      const blockers=(candidate?.blockedBy||[]).filter(blocker=>byId.has(blocker)).slice().sort(compareStrings);
      for(const blocker of blockers)if(visit(blocker))return true;
      visiting.delete(id);visited.add(id);return false
    }
    for(const id of [...byId.keys()].sort(compareStrings))if(visit(id))return true;
    return false
  }
  function select(candidates,options={}){
    if(!Array.isArray(candidates))throw new TypeError('Tutor move candidates must be an array');
    if(!isPlainObject(options))throw new TypeError('Tutor move selector options must be a plain object');
    const allowedOptions=new Set(['frontierComplete']);
    for(const key of Object.keys(options))if(!allowedOptions.has(key))throw new TypeError(`Unknown Tutor move selector option "${key}"`);
    if(Object.prototype.hasOwnProperty.call(options,'frontierComplete')&&typeof options.frontierComplete!=='boolean')throw new TypeError('Tutor move selector frontierComplete must be boolean');
    const frontierComplete=options.frontierComplete!==false;
    if(candidates.length===0)return result(STATUS.NO_PLAYABLE_CANDIDATE,{frontierComplete});

    const checked=candidates.map(validateCandidate);
    const ids=new Set();
    for(const candidate of checked){if(ids.has(candidate.id))return invalid('DUPLICATE_ID',frontierComplete);ids.add(candidate.id)}
    const game=checked[0].game,costModel=checked[0].costModel,costLength=checked[0].costVector.length;
    if(checked.some(candidate=>candidate.game!==game))return invalid('MIXED_GAME',frontierComplete);
    if(checked.some(candidate=>candidate.costModel!==costModel))return invalid('MIXED_COST_MODEL',frontierComplete);
    if(checked.some(candidate=>candidate.costVector.length!==costLength))return invalid('MIXED_COST_VECTOR_LENGTH',frontierComplete);

    const active=checked.filter(candidate=>candidate.playable&&candidate.validated);
    if(active.length===0)return result(STATUS.NO_PLAYABLE_CANDIDATE,{frontierComplete});
    if(dominanceCycle(active))return invalid('DOMINANCE_CYCLE',frontierComplete);

    const activeIds=new Set(active.map(candidate=>candidate.id));
    const dominated=active.filter(candidate=>candidate.blockedBy.some(blocker=>activeIds.has(blocker))).sort(compareCandidates);
    const dominatedIds=new Set(dominated.map(candidate=>candidate.id));
    const frontier=active.filter(candidate=>!dominatedIds.has(candidate.id)).sort(compareCandidates);
    if(frontier.length===0)return invalid('EMPTY_FRONTIER',frontierComplete);

    const selected=frontier[0];
    return result(frontierComplete?STATUS.PROVEN_MINIMUM:STATUS.BEST_AVAILABLE_BUDGET_LIMITED,{
      selected,
      frontierIds:frontier.map(candidate=>candidate.id),
      discardedDominatedIds:dominated.map(candidate=>candidate.id),
      frontierComplete
    })
  }

  return Object.freeze({VERSION,CANDIDATE_SCHEMA,RESULT_SCHEMA,STATUS,select})
});
