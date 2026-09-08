/*
 * QUADLUD — Soleil/Lune Tutor cognitive conclusion batches R6
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoTutorConclusionBatchR6=api;
  if(typeof document!=='undefined')api.scheduleInstall();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=1;
const TOKEN='3.1.9-hf3.9-r6-cognitive-batch-v1';
const BATCH_SCHEMA='tango-tutor-cognitive-batch-v1';
const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const cellKey=cell=>Array.isArray(cell)&&cell.length>=2?`${Number(cell[0])}:${Number(cell[1])}`:'';
function session(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function currentGroup(){try{return typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}}
function snapshot(work){try{return typeof walkthroughSnapshot==='function'?copy(walkthroughSnapshot(work)):{state:copy(work?.state||[]),tangoDerivedRelations:copy(work?.tangoDerivedRelations||[])}}catch(_){return {state:copy(work?.state||[]),tangoDerivedRelations:copy(work?.tangoDerivedRelations||[])}}}
function complete(){try{return typeof walkthroughComplete==='function'&&walkthroughComplete()}catch(_){return false}}
function presenter(){try{return typeof tangoReasoningPresenter==='function'?tangoReasoningPresenter():null}catch(_){return null}}
function human(){const H=root.QuadludTangoHumanPedagogyR4;return H&&typeof H?._test?.proofStagesForDeduction==='function'?H:null}
function genericBatch(){return root.QuadludPedagogyConclusionBatch||null}
function stageKind(move){return String(move?.pedagogyStageKind||move?.proofStage?.kind||'')}
function valueConclusions(d){return (d?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&c.cell.length>=2&&(Number(c.value)===0||Number(c.value)===1))}
function firstValueTarget(d){const c=valueConclusions(d)[0];return c?copy(c.cell):null}
function valueAt(state,cell){return Array.isArray(cell)?state?.[Number(cell[0])]?.[Number(cell[1])]:undefined}
function conclusionKey(cell,value){return `${cellKey(cell)}:${Number(value)}`}
function sourceKey(d){return String(d?.signature||d?.id||JSON.stringify([d?.rule||'',d?.premises||[],d?.conclusions||[]]))}
function actionValue(move){const target=move?.target;if(!Array.isArray(target))return undefined;const v=move?.snapshot?.state?.[Number(target[0])]?.[Number(target[1])];return v===0||v===1?Number(v):undefined}
function deductionCandidates(move){return [move?.deduction,move?.presentation?.evidence?.primary,move?.presentation?.evidence?.final,move?.presentation?.action?.deduction].filter(Boolean)}
function batchDeductionForAction(move,beforeState){
  const target=move?.target,value=actionValue(move);if(!Array.isArray(target)||(value!==0&&value!==1))return null;
  const candidates=[];
  for(const d of deductionCandidates(move)){
    const conclusions=valueConclusions(d),hasPrimary=conclusions.some(c=>sameCell(c.cell,target)&&Number(c.value)===value);if(!hasPrimary)continue;
    const playable=conclusions.filter(c=>{const v=valueAt(beforeState,c.cell);return v===-1||sameCell(c.cell,target)&&v===-1});
    candidates.push({d,playableCount:playable.length,conclusionCount:conclusions.length})
  }
  candidates.sort((a,b)=>b.playableCount-a.playableCount||b.conclusionCount-a.conclusionCount);
  return candidates[0]?.d||null
}
function conclusionBatchFromAction(move){
  const before=move?.beforeSnapshot?.state,target=move?.target,value=actionValue(move),Batch=genericBatch();if(!Array.isArray(before)||!Array.isArray(target)||(value!==0&&value!==1)||!Batch?.create)return null;
  const d=batchDeductionForAction(move,before);if(!d)return null;
  const seen=new Set(),items=[];
  for(const c of valueConclusions(d)){
    const v=valueAt(before,c.cell),key=conclusionKey(c.cell,c.value);if(v!==-1||seen.has(key))continue;seen.add(key);items.push({key,target:copy(c.cell),value:Number(c.value)})
  }
  const primaryKey=conclusionKey(target,value);if(!seen.has(primaryKey))items.unshift({key:primaryKey,target:copy(target),value});
  if(items.length<2)return null;
  let batch;try{batch=Batch.create({sourceKey:sourceKey(d),items,primaryKey,metadata:{game:'tango',rule:String(d?.rule||''),zeroMarginalCognitiveCost:true}})}catch(_){return null}
  return {batch,sourceDeduction:copy(d),primaryKey}
}
function annotateBatchMoves(moves,batch,index,zeroCost){
  for(const move of moves||[]){
    move.conclusionBatch={schema:BATCH_SCHEMA,id:batch.id,index,size:batch.size,sourceKey:batch.sourceKey,zeroCognitiveCost:!!zeroCost};
    move.metrics={...(move.metrics||{}),conclusionBatchId:batch.id,conclusionBatchIndex:index,conclusionBatchSize:batch.size,zeroCognitiveCostConclusion:!!zeroCost,solverRequiredForConclusion:!zeroCost}
  }
}
function captureBatchAfterGenerated(sessionValue,startMoves){
  const added=(sessionValue?.moves||[]).slice(startMoves),action=[...added].reverse().find(move=>stageKind(move)==='action')||added.at(-1);if(!action)return null;
  const found=conclusionBatchFromAction(action);if(!found){sessionValue.tangoTutorConclusionBatch=null;return null}
  const {batch,sourceDeduction}=found;annotateBatchMoves(added,batch,1,false);
  sessionValue.tangoTutorConclusionBatch={schema:BATCH_SCHEMA,id:batch.id,sourceKey:batch.sourceKey,size:batch.size,nextIndex:1,items:copy(batch.items),sourceDeduction,createdAtMoveCount:(sessionValue.moves||[]).length};
  return copy(sessionValue.tangoTutorConclusionBatch)
}
function reorderedDeduction(source,item){
  const d=copy(source),all=valueConclusions(d),chosen=all.find(c=>sameCell(c.cell,item.target)&&Number(c.value)===Number(item.value));if(!chosen)return null;
  const others=(d.conclusions||[]).filter(c=>!(c?.type==='VALUE'&&sameCell(c.cell,item.target)&&Number(c.value)===Number(item.value)));
  d.conclusions=[copy(chosen),...copy(others)];return d
}
function materializeCachedConclusion(sessionValue,queue,item,itemIndex){
  const H=human(),P=presenter(),d=reorderedDeduction(queue?.sourceDeduction,item);if(!H||!P||!d)return false;
  const stages=H._test.proofStagesForDeduction(d,P);if(!Array.isArray(stages)||!stages.length)return false;
  const [r,c]=item.target||[],value=Number(item.value);if(!Number.isInteger(r)||!Number.isInteger(c)||(value!==0&&value!==1)||sessionValue.work?.state?.[r]?.[c]!==-1)return false;
  const beforeSnapshot=snapshot(sessionValue.work);sessionValue.work.state[r][c]=value;sessionValue.work.tangoDerivedRelations=[];sessionValue.tangoLogic=null;const finalSnapshot=snapshot(sessionValue.work),added=[];
  stages.forEach((stage,index)=>{
    const last=index===stages.length-1,presentation=stage.presentation||P.presentation(stage.deduction),reasoning=P.legacyReasoning(stage.deduction),stageTarget=last?[r,c]:(firstValueTarget(stage.deduction)||[r,c]);
    const info={
      rule:presentation?.rule||d.rule,technique:presentation?.technique,rank:presentation?.rank??d.rank,techniqueLevel:presentation?.techniqueLevel??d.techniqueLevel,target:[r,c],presentation,deduction:reasoning,
      where:presentation?.explanation?.where||'',why:presentation?.explanation?.why||'',move:last?(presentation?.explanation?.move||P.conclusionText(d)):'',automatic:[],pedagogyStageKind:stage.kind,
      metrics:{plannerStatus:'cached-demonstrated-conclusion',selectionStatus:'CACHED_DEMONSTRATED_CONCLUSION',candidateCount:0,humanCandidateCount:0,humanGlobalSelection:false,frontierComplete:true,pendingConclusionContinuation:true,zeroCognitiveCostConclusion:true,solverRequiredForConclusion:false,conclusionBatchId:queue.id,conclusionBatchIndex:itemIndex+1,conclusionBatchSize:queue.size},
      beforeSnapshot:copy(beforeSnapshot),proofTarget:stageTarget,snapshot:copy(last?finalSnapshot:beforeSnapshot)
    };
    added.push(info);sessionValue.moves.push(info)
  });
  const batchView={id:queue.id,sourceKey:queue.sourceKey,size:queue.size};annotateBatchMoves(added,batchView,itemIndex+1,true);
  sessionValue.tangoTutorStatus='cached-demonstrated-conclusion';sessionValue.tangoTutorSelectionStatus='CACHED_DEMONSTRATED_CONCLUSION';
  if(complete()){sessionValue.done=true;sessionValue.total=sessionValue.moves.length}
  return true
}
function consumeQueuedConclusion(sessionValue){
  const q=sessionValue?.tangoTutorConclusionBatch;if(!q||q.schema!==BATCH_SCHEMA||!Array.isArray(q.items)||!Array.isArray(sessionValue?.work?.state))return false;
  while(Number(q.nextIndex)<q.items.length){
    const index=Number(q.nextIndex),item=q.items[index],current=valueAt(sessionValue.work.state,item?.target);
    if(current===Number(item?.value)){q.nextIndex=index+1;continue}
    if(current!==-1){sessionValue.tangoTutorConclusionBatch=null;return false}
    if(!materializeCachedConclusion(sessionValue,q,item,index)){sessionValue.tangoTutorConclusionBatch=null;return false}
    q.nextIndex=index+1;if(q.nextIndex>=q.items.length)sessionValue.tangoTutorConclusionBatch=null;return true
  }
  sessionValue.tangoTutorConclusionBatch=null;return false
}

function causalStep(move){const proof=move?.causalProof,id=move?.causalStepId;if(!proof||!id||!Array.isArray(proof.steps))return null;return proof.steps.find(step=>step?.id===id)||null}
function hierarchyItems(group,index){
  const byMajor=new Map(),entries=Array.isArray(group?.entries)?group.entries:[],limit=Math.min(Math.max(0,Number(index)||0),Math.max(0,entries.length-1)),add=(major,cell,kind)=>{if(!Number.isInteger(major)||major<1||!Array.isArray(cell))return;const list=byMajor.get(major)||[],key=cellKey(cell);if(!list.some(x=>x.key===key))list.push({key,cell:copy(cell),kind});byMajor.set(major,list)};
  for(let i=0;i<=limit;i++){const step=causalStep(entries[i]?.move);if(step?.hypothetical&&step.kind==='deduction'&&Number.isInteger(step.sequenceIndex)&&step.sequenceIndex>=1)for(const cell of step.producedCells||[])add(step.sequenceIndex,cell,'direct')}
  const R=root.QuadludTangoTutorHumanRegressionR54;let projected=[];try{projected=R?._test?.projectedMarkers?.(group,limit)||[]}catch(_){projected=[]}
  for(const marker of projected)add(Number(marker.afterSequence),marker.cell,'projected');return byMajor
}
function relabelHypotheticalBadges(){
  const s=session(),g=currentGroup(),board=root.document?.querySelector?.('.walkthrough-board'),Batch=genericBatch();if(!s||s.base?.game!=='tango'||!g||!board||!Batch?.label)return false;
  const index=Math.max(0,Math.min((g.entries?.length||1)-1,Number(s.navigation?.proofStepIndex)||0)),byMajor=hierarchyItems(g,index);let changed=false;
  for(const [major,items] of byMajor){items.forEach((item,minor)=>{const cell=board.querySelector?.(`[data-r="${Number(item.cell[0])}"][data-c="${Number(item.cell[1])}"]`);if(!cell)return;const selector=item.kind==='projected'?'.hf39-marker-badge[data-hf39-r54-projection="true"]':'.walkthrough-hypothetical-badge',badge=cell.querySelector?.(selector);if(!badge)return;badge.textContent=Batch.label(major,minor,items.length);changed=true})}
  return changed
}

function installGeneration(){
  const previous=root.walkthroughGenerateTangoNext;if(typeof previous!=='function')return false;if(previous.__quadludTutorConclusionBatchR6===true)return true;
  const wrapped=function(...args){const s=session();if(!s||s.base?.game!=='tango'||s.done||s.stalled)return previous(...args);if(consumeQueuedConclusion(s))return true;const start=(s.moves||[]).length,ok=previous(...args);if(ok)captureBatchAfterGenerated(s,start);return ok};
  wrapped.__quadludTutorConclusionBatchR6=true;wrapped.__quadludPrevious=previous;root.walkthroughGenerateTangoNext=wrapped;return true
}
function installRender(){
  const previous=root.renderWalkthrough;if(typeof previous!=='function')return false;if(previous.__quadludTutorConclusionBatchR6===true)return true;
  const wrapped=function(...args){const result=previous(...args);relabelHypotheticalBadges();return result};wrapped.__quadludTutorConclusionBatchR6=true;wrapped.__quadludPrevious=previous;root.renderWalkthrough=wrapped;return true
}
function install(){return installGeneration()&&installRender()}
function scheduleInstall(){let tries=320,timer=null;const retry=()=>{const ok=install();if(ok){if(timer!=null)clearTimeout(timer);relabelHypotheticalBadges();return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true}

return Object.freeze({VERSION,TOKEN,BATCH_SCHEMA,install,scheduleInstall,consumeQueuedConclusion,captureBatchAfterGenerated,relabelHypotheticalBadges,_test:Object.freeze({stageKind,valueConclusions,conclusionKey,sourceKey,actionValue,deductionCandidates,batchDeductionForAction,conclusionBatchFromAction,reorderedDeduction,hierarchyItems})});
});
