/*
 * QUADLUD — Soleil/Lune Coach/Tutor locally self-contained proof clarity
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

const VERSION=2;
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
function unitName(family,id,loc=locale()){if(family==='row')return loc==='fr'?`ligne ${String.fromCharCode(65+Number(id))}`:`row ${String.fromCharCode(65+Number(id))}`;return loc==='fr'?`colonne ${Number(id)+1}`:`column ${Number(id)+1}`}
function relationWord(parity,loc=locale()){return Number(parity)===0?(loc==='fr'?'identiques':'the same'):(loc==='fr'?'opposées':'opposite')}
function relationSymbol(parity){return Number(parity)===0?'=':'×'}
function relationStatement(a,b,parity,loc=locale()){const x=humanCell(a),y=humanCell(b);return loc==='fr'?`${x} ${relationSymbol(parity)} ${y} : ${x} et ${y} sont ${relationWord(parity,loc)}.`:`${x} ${relationSymbol(parity)} ${y}: ${x} and ${y} are ${relationWord(parity,loc)}.`}
function orderedRelationPath(source,target,path){
  if(!Array.isArray(source)||!Array.isArray(target)||!Array.isArray(path)||!path.length)return [];
  const unused=path.map((edge,index)=>({edge,index})),out=[];let current=source.slice();
  while(unused.length&&!sameCell(current,target)){
    const i=unused.findIndex(x=>sameCell(x.edge?.a,current)||sameCell(x.edge?.b,current));if(i<0)return [];
    const [{edge}]=unused.splice(i,1),next=sameCell(edge.a,current)?edge.b:edge.a;if(!Array.isArray(next))return [];
    out.push({from:current.slice(),to:next.slice(),parity:Number(edge.parity)||0,explicit:!!edge.explicit,source:edge.source||null,deductionId:edge.deductionId||null,support:edge.support?copy(edge.support):null});current=next.slice()
  }
  return sameCell(current,target)?out:[]
}
function relationPathCells(source,target,path){
  const ordered=orderedRelationPath(source,target,path);if(!ordered.length)return [];
  const cells=[ordered[0].from.slice()];for(const edge of ordered)cells.push(edge.to.slice());return cells
}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function unsupportedRelationLine(a,b,loc=locale()){return loc==='fr'?`La provenance nécessaire pour démontrer ${humanCell(a)} ${relationSymbol(1)} ${humanCell(b)} n’est pas disponible dans cette preuve.`:`The provenance required to prove the relation between ${humanCell(a)} and ${humanCell(b)} is missing from this proof.`}
function premiseRelationLines(p,loc=locale(),depth=0){
  if(!p||!Array.isArray(p.a)||!Array.isArray(p.b)||depth>4)return {lines:[],complete:false};
  const ordered=orderedRelationPath(p.a,p.b,p.path);
  if(ordered.length){let lines=[],complete=true;for(const edge of ordered){const detail=edgeProofLines(edge,loc,depth+1);lines.push(...detail.lines);complete=complete&&detail.complete}if(ordered.length>1)lines.push(loc==='fr'?`En combinant ces relations, ${humanCell(p.a)} et ${humanCell(p.b)} sont ${relationWord(p.parity,loc)}.`:`Combining these relations, ${humanCell(p.a)} and ${humanCell(p.b)} are ${relationWord(p.parity,loc)}.`);return {lines,complete}}
  if(p.explicit===true)return {lines:[loc==='fr'?`L’indice visible ${relationStatement(p.a,p.b,p.parity,loc)}`:`Visible clue: ${relationStatement(p.a,p.b,p.parity,loc)}`],complete:true};
  return {lines:[unsupportedRelationLine(p.a,p.b,loc)],complete:false}
}
function supportRelationLines(support,edge,loc=locale(),depth=0){
  if(!support||depth>4)return {lines:[unsupportedRelationLine(edge.from,edge.to,loc)],complete:false};
  const x=support.explanationData||{},rule=String(support.rule||''),conclusion=(support.conclusions||[]).find(c=>c?.type==='RELATION'&&((sameCell(c.a,edge.from)&&sameCell(c.b,edge.to))||(sameCell(c.a,edge.to)&&sameCell(c.b,edge.from))))||(support.conclusions||[]).find(c=>c?.type==='RELATION');
  if(rule==='TRIPLE_CONSTRAINT'&&x.mode==='RELATION'){
    const lines=[];let complete=true,rel=relationPremise(support);if(rel){const proof=premiseRelationLines(rel,loc,depth+1);lines.push(...proof.lines);complete=complete&&proof.complete}
    const window=Array.isArray(x.window)?x.window:[],pair=Array.isArray(x.pair)?x.pair:[],target=x.target;
    if(pair.length>=2&&Array.isArray(target))lines.push(loc==='fr'?`Dans les trois cases ${window.length?window.map(humanCell).join('–'):`${humanCell(pair[0])}–${humanCell(pair[1])}–${humanCell(target)}`}, ${humanCell(pair[0])} et ${humanCell(pair[1])} ont le même symbole. La règle des trois interdit que ${humanCell(target)} ait encore ce symbole ; ${humanCell(target)} doit donc être opposée à ces deux cases.`:`In the three cells ${window.length?window.map(humanCell).join('–'):`${humanCell(pair[0])}–${humanCell(pair[1])}–${humanCell(target)}`}, ${humanCell(pair[0])} and ${humanCell(pair[1])} have the same symbol. The no-three rule forces ${humanCell(target)} to be opposite.`);
    else if(conclusion)lines.push(relationStatement(conclusion.a,conclusion.b,conclusion.parity,loc));else complete=false;
    return {lines,complete}
  }
  if(rule==='BALANCE_RELATION'){
    const remaining=Array.isArray(x.remaining)?x.remaining:[],unit=unitName(x.family,x.id,loc);if(remaining.length===2)return {lines:[loc==='fr'?`Dans ${unit}, il reste exactement ${humanCell(remaining[0])} et ${humanCell(remaining[1])} à remplir. L’équilibre exige encore un soleil et une lune : ces deux cases sont donc opposées.`:`In ${unit}, only ${humanCell(remaining[0])} and ${humanCell(remaining[1])} remain. Balance requires one sun and one moon, so the two cells are opposite.`],complete:true}
  }
  if(rule==='LINE_DOMAIN_SUPPORT'&&conclusion){
    const unit=unitName(x.family,x.id,loc),count=Number(x.domainCount),known=(support.premises||[]).filter(p=>p?.kind==='RELATION'&&p.explicit!==true);let lines=[],complete=true;
    for(const p of known){const proof=premiseRelationLines(p,loc,depth+1);lines.push(...proof.lines);complete=complete&&proof.complete}
    lines.push(loc==='fr'?`Dans ${unit}, ${Number.isFinite(count)&&count>0?`${count} complétion${count===1?'':'s'}`:'les complétions restantes'} respectent l’équilibre, la règle des trois et les indices visibles. Dans chacune, ${humanCell(conclusion.a)} et ${humanCell(conclusion.b)} sont ${relationWord(conclusion.parity,loc)} ; cette relation est donc forcée.`:`In ${unit}, ${Number.isFinite(count)&&count>0?`${count} remaining completion${count===1?'':'s'}`:'the remaining completions'} satisfy balance, the no-three rule and visible clues. In all of them, ${humanCell(conclusion.a)} and ${humanCell(conclusion.b)} are ${relationWord(conclusion.parity,loc)}, so the relation is forced.`);return {lines,complete}
  }
  return {lines:[unsupportedRelationLine(edge.from,edge.to,loc)],complete:false}
}
function edgeProofLines(edge,loc=locale(),depth=0){
  if(edge.explicit===true)return {lines:[loc==='fr'?`L’indice visible ${relationStatement(edge.from,edge.to,edge.parity,loc)}`:`Visible clue: ${relationStatement(edge.from,edge.to,edge.parity,loc)}`],complete:true};
  if(edge.support)return supportRelationLines(edge.support,edge,loc,depth+1);
  return {lines:[unsupportedRelationLine(edge.from,edge.to,loc)],complete:false}
}
function relationExplanation(d,loc=locale()){
  if(String(d?.rule||'')!=='RELATION_PROPAGATION')return null;
  const x=d?.explanationData||{},source=x.source,target=x.target||valueConclusions(d)[0]?.cell,conclusion=valueConclusions(d)[0],rel=relationPremise(d);
  if(!Array.isArray(source)||!Array.isArray(target)||!conclusion||!rel)return null;
  const sourceName=humanCell(source),targetName=humanCell(target),sourceValue=Number(x.sourceValue),targetValue=Number(conclusion.value),ordered=orderedRelationPath(source,target,rel.path),hypothesis=!!valuePremise(d,source)?.hypothesis,parity=Number(x.parity)||0;
  const whereCells=ordered.length?relationPathCells(source,target,rel.path):[source,target],where=loc==='fr'?`Vérifie ${whereCells.map(humanCell).join(' → ')}.`:`Check ${whereCells.map(humanCell).join(' → ')}.`;
  let rawSteps=[],complete=true;
  if(ordered.length){for(const edge of ordered){const proof=edgeProofLines(edge,loc,0);rawSteps.push(...proof.lines);complete=complete&&proof.complete}if(ordered.length>1)rawSteps.push(loc==='fr'?`En combinant ces relations, ${sourceName} et ${targetName} sont ${relationWord(parity,loc)}.`:`Combining these relations, ${sourceName} and ${targetName} are ${relationWord(parity,loc)}.`)}
  else if(rel.explicit===true)rawSteps.push(loc==='fr'?`L’indice visible ${relationStatement(source,target,parity,loc)}`:`Visible clue: ${relationStatement(source,target,parity,loc)}`);
  else{rawSteps.push(unsupportedRelationLine(source,target,loc));complete=false}
  if(complete){rawSteps.push(loc==='fr'?`${hypothesis?'Sous l’hypothèse, ':''}${sourceName} = ${humanPiece(sourceValue,loc)}.`:`${hypothesis?'Under the assumption, ':''}${sourceName} = ${humanPiece(sourceValue,loc)}.`);rawSteps.push(loc==='fr'?`Comme ${sourceName} et ${targetName} sont ${relationWord(parity,loc)}, ${targetName} = ${humanPiece(targetValue,loc)}.`:`Because ${sourceName} and ${targetName} are ${relationWord(parity,loc)}, ${targetName} = ${humanPiece(targetValue,loc)}.`)}
  const steps=rawSteps.map((step,index)=>`${index+1}. ${step}`),conclusionText=complete?(loc==='fr'?`Conclusion intermédiaire : ${targetName} = ${humanPiece(targetValue,loc)}.`:`Intermediate conclusion: ${targetName} = ${humanPiece(targetValue,loc)}.`):(loc==='fr'?`Étape non démontrée : la provenance locale de la relation est manquante.`:`Unproved step: local relation provenance is missing.`);
  return {where,steps,conclusion:conclusionText,direct:ordered.length<=1,source:source.slice(),target:target.slice(),value:targetValue,complete}
}
function relationFocusCells(d){
  const detail=relationExplanation(d,locale());if(!detail)return [];
  const rel=relationPremise(d),path=orderedRelationPath(detail.source,detail.target,rel?.path);return path.length?relationPathCells(detail.source,detail.target,rel.path):[detail.source.slice(),detail.target.slice()]
}
function alignRelationFocus(board,entry){
  if(stageKind(entry)!=='reasoning')return false;
  const d=deduction(entry),cells=relationFocusCells(d);if(!cells.length)return false;
  const conclusions=valueConclusions(d),isConclusion=cell=>conclusions.some(c=>sameCell(c.cell,cell));board.querySelectorAll?.('.walkthrough-current-focus').forEach(el=>el.classList.remove('walkthrough-current-focus'));
  let changed=false;for(const [r,c] of cells){if(isConclusion([r,c]))continue;const el=board.querySelector?.(`[data-r="${Number(r)}"][data-c="${Number(c)}"]`);if(el){el.classList.add('walkthrough-current-focus');changed=true}}return changed
}
function clearConclusion(board){if(!board?.querySelectorAll)return;board.querySelectorAll(`.${CONCLUSION_CLASS}`).forEach(el=>el.classList.remove(CONCLUSION_CLASS));board.querySelectorAll(`.${CONCLUSION_BADGE_CLASS}`).forEach(el=>el.remove())}
function decorateConclusion(board,entry){
  clearConclusion(board);if(stageKind(entry)!=='reasoning')return false;
  const doc=root.document,conclusions=valueConclusions(deduction(entry));let changed=false;for(const conclusion of conclusions){const [r,c]=conclusion.cell,cell=board.querySelector?.(`[data-r="${Number(r)}"][data-c="${Number(c)}"]`);if(!cell)continue;cell.classList.add(CONCLUSION_CLASS);if(!cell.querySelector(`:scope > .${CONCLUSION_BADGE_CLASS}`)){const badge=doc.createElement('span');badge.className=CONCLUSION_BADGE_CLASS;badge.setAttribute('aria-hidden','true');badge.textContent='⇒';cell.appendChild(badge)}changed=true}return changed
}
function applyExplanation(presentation,d,loc=locale()){
  const detail=relationExplanation(d,loc);if(!detail||!presentation?.explanation)return presentation;
  const next=copy(presentation);next.explanation.where=detail.where;next.explanation.why=`${detail.steps.join(' ')} ${detail.conclusion}`;next.metadata={...(next.metadata||{}),localSelfContained:detail.complete,localProvenanceComplete:detail.complete};return next
}
function installPresenter(){
  let current;try{current=tangoReasoningPresenter}catch(_){return false}if(typeof current!=='function')return false;if(current.__quadludLocalSelfContained===true)return true;
  const previous=current,wrapped=function(...args){const base=previous(...args);if(!base||typeof base.presentation!=='function')return base;const originalPresentation=base.presentation.bind(base),next={...base,presentation(d){return applyExplanation(originalPresentation(d),d,locale())}};return Object.freeze(next)};
  wrapped.__quadludLocalSelfContained=true;wrapped.__quadludPrevious=previous;try{tangoReasoningPresenter=wrapped;return true}catch(_){return false}
}
function decorateExplanation(entry){
  const doc=root.document,panel=doc?.querySelector?.('.walkthrough-explanation');if(!panel)return false;
  const paragraphs=[...panel.querySelectorAll('p')],whereP=paragraphs[0],whyP=paragraphs[1],kind=stageKind(entry),loc=locale();if(kind==='reasoning'&&whyP){const heading=whyP.querySelector('b');if(heading)heading.textContent=loc==='fr'?'Raisonnement :':'Reasoning:'}
  const detail=kind==='reasoning'?relationExplanation(deduction(entry),loc):null;if(!detail)return kind==='reasoning';if(whereP)whereP.innerHTML=`<b>${loc==='fr'?'Où regarder':'Where to look'} :</b> ${escapeHtml(detail.where)}`;if(whyP){const reasoningLabel=loc==='fr'?'Raisonnement :':'Reasoning:',stepHtml=detail.steps.map(step=>`<span class="reason-step">${escapeHtml(step)}</span>`).join('');whyP.innerHTML=`<b>${reasoningLabel}</b><br>${stepHtml}<span class="reason-step conclusion"><b>${escapeHtml(detail.conclusion)}</b></span>`}return true
}
function decorate(){
  const s=session(),g=group(),entry=currentEntry(g),doc=root.document,board=doc?.querySelector?.('.walkthrough-board');if(!s||s.base?.game!=='tango'||!g||!entry||!board)return false;
  const f=alignRelationFocus(board,entry),a=decorateConclusion(board,entry),b=decorateExplanation(entry);board.dataset.pedagogyConclusionLayer=stageKind(entry)==='reasoning'?'intermediate':'none';return f||a||b
}
function installRender(){
  if(typeof renderWalkthrough!=='function'||renderWalkthrough.__quadludTangoTutorClarity===true)return false;if(renderWalkthrough.__quadludContradictionVisuals!==true||renderWalkthrough.__quadludHumanProgressiveV4!==true)return false;
  const previous=renderWalkthrough,wrapped=function(options={}){const result=previous(options);decorate();return result};wrapped.__quadludTangoTutorClarity=true;wrapped.__quadludContradictionVisuals=true;wrapped.__quadludHumanProgressiveV4=true;wrapped.__quadludPrevious=previous;renderWalkthrough=wrapped;return true
}
function install(){const presenterOk=installPresenter(),renderOk=installRender();return presenterOk&&renderOk}
function scheduleInstall(){
  installStyles();let tries=240,timer=null;const retry=()=>{installStyles();const presenterOk=installPresenter(),renderOk=installRender();if(presenterOk&&renderOk){if(timer!=null)clearTimeout(timer);return true}if(tries--<=0)return false;timer=setTimeout(retry,10);return true};retry();if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});return true
}
return Object.freeze({VERSION,install,installStyles,installPresenter,installRender,scheduleInstall,decorate,_test:Object.freeze({sameCell,currentEntry,stageKind,deduction,valueConclusions,relationPremise,valuePremise,humanCell,humanPiece,unitName,relationWord,relationStatement,orderedRelationPath,relationPathCells,premiseRelationLines,supportRelationLines,edgeProofLines,relationExplanation,relationFocusCells,alignRelationFocus,applyExplanation,escapeHtml})})
});