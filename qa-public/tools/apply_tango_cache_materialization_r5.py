#!/usr/bin/env python3
# QUADLUD — exact materialized Tango Tutor cache patch R5
# Copyright © 2026 Serge Benoliel. All rights reserved.
from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing patch anchor in {path}: {old[:120]!r}")
    if s.count(old) != 1:
        raise SystemExit(f"non-unique patch anchor in {path}: {old[:120]!r}")
    p.write_text(s.replace(old, new, 1))


builder = 'qa-public/tools/build_tango_tutor_sync_shard_r8.js'
old_verify = "function verifyRebuild(engine,diff,plan,startSeed,dispSeed){const starting=resolveSeed(engine,diff,startSeed);if(!starting)throw new Error('starting seed cannot be resolved');const tier=Planner.tierIndexForDifficulty(diff),rebuilt=Planner._test.planFromFirstDeduction(engine,tier,starting,{advancedStart:!!plan.advancedStart,initialStateValidated:true});if(rebuilt?.status!=='move')throw new Error(`targeted rebuild returned ${rebuilt?.status||'invalid'}`);if(cellIndex(rebuilt.target)!==cellIndex(plan.target)||rebuilt.value!==plan.value)throw new Error(`targeted rebuild changed move ${JSON.stringify({expected:[cellIndex(plan.target),plan.value],actual:[cellIndex(rebuilt.target),rebuilt.value]})}`);const display=resolveSeed(engine,diff,dispSeed,{display:true});if(!display||!sameJson(display,plan.displayDeduction||plan.displayProof?.deduction||plan.deduction))throw new Error(`materialized display proof cannot be reproduced for ${plan.target?.join(',')}`)}"
new_verify = """function directlyConcludesTarget(deduction,target,value){return !!(deduction?.conclusions||[]).some(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&c.cell[0]===target?.[0]&&c.cell[1]===target?.[1]&&c.value===value)}
const FORBIDDEN_CACHE_KEYS=new Set(['solution','hiddenSolution','solutionGrid','backtrack','backtracking','solverTrace','searchTree']);
function assertNoHiddenState(value,label,path=''){if(value==null||typeof value!=='object')return;if(Array.isArray(value)){value.forEach((child,i)=>assertNoHiddenState(child,label,`${path}[${i}]`));return}for(const [key,child] of Object.entries(value)){if(FORBIDDEN_CACHE_KEYS.has(key))throw new Error(`${label}: forbidden hidden-state field ${path?path+'.':''}${key}`);assertNoHiddenState(child,label,path?`${path}.${key}`:key)}}
function verifyMaterializedPlan(engine,diff,plan,startSeed,dispSeed){
  const starting=resolveSeed(engine,diff,startSeed);if(!starting)throw new Error('starting seed cannot be resolved');
  const canonicalStart=plan?.startingDeduction||plan?.deduction;if(!canonicalStart||!sameJson(starting,canonicalStart))throw new Error('materialized starting deduction cannot be reproduced');
  const display=resolveSeed(engine,diff,dispSeed,{display:true}),canonicalDisplay=plan?.displayDeduction||plan?.displayProof?.deduction||plan?.deduction;
  if(!display||!sameJson(display,canonicalDisplay))throw new Error(`materialized display proof cannot be reproduced for ${plan.target?.join(',')}`);
  if(!Array.isArray(plan?.target)||engine?.state?.[plan.target[0]]?.[plan.target[1]]!==-1)throw new Error('materialized Tutor target is not an empty visible cell');
  if(!directlyConcludesTarget(display,plan.target,plan.value))throw new Error(`materialized display deduction does not conclude ${plan.target?.join(',')}=${plan.value}`);
  assertNoHiddenState(starting,'starting deduction');assertNoHiddenState(display,'display deduction');assertNoHiddenState(plan?.displayProof,'display proof');
}"""
replace_once(builder, old_verify, new_verify)
replace_once(builder, "const start=startingSeed(engine,difficulty,plan),display=displaySeed(engine,difficulty,plan);verifyRebuild(engine,difficulty,plan,start,display);", "const start=startingSeed(engine,difficulty,plan),display=displaySeed(engine,difficulty,plan);verifyMaterializedPlan(engine,difficulty,plan,start,display);")

