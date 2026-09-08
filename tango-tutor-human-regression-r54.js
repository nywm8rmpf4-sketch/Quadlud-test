/*
 * QUADLUD — Soleil/Lune Tutor human-regression presentation R5.4
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoTutorHumanRegressionR54=api;
  if(typeof document!=='undefined')api.scheduleInstall();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=7;
const TOKEN='3.1.9-hf3.9-r5.4g';
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const cellKey=cell=>Array.isArray(cell)&&cell.length>=2?`${Number(cell[0])},${Number(cell[1])}`:'';
function locale(){try{return String(typeof lang==='function'?lang():root.document?.documentElement?.lang||'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function humanCell(cell){return Array.isArray(cell)?`${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`:''}
function currentSession(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function currentGroup(){try{return typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}}
function stageKind(move){return String(move?.pedagogyStageKind||move?.proofStage?.kind||'')}
function entryDeduction(move){return move?.deduction||move?.presentation?.evidence?.primary||null}
function causalStep(move){const proof=move?.causalProof,id=move?.causalStepId;if(proof&&id&&Array.isArray(proof.steps))return proof.steps.find(step=>step?.id===id)||null;return move?.causalStep||null}
function valueConclusions(d){return (d?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&(Number(c.value)===0||Number(c.value)===1))}
function relationPremise(d){return (d?.premises||[]).find(p=>p?.kind==='RELATION'||(Array.isArray(p?.a)&&Array.isArray(p?.b)))||null}
function relationParity(rel){if(Number(rel?.parity)===0||String(rel?.relation||'').toUpperCase()==='SAME'||String(rel?.relation||'')==='=')return 0;if(Number(rel?.parity)===1||String(rel?.relation||'').toUpperCase()==='OPPOSITE'||String(rel?.relation||'')==='×')return 1;return null}
function cellsOfDeduction(d){const out=[],seen=new Set(),add=cell=>{if(!Array.isArray(cell)||cell.length<2)return;const normalized=[Number(cell[0]),Number(cell[1])],key=cellKey(normalized);if(!seen.has(key)){seen.add(key);out.push(normalized)}};for(const c of d?.focusCells||[])add(c);for(const p of d?.premises||[]){add(p?.cell);add(p?.a);add(p?.b)}for(const c of d?.conclusions||[])add(c?.cell);return out}
function inferUnit(d){const refs=[...(d?.focusUnits||[])];if(d?.explanationData?.family!=null&&d?.explanationData?.id!=null)refs.push({family:d.explanationData.family,id:d.explanationData.id});for(const ref of refs){const family=String(ref?.family||''),id=Number(ref?.id);if((family==='row'||family==='column')&&Number.isInteger(id)&&id>=0)return {family,id}}const cells=cellsOfDeduction(d);if(cells.length<2)return null;const row=cells[0][0],column=cells[0][1];if(cells.every(c=>c[0]===row))return {family:'row',id:row};if(cells.every(c=>c[1]===column))return {family:'column',id:column};return null}
function unitName(unit,loc=locale()){if(!unit)return'';if(unit.family==='row')return loc==='fr'?`la ligne ${String.fromCharCode(65+unit.id)}`:`row ${String.fromCharCode(65+unit.id)}`;return loc==='fr'?`la colonne ${unit.id+1}`:`column ${unit.id+1}`}
function valuePremises(d){return (d?.premises||[]).filter(p=>p?.kind==='VALUE'&&Array.isArray(p.cell)&&(Number(p.value)===0||Number(p.value)===1))}
function visibleValue(move,cell){if(!Array.isArray(cell))return undefined;const r=Number(cell[0]),c=Number(cell[1]),before=move?.beforeSnapshot?.state?.[r]?.[c];if(before!==undefined)return before;return move?.snapshot?.state?.[r]?.[c]}

/* Tutor-only action projection.
 * After a demonstrated sibling continuation, inspect only the engine's cheap
 * direct visible deductions. If a RELATION_BALANCE deduction proves several
 * playable VALUE conclusions at once, keep that exact proof and play the
 * conclusion nearest to its explicit relation. This avoids a speculative
 * second planner pass in deep states such as D5. */
