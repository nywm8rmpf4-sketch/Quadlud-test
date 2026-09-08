#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'../..');
const sandbox={console};sandbox.globalThis=sandbox;vm.createContext(sandbox);
for(const file of ['game-contract.js','game-manifest.js','game-registry.js','difficulty-rating.js','tango-logic.js','tango-difficulty.js','generation-common.js','tango-generator.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),sandbox,{filename:file});
}
vm.runInContext('globalThis.__random=tangoRandomStructuralCandidateV223;globalThis.__rate=tangoRateGeneratedV223;globalThis.__transform=tangoTransformTemplateV223',sandbox);

function publicKey(candidate){
  const state=Array.from({length:6},()=>Array(6).fill(-1));
  for(const i of candidate.givens)state[Math.floor(i/6)][i%6]=candidate.sol[Math.floor(i/6)][i%6];
  return JSON.stringify({state,edges:candidate.edges.map(e=>[...e]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2].localeCompare(b[2]))});
}
function familyKey(candidate){
  const source={...candidate,state:Array.from({length:6},()=>Array(6).fill(-1))};
  for(const i of candidate.givens)source.state[Math.floor(i/6)][i%6]=candidate.sol[Math.floor(i/6)][i%6];
  const variants=[];
  for(let k=0;k<8;k++)for(const invert of [false,true])variants.push(publicKey(sandbox.__transform(source,k,invert)));
  return variants.sort()[0];
}
function compactProfile(profile){return JSON.parse(JSON.stringify(profile))}
function entry(candidate,profile){return {sol:candidate.sol.map(r=>[...r]),givens:[...candidate.givens].sort((a,b)=>a-b),edges:candidate.edges.map(e=>[...e]),difficultyProfile:compactProfile(profile)}}

const targets={medium:24,hard:32,expert:32};
const minClues={medium:[8,9,10,11,12,13,14],hard:[6,7,8,9,10,11,12],expert:[6,7,8,9,10,11,12]};
const entries={medium:[],hard:[],expert:[]},families={medium:new Set(),hard:new Set(),expert:new Set()},fingerprints={medium:new Set(),hard:new Set(),expert:new Set()};
const attempts={medium:0,hard:0,expert:0};
for(const diff of Object.keys(targets)){
  for(let i=0;entries[diff].length<targets[diff]&&i<12000;i++){
    attempts[diff]++;
    const clue=minClues[diff][i%minClues[diff].length];
    const candidate=sandbox.QuadludGenerationCommon.withSeed(`tango-diversity-v1:${diff}:${i}`,()=>sandbox.__random(clue));
    if(!candidate)continue;
    const rated=sandbox.__rate(candidate),profile=rated?.profile;
    if(!profile||profile.status!=='solved'||profile.difficulty!==diff||profile.budgetHit)continue;
    const family=familyKey(candidate),fingerprint=profile.fingerprint;
    if(families[diff].has(family)||fingerprints[diff].has(fingerprint))continue;
    families[diff].add(family);fingerprints[diff].add(fingerprint);entries[diff].push(entry(candidate,profile));
    console.error(`${diff}: ${entries[diff].length}/${targets[diff]} (attempt ${i+1})`);
  }
  if(entries[diff].length!==targets[diff])throw new Error(`${diff}: only ${entries[diff].length}/${targets[diff]} entries after ${attempts[diff]} attempts`);
}

const payload={schema:1,version:'tango-diversity-pilot-v1',generatedBy:'qa-public/tools/build_tango_diversity_pool.js',targets,attempts,entries};
process.stdout.write(`/* QUADLUD — generated certified Soleil-Lune diversity pool. */\n(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.QuadludTangoDiversityPool=api})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${JSON.stringify(payload)});});\n`);