runtime = 'tango-tutor-precomputed-cache.js'
replace_once(runtime, "const VERSION=4,DATA_SCHEMA=8,DATA_VERSION='tango-tutor-cache-r8-sync3-cognitive',SOURCE_POOL_VERSION='tango-runtime-pool-r8';", "const VERSION=5,DATA_SCHEMA=8,DATA_VERSION='tango-tutor-cache-r8-sync3-cognitive',SOURCE_POOL_VERSION='tango-runtime-pool-r8';")
old_try = "function tryPlan(session,diff){try{if(!session||typeof session.clone!=='function'||!payload){stats.misses++;return null}const hit=lookup(session,diff);if(!hit){stats.misses++;return null}const {fingerprint,step}=hit,advanced=step[1]===1,startKind=step[2],target=cellFromIndex(step[3]),value=step[4],starting=resolveSeed(session,diff,startKind,step[5]);if(!target||!starting){stats.rebuildRejects++;stats.misses++;return null}const P=planner(),tier=P.tierIndexForDifficulty(diff),plan=P._test.planFromFirstDeduction(session,tier,starting,{advancedStart:advanced,initialStateValidated:true});if(plan?.status!=='move'||plan?.target?.[0]!==target[0]||plan?.target?.[1]!==target[1]||plan?.value!==value){stats.rebuildRejects++;stats.misses++;return null}const displayDeduction=resolveSeed(session,diff,step[7],step[8],{display:true}),displayProof=decodeProof(payload.proofMeta[step[9]],displayDeduction,target,value);if(!displayDeduction||!displayProof){stats.rebuildRejects++;stats.misses++;return null}stats.hits++;return {...plan,...decodeSelection(payload.selectionMeta[step[6]]),displayDeduction,displayProof,precomputedTutorCache:true,precomputedTutorFingerprint:fingerprint,precomputedTutorAdvanced:advanced,precomputedTutorContractDigest:String(payload.tutorContract.digest),cognitiveModel:payload.cognitiveModel,cognitivePatternCatalog:payload.cognitivePatternCatalog}}catch(_){stats.rebuildRejects++;stats.misses++;return null}}"
new_try = """function directlyConcludesTarget(deduction,target,value){return !!(deduction?.conclusions||[]).some(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&c.cell[0]===target?.[0]&&c.cell[1]===target?.[1]&&c.value===value)}
  function materializedPlan(session,diff,starting,target,value,advanced,displayDeduction,displayProof,selection,fingerprint){
    if(!Array.isArray(target)||target.length!==2||session?.state?.[target[0]]?.[target[1]]!==-1||!starting||!displayDeduction||!displayProof)return null;
    if(!directlyConcludesTarget(displayDeduction,target,value))return null;
    const P=planner(),tier=P.tierIndexForDifficulty(diff);
    return {status:'move',tierIndex:tier,target:target.slice(),value,deduction:clone(displayDeduction),startingDeduction:clone(starting),proofChain:[clone(displayDeduction)],advancedStart:!!advanced,...selection,displayDeduction:clone(displayDeduction),displayProof:clone(displayProof),precomputedTutorCache:true,precomputedTutorFingerprint:fingerprint,precomputedTutorAdvanced:!!advanced,precomputedTutorContractDigest:String(payload?.tutorContract?.digest||''),cognitiveModel:payload?.cognitiveModel||displayProof?.cognitiveModel||null,cognitivePatternCatalog:payload?.cognitivePatternCatalog||displayProof?.cognitivePatternCatalog||null};
  }
  function tryPlan(session,diff){
    try{
      if(!session||typeof session.clone!=='function'||!payload){stats.misses++;return null}
      const hit=lookup(session,diff);if(!hit){stats.misses++;return null}
      const {fingerprint,step}=hit,advanced=step[1]===1,startKind=step[2],target=cellFromIndex(step[3]),value=step[4],starting=resolveSeed(session,diff,startKind,step[5]);
      if(!target||!starting){stats.rebuildRejects++;stats.misses++;return null}
      const displayDeduction=resolveSeed(session,diff,step[7],step[8],{display:true}),displayProof=decodeProof(payload.proofMeta[step[9]],displayDeduction,target,value),selection=decodeSelection(payload.selectionMeta[step[6]]);
      const plan=materializedPlan(session,diff,starting,target,value,advanced,displayDeduction,displayProof,selection,fingerprint);
      if(!plan){stats.rebuildRejects++;stats.misses++;return null}
      stats.hits++;return plan
    }catch(_){stats.rebuildRejects++;stats.misses++;return null}
  }"""
replace_once(runtime, old_try, new_try)
replace_once(runtime, "decodeProof,resetStats})});", "decodeProof,directlyConcludesTarget,materializedPlan,resetStats})});")

Path('qa-public/tests/v319-r8-cache-materialized-hit.test.js').write_text(r'''#!/usr/bin/env node
/* QUADLUD — exact materialized Tutor cache hit regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const candidate=path.resolve(__dirname,'../GitHub'),repo=path.resolve(__dirname,'../..'),WEB=fs.existsSync(path.join(candidate,'tango-tutor-precomputed-cache.js'))?candidate:repo;
const Cache=require(path.join(WEB,'tango-tutor-precomputed-cache.js'));
const Tutor=require(path.join(WEB,'tango-tutor-single-planner-r5.js'));
const source=fs.readFileSync(path.join(WEB,'tango-tutor-precomputed-cache.js'),'utf8');
assert(!source.includes('planFromFirstDeduction'),'cache-hit runtime must not re-run targeted played-move planning');
const state=Array.from({length:6},()=>Array(6).fill(-1)),session={state};
const starting={rule:'RELATION_PROPAGATION',signature:'RELATION_PROPAGATION|synthetic',conclusions:[{type:'RELATION',a:[0,0],b:[0,1],same:true}]};
const display={rule:'LINE_DOMAIN_SUPPORT',signature:'LINE_DOMAIN_SUPPORT|synthetic',conclusions:[{type:'VALUE',cell:[1,1],value:0}]};
const proof={kind:'engine-proof',deduction:display,cognitiveModel:'quadlud-cognitive-load-v1',cognitivePatternCatalog:'tango-cognitive-patterns-v1'};
const selection={selectionStatus:'synthetic-cache',candidateCount:2,humanCandidateCount:2,humanGlobalSelection:false,frontierComplete:true,budgetHit:false,cognitiveCandidateCount:2,cognitiveGlobalSelection:true,cognitiveCostVector:[1,2,3]};
const plan=Cache._test.materializedPlan(session,'hard',starting,[1,1],0,false,display,proof,selection,'synthetic-fingerprint');
assert(plan&&plan.status==='move');assert.deepStrictEqual(plan.target,[1,1]);assert.strictEqual(plan.value,0);assert.strictEqual(plan.startingDeduction.signature,starting.signature);assert.deepStrictEqual(plan.displayDeduction,display);
assert.strictEqual(Cache._test.materializedPlan(session,'hard',starting,[1,2],0,false,display,proof,selection,'bad'),null,'display proof must visibly conclude cached target/value');
let humanSearch=0,runtimeSearch=0;
const H={_test:{evaluatePlanHumanProof(){humanSearch++;throw new Error('must not run')}}};
const R={selectDisplayProof(){runtimeSearch++;throw new Error('must not run')},_test:{minimalDisplayDeduction(){throw new Error('must not run')}}};
const attached=Tutor._test.attachHumanProof(session,plan,H,R,'precomputed-guarded');
assert(attached&&attached.status==='move');assert.strictEqual(humanSearch,0);assert.strictEqual(runtimeSearch,0);
console.log('v319-r8-cache-materialized-hit.test.js: PASS — cached plan/proof used directly; no targeted planner or proof search');
''')

parity = 'qa-public/tests/v319-r8-cognitive-cache-live-parity.test.js'
p = Path(parity)
s = p.read_text()
s = s.replace("const report={schema:1,checkedStates:0,hits:0,lookupMisses:0,rebuildMisses:0,mismatches:0,maxCacheMs:0,maxLiveMs:0,byDifficulty:{},examples:[]};", "const report={schema:2,checkedStates:0,hits:0,lookupMisses:0,validationMisses:0,mismatches:0,maxCacheMs:0,maxLiveMs:0,byDifficulty:{},examples:[]};")
s = s.replace("const stats={puzzles:count,states:0,hits:0,lookupMisses:0,rebuildMisses:0,mismatches:0,maxCacheMs:0,maxLiveMs:0};", "const stats={puzzles:count,states:0,hits:0,lookupMisses:0,validationMisses:0,mismatches:0,maxCacheMs:0,maxLiveMs:0};")
s = s.replace("else{stats.rebuildMisses++;report.rebuildMisses++}", "else{stats.validationMisses++;report.validationMisses++}")
s = s.replace("misses=${stats.lookupMisses+stats.rebuildMisses}", "misses=${stats.lookupMisses+stats.validationMisses}")
s = s.replace("assert.strictEqual(report.rebuildMisses,0,'canonical cognitive cache must have zero rebuild misses');", "assert.strictEqual(report.validationMisses,0,'canonical cognitive cache must have zero materialized-plan validation misses');")
p.write_text(s)
print('apply_tango_cache_materialization_r5.py: PATCHED')