function lastActionMove(session){for(let i=(session?.moves?.length||0)-1;i>=0;i--){const move=session.moves[i];if(stageKind(move)==='action')return move}return null}
function manhattan(a,b){return Math.abs(Number(a?.[0])-Number(b?.[0]))+Math.abs(Number(a?.[1])-Number(b?.[1]))}
function relationDistance(cell,rel){return Math.min(manhattan(cell,rel?.a),manhattan(cell,rel?.b))}
function pedagogicalContinuation(move){const status=String(move?.metrics?.selectionStatus||'');return move?.metrics?.pendingConclusionContinuation===true||move?.metrics?.recentDependencyContinuation===true||status.includes('PEDAGOGICAL_CONTINUATION')}
function multiConclusionRelationDeduction(plan){const candidates=[plan?.startingDeduction,plan?.deduction,plan?.displayDeduction,plan?.displayProof?.deduction];for(const d of candidates){if(String(d?.rule||'')==='RELATION_BALANCE'&&relationPremise(d)&&valueConclusions(d).length>=2)return d}return null}
function projectedRelationBalancePlan(plan,state){
  if(plan?.status!=='move'||!Array.isArray(state))return null;const d=multiConclusionRelationDeduction(plan),rel=relationPremise(d);if(!d||!rel)return null;
  const playable=valueConclusions(d).filter(c=>state?.[Number(c.cell[0])]?.[Number(c.cell[1])]===-1);if(playable.length<2)return null;
  const ranked=playable.map((conclusion,index)=>({conclusion,index,distance:relationDistance(conclusion.cell,rel)})).sort((a,b)=>a.distance-b.distance||a.index-b.index),chosen=ranked[0];if(!chosen)return null;
  if(sameCell(chosen.conclusion.cell,plan.target)&&Number(chosen.conclusion.value)===Number(plan.value))return null;
  return {...copy(plan),target:copy(chosen.conclusion.cell),value:Number(chosen.conclusion.value),startingDeduction:copy(d),deduction:copy(d),displayDeduction:copy(d),displayProof:null,selectionStatus:'PROVEN_MINIMUM_RELATION_LOCALITY_TIEBREAK',pendingConclusionContinuation:false,recentDependencyContinuation:false,localAttentionContinuation:false,relationLocalityTieBreak:true,relationLocalityDistance:chosen.distance,siblingConclusionProjection:true}
}
function directRelationBalancePlan(d,state,tierIndex){
  const first=valueConclusions(d)[0];if(!first)return null;
  return projectedRelationBalancePlan({status:'move',tierIndex,target:copy(first.cell),value:Number(first.value),startingDeduction:copy(d),deduction:copy(d),proofChain:[copy(d)],candidateCount:1,frontierComplete:true},state)
}
function relationLocalityAlternative(session){
  const last=lastActionMove(session),lastDeduction=entryDeduction(last);if(!pedagogicalContinuation(last)||String(lastDeduction?.rule||'')!=='BALANCE_QUOTA')return null;
  const P=root.QuadludTangoPlayedMovePlanner,O=root.QuadludTangoTutorAttentionOrchestratorR5;if(!P?.sessionFromPublicBoard||typeof P?._test?.allowedDirectDeductions!=='function'||typeof O?.materializeContinuation!=='function')return null;
  const state=session?.work?.state;if(!Array.isArray(state))return null;
  const puzzle={n:session.work?.n||session.base?.n||6,state:copy(state),edges:copy(session.work?.edges||session.base?.edges||[])},diff=String(session.base?.diff||'expert');let engine,tier;
  try{engine=P.sessionFromPublicBoard(puzzle,state);tier=P.tierIndexForDifficulty(diff)}catch(_){return null}
  let direct;try{direct=P._test.allowedDirectDeductions(engine,tier)||[]}catch(_){return null}
  for(const d of direct){const plan=directRelationBalancePlan(d,state,tier);if(plan)return {engine,plan}}
  return null
}
function installGeneration(){const previous=root.walkthroughGenerateTangoNext;if(typeof previous!=='function')return false;if(previous.__quadludTutorHumanRegressionR54===true)return true;const wrapped=function(...args){const s=currentSession();if(s?.base?.game==='tango'){const alternative=relationLocalityAlternative(s);if(alternative){try{if(root.QuadludTangoTutorAttentionOrchestratorR5.materializeContinuation(s,alternative.engine,alternative.plan))return true}catch(_){}}}return previous(...args)};wrapped.__quadludTutorHumanRegressionR54=true;wrapped.__quadludPrevious=previous;root.walkthroughGenerateTangoNext=wrapped;return true}

function explicitRelationsFromCausalStep(step){const out=[],seenKeys=new Set(),seenObjects=new Set();const visit=value=>{if(!value||typeof value!=='object')return;if(seenObjects.has(value))return;seenObjects.add(value);if(Array.isArray(value)){for(const item of value)visit(item);return}if(value.explicit===true&&Array.isArray(value.a)&&Array.isArray(value.b)){const parity=relationParity(value);if(parity===0||parity===1){const a=[Number(value.a[0]),Number(value.a[1])],b=[Number(value.b[0]),Number(value.b[1])],ordered=[cellKey(a),cellKey(b)].sort(),key=`${ordered[0]}|${ordered[1]}|${parity}`;if(!seenKeys.has(key)){seenKeys.add(key);out.push({a,b,parity})}}}for(const child of Object.values(value))visit(child)};visit(step);return out}
function projectedConsequencesForMove(move){if(stageKind(move)!=='reasoning')return [];const step=causalStep(move),afterSequence=Number(step?.sequenceIndex);if(!step||!Number.isInteger(afterSequence)||afterSequence<1)return [];const relations=explicitRelationsFromCausalStep(step),direct=valueConclusions(entryDeduction(move)),directKeys=new Set(direct.map(c=>cellKey(c.cell))),out=[],seen=new Set();for(const conclusion of direct){for(const rel of relations){let partner=null;if(sameCell(conclusion.cell,rel.a))partner=rel.b;else if(sameCell(conclusion.cell,rel.b))partner=rel.a;else continue;const key=cellKey(partner);if(!key||directKeys.has(key)||seen.has(key)||visibleValue(move,partner)!==-1)continue;const value=rel.parity===0?Number(conclusion.value):1-Number(conclusion.value);seen.add(key);out.push({afterSequence,cell:copy(partner),value,sourceCell:copy(conclusion.cell),parity:rel.parity})}}return out}
function projectedMarkers(group,index){
  const entries=Array.isArray(group?.entries)?group.entries:[],raw=[],seen=new Set(),directSeen=new Set(),limit=Math.min(Number(index)||0,entries.length-1);
  for(let i=0;i<=limit;i++){
    const move=entries[i]?.move;for(const c of valueConclusions(entryDeduction(move)))directSeen.add(`${cellKey(c.cell)}:${Number(c.value)}`);
    for(const projection of projectedConsequencesForMove(move)){const key=`${cellKey(projection.cell)}:${projection.value}`;if(directSeen.has(key)||seen.has(key))continue;seen.add(key);raw.push({...projection,current:i===Number(index)})}
  }
  raw.sort((a,b)=>a.afterSequence-b.afterSequence||cellKey(a.cell).localeCompare(cellKey(b.cell)));
  return raw.map((projection,i)=>({...projection,sequence:projection.afterSequence+1+raw.slice(0,i).filter(p=>p.afterSequence<=projection.afterSequence).length}))
}
function shiftedSequence(rawSequence,projections){return Number(rawSequence)+(projections||[]).filter(p=>Number(p.afterSequence)<Number(rawSequence)).length}
function relationBalanceDetail(move,loc=locale()){
  const d=entryDeduction(move);if(String(d?.rule||'')!=='RELATION_BALANCE')return null;const rel=relationPremise(d),parity=relationParity(rel),target=valueConclusions(d)[0],unit=inferUnit(d);if(!rel||parity!==1||!target||!unit)return null;
  const values=valuePremises(d).filter(p=>!sameCell(p.cell,rel.a)&&!sameCell(p.cell,rel.b)&&!sameCell(p.cell,target.cell)),sunCells=values.filter(p=>Number(p.value)===1).map(p=>humanCell(p.cell)),moonCells=values.filter(p=>Number(p.value)===0).map(p=>humanCell(p.cell));
  const suns=sunCells.length+1,moons=moonCells.length+1,total=suns+moons+1;if(total%2!==0)return null;const quota=total/2,targetValue=Number(target.value);if(!((targetValue===0&&suns===quota&&moons===quota-1)||(targetValue===1&&moons===quota&&suns===quota-1)))return null;
  const a=humanCell(rel.a),b=humanCell(rel.b),t=humanCell(target.cell),unitText=unitName(unit,loc),symbol='×';
  if(loc==='fr'){const known=[];if(sunCells.length)known.push(`${sunCells.join(' et ')} ${sunCells.length===1?'est soleil':'sont soleils'}`);if(moonCells.length)known.push(`${moonCells.join(' et ')} ${moonCells.length===1?'est lune':'sont lunes'}`);return {where:`Regarde ${a} ${symbol} ${b} et ${unitText}.`,steps:[`${a} ${symbol} ${b} sont opposées : 1 soleil et 1 lune. ${known.join(' ; ')} ; ${unitText} compte donc ${suns} soleil${suns>1?'s':''} et ${moons} lune${moons>1?'s':''}. Pour faire ${quota} de chaque, ${t} = ${targetValue===1?'soleil ☀':'lune ☾'}.`]}}
  const known=[];if(sunCells.length)known.push(`${sunCells.join(' and ')} ${sunCells.length===1?'is a sun':'are suns'}`);if(moonCells.length)known.push(`${moonCells.join(' and ')} ${moonCells.length===1?'is a moon':'are moons'}`);return {where:`Look at ${a} ${symbol} ${b} and ${unitText}.`,steps:[`${a} ${symbol} ${b} are opposite: 1 sun and 1 moon. ${known.join('; ')}; ${unitText} therefore has ${suns} sun${suns===1?'':'s'} and ${moons} moon${moons===1?'':'s'}. To make ${quota} of each, ${t} = ${targetValue===1?'sun ☀':'moon ☾'}.`]}
}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function addProjectedMarker(board,marker){const cell=board?.querySelector?.(`[data-r="${Number(marker.cell?.[0])}"][data-c="${Number(marker.cell?.[1])}"]`);if(!cell||!root.document?.createElement)return false;cell.classList.add('hf39-hypothetical-cell');const wrapper=root.document.createElement('span');wrapper.className=`walkthrough-hypothetical-piece hf39-hypothetical-piece is-consequence${marker.current?' is-current':''}`;wrapper.dataset.hf39R54Projection='true';wrapper.setAttribute('aria-hidden','true');const symbol=root.document.createElement('span');symbol.className='walkthrough-hypothetical-symbol tango-symbol';symbol.textContent=Number(marker.value)===1?'☀':'☾';wrapper.appendChild(symbol);const badge=root.document.createElement('span');badge.className='hf39-marker-badge';badge.dataset.hf39R54Projection='true';badge.setAttribute('aria-hidden','true');badge.textContent=String(marker.sequence);cell.append(wrapper,badge);const loc=locale(),label=loc==='fr'?`Conséquence ${marker.sequence} : ${Number(marker.value)===1?'soleil ☀':'lune ☾'}`:`Consequence ${marker.sequence}: ${Number(marker.value)===1?'sun ☀':'moon ☾'}`,aria=String(cell.getAttribute('aria-label')||'');if(!aria.includes(label))cell.setAttribute('aria-label',aria?`${aria}, ${label}`:label);return true}
function applyProjectedRelationMarkers(board,g,index){if(!board)return false;const projections=projectedMarkers(g,index);if(!projections.length)return false;board.querySelectorAll?.('.hf39-marker-badge:not([data-hf39-r54-projection="true"])').forEach(badge=>{const raw=Number(String(badge.textContent||'').trim());if(Number.isInteger(raw)&&raw>0)badge.textContent=String(shiftedSequence(raw,projections))});for(const marker of projections)addProjectedMarker(board,marker);return true}
function renderRelationBalanceDetail(panel,move){const detail=relationBalanceDetail(move,locale());if(!detail||!panel)return false;const box=panel.querySelector?.('.walkthrough-explanation')||panel,ps=[...(box.querySelectorAll?.('p')||[])],where=ps[0],why=ps[1];if(!where||!why)return false;const loc=locale();where.innerHTML=`<b>${loc==='fr'?'Où regarder':'Where to look'} :</b> ${escapeHtml(detail.where)}`;why.innerHTML=`<b>${loc==='fr'?'Raisonnement :':'Reasoning:'}</b> ${detail.steps.map(step=>`<span class="reason-step">${escapeHtml(step)}</span>`).join('')}`;return true}
function decorate(){const s=currentSession(),g=currentGroup(),panel=root.document?.querySelector?.('.walkthrough-panel'),board=root.document?.querySelector?.('.walkthrough-board');if(!s||s.base?.game!=='tango'||!g||!panel||!board)return false;const index=Math.max(0,Math.min(g.entries.length-1,Number(s.navigation?.proofStepIndex)||0)),move=g.entries[index]?.move;if(!move)return false;renderRelationBalanceDetail(panel,move);if(stageKind(move)!=='action')applyProjectedRelationMarkers(board,g,index);return true}
function installRender(){const previous=root.renderWalkthrough;if(typeof previous!=='function')return false;if(previous.__quadludTutorHumanRegressionR54===true)return true;const wrapped=function(...args){const result=previous(...args);decorate();return result};wrapped.__quadludTutorHumanRegressionR54=true;wrapped.__quadludPrevious=previous;root.renderWalkthrough=wrapped;return true}
function installNavigation(){const previous=root.walkthroughNavigateProof;if(typeof previous!=='function')return false;if(previous.__quadludTutorHumanRegressionR54===true)return true;const wrapped=function(...args){const result=previous(...args);decorate();return result};wrapped.__quadludTutorHumanRegressionR54=true;wrapped.__quadludPrevious=previous;root.walkthroughNavigateProof=wrapped;return true}
function install(){return installGeneration()&&installRender()&&installNavigation()}
function scheduleInstall(){let tries=320,timer=null;const retry=()=>{const ok=install();if(ok){if(timer!=null)clearTimeout(timer);decorate();return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true}
return Object.freeze({VERSION,TOKEN,install,scheduleInstall,decorate,_test:Object.freeze({sameCell,cellKey,stageKind,entryDeduction,causalStep,valueConclusions,relationPremise,relationParity,cellsOfDeduction,inferUnit,unitName,valuePremises,visibleValue,lastActionMove,manhattan,relationDistance,pedagogicalContinuation,multiConclusionRelationDeduction,projectedRelationBalancePlan,directRelationBalancePlan,relationLocalityAlternative,explicitRelationsFromCausalStep,projectedConsequencesForMove,projectedMarkers,shiftedSequence,relationBalanceDetail})});
});