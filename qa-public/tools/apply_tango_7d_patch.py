#!/usr/bin/env python3
from pathlib import Path

p=Path('tango-human-cost-bridge.js')
s=p.read_text(encoding='utf-8')
if s.count('const VERSION=4;') != 1:
    raise SystemExit('human cost version anchor mismatch')
s=s.replace('const VERSION=4;','const VERSION=5;')
old="""function baseHumanProofCost(source,session,d){
  const value=source?._test?.humanProofCost?source._test.humanProofCost(session,d?[d]:[]):[1,0,1,0,0,0];return Array.isArray(value)?value.slice():[1,0,1,0,0,0]
}
function relationAwareHumanProofCost(source,session,d){
  const cost=baseHumanProofCost(source,session,d),support=relationDerivedSupportPenalty(session,d);if(!support)return cost;
  cost[0]=(Number(cost[0])||0)+support;cost[1]=(Number(cost[1])||0)+support;cost[5]=(Number(cost[5])||0)+support;return cost
}"""
new="""function normalizeCostVector(value){
  if(Array.isArray(value)&&value.length>=7)return value.slice(0,7).map(x=>Number(x)||0);
  if(Array.isArray(value)&&value.length===6)return [0,...value.map(x=>Number(x)||0)];
  return [0,1,0,1,0,0,0]
}
function baseHumanProofCost(source,session,d){
  const value=source?._test?.humanProofCost?source._test.humanProofCost(session,d?[d]:[]):null;return normalizeCostVector(value)
}
function relationAwareHumanProofCost(source,session,d){
  const cost=baseHumanProofCost(source,session,d),support=relationDerivedSupportPenalty(session,d);if(!support)return cost;
  // 7D contract: [semantic indirection, human steps, premises, spatial extent,
  // technique level, rank, abstract/derived support penalty]. A derived relation
  // adds human work and support evidence, but does not change its rule family.
  cost[1]+=support;cost[2]+=support;cost[6]+=support;return cost
}"""
if s.count(old) != 1:
    raise SystemExit('base/relation cost anchor mismatch')
s=s.replace(old,new)
old="""function advancedHumanProofCost(source,session,d){
  const base=relationAwareHumanProofCost(source,session,d),groups=advancedTraceGroups(d);
  if(!groups.length)return base;
  const trace=groups.flat().filter(Boolean),traceCost=source?._test?.humanProofCost?source._test.humanProofCost(session,trace):[trace.length,0,1,0,0,0];
  const atomicExtra=trace.reduce((sum,step)=>sum+(ABSTRACT_HUMAN_RULES.has(String(step?.rule||''))?Math.max(0,(step?.conclusions||[]).length-1):0)+relationDerivedSupportPenalty(session,step),0);
  return [
    3+(Number(traceCost?.[0])||0)+atomicExtra,
    Math.max(Number(base?.[1])||0,Number(traceCost?.[1])||0),
    Math.max(Number(base?.[2])||1,Number(traceCost?.[2])||1),
    Math.max(Number(base?.[3])||0,Number(traceCost?.[3])||0),
    Math.max(Number(base?.[4])||0,Number(traceCost?.[4])||0),
    (Number(base?.[5])||0)+(Number(traceCost?.[5])||0)+atomicExtra
  ]
}"""
new="""function advancedHumanProofCost(source,session,d){
  const base=relationAwareHumanProofCost(source,session,d),groups=advancedTraceGroups(d);
  if(!groups.length)return base;
  const trace=groups.flat().filter(Boolean),traceCost=normalizeCostVector(source?._test?.humanProofCost?source._test.humanProofCost(session,trace):null);
  const atomicExtra=trace.reduce((sum,step)=>sum+(ABSTRACT_HUMAN_RULES.has(String(step?.rule||''))?Math.max(0,(step?.conclusions||[]).length-1):0)+relationDerivedSupportPenalty(session,step),0);
  return [
    Math.max(2,base[0],traceCost[0]),
    3+traceCost[1]+atomicExtra,
    Math.max(base[2],traceCost[2]),
    Math.max(base[3],traceCost[3]),
    Math.max(base[4],traceCost[4]),
    Math.max(base[5],traceCost[5]),
    base[6]+traceCost[6]+atomicExtra
  ]
}"""
if s.count(old) != 1:
    raise SystemExit('advanced cost anchor mismatch')
s=s.replace(old,new)
if s.count("if(source.__quadludHumanCostCorrectionV4===true)return true;") != 1:
    raise SystemExit('install guard anchor mismatch')
