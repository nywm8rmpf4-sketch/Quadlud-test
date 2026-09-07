/*
 * QUADLUD — Soleil/Lune pilot for human-oriented next-move selection
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
(function(root){
'use strict';

const VERSION=10;
const Planner=root.QuadludTangoPlayedMovePlanner;
const Policy=root.QuadludPedagogyNextMovePolicy;
if(!Planner||!Planner._test||typeof Planner.nextPlayedMove!=='function'||!Policy||typeof Policy.rank!=='function')return;
const originalNextPlayedMove=Planner.nextPlayedMove.bind(Planner);
const DIFF_TO_TIER=Object.freeze({easy:0,medium:1,hard:2,expert:3,facile:0,moyen:1,difficile:2});
const NON_SIMPLE_CONTINUATION_RULES=new Set(['ASSUMPTION_CONTRADICTION','COMMON_CONSEQUENCE','LINE_DOMAIN_SUPPORT']);
const LOCAL_AXIS_RADIUS=2;
const RECENT_ACTION_GROUPS=2;

function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function stateKey(state){return JSON.stringify(state||null)}
function cellKey(cell){return Array.isArray(cell)&&cell.length>=2?`${Number(cell[0])}:${Number(cell[1])}`:''}
function sameCell(a,b){return !!a&&!!b&&cellKey(a)===cellKey(b)}
function changedVisibleCells(before,after){
  const out=[];if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length)return out;
  for(let r=0;r<before.length;r++)for(let c=0;c<(before[r]?.length||0);c++)if(before[r]?.[c]!==after[r]?.[c]&&(after[r]?.[c]===0||after[r]?.[c]===1))out.push([r,c]);
  return out
}
function walkthrough(){let s=null;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}return s}
function currentMoveGroup(session){
  const moves=Array.isArray(session?.moves)?session.moves:[];if(!moves.length)return [];
  const last=moves[moves.length-1],beforeKey=stateKey(last?.beforeSnapshot?.state);const out=[];
  for(let i=moves.length-1;i>=0;i--){const move=moves[i];if(beforeKey&&stateKey(move?.beforeSnapshot?.state)!==beforeKey)break;out.unshift(move)}
  return out.length?out:[last]
}
function recentPlayedTargets(session,maxGroups=RECENT_ACTION_GROUPS){
  const moves=Array.isArray(session?.moves)?session.moves:[],out=[];
  for(let i=moves.length-1;i>=0&&out.length<maxGroups;i--){const move=moves[i],kind=String(move?.pedagogyStageKind||move?.proofStage?.kind||'');if(kind!=='action')continue;addCell(out,move?.target)}
  if(out.length<maxGroups){const seen=new Set();for(let i=moves.length-1;i>=0&&out.length<maxGroups;i--){const move=moves[i],key=stateKey(move?.beforeSnapshot?.state)||`move:${i}`;if(seen.has(key))continue;seen.add(key);addCell(out,move?.target)}}
  return Policy._test.uniqCells(out).slice(0,maxGroups)
}
function tierIndex(diff){if(Number.isInteger(diff)&&diff>=0&&diff<=3)return diff;return DIFF_TO_TIER[String(diff||'').trim().toLowerCase()]}
function addCell(out,cell){if(Array.isArray(cell)&&cell.length>=2&&Number.isInteger(Number(cell[0]))&&Number.isInteger(Number(cell[1])))out.push([Number(cell[0]),Number(cell[1])])}
function collectCells(value,out,depth=0){
  if(value==null||depth>6)return;if(Array.isArray(value)){if(value.length>=2&&Number.isInteger(Number(value[0]))&&Number.isInteger(Number(value[1]))){addCell(out,value);return}for(const child of value)collectCells(child,out,depth+1);return}if(typeof value!=='object')return;
  for(const key of ['cell','a','b','target','source'])addCell(out,value[key]);for(const key of ['cells','focusCells','window','pair','targets'])if(Array.isArray(value[key]))for(const child of value[key])collectCells(child,out,depth+1)
}
function addConclusion(out,c){if(c?.type==='VALUE'&&Array.isArray(c?.cell)&&(Number(c.value)===0||Number(c.value)===1))out.push({cell:[Number(c.cell[0]),Number(c.cell[1])],value:Number(c.value)})}
function moveValueConclusions(move){
  const out=[];
  for(const c of move?.deduction?.conclusions||[])addConclusion(out,c);
  for(const c of move?.presentation?.action?.conclusions||[])addConclusion(out,c);
  for(const c of move?.presentation?.evidence?.primary?.conclusions||[])addConclusion(out,c);
  for(const c of move?.presentation?.evidence?.final?.conclusions||[])addConclusion(out,c);
  return typeof Policy._test?.uniqConclusions==='function'?Policy._test.uniqConclusions(out):out
}
function pendingConclusionsForGroup(session,group){
  const state=session?.work?.state;if(!Array.isArray(state))return [];
  const all=[];for(const move of group||[])all.push(...moveValueConclusions(move));
  const unique=typeof Policy._test?.uniqConclusions==='function'?Policy._test.uniqConclusions(all):all;
  return unique.filter(c=>{const v=state?.[c.cell[0]]?.[c.cell[1]];return v!==0&&v!==1})
}
function tutorRecentContext(){
  const s=walkthrough();if(!s||s.base?.game!=='tango'||!Array.isArray(s.work?.state))return {recentCells:[],demonstratedCells:[],moveCells:[],recentActionCells:[],pendingConclusions:[]};
  const current=s.work.state,currentKey=stateKey(current),moves=Array.isArray(s.moves)?s.moves:[];let previous=null;
  for(let i=moves.length-1;i>=0;i--){const candidate=moves[i]?.snapshot?.state;if(Array.isArray(candidate)&&stateKey(candidate)!==currentKey){previous=candidate;break}}
  if(!previous&&Array.isArray(s.initial?.state))previous=s.initial.state;
  const changed=changedVisibleCells(previous,current),moveCells=[];if(changed.length)moveCells.push(...changed);else for(let i=moves.length-1;i>=0&&moveCells.length<4;i--)addCell(moveCells,moves[i]?.target);
  const group=currentMoveGroup(s),demonstrated=[];for(const move of group){addCell(demonstrated,move?.target);collectCells(move?.presentation,demonstrated);collectCells(move?.deduction,demonstrated)}
  const demonstratedCells=Policy._test.uniqCells([...demonstrated,...moveCells]),recentActionCells=recentPlayedTargets(s),pendingConclusions=pendingConclusionsForGroup(s,group);
  return {recentCells:demonstratedCells,demonstratedCells,moveCells:Policy._test.uniqCells(moveCells),recentActionCells,pendingConclusions}
}
function tutorRecentCells(){return tutorRecentContext().recentCells}
function dominantAxis(cells){
  const normalized=Policy._test.uniqCells(cells||[]);if(normalized.length<2)return null;
  const rows=new Set(normalized.map(c=>Number(c[0]))),columns=new Set(normalized.map(c=>Number(c[1])));
  if(rows.size===1)return {family:'row',id:Number(normalized[0][0])};
  if(columns.size===1)return {family:'column',id:Number(normalized[0][1])};
  return null
}
function expandContextAlongAxis(context,state,radius=LOCAL_AXIS_RADIUS){
  const recent=Policy._test.uniqCells(context?.recentCells||[]),axis=dominantAxis(recent),rows=Array.isArray(state)?state.length:0;
  if(!axis||!rows)return {...context,recentCells:recent,localAxis:null,localExpansionApplied:false};
  const expanded=[...recent];
  for(const cell of recent)for(let delta=-radius;delta<=radius;delta++){
    const r=axis.family==='row'?axis.id:Number(cell[0])+delta,c=axis.family==='row'?Number(cell[1])+delta:axis.id;
    if(r>=0&&r<rows&&c>=0&&c<(state?.[r]?.length||0))expanded.push([r,c]);
  }
  const unique=Policy._test.uniqCells(expanded);
  return {...context,recentCells:unique,localAxis:axis,localExpansionApplied:unique.length>recent.length,localAttentionRadius:radius}
}
function planCells(plan){
  const premises=[],focus=[];for(const deduction of plan?.proofChain||[]){for(const p of deduction?.premises||[])collectCells(p,premises);for(const c of deduction?.focusCells||[])addCell(focus,c)}
  if(plan?.deduction){for(const p of plan.deduction.premises||[])collectCells(p,premises);for(const c of plan.deduction.focusCells||[])addCell(focus,c)}
  return {premiseCells:Policy._test.uniqCells(premises),focusCells:Policy._test.uniqCells(focus)}
}
function pendingConclusionMatch(candidate,pendingConclusions){
  if(!Array.isArray(candidate?.target)||(Number(candidate?.value)!==0&&Number(candidate?.value)!==1))return false;
  return (pendingConclusions||[]).some(c=>Array.isArray(c?.cell)&&Number(c.cell[0])===Number(candidate.target[0])&&Number(c.cell[1])===Number(candidate.target[1])&&Number(c.value)===Number(candidate.value))
}
function simpleDirectContinuationCandidate(candidate,contextCells){
  const base=(candidate?.baseCost||[]).map(x=>Math.max(0,Number(x)||0)),plan=candidate?.payload||candidate?.plan||null,rule=String(plan?.deduction?.rule||'');
  if(base[0]!==0||base[1]!==1||base[2]!==1)return false;
  if(NON_SIMPLE_CONTINUATION_RULES.has(rule))return false;
  const metrics=Policy.contextualMetrics(candidate,{recentCells:contextCells});
  return metrics.reusedPremiseCount>0&&metrics.novelPremiseCount===0
}
function localDependencyContinuationCandidate(candidate,context,localContext){
  const base=(candidate?.baseCost||[]).map(x=>Math.max(0,Number(x)||0)),plan=candidate?.payload||candidate?.plan||null,rule=String(plan?.deduction?.rule||'');
  if(base[0]!==0||base[1]!==1||base[2]!==1||rule!=='RELATION_PROPAGATION')return false;
  if(!Array.isArray(candidate?.target))return false;
  const localKeys=new Set(Policy._test.uniqCells(localContext?.recentCells||[]).map(cellKey));if(!localKeys.has(cellKey(candidate.target)))return false;
  const knownKeys=new Set(Policy._test.uniqCells([...(context?.recentCells||[]),...(context?.recentActionCells||[])]).map(cellKey));
  const realPremises=Policy._test.uniqCells(candidate?.premiseCells||[]).filter(cell=>!sameCell(cell,candidate.target));
  return realPremises.length>0&&realPremises.every(cell=>knownKeys.has(cellKey(cell)))
}
function directlyPlacesVisibleValue(session,deduction){
  const state=session?.state;if(!Array.isArray(state))return false;
  return !!(deduction?.conclusions||[]).some(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&c.cell.length===2&&state?.[Number(c.cell[0])]?.[Number(c.cell[1])]===-1&&(Number(c.value)===0||Number(c.value)===1))
}
function directVisiblePlacements(session,deduction){
  const state=session?.state;if(!Array.isArray(state))return [];
  const changes=[];
  for(const conclusion of deduction?.conclusions||[]){
    if(conclusion?.type!=='VALUE'||!Array.isArray(conclusion.cell)||conclusion.cell.length!==2)continue;
    const r=Number(conclusion.cell[0]),c=Number(conclusion.cell[1]),value=Number(conclusion.value);
    if(!Number.isInteger(r)||!Number.isInteger(c)||(value!==0&&value!==1)||state?.[r]?.[c]!==-1)continue;
    if(!changes.some(change=>change.cell[0]===r&&change.cell[1]===c&&change.to===value))changes.push({cell:[r,c],from:-1,to:value});
  }
  changes.sort((a,b)=>a.cell[0]-b.cell[0]||a.cell[1]-b.cell[1]||a.to-b.to);
  if(!changes.length)return [];
  const proof=copy(deduction),relationPathLength=typeof Planner._test.relationPathLengthForDeduction==='function'?Planner._test.relationPathLengthForDeduction(session,deduction):0;
  return changes.map(change=>({target:change.cell.slice(),value:change.to,deduction:copy(proof),proofChain:[copy(proof)],humanRelationPathLength:relationPathLength,engineVisiblePlacementCount:changes.length,engineVisiblePlacements:copy(changes)}))
}
function candidateLimitFor(session,options){return Number.isInteger(options?.maxCandidatePlans)&&options.maxCandidatePlans>0?options.maxCandidatePlans:Math.max(24,Number(session?.n||6)*Number(session?.n||6)*2)}
function deferEngineMetadata(plan,session,tier,deduction,options){
  if(!plan||plan.status!=='move')return plan;
  let cached=null;
  const cheapCount=Number(plan.engineVisiblePlacementCount)||0,cheapPlacements=copy(plan.engineVisiblePlacements||[]);
  function hydrate(){
    if(cached)return cached;
    const full=Planner._test.planFromFirstDeduction(session,tier,copy(deduction),{...options,advancedStart:false});
    if(full?.status!=='move'||!sameCell(full.target,plan.target)||Number(full.value)!==Number(plan.value)||JSON.stringify(Planner._test.planCostVector(full))!==JSON.stringify(Planner._test.planCostVector(plan))){
      cached={count:cheapCount,placements:cheapPlacements};return cached
    }
    cached={count:Number(full.engineVisiblePlacementCount)||0,placements:copy(full.engineVisiblePlacements||[])};return cached
  }
  Object.defineProperties(plan,{
    engineVisiblePlacementCount:{enumerable:true,configurable:true,get(){return hydrate().count}},
    engineVisiblePlacements:{enumerable:true,configurable:true,get(){return copy(hydrate().placements)}}
  });
  Object.defineProperty(plan,'__attentionFastDirect',{value:true,enumerable:false,configurable:false});
  return plan
}
function fastDirectPlan(session,tier,deduction,options={}){
  if(!directlyPlacesVisibleValue(session,deduction)||typeof Planner._test.selectPlans!=='function'||typeof Planner._test.planFromFirstDeduction!=='function')return null;
  const placements=directVisiblePlacements(session,deduction);if(!placements.length)return null;
  const branchPlans=placements.map(placement=>deferEngineMetadata({status:'move',tierIndex:tier,...placement,engineStepCount:1,advancedStart:false,startingDeduction:copy(deduction)},session,tier,deduction,options));
  const selected=Planner._test.selectPlans(branchPlans,{frontierComplete:true});return selected.plan||branchPlans[0]||null
}
function evaluateDirectStartingDeductions(session,tier,deductions,options){
  if(typeof Planner._test.planFromFirstDeduction!=='function')return Planner._test.evaluateStartingDeductions(session,tier,deductions,options,false);
  const limit=candidateLimitFor(session,options),chosen=(deductions||[]).slice(0,limit),plans=[];let branchBudgetHit=false;
  for(const deduction of chosen){
    const fast=fastDirectPlan(session,tier,deduction,options),plan=fast||Planner._test.planFromFirstDeduction(session,tier,deduction,{...options,advancedStart:false});
    if(plan?.status==='move')plans.push(plan);else if(plan?.status==='budget-exhausted')branchBudgetHit=true
  }
  return {plans,truncated:(deductions||[]).length>chosen.length,branchBudgetHit,evaluated:chosen.length,total:(deductions||[]).length}
}
function directFrontierCandidates(session,tier,options){
  const direct=Planner._test.allowedDirectDeductions(session,tier),evaluation=evaluateDirectStartingDeductions(session,tier,direct,options);if(!evaluation.plans.length)return {evaluation,frontier:[],policyCandidates:[]};
  const selectorCandidates=Planner._test.buildSelectorCandidates(evaluation.plans),activeIds=new Set(selectorCandidates.map(c=>c.id)),blocked=new Set(selectorCandidates.filter(c=>(c.blockedBy||[]).some(id=>activeIds.has(id))).map(c=>c.id));
  const frontier=selectorCandidates.filter(c=>!blocked.has(c.id));
  const policyCandidates=frontier.map(c=>{const cells=planCells(c.plan);return {id:c.id,stableKey:c.stableKey,baseCost:Planner._test.planCostVector(c.plan),target:c.plan.target,value:c.plan.value,premiseCells:cells.premiseCells,focusCells:cells.focusCells,payload:c.plan}});
  return {evaluation,frontier,policyCandidates}
}
function baselineDirectPlan(frontierData){
  const evaluation=frontierData?.evaluation;if(!evaluation?.plans?.length||typeof Planner._test.selectPlans!=='function')return null;
  const frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit,selected=Planner._test.selectPlans(evaluation.plans,{frontierComplete});
  if(!selected?.plan||!selected?.selection?.selected)return null;
  return {...copy(selected.plan),selectionStatus:selected.selection.status,selectedCostVector:copy(selected.selection.selected.costVector),candidateCount:selected.candidates.length,frontierComplete,budgetHit:!frontierComplete}
}
function baselineContinuationPlan(session,diff,options,frontierData){
  const direct=baselineDirectPlan(frontierData);if(direct)return direct;
  const evaluation=frontierData?.evaluation,tier=tierIndex(diff);
  if(!evaluation||!Number.isInteger(tier)||typeof Planner._test.advancedDeductionsDetailed!=='function'||typeof Planner._test.evaluateStartingDeductions!=='function'||typeof Planner._test.selectPlans!=='function')return null;
  let frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit,advancedBudgetHit=false;
  if(tier>=3){
    const advanced=Planner._test.advancedDeductionsDetailed(session,tier)||{deductions:[],budgetHit:false};advancedBudgetHit=!!advanced.budgetHit;
    const advancedEval=Planner._test.evaluateStartingDeductions(session,tier,advanced.deductions||[],options,true);
    frontierComplete=frontierComplete&&!advancedBudgetHit&&!advancedEval.truncated&&!advancedEval.branchBudgetHit;
    if(advancedEval.plans.length){const selected=Planner._test.selectPlans(advancedEval.plans,{frontierComplete});if(selected?.plan&&selected?.selection?.selected)return {...copy(selected.plan),selectionStatus:selected.selection.status,selectedCostVector:copy(selected.selection.selected.costVector),candidateCount:selected.candidates.length,frontierComplete,budgetHit:!frontierComplete}}
  }
  const budgetHit=!frontierComplete||advancedBudgetHit;return {status:budgetHit?'budget-exhausted':'blocked',budgetHit,tierIndex:tier,proofChain:[]}
}
function contextualDirectPlan(session,diff,options,context,frontierData=null){
  const contextCells=context?.recentCells||[],pending=context?.pendingConclusions||[],tier=tierIndex(diff);if(!Number.isInteger(tier)||(!contextCells.length&&!pending.length))return null;
  const {evaluation,frontier,policyCandidates}=frontierData||directFrontierCandidates(session,tier,options);if(!frontier.length)return null;
  const eligible=policyCandidates.filter(c=>pendingConclusionMatch(c,pending)||simpleDirectContinuationCandidate(c,contextCells));if(!eligible.length)return null;
  const ranked=Policy.rank(eligible,{recentCells:contextCells,pendingConclusions:pending}),selected=ranked.selected;if(!selected?.payload)return null;
  const frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit;
  return {...copy(selected.payload),selectionStatus:frontierComplete?'PROVEN_MINIMUM_PEDAGOGICAL_CONTINUATION':'BEST_AVAILABLE_PEDAGOGICAL_CONTINUATION_BUDGET_LIMITED',selectedCostVector:selected.costVector.slice(),candidateCount:frontier.length,causalContinuationCandidateCount:eligible.length,frontierComplete,budgetHit:!frontierComplete,humanNextMovePolicy:ranked.costModel,humanNextMoveMetrics:copy(selected.metrics),humanRecentCells:copy(contextCells),humanPendingConclusions:copy(pending),simpleCausalContinuation:!selected.metrics.pendingConclusionMatch,pendingConclusionContinuation:!!selected.metrics.pendingConclusionMatch}
}
function contextualDependencyPlan(session,diff,options,context,localContext){
  const tier=tierIndex(diff);if(!Number.isInteger(tier)||!localContext?.localExpansionApplied)return null;
  const {evaluation,frontier,policyCandidates}=directFrontierCandidates(session,tier,options);if(!frontier.length)return null;
  const eligible=policyCandidates.filter(c=>localDependencyContinuationCandidate(c,context,localContext));if(!eligible.length)return null;
  const dependencyCells=Policy._test.uniqCells([...(localContext.recentCells||[]),...(context?.recentActionCells||[])]),ranked=Policy.rank(eligible,{recentCells:dependencyCells,pendingConclusions:context?.pendingConclusions||[]}),selected=ranked.selected;if(!selected?.payload)return null;
  const frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit;
  return {...copy(selected.payload),selectionStatus:frontierComplete?'PROVEN_MINIMUM_RECENT_DEPENDENCY_CONTINUATION':'BEST_AVAILABLE_RECENT_DEPENDENCY_CONTINUATION_BUDGET_LIMITED',selectedCostVector:selected.costVector.slice(),candidateCount:frontier.length,causalContinuationCandidateCount:eligible.length,frontierComplete,budgetHit:!frontierComplete,humanNextMovePolicy:ranked.costModel,humanNextMoveMetrics:copy(selected.metrics),humanRecentCells:copy(dependencyCells),humanPendingConclusions:copy(context?.pendingConclusions||[]),localAttentionContinuation:true,recentDependencyContinuation:true,localAttentionAxis:copy(localContext.localAxis),localAttentionRadius:LOCAL_AXIS_RADIUS,recentActionCells:copy(context?.recentActionCells||[])}
}
function nextPlayedMove(session,diff,options={}){
  const context=tutorRecentContext();if(!context.recentCells.length&&!context.pendingConclusions.length)return originalNextPlayedMove(session,diff,options);
  try{
    const tier=tierIndex(diff),frontierData=Number.isInteger(tier)?directFrontierCandidates(session,tier,options):null;
    const exact=contextualDirectPlan(session,diff,options,context,frontierData);if(exact)return exact;
    const local=expandContextAlongAxis(context,session?.state,LOCAL_AXIS_RADIUS);
    if(local.localExpansionApplied){
      const contextual=contextualDirectPlan(session,diff,options,local,frontierData);
      if(contextual)return {...contextual,localAttentionContinuation:true,localAttentionAxis:copy(local.localAxis),localAttentionRadius:LOCAL_AXIS_RADIUS,humanRecentCellsOriginal:copy(context.recentCells)}
    }
    const baseline=baselineContinuationPlan(session,diff,options,frontierData);if(baseline)return baseline;
  }catch(_){/* fail safely to certified baseline planner */}
  return originalNextPlayedMove(session,diff,options)
}

root.QuadludTangoPlayedMovePlanner=Object.freeze({...Planner,nextPlayedMove,attentionContinuityVersion:VERSION,_attentionTest:Object.freeze({tutorRecentContext,tutorRecentCells,currentMoveGroup,recentPlayedTargets,changedVisibleCells,moveValueConclusions,pendingConclusionsForGroup,dominantAxis,expandContextAlongAxis,LOCAL_AXIS_RADIUS,RECENT_ACTION_GROUPS,planCells,pendingConclusionMatch,simpleDirectContinuationCandidate,localDependencyContinuationCandidate,directlyPlacesVisibleValue,directVisiblePlacements,candidateLimitFor,deferEngineMetadata,fastDirectPlan,evaluateDirectStartingDeductions,directFrontierCandidates,baselineDirectPlan,baselineContinuationPlan,contextualDirectPlan,contextualDependencyPlan,NON_SIMPLE_CONTINUATION_RULES})});
})(typeof globalThis!=='undefined'?globalThis:this);
