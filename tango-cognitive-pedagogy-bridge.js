/*
 * QUADLUD — Soleil-Lune cognitive pedagogy bridge
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
'use strict';
const isNode=typeof module==='object'&&module.exports;
const Cognitive=isNode?require('./cognitive-cost.js'):root.QuadludCognitiveCost;
const Patterns=isNode?require('./tango-cognitive-patterns.js'):root.QuadludTangoCognitivePatterns;
const VERSION=1;
const TOKEN='3.1.9-cognitive-chunks-r1';
if(!Cognitive||!Patterns)throw new Error('Soleil-Lune cognitive dependencies unavailable');

const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const deductionKey=d=>String(d?.signature||d?.id||JSON.stringify([d?.rule,d?.conclusions||[]]));
const planKey=p=>`${String(p?.target?.[0]??999).padStart(3,'0')}:${String(p?.target?.[1]??999).padStart(3,'0')}:${Number(p?.value)}|${deductionKey(p?.startingDeduction||p?.deduction)}`;
function planner(){
  const p=root.QuadludTangoPlayedMovePlanner||(isNode?require('./tango-played-move-planner.js'):null);
  if(!p||typeof p.tierIndexForDifficulty!=='function')throw new Error('Soleil-Lune planner unavailable');
  return p;
}
function humanBridge(){return root.QuadludTangoHumanCostBridge||(isNode?require('./tango-human-cost-bridge.js'):null)}
function compare(a,b){return Cognitive.compareCostVector(a||[],b||[])}
function concludesMove(d,target,value){return !!(d?.conclusions||[]).some(c=>c?.type==='VALUE'&&sameCell(c.cell,target)&&Number(c.value)===Number(value))}
function legacyCost(source,session,d,existing=null){
  if(Array.isArray(existing)&&existing.length)return existing.slice();
  const H=humanBridge(),advanced=d?.rule==='ASSUMPTION_CONTRADICTION'||d?.rule==='COMMON_CONSEQUENCE';
  if(advanced&&typeof H?._test?.advancedHumanProofCost==='function')return H._test.advancedHumanProofCost(source,session,d);
  if(typeof H?._test?.relationAwareHumanProofCost==='function')return H._test.relationAwareHumanProofCost(source,session,d);
  if(typeof source?._test?.humanProofCost==='function')return source._test.humanProofCost(session,d?[d]:[]);
  return [0,1,0,1,0,0,0]
}
function cognitiveEvidence(source,session,d,existingLegacy=null){
  const legacy=legacyCost(source,session,d,existingLegacy),profile=Patterns.profileForDeduction(d),vector=Cognitive.costVector(profile,legacy);
  return {legacyCostVector:legacy,cognitiveProfile:profile,cognitiveCostVector:vector}
}
function candidate(source,session,d,{kind='candidate',witness=null,baseProof=null}={}){
  if(!d)return null;const evidence=cognitiveEvidence(source,session,d,baseProof?.legacyCostVector||baseProof?.costVector||null);
  return {kind,deduction:copy(d),witness:copy(witness),...evidence,stableKey:deductionKey(d)}
}
function directCandidates(source,session,target,value){
  if(!session||typeof session.directDeductions!=='function')return [];
  const seen=new Set(),out=[];
  for(const raw of session.directDeductions()||[]){
    if(!raw||!concludesMove(raw,target,value))continue;const key=deductionKey(raw);if(seen.has(key))continue;seen.add(key);
    const d=typeof source?._test?.minimalDisplayDeduction==='function'?source._test.minimalDisplayDeduction(raw):copy(raw),c=candidate(source,session,d,{kind:'direct'});if(c)out.push(c)
  }
  return out
}
function contradictionCandidate(source,session,plan){
  if(Number(plan?.tierIndex)<3)return null;
  const H=humanBridge(),find=H?._test?.causalContradictionCandidate;if(typeof find!=='function')return null;
  try{
    const result=find(source,session,plan.target,plan.value);if(!result?.deduction)return null;
    return candidate(source,session,result.deduction,{kind:'contradiction',witness:result.witness})
  }catch(_){return null}
}
function compareProofCandidates(a,b){return compare(a?.cognitiveCostVector,b?.cognitiveCostVector)||compare(a?.legacyCostVector,b?.legacyCostVector)||String(a?.stableKey||'').localeCompare(String(b?.stableKey||''))}
function selectCognitiveProof(source,session,plan,rawProof){
  const proof=copy(rawProof)||{},currentDeduction=proof.deduction||plan?.deduction;if(!currentDeduction)return proof;
  const current=candidate(source,session,currentDeduction,{kind:'current',witness:proof.witness,baseProof:proof}),candidates=[current,...directCandidates(source,session,plan?.target,plan?.value)];
  const contradiction=contradictionCandidate(source,session,plan);if(contradiction)candidates.push(contradiction);
  const unique=[] ,seen=new Set();for(const c of candidates){if(!c)continue;const key=deductionKey(c.deduction);if(seen.has(key))continue;seen.add(key);unique.push(c)}
  unique.sort(compareProofCandidates);const best=unique[0]||current,replaced=deductionKey(best.deduction)!==deductionKey(current.deduction);
  const next={...proof,
    deduction:copy(best.deduction),displayDeductions:[copy(best.deduction)],
    cognitiveProfile:copy(best.cognitiveProfile),cognitiveCostVector:best.cognitiveCostVector.slice(),legacyCostVector:best.legacyCostVector.slice(),
    costVector:best.cognitiveCostVector.slice(),cognitiveModel:Cognitive.MODEL_ID,cognitivePatternCatalog:Patterns.CATALOG_VERSION
  };
  if(replaced){next.replaced=true;next.replacedRule=String(current.deduction?.rule||'');next.replacedCognitiveCostVector=current.cognitiveCostVector.slice();next.kind=best.kind==='contradiction'?'cognitive-simpler-contradiction-proof':'cognitive-simpler-direct-proof';if(best.witness)next.witness=copy(best.witness)}
  return Object.freeze(next)
}
function scorePlan(source,session,plan,rawSelect){
  const rawProof=rawSelect.call(source,session,plan),proof=selectCognitiveProof(source,session,plan,rawProof),vector=proof?.cognitiveCostVector||proof?.costVector||[999];
  return {plan,displayProof:proof,cognitiveCostVector:Array.from(vector),legacyCostVector:Array.from(proof?.legacyCostVector||[]),stableKey:planKey(plan)}
}
function compareScoredPlans(a,b){return compare(a?.cognitiveCostVector,b?.cognitiveCostVector)||compare(a?.legacyCostVector,b?.legacyCostVector)||String(a?.stableKey||'').localeCompare(String(b?.stableKey||''))}
function selectLowestCognitivePlan(scored){return [...(scored||[])].sort(compareScoredPlans)[0]||null}
function evaluatePlans(session,diff,options={}){
  const P=planner(),T=P._test,tier=P.tierIndexForDifficulty(diff),validated={...options,initialStateValidated:true};
  const direct=T.allowedDirectDeductions(session,tier),directEval=T.evaluateStartingDeductions(session,tier,direct,validated,false);
  if(directEval.plans.length)return {tier,kind:'direct',evaluation:directEval,plans:directEval.plans,frontierComplete:!directEval.truncated&&!directEval.branchBudgetHit};
  if(tier<3)return {tier,kind:'none',evaluation:directEval,plans:[],frontierComplete:!directEval.truncated&&!directEval.branchBudgetHit};
  const advanced=T.advancedDeductionsDetailed(session,tier),advancedEval=T.evaluateStartingDeductions(session,tier,advanced.deductions,validated,true),frontierComplete=!directEval.truncated&&!directEval.branchBudgetHit&&!advanced.budgetHit&&!advancedEval.truncated&&!advancedEval.branchBudgetHit;
  return {tier,kind:'advanced',evaluation:advancedEval,plans:advancedEval.plans,frontierComplete,advancedBudgetHit:!!advanced.budgetHit}
}
function cognitivePlanHumanMove(source,session,diff,rawSelect,rawPlan,options={}){
  if(!session||typeof session.clone!=='function')return rawPlan.call(source,session,diff);
  let evaluated;try{evaluated=evaluatePlans(session,diff,options)}catch(_){return rawPlan.call(source,session,diff)}
  if(!evaluated.plans.length)return rawPlan.call(source,session,diff);
  const scored=evaluated.plans.map(plan=>scorePlan(source,session,plan,rawSelect)),chosen=selectLowestCognitivePlan(scored);if(!chosen)return rawPlan.call(source,session,diff);
  const plan=copy(chosen.plan),proof=copy(chosen.displayProof),displayDeduction=copy(proof?.deduction||plan.deduction);
  return {...plan,displayProof:proof,displayDeduction,
    selectionStatus:evaluated.frontierComplete?'cognitive-human-global-minimum':'cognitive-human-minimum-budget-limited',
    candidateCount:scored.length,frontierComplete:evaluated.frontierComplete,budgetHit:!evaluated.frontierComplete,
    cognitiveGlobalSelection:true,cognitiveCandidateCount:scored.length,cognitiveCostVector:chosen.cognitiveCostVector.slice(),legacyHumanCostVector:chosen.legacyCostVector.slice(),
    cognitiveModel:Cognitive.MODEL_ID,cognitivePatternCatalog:Patterns.CATALOG_VERSION,
    humanSignature:`${plan.target?.join(',')||''}:${plan.value}|${plan.startingDeduction?.signature||plan.deduction?.signature||plan.deduction?.id||''}|${proof?.kind||'engine-proof'}|cognitive`
  }
}
function install(){
  const source=root.QuadludTangoPlayedMoveRuntime;if(!source||typeof source.selectDisplayProof!=='function'||typeof source.planHumanMove!=='function')return false;
  if(source.__quadludCognitivePedagogyR1===true)return true;
  const rawSelect=source.selectDisplayProof,rawPlan=source.planHumanMove;
  const replacement={...source,
    selectDisplayProof(session,plan){return selectCognitiveProof(source,session,plan,rawSelect.call(source,session,plan))},
    planHumanMove(session,diff){return cognitivePlanHumanMove(source,session,diff,rawSelect,rawPlan)},
    _test:Object.freeze({...source._test,cognitiveEvidence,directCognitiveCandidates:directCandidates,selectCognitiveProof,scoreCognitivePlan:scorePlan,compareCognitiveProofCandidates:compareProofCandidates,compareCognitiveScoredPlans:compareScoredPlans,selectLowestCognitivePlan,evaluateCognitivePlans}),
    __quadludCognitivePedagogyR1:true,cognitiveModel:Cognitive.MODEL_ID,cognitivePatternCatalog:Patterns.CATALOG_VERSION
  };
  root.QuadludTangoPlayedMoveRuntime=Object.freeze(replacement);return true
}
const api=Object.freeze({VERSION,TOKEN,install,_test:Object.freeze({deductionKey,planKey,legacyCost,cognitiveEvidence,candidate,directCandidates,contradictionCandidate,compareProofCandidates,selectCognitiveProof,scorePlan,compareScoredPlans,selectLowestCognitivePlan,evaluatePlans,cognitivePlanHumanMove})});
root.QuadludTangoCognitivePedagogyBridge=api;
if(typeof document!=='undefined')install();
if(isNode)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
