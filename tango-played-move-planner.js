/*
 * QUADLUD — Soleil/Lune played-move planner
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoPlayedMovePlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const TL=(typeof module!=='undefined'&&module.exports)?require('./tango-logic.js'):root.TangoLogic;
const TD=(typeof module!=='undefined'&&module.exports)?require('./tango-difficulty.js'):root.TangoDifficulty;
const Selector=(typeof module!=='undefined'&&module.exports)?require('./tutor-move-selector.js'):root.QuadludTutorMoveSelector;
if(!TL||!TD||typeof TD.nextAllowedDeduction!=='function'||!Selector||typeof Selector.select!=='function')throw new Error('Soleil/Lune played-move planner dependencies unavailable');

const VALUE_EMPTY=TL.constants.VALUE_EMPTY;
const DIFF_TO_TIER=Object.freeze({easy:0,medium:1,hard:2,expert:3,facile:0,moyen:1,difficile:2});
const COST_MODEL='tango-tutor-ordinal-v1';

function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function tierIndexForDifficulty(diff){
  if(Number.isInteger(diff)&&diff>=0&&diff<=3)return diff;
  const key=String(diff||'').trim().toLowerCase();
  if(!Object.prototype.hasOwnProperty.call(DIFF_TO_TIER,key))throw new Error(`Unknown Soleil/Lune difficulty: ${diff}`);
  return DIFF_TO_TIER[key];
}
function deductionKey(d){return String(d?.signature||d?.id||JSON.stringify([d?.rule,d?.conclusions||[]]))}
function uniqDeductions(list){const seen=new Set(),out=[];for(const d of list||[]){if(!d)continue;const key=deductionKey(d);if(seen.has(key))continue;seen.add(key);out.push(d)}return out}
function stateDiff(before,after){
  const out=[];
  if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length)return out;
  for(let r=0;r<before.length;r++){
    if(!Array.isArray(before[r])||!Array.isArray(after[r])||before[r].length!==after[r].length)continue;
    for(let c=0;c<before[r].length;c++)if(before[r][c]!==after[r][c])out.push({cell:[r,c],from:before[r][c],to:after[r][c]});
  }
  return out;
}
function isVisiblePlacement(change){return change&&change.from===VALUE_EMPTY&&(change.to===0||change.to===1)}
function traceEntries(applied){return [applied?.deduction,...(applied?.automatic||[])].filter(Boolean)}
function dependencyIds(deduction){
  return [...new Set([...(deduction?.dependencies||[]),...(deduction?.premises||[]).flatMap(p=>p?.dependencies||[])].filter(Boolean))];
}
function causalProofForTarget(trace,target,value){
  const byId=new Map((trace||[]).filter(d=>d?.id).map(d=>[d.id,d]));
  const sources=(trace||[]).filter(d=>(d?.conclusions||[]).some(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&c.cell[0]===target[0]&&c.cell[1]===target[1]&&c.value===value));
  if(!sources.length)return {source:null,proofChain:copy(trace||[])};
  const source=sources[0],needed=new Set(source.id?[source.id]:[]),stack=[...needed];
  while(stack.length){
    const current=byId.get(stack.pop());if(!current)continue;
    for(const id of dependencyIds(current))if(byId.has(id)&&!needed.has(id)){needed.add(id);stack.push(id)}
  }
  const chain=(trace||[]).filter(d=>!d?.id||needed.has(d.id));
  return {source:copy(source),proofChain:copy(chain.length?chain:[source])};
}
function firstCausalVisiblePlacement(before,after,trace){
  const changes=stateDiff(before,after).filter(isVisiblePlacement);
  if(!changes.length)return null;
  const byKey=new Map(changes.map(change=>[`${change.cell[0]}:${change.cell[1]}:${change.to}`,change]));
  for(const deduction of trace||[]){
    const matches=[];
    for(const conclusion of deduction?.conclusions||[]){
      if(conclusion?.type!=='VALUE'||!Array.isArray(conclusion.cell)||conclusion.cell.length!==2)continue;
      const key=`${conclusion.cell[0]}:${conclusion.cell[1]}:${conclusion.value}`;
      const change=byKey.get(key);
      if(change)matches.push(change);
    }
    if(matches.length){
      matches.sort((a,b)=>a.cell[0]-b.cell[0]||a.cell[1]-b.cell[1]||a.to-b.to);
      return {target:matches[0],changes};
    }
  }
  return {target:changes[0],changes};
}
function firstPlacementFromApplied(before,after,trace,proofPrefix=[]){
  const picked=firstCausalVisiblePlacement(before,after,trace);
  if(!picked)return null;
  const {target,changes}=picked,fullTrace=[...(proofPrefix||[]),...(trace||[])],causal=causalProofForTarget(fullTrace,target.cell,target.to);
  return {
    target:target.cell.slice(),
    value:target.to,
    deduction:causal.source||copy(trace?.[trace.length-1]||null),
    proofChain:causal.proofChain,
    engineVisiblePlacementCount:changes.length,
    engineVisiblePlacements:copy(changes)
  };
}
function placementsFromApplied(before,after,trace,proofPrefix=[]){
  const changes=stateDiff(before,after).filter(isVisiblePlacement).sort((a,b)=>a.cell[0]-b.cell[0]||a.cell[1]-b.cell[1]||a.to-b.to);
  if(!changes.length)return [];
  const fullTrace=[...(proofPrefix||[]),...(trace||[])];
  return changes.map(target=>{
    const causal=causalProofForTarget(fullTrace,target.cell,target.to);
    return {
      target:target.cell.slice(),
      value:target.to,
      deduction:causal.source||copy(trace?.[trace.length-1]||null),
      proofChain:causal.proofChain,
      engineVisiblePlacementCount:changes.length,
      engineVisiblePlacements:copy(changes)
    };
  });
}
function allowedDirectDeductions(session,tierIndex){
  const policy=TD.TIER_POLICY?.[tierIndex],allowed=new Set(policy?.allowedRules||[]);
  if(!allowed.size||typeof session?.directDeductions!=='function')return [];
  return uniqDeductions(session.directDeductions().filter(d=>allowed.has(d.rule))).sort(TL.deductionComparator);
}
function advancedDeductionsDetailed(session,tierIndex){
  if(tierIndex<3)return {deductions:[],budgetHit:false};
  let budgetHit=false,out=[];
  if(typeof session?.findAssumptionContradictionsDetailed==='function'){
    const result=session.findAssumptionContradictionsDetailed()||{};budgetHit=budgetHit||!!result.budgetHit;out.push(...(result.deductions||[]));
  }
  if(typeof session?.findCommonConsequencesDetailed==='function'){
    const result=session.findCommonConsequencesDetailed()||{};budgetHit=budgetHit||!!result.budgetHit;out.push(...(result.deductions||[]));
  }
  return {deductions:uniqDeductions(out).sort(TL.deductionComparator),budgetHit};
}
function planFromFirstDeduction(session,tierIndex,firstDeduction,{maxEngineSteps,advancedStart=false}={}){
  const fork=session.clone(),limit=Number.isInteger(maxEngineSteps)&&maxEngineSteps>0?maxEngineSteps:Math.max(24,fork.n*fork.n*2),proof=[];
  let deduction=copy(firstDeduction);
  for(let step=0;step<limit;step++){
    const contradiction=fork.diagnose();
    if(contradiction)return {status:'contradictory',contradiction:copy(contradiction),tierIndex,proofChain:copy(proof)};
    if(!fork.state.some(row=>row.includes(VALUE_EMPTY)))return {status:'solved',tierIndex,proofChain:copy(proof)};
    if(step>0){const next=TD.nextAllowedDeduction(fork,tierIndex,false);deduction=next?.deduction||null;if(!deduction)return {status:next?.budgetHit?'budget-exhausted':'blocked',budgetHit:!!next?.budgetHit,tierIndex,proofChain:copy(proof)}}
    if(!deduction)return {status:'blocked',budgetHit:false,tierIndex,proofChain:copy(proof)};
    const before=copy(fork.state),applied=fork.applyDeduction(deduction);
    if(!applied?.deduction)return {status:'invalid',tierIndex,error:'Soleil/Lune deduction could not be applied',proofChain:copy(proof)};
    const trace=traceEntries(applied),placements=placementsFromApplied(before,fork.state,trace,proof);
    proof.push(...copy(trace));
    if(placements.length){
      const branchPlans=placements.map(placement=>({status:'move',tierIndex,...placement,engineStepCount:step+1,advancedStart:!!advancedStart,startingDeduction:copy(firstDeduction)}));
      const selected=selectPlans(branchPlans,{frontierComplete:true});
      return selected.plan||branchPlans[0];
    }
  }
  return {status:'budget-exhausted',budgetHit:true,tierIndex,proofChain:copy(proof)};
}
function addCell(set,cell){if(Array.isArray(cell)&&cell.length===2&&cell.every(Number.isInteger))set.add(`${cell[0]}:${cell[1]}`)}
function collectCellsFromObject(set,value){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const child of value)collectCellsFromObject(set,child);return}
  for(const key of ['cell','a','b','target'])addCell(set,value[key]);
  for(const key of ['cells','focusCells','window','pair'])if(Array.isArray(value[key]))for(const cell of value[key])addCell(set,cell);
}
function planMetrics(plan){
  const proof=Array.isArray(plan?.proofChain)?plan.proofChain.filter(Boolean):[],cells=new Set();
  let premises=0,techniqueLevel=0,rank=0;
  for(const d of proof){premises+=(d?.premises||[]).length;techniqueLevel=Math.max(techniqueLevel,Number(d?.techniqueLevel)||0);rank=Math.max(rank,Number(d?.rank)||0);collectCellsFromObject(cells,d);for(const p of d?.premises||[])collectCellsFromObject(cells,p);for(const c of d?.conclusions||[])collectCellsFromObject(cells,c)}
  addCell(cells,plan?.target);
  const engineStepCount=Math.max(1,Number(plan?.engineStepCount)||proof.length||1),indirectionTier=plan?.advancedStart?2:(engineStepCount===1?0:1);
  return {indirectionTier,engineStepCount,proofDepth:Math.max(1,proof.length),premiseCount:premises,spatialExtent:Math.max(1,cells.size),techniqueLevel,rank};
}
function planCostVector(plan){const m=planMetrics(plan);return [m.indirectionTier,m.engineStepCount,m.proofDepth,m.premiseCount,m.spatialExtent,m.techniqueLevel,m.rank]}
function candidateIdForPlan(plan){return `tango:${plan.target?.[0]}:${plan.target?.[1]}:${plan.value}|${deductionKey(plan.startingDeduction||plan.deduction)}`}
function candidateStableKey(plan){return `${String(plan.target?.[0]).padStart(3,'0')}:${String(plan.target?.[1]).padStart(3,'0')}:${plan.value}|${deductionKey(plan.startingDeduction||plan.deduction)}`}
function planDependencyIds(plan){return new Set((plan?.proofChain||[]).flatMap(dependencyIds))}
function buildSelectorCandidates(plans){
  const candidates=(plans||[]).filter(p=>p?.status==='move'&&Array.isArray(p.target)).map(plan=>({schema:1,id:candidateIdForPlan(plan),game:'tango',deduction:plan.deduction,plan,playable:true,validated:true,costModel:COST_MODEL,costVector:planCostVector(plan),blockedBy:[],stableKey:candidateStableKey(plan)}));
  const directByDeductionId=new Map();
  for(const c of candidates){const p=c.plan,start=p?.startingDeduction||p?.deduction;if(p?.engineStepCount===1&&start?.id)directByDeductionId.set(start.id,c.id)}
  return candidates.map(c=>{const deps=planDependencyIds(c.plan),blockedBy=[...new Set([...deps].map(id=>directByDeductionId.get(id)).filter(id=>id&&id!==c.id))].sort();return {...c,blockedBy}});
}
function selectPlans(plans,{frontierComplete=true}={}){
  const candidates=buildSelectorCandidates(plans),selection=Selector.select(candidates,{frontierComplete});
  if(!selection.selected)return {selection,candidates,plan:null};
  return {selection,candidates,plan:selection.selected.plan};
}
function candidateLimitFor(session,options){return Number.isInteger(options?.maxCandidatePlans)&&options.maxCandidatePlans>0?options.maxCandidatePlans:Math.max(24,Number(session?.n||6)*Number(session?.n||6)*2)}
function evaluateStartingDeductions(session,tierIndex,deductions,options,advancedStart=false){
  const limit=candidateLimitFor(session,options),chosen=(deductions||[]).slice(0,limit),plans=[];let branchBudgetHit=false;
  for(const d of chosen){const plan=planFromFirstDeduction(session,tierIndex,d,{...options,advancedStart});if(plan.status==='move')plans.push(plan);else if(plan.status==='budget-exhausted')branchBudgetHit=true}
  return {plans,truncated:(deductions||[]).length>chosen.length,branchBudgetHit,evaluated:chosen.length,total:(deductions||[]).length};
}
function nextPlayedMove(session,diff,options={}){
  if(!session||typeof session.clone!=='function')throw new TypeError('Soleil/Lune planner requires a clonable logic session');
  const tierIndex=tierIndexForDifficulty(diff),bad=session.diagnose();
  if(bad)return {status:'contradictory',contradiction:copy(bad),tierIndex,proofChain:[]};
  if(!session.state.some(row=>row.includes(VALUE_EMPTY)))return {status:'solved',tierIndex,proofChain:[]};

  const direct=allowedDirectDeductions(session,tierIndex),directEval=evaluateStartingDeductions(session,tierIndex,direct,options,false);
  if(directEval.plans.length){
    const frontierComplete=!directEval.truncated&&!directEval.branchBudgetHit,selected=selectPlans(directEval.plans,{frontierComplete});
    if(selected.plan)return {...selected.plan,selectionStatus:selected.selection.status,selectedCostVector:copy(selected.selection.selected.costVector),candidateCount:selected.candidates.length,frontierComplete,budgetHit:!frontierComplete};
  }

  let frontierComplete=!directEval.truncated&&!directEval.branchBudgetHit,advancedBudgetHit=false,advancedEval={plans:[],truncated:false,branchBudgetHit:false,evaluated:0,total:0};
  if(tierIndex>=3){
    const advanced=advancedDeductionsDetailed(session,tierIndex);advancedBudgetHit=!!advanced.budgetHit;advancedEval=evaluateStartingDeductions(session,tierIndex,advanced.deductions,options,true);frontierComplete=frontierComplete&&!advancedBudgetHit&&!advancedEval.truncated&&!advancedEval.branchBudgetHit;
    if(advancedEval.plans.length){const selected=selectPlans(advancedEval.plans,{frontierComplete});if(selected.plan)return {...selected.plan,selectionStatus:selected.selection.status,selectedCostVector:copy(selected.selection.selected.costVector),candidateCount:selected.candidates.length,frontierComplete,budgetHit:!frontierComplete}}
  }

  const budgetHit=!frontierComplete||advancedBudgetHit;
  return {status:budgetHit?'budget-exhausted':'blocked',budgetHit,tierIndex,proofChain:[]};
}
function publicBoard(puzzle,stateOverride=null){
  const canonical=TD.canonicalizePublicPuzzle(puzzle),state=stateOverride?copy(stateOverride):copy(canonical.state);
  return {n:canonical.n,state,edges:copy(canonical.edges)};
}
function sessionFromPublicBoard(puzzle,stateOverride=null,options={}){
  return TL.createSession(publicBoard(puzzle,stateOverride),{maxHypothesisSteps:options.maxHypothesisSteps??18,maxCommonSteps:options.maxCommonSteps??10});
}
function applyPlayedMoveToState(state,plan){
  if(!Array.isArray(state)||!plan||plan.status!=='move'||!Array.isArray(plan.target))return false;
  const [r,c]=plan.target,value=plan.value;
  if(state?.[r]?.[c]!==VALUE_EMPTY)return state?.[r]?.[c]===value;
  state[r][c]=value;return true;
}
function solveByPlayedMoves(puzzle,diff,options={}){
  const canonical=TD.canonicalizePublicPuzzle(puzzle),state=copy(canonical.state),limit=Number.isInteger(options.maxMoves)&&options.maxMoves>0?options.maxMoves:Math.max(24,canonical.n*canonical.n*2),moves=[];
  for(let i=0;i<limit;i++){
    const session=sessionFromPublicBoard(canonical,state,options),bad=session.diagnose();
    if(bad)return {status:'contradictory',moves,contradiction:copy(bad),state:copy(state)};
    if(!state.some(row=>row.includes(VALUE_EMPTY)))return {status:'solved',moves,state:copy(state)};
    const plan=nextPlayedMove(session,diff,options);
    if(plan.status!=='move')return {...plan,moves,state:copy(state)};
    if(!applyPlayedMoveToState(state,plan))return {status:'invalid',moves,state:copy(state),error:'Soleil/Lune planned move could not be applied'};
    moves.push(copy(plan));
  }
  return {status:'budget-exhausted',budgetHit:true,moves,state:copy(state)};
}

return Object.freeze({
  VERSION:3,
  COST_MODEL,
  tierIndexForDifficulty,
  stateDiff,
  publicBoard,
  sessionFromPublicBoard,
  nextPlayedMove,
  applyPlayedMoveToState,
  solveByPlayedMoves,
  _test:Object.freeze({firstCausalVisiblePlacement,firstPlacementFromApplied,placementsFromApplied,traceEntries,dependencyIds,causalProofForTarget,allowedDirectDeductions,advancedDeductionsDetailed,planFromFirstDeduction,planMetrics,planCostVector,buildSelectorCandidates,selectPlans,evaluateStartingDeductions})
});
});