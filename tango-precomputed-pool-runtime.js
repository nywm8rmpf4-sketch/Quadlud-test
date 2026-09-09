/*
 * QUADLUD — Soleil/Lune precomputed puzzle pool runtime
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  'use strict';
  const api=factory(root,(typeof module!=='undefined'&&module.exports)?require('./difficulty-rating.js'):root.DifficultyRating);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoPrecomputedPoolRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,DR){
'use strict';
if(!DR)throw new Error('Soleil-Lune precomputed pool requires DifficultyRating');
const VERSION=4,SCHEMA=2,POOL_VERSION='tango-runtime-pool-v1',EXACT_DATA_SCHEMA=2,EXACT_DATA_VERSION='tango-runtime-pool-r8';
const DIFF={easy:'easy',facile:'easy',medium:'medium',moyen:'medium',hard:'hard',difficile:'hard',expert:'expert'};
const TIER={easy:0,medium:1,hard:2,expert:3};
const FINGERPRINT=/^qfp1-[0-9a-f]{32}$/;
const shards=new Map(),bags=new Map(),lastPicked=new Map();
const stats={puzzleHits:0,puzzleMisses:0,shardRejects:0,dataRejects:0,exactHits:0,legacyHits:0};
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const normalizeDiff=d=>DIFF[String(d||'').trim().toLowerCase()]||null;
function exactData(){
  if(root?.QuadludTangoRuntimePoolData)return root.QuadludTangoRuntimePoolData;
  if(typeof module!=='undefined'&&module.exports){try{return require('./tango-runtime-pool-data.js')}catch(_){return null}}
  return null
}
function validSolutionGrid(grid){return Array.isArray(grid)&&grid.length===6&&grid.every(row=>Array.isArray(row)&&row.length===6&&row.every(v=>v===0||v===1))}
function decodeSolution(bits){if(typeof bits!=='string'||bits.length!==36||/[^01]/.test(bits))return null;return Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>Number(bits[r*6+c])))}
function validEdge(e){if(!Array.isArray(e)||e.length!==4)return false;const [r,c,d,rel]=e;if(!Number.isInteger(r)||!Number.isInteger(c)||!['r','d'].includes(d)||!['=','×'].includes(rel))return false;if(r<0||r>=6||c<0||c>=6)return false;return d==='r'?c<5:r<5}
function validGivenList(givens){return Array.isArray(givens)&&givens.length===new Set(givens).size&&givens.every(i=>Number.isInteger(i)&&i>=0&&i<36)}
function validateEntry(entry){
  if(!Array.isArray(entry)||entry.length<4)return false;
  const [solution,givens,edges,fingerprint]=entry;
  return !!decodeSolution(solution)&&validGivenList(givens)&&Array.isArray(edges)&&edges.every(validEdge)&&FINGERPRINT.test(String(fingerprint||''))
}
function validateExactEntry(entry){return !!entry&&typeof entry==='object'&&typeof entry.id==='string'&&validSolutionGrid(entry.solution)&&validGivenList(entry.givens)&&Array.isArray(entry.edges)&&entry.edges.every(validEdge)&&FINGERPRINT.test(String(entry.fingerprint||''))}
function validateExactData(data){
  if(!data||Number(data.schema)!==EXACT_DATA_SCHEMA||String(data.version)!==EXACT_DATA_VERSION||!data.pools||typeof data.pools!=='object')return false;
  for(const d of ['easy','medium','hard','expert'])if(Number(data.counts?.[d])<120||!Array.isArray(data.pools[d])||data.pools[d].length<120||!data.pools[d].every(validateExactEntry))return false;
  return true
}
function profileFromFingerprint(diff,fingerprint){
  const d=normalizeDiff(diff),tier=typeof DR.tierIndex==='function'?DR.tierIndex(d):TIER[d];
  if(!d||!Number.isInteger(tier)||!FINGERPRINT.test(String(fingerprint||'')))return null;
  return {schema:DR.SCHEMA_VERSION??1,ratingVersion:DR.RATING_VERSION??1,game:'tango',status:'solved',difficulty:d,minimumRequiredTier:tier,budgetHit:false,fingerprint:String(fingerprint)}
}
function registerShard(shard){
  const difficulty=normalizeDiff(shard?.difficulty);
  if(!shard||Number(shard.schema)!==SCHEMA||String(shard.version)!==POOL_VERSION||!difficulty||!Array.isArray(shard.entries)||shard.entries.length<120||!shard.entries.every(validateEntry)){
    stats.shardRejects++;throw new Error('Invalid Soleil-Lune runtime pool shard')
  }
  shards.set(difficulty,Object.freeze({schema:SCHEMA,version:POOL_VERSION,difficulty,entries:shard.entries}));bags.delete(`legacy:${difficulty}`);lastPicked.delete(`legacy:${difficulty}`);return {difficulty,count:shard.entries.length}
}
function unregisterShard(diff){const d=normalizeDiff(diff);bags.delete(`legacy:${d}`);lastPicked.delete(`legacy:${d}`);return shards.delete(d)}
function exactPool(diff){const d=normalizeDiff(diff),data=exactData();if(!d||!validateExactData(data))return null;return data.pools[d]}
function hasShard(diff){const d=normalizeDiff(diff),exact=exactPool(d),s=shards.get(d);return !!(exact&&exact.length>=120)||!!(s&&s.entries.length>=120)}
function refillBag(key,size,rng){const a=Array.from({length:size},(_,i)=>i),random=typeof rng==='function'?rng:Math.random;for(let i=a.length-1;i>0;i--){const n=Number(random()),j=Math.max(0,Math.min(i,Math.floor((Number.isFinite(n)?n:0)*(i+1))));[a[i],a[j]]=[a[j],a[i]]}const last=lastPicked.get(key);if(a.length>1&&a[a.length-1]===last)[a[0],a[a.length-1]]=[a[a.length-1],a[0]];bags.set(key,a);return a}
function generationStats(diff,fingerprint,poolSize,id,version){return {generatorVersion:DR.GENERATOR_VERSION??1,targetDifficulty:diff,strategy:'certified-precomputed-pool',attempts:0,randomAttempts:0,templateAttempts:0,rejected:{structure:0,uniqueness:0,ratingMismatch:0,budgetExhausted:0,invalid:0},fallbackUsed:false,fingerprint,poolVersion:version,poolEntryId:id,poolFingerprint:fingerprint,poolSize}}
function puzzleFromEntry(entry,diff,poolSize,index){const [solution,givenList,edges,fingerprint]=entry,sol=decodeSolution(solution),difficultyProfile=profileFromFingerprint(diff,fingerprint);if(!sol||!difficultyProfile)return null;return {sol,givens:new Set(givenList),edges:copy(edges),difficultyProfile,generationStats:generationStats(diff,fingerprint,poolSize,`${diff}-${index}`,POOL_VERSION)}}
function puzzleFromExactEntry(entry,diff,poolSize,index){if(!validateExactEntry(entry))return null;const difficultyProfile=profileFromFingerprint(diff,entry.fingerprint);if(!difficultyProfile)return null;return {sol:copy(entry.solution),givens:new Set(entry.givens),edges:copy(entry.edges),difficultyProfile,generationStats:generationStats(diff,entry.fingerprint,poolSize,entry.id||`${diff}-${index}`,EXACT_DATA_VERSION)}}
function takeFrom(source,key,diff,rng,convert){let bag=bags.get(key);if(!bag||!bag.length||bag.some(i=>i<0||i>=source.length))bag=refillBag(key,source.length,rng);const index=bag.pop(),candidate=convert(source[index],diff,source.length,index);if(!candidate)return null;lastPicked.set(key,index);return candidate}
function takePuzzle(diff,rng=Math.random){
  const d=normalizeDiff(diff);if(!d){stats.puzzleMisses++;return null}
  const data=exactData();if(data&&!validateExactData(data)){stats.dataRejects++;stats.puzzleMisses++;return null}
  const exact=data?.pools?.[d];if(Array.isArray(exact)&&exact.length>=120){const candidate=takeFrom(exact,`exact:${d}`,d,rng,puzzleFromExactEntry);if(candidate){stats.puzzleHits++;stats.exactHits++;return candidate}}
  const shard=shards.get(d);if(shard?.entries?.length>=120){const candidate=takeFrom(shard.entries,`legacy:${d}`,d,rng,puzzleFromEntry);if(candidate){stats.puzzleHits++;stats.legacyHits++;return candidate}}
  stats.puzzleMisses++;return null
}
function info(){const data=exactData(),exactValid=validateExactData(data);return Object.freeze({version:VERSION,schema:SCHEMA,poolVersion:POOL_VERSION,exactDataVersion:exactValid?data.version:null,exactRegistered:exactValid?Object.fromEntries(['easy','medium','hard','expert'].map(d=>[d,data.pools[d].length])):{},legacyRegistered:Object.fromEntries([...shards].map(([d,s])=>[d,s.entries.length])),stats:{...stats}})}
function resetForTests(){shards.clear();bags.clear();lastPicked.clear();for(const k of Object.keys(stats))stats[k]=0}
return Object.freeze({VERSION,SCHEMA,POOL_VERSION,EXACT_DATA_SCHEMA,EXACT_DATA_VERSION,normalizeDiff,registerShard,unregisterShard,hasShard,takePuzzle,info,stats,_test:Object.freeze({exactData,validSolutionGrid,decodeSolution,validEdge,validGivenList,validateEntry,validateExactEntry,validateExactData,profileFromFingerprint,refillBag,puzzleFromEntry,puzzleFromExactEntry,resetForTests})});
});