s=s.replace("if(source.__quadludHumanCostCorrectionV4===true)return true;","if(source.__quadludHumanCostCorrectionV5===true)return true;")
old="_test:Object.freeze({...source._test,advancedTraceGroups,advancedHumanProofCost,derivedPremiseSupportPenalty,relationDerivedSupportPenalty,relationAwareHumanProofCost,proofPreferenceTier,compareProofCandidates,selfContainedDirectCandidates,causalContradictionCandidate,correctedProof,enrichedRelationPath,relationFactForEdge}),__quadludHumanCostCorrection:true,__quadludHumanCostCorrectionV3:true,__quadludHumanCostCorrectionV4:true}"
new="_test:Object.freeze({...source._test,normalizeCostVector,advancedTraceGroups,advancedHumanProofCost,derivedPremiseSupportPenalty,relationDerivedSupportPenalty,relationAwareHumanProofCost,proofPreferenceTier,compareProofCandidates,selfContainedDirectCandidates,causalContradictionCandidate,correctedProof,enrichedRelationPath,relationFactForEdge}),__quadludHumanCostCorrection:true,__quadludHumanCostCorrectionV3:true,__quadludHumanCostCorrectionV4:true,__quadludHumanCostCorrectionV5:true}"
if s.count(old) != 1:
    raise SystemExit('installed test surface anchor mismatch')
s=s.replace(old,new)
old="_test:Object.freeze({advancedTraceGroups,advancedHumanProofCost,derivedPremiseSupportPenalty,relationDerivedSupportPenalty,relationAwareHumanProofCost,proofPreferenceTier,compareProofCandidates,selfContainedDirectCandidates,causalContradictionCandidate,correctedProof,enrichedRelationPath,relationFactForEdge})"
new="_test:Object.freeze({normalizeCostVector,advancedTraceGroups,advancedHumanProofCost,derivedPremiseSupportPenalty,relationDerivedSupportPenalty,relationAwareHumanProofCost,proofPreferenceTier,compareProofCandidates,selfContainedDirectCandidates,causalContradictionCandidate,correctedProof,enrichedRelationPath,relationFactForEdge})"
if s.count(old) != 1:
    raise SystemExit('api test surface anchor mismatch')
p.write_text(s.replace(old,new),encoding='utf-8')

p=Path('tango-played-move-runtime.js')
s=p.read_text(encoding='utf-8')
old="baseCost=chosen?humanProofCost(session,[chosen]):Object.freeze([1,0,1,0,0,0])"
new="baseCost=chosen?humanProofCost(session,[chosen]):Object.freeze([0,1,0,1,0,0,0])"
if s.count(old) != 1:
    raise SystemExit('runtime fallback cost anchor mismatch')
p.write_text(s.replace(old,new),encoding='utf-8')

p=Path('qa-public/tests/v319-r3ui-tango-derived-relation-human-cost.test.js')
s=p.read_text(encoding='utf-8')
replacements={
"if(d?.rule==='TRIPLE_CONSTRAINT')return [1,2,3,1,1,0];":"if(d?.rule==='TRIPLE_CONSTRAINT')return [0,1,2,3,1,1,0];",
"if(d?.rule==='RELATION_PROPAGATION')return [1,2,2,0,0,0];":"if(d?.rule==='RELATION_PROPAGATION')return [0,1,2,2,0,0,0];",
"return [1,1,1,0,0,0]":"return [0,1,1,1,0,0,0]",
"assert.deepStrictEqual(Bridge._test.relationAwareHumanProofCost(source,session,relationProof),[2,3,2,0,0,1]);":"assert.deepStrictEqual(Bridge._test.relationAwareHumanProofCost(source,session,relationProof),[0,2,3,2,0,0,1]);\nassert.strictEqual(Bridge.VERSION,5);\nassert.strictEqual(Bridge._test.relationAwareHumanProofCost(source,session,relationProof).length,7,'human proof cost contract must stay 7D');\nassert.deepStrictEqual(Bridge._test.normalizeCostVector([1,2,3,4,5,6]),[0,1,2,3,4,5,6],'legacy 6D vectors must map deterministically to the 7D contract');",
"assert.deepStrictEqual(corrected.costVector,[1,2,3,1,1,0]);":"assert.deepStrictEqual(corrected.costVector,[0,1,2,3,1,1,0]);"
}
for old,new in replacements.items():
    if s.count(old) != 1:
        raise SystemExit(f'derived test anchor mismatch: {old[:40]}')
    s=s.replace(old,new)
advanced="""
const advancedProof={rule:'ASSUMPTION_CONTRADICTION',signature:'advanced',premises:[],conclusions:[{type:'VALUE',cell:[1,1],value:1}],explanationData:{causalTrace:[tripleProof]}};
const advancedCost=Bridge._test.advancedHumanProofCost(source,session,advancedProof);
assert.strictEqual(advancedCost.length,7,'advanced proof cost must stay on the same 7D contract');
assert.ok(advancedCost[0]>=2,'advanced contradiction must carry semantic indirection');
assert.ok(advancedCost[1]>=4,'advanced contradiction must include hypothesis/contradiction human steps');
"""
marker="\nconst producer={id:'D7'"
if s.count(marker) != 1:
    raise SystemExit('advanced test insertion anchor mismatch')
p.write_text(s.replace(marker,advanced+marker),encoding='utf-8')
