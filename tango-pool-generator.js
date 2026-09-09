/*
 * QUADLUD — Soleil-Lune precomputed pool generation provider
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  'use strict';
  let api;
  if(typeof module!=='undefined'&&module.exports){
    let pool=null;try{pool=require('./tango-diversity-pool.js')}catch(_){pool=null}
    api=factory(require('./tango-generator.js'),pool,require('./difficulty-rating.js'));
    module.exports=api;
  }else api=factory(root.QuadludTangoGenerator,root.QuadludTangoDiversityPool,root.DifficultyRating);
  if(root&&api)root.QuadludTangoGenerator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Base,Pool,DR){
  'use strict';
  if(!Base)throw new Error('Soleil-Lune base generator unavailable');
  if(!DR)throw new Error('Soleil-Lune pool rating dependency unavailable');

  function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function publicPuzzle(candidate,state=null){
    if(state)return {game:'tango',n:6,state:state.map(row=>row.slice()),edges:(candidate.edges||[]).map(edge=>edge.slice())};
    return Base.publicPuzzleFromCandidate(candidate)
  }
  function fingerprint(puzzle){try{return DR.fingerprintPublicPuzzle(puzzle)}catch(_){return null}}
  function poolEntries(diff){let entries=Pool?.entries?.[diff];return Array.isArray(entries)?entries:[]}
  function candidateFromEntry(diff,entry,index){
    if(!entry||!Array.isArray(entry.sol)||entry.sol.length!==6||!Array.isArray(entry.givens)||!Array.isArray(entry.edges)||!entry.difficultyProfile)return null;
    let candidate={sol:entry.sol.map(row=>row.slice()),givens:new Set(entry.givens),edges:entry.edges.map(edge=>edge.slice()),difficultyProfile:copy(entry.difficultyProfile)};
    let puzzle=publicPuzzle(candidate),fp=fingerprint(puzzle),profile=candidate.difficultyProfile,tier=DR.tierIndex(diff);
    if(!fp||profile.status!=='solved'||profile.difficulty!==diff||profile.minimumRequiredTier!==tier||profile.budgetHit||profile.fingerprint!==fp)return null;
    let trace=entry.logicTrace;
    if(trace&&trace.sourceFingerprint!==fp)return null;
    candidate.generationStats={
      generatorVersion:DR.GENERATOR_VERSION||1,
      targetDifficulty:diff,
      strategy:'certified-precomputed-pool+historical-fallback',
      source:'certified-precomputed-pool',
      poolVersion:Pool?.version||null,
      poolSchema:Pool?.schema||null,
      poolIndex:index,
      poolSize:poolEntries(diff).length,
      fingerprint:fp,
      minimumRequiredTier:profile.minimumRequiredTier,
      totalLogicalSteps:profile.totalLogicalSteps,
      givenCount:candidate.givens.size,
      relationCount:candidate.edges.length,
      diversityIdentity:entry.familyKey||null,
      tracePolicy:trace?.policy||null,
      traceSourceFingerprint:trace?.sourceFingerprint||null,
      fallbackUsed:false
    };
    return candidate
  }
  function precomputedCandidate(diff,forcedIndex=null){
    let entries=poolEntries(diff);if(!entries.length)return null;
    let start=forcedIndex==null?Math.floor(Math.random()*entries.length):((Number(forcedIndex)||0)%entries.length+entries.length)%entries.length;
    for(let offset=0;offset<Math.min(entries.length,8);offset++){
      let index=(start+offset)%entries.length,candidate=candidateFromEntry(diff,entries[index],index);
      if(candidate)return candidate
    }
    return null
  }
  function generateTangoPuzzle(diff,options){return precomputedCandidate(diff,options?.poolIndex) || Base.generateTangoPuzzle(diff,options)}
  function generationIdentity(candidate){
    if(candidate?.generationStats?.diversityIdentity)return candidate.generationStats.diversityIdentity;
    if(typeof Base.generationIdentity==='function')return Base.generationIdentity(candidate);
    let fp=fingerprint(publicPuzzle(candidate));return fp?`tango-public-v1:${fp}`:null
  }
  function poolEntryForCandidate(candidate){
    let stats=candidate?.generationStats,index=stats?.poolIndex,diff=stats?.targetDifficulty;
    if(stats?.source!=='certified-precomputed-pool'||!Number.isInteger(index)||!diff)return null;
    let entries=poolEntries(diff),entry=entries[index];
    if(!entry||entry.difficultyProfile?.fingerprint!==candidate?.difficultyProfile?.fingerprint)return null;
    return entry
  }
  function precomputedTraceForPublicPuzzle(candidate,currentPuzzle){
    let entry=poolEntryForCandidate(candidate),trace=entry?.logicTrace;if(!trace||!currentPuzzle)return null;
    let currentFingerprint=fingerprint(currentPuzzle);
    if(!currentFingerprint||currentFingerprint!==trace.sourceFingerprint||currentFingerprint!==candidate?.difficultyProfile?.fingerprint)return null;
    return copy(trace)
  }
  function precomputedTraceForState(candidate,state){return precomputedTraceForPublicPuzzle(candidate,publicPuzzle(candidate,state))}
  function poolInfo(){return Pool?copy({schema:Pool.schema,version:Pool.version,counts:Pool.counts||Object.fromEntries(Object.keys(Pool.entries||{}).map(diff=>[diff,poolEntries(diff).length])),certification:Pool.certification||null}):null}

  return Object.freeze({...Base,generateTangoPuzzle,tangoCandidate:generateTangoPuzzle,generationIdentity,precomputedCandidate,precomputedTraceForPublicPuzzle,precomputedTraceForState,poolInfo,_poolTest:Object.freeze({candidateFromEntry,poolEntryForCandidate,poolEntries,fingerprint})});
});
