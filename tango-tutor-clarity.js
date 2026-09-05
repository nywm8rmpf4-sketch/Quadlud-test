/*
 * QUADLUD — Soleil/Lune Tutor conclusion and explanation clarity
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoTutorClarity=api;
  if(typeof document!=='undefined')api.scheduleInstall();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION=1;
const CONCLUSION_CLASS='walkthrough-substep-conclusion';
const CONCLUSION_BADGE_CLASS='walkthrough-substep-conclusion-badge';
const STYLE_ID='quadlud-tango-tutor-clarity-style';
const STYLE_TEXT=`
.walkthrough-substep-conclusion:not(.walkthrough-current-action){position:relative;z-index:7!important;outline:4px solid var(--accent)!important;outline-offset:-5px!important;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--paper) 92%,transparent),inset 0 0 0 7px color-mix(in srgb,var(--accent) 18%,transparent)!important}
.walkthrough-substep-conclusion-badge{position:absolute;inset-inline-end:3px;top:3px;display:grid;place-items:center;min-width:20px;height:20px;padding:0 4px;border-radius:999px;border:1px solid var(--accent);background:color-mix(in srgb,var(--paper) 94%,var(--accent));color:var(--accent);font-size:13px;font-weight:900;line-height:1;pointer-events:none;z-index:13}
@media(max-width:520px){.walkthrough-substep-conclusion:not(.walkthrough-current-action){outline-width:4px!important;outline-offset:-4px!important}.walkthrough-substep-conclusion-badge{min-width:18px;height:18px;font-size:12px;top:2px;inset-inline-end:2px}}
@media(forced-colors:active){.walkthrough-substep-conclusion:not(.walkthrough-current-action){outline:4px solid Highlight!important;box-shadow:none!important}.walkthrough-substep-conclusion-badge{border-color:Highlight!important;color:Highlight!important;background:Canvas!important}}
`;
function installStyles(){
  const doc=root.document;if(!doc)return false;if(doc.getElementById?.(STYLE_ID))return true;
  const style=doc.createElement?.('style');if(!style)return false;style.id=STYLE_ID;style.textContent=STYLE_TEXT;(doc.head||doc.documentElement)?.appendChild(style);return true
}

function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function sameCell(a,b){return Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1])}
function session(){try{return typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){return null}}
function group(){try{return typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return null}}
function currentEntry(g=group()){
  const entries=Array.isArray(g?.entries)?g.entries:[],s=session(),index=Math.max(0,Math.min(entries.length-1,Number(s?.navigation?.proofStepIndex)||0));
  return entries[index]||null
}
function stageKind(entry){return String(entry?.move?.pedagogyStageKind||entry?.move?.proofStage?.kind||'')}
function deduction(entry){const move=entry?.move||entry||{};return move.deduction||move.presentation?.evidence?.primary||null}
function valueConclusions(d){return (d?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c.cell)&&(Number(c.value)===0||Number(c.value)===1)).map(c=>({cell:copy(c.cell),value:Number(c.value)}))}
function relationPremise(d){return (d?.premises||[]).find(x=>x?.kind==='RELATION'||(Array.isArray(x?.a)&&Array.isArray(x?.b)))||null}
function valuePremise(d,cell){return (d?.premises||[]).find(x=>x?.kind==='VALUE'&&Array.isArray(x.cell)&&sameCell(x.cell,cell))||null}
function locale(){try{return String(typeof lang==='function'?lang():root.document?.documentElement?.lang||'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function humanCell(cell){if(!Array.isArray(cell))return'';return `${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`}
function humanPiece(value,loc=locale()){if(loc==='fr')return Number(value)===1?'soleil 🌞':'lune 🌙';return Number(value)===1?'sun 🌞':'moon 🌙'}
function orderedRelationPath(source,target,path){
  if(!Array.isArray(source)||!Array.isArray(target)||!Array.isArray(path)||!path.length)return [];
  const unused=path.map((edge,index)=>({edge,index})),out=[];let current=source.slice();
  while(unused.length&&!sameCell(current,target)){
    const i=unused.findIndex(x=>sameCell(x.edge?.a,current)||sameCell(x.edge?.b,current));if(i<0)return [];
    const [{edge}]=unused.splice(i,1),next=sameCell(edge.a,current)?edge.b:edge.a;if(!Array.isArray(next))return [];
    out.push({from:current.slice(),to:next.slice(),parity:Number(edge.parity)||0});current=next.slice()
  }
  return sameCell(current,target)?out:[]
}
function relationPathCells(source,target,path){
  const ordered=orderedRelationPath(source,target,path);if(!ordered.length)return [];
  const cells=[ordered[0].from.slice()];for(const edge of ordered)cells.push(edge.to.slice());return cells
}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function relationExplanation(d,loc=locale()){
  if(String(d?.rule||'')!=='RELATION_PROPAGATION')return null;
  const x=d?.explanationData||{},source=x.source,target=x.target||valueConclusions(d)[0]?.cell,conclusion=valueConclusions(d)[0],rel=relationPremise(d);
  if(!Array.isArray(source)||!Array.isArray(target)||!conclusion||!rel)return null;
  const sourceName=humanCell(source),targetName=humanCell(target),sourceValue=Number(x.sourceValue),targetValue=Number(conclusion.value),ordered=orderedRelationPath(source,target,rel.path),hypothesis=!!valuePremise(d,source)?.hypothesis;
  const direct=!ordered.length,parity=Number(x.parity)||0,relationWord=parity===0?(loc==='fr'?'le même symbole':'the same symbol'):(loc==='fr'?"le symbole opposé":'the opposite symbol');
  const whereCells=ordered.length?relationPathCells(source,target,rel.path):[source,target];
  const where=loc==='fr'?`Suis le chemin ${whereCells.map(humanCell).join(' → ')}.`:`Follow the path ${whereCells.map(humanCell).join(' → ')}.`;
  const steps=[];
  if(ordered.length){
    ordered.forEach((edge,index)=>{
      const from=humanCell(edge.from),to=humanCell(edge.to),symbol=edge.parity===0?'=':'×';
      if(loc==='fr')steps.push(`${index+1}. ${from} ${symbol} ${to} : ${from} et ${to} sont ${edge.parity===0?'identiques':'opposées'}.`);
      else steps.push(`${index+1}. ${from} ${symbol} ${to}: ${to} has ${edge.parity===0?'the same symbol as':'the opposite symbol to'} ${from}.`)
    });
    const nextIndex=steps.length+1;
    if(loc==='fr'){const lead=ordered.length===2&&ordered.every(edge=>edge.parity===1)?'Deux oppositions successives s’annulent : ':'En combinant ces relations, ';steps.push(`${nextIndex}. ${lead}${targetName} a ${relationWord} que ${sourceName}.`)}
    else steps.push(`${nextIndex}. Combining these relations, ${targetName} has ${relationWord} as ${sourceName}.`)
  }else{
    if(loc==='fr')steps.push(`1. ${sourceName} et ${targetName} ont ${relationWord}.`);
    else steps.push(`1. ${sourceName} and ${targetName} have ${relationWord}.`)
  }
  const valueIndex=steps.length+1;
  if(loc==='fr')steps.push(`${valueIndex}. ${hypothesis?'Sous l’hypothèse, ':''}${sourceName} est un ${humanPiece(sourceValue,loc)}.`);
  else steps.push(`${valueIndex}. ${hypothesis?'Under the assumption, ':''}${sourceName} = ${humanPiece(sourceValue,loc)}.`);
  const conclusionText=loc==='fr'?`Conclusion intermédiaire : ${targetName} est donc un ${humanPiece(targetValue,loc)}.`:`Intermediate conclusion: ${targetName} = ${humanPiece(targetValue,loc)}.`;
  return {where,steps,conclusion:conclusionText,direct,source:source.slice(),target:target.slice(),value:targetValue}
}
function relationFocusCells(d){
  const detail=relationExplanation(d,locale());if(!detail)return [];
  const rel=relationPremise(d),path=orderedRelationPath(detail.source,detail.target,rel?.path);
  return path.length?relationPathCells(detail.source,detail.target,rel.path):[detail.source.slice(),detail.target.slice()]
}
function alignRelationFocus(board,entry){
  if(stageKind(entry)!=='reasoning')return false;
  const d=deduction(entry),cells=relationFocusCells(d);if(!cells.length)return false;
  const conclusions=valueConclusions(d),isConclusion=cell=>conclusions.some(c=>sameCell(c.cell,cell));
  board.querySelectorAll?.('.walkthrough-current-focus').forEach(el=>el.classList.remove('walkthrough-current-focus'));
  let changed=false;
  for(const [r,c] of cells){
    if(isConclusion([r,c]))continue;
    const el=board.querySelector?.(`[data-r="${Number(r)}"][data-c="${Number(c)}"]`);if(el){el.classList.add('walkthrough-current-focus');changed=true}
  }
  return changed
}
function clearConclusion(board){
  if(!board?.querySelectorAll)return;
  board.querySelectorAll(`.${CONCLUSION_CLASS}`).forEach(el=>el.classList.remove(CONCLUSION_CLASS));
  board.querySelectorAll(`.${CONCLUSION_BADGE_CLASS}`).forEach(el=>el.remove())
}
function decorateConclusion(board,entry){
  clearConclusion(board);if(stageKind(entry)!=='reasoning')return false;
  const doc=root.document,conclusions=valueConclusions(deduction(entry));let changed=false;
  for(const conclusion of conclusions){
    const [r,c]=conclusion.cell,cell=board.querySelector?.(`[data-r="${Number(r)}"][data-c="${Number(c)}"]`);if(!cell)continue;
    cell.classList.add(CONCLUSION_CLASS);if(!cell.querySelector(`:scope > .${CONCLUSION_BADGE_CLASS}`)){
      const badge=doc.createElement('span');badge.className=CONCLUSION_BADGE_CLASS;badge.setAttribute('aria-hidden','true');badge.textContent='⇒';cell.appendChild(badge)
    }
    changed=true
  }
  return changed
}
function decorateExplanation(entry){
  const doc=root.document,panel=doc?.querySelector?.('.walkthrough-explanation');if(!panel)return false;
  const paragraphs=[...panel.querySelectorAll('p')],whereP=paragraphs[0],whyP=paragraphs[1],kind=stageKind(entry),loc=locale();
  if(kind==='reasoning'&&whyP){const heading=whyP.querySelector('b');if(heading)heading.textContent=loc==='fr'?'Raisonnement :':'Reasoning:'}
  const detail=kind==='reasoning'?relationExplanation(deduction(entry),loc):null;if(!detail)return kind==='reasoning';
  if(whereP)whereP.innerHTML=`<b>${loc==='fr'?'Où regarder':'Where to look'} :</b> ${escapeHtml(detail.where)}`;
  if(whyP){
    const reasoningLabel=loc==='fr'?'Raisonnement :':'Reasoning:';
    const stepHtml=detail.steps.map(step=>`<span class="reason-step">${escapeHtml(step)}</span>`).join('');
    whyP.innerHTML=`<b>${reasoningLabel}</b><br>${stepHtml}<span class="reason-step conclusion"><b>${escapeHtml(detail.conclusion)}</b></span>`
  }
  return true
}
function decorate(){
  const s=session(),g=group(),entry=currentEntry(g),doc=root.document,board=doc?.querySelector?.('.walkthrough-board');
  if(!s||s.base?.game!=='tango'||!g||!entry||!board)return false;
  const f=alignRelationFocus(board,entry),a=decorateConclusion(board,entry),b=decorateExplanation(entry);board.dataset.pedagogyConclusionLayer=stageKind(entry)==='reasoning'?'intermediate':'none';return f||a||b
}
function install(){
  if(typeof renderWalkthrough!=='function'||renderWalkthrough.__quadludTangoTutorClarity===true)return false;
  if(renderWalkthrough.__quadludContradictionVisuals!==true||renderWalkthrough.__quadludHumanProgressiveV4!==true)return false;
  const previous=renderWalkthrough;const wrapped=function(options={}){const result=previous(options);decorate();return result};
  wrapped.__quadludTangoTutorClarity=true;wrapped.__quadludContradictionVisuals=true;wrapped.__quadludHumanProgressiveV4=true;wrapped.__quadludPrevious=previous;renderWalkthrough=wrapped;return true
}
function scheduleInstall(){
  installStyles();let tries=240,timer=null;const retry=()=>{installStyles();if(install()){if(timer!=null)clearTimeout(timer);return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};
  retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}

return Object.freeze({VERSION,install,installStyles,scheduleInstall,decorate,_test:Object.freeze({sameCell,currentEntry,stageKind,deduction,valueConclusions,relationPremise,valuePremise,humanCell,humanPiece,orderedRelationPath,relationPathCells,relationExplanation,relationFocusCells,alignRelationFocus,escapeHtml})})
});
