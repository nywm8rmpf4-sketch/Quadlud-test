/*
 * QUADLUD — Soleil/Lune human-first pedagogy orchestration
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const isNode=typeof module!=='undefined'&&module.exports;
  const Base=isNode?require('./tango-played-move-runtime.js'):root.QuadludTangoPlayedMoveRuntime;
  const Planner=isNode?require('./tango-played-move-planner.js'):root.QuadludTangoPlayedMovePlanner;
  const api=factory(root,Base,Planner);
  if(isNode)module.exports=api;
  if(root){root.QuadludTangoHumanPedagogyR4=api;if(!isNode)api.installEarly()}
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Base,Planner){
'use strict';

if(!Base)throw new Error('QuadludTangoPlayedMoveRuntime is required');
const VERSION=2;
const POLICY='tango-human-proof-minimal-v4';
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const sameCell=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length>=2&&b.length>=2&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const moveKey=p=>Array.isArray(p?.target)?`${Number(p.target[0])},${Number(p.target[1])}:${Number(p.value)}`:'';
const planStableKey=p=>`${String(p?.target?.[0]??999).padStart(3,'0')}:${String(p?.target?.[1]??999).padStart(3,'0')}:${Number(p?.value)}|${String(p?.deduction?.signature||p?.deduction?.id||p?.deduction?.rule||'')}`;
function planner(){const p=Planner||root.QuadludTangoPlayedMovePlanner;if(!p||typeof p.nextPlayedMove!=='function')throw new Error('Soleil/Lune played-move planner unavailable');return p}
function compareVector(a,b){return Base._test?.compareCostVector?Base._test.compareCostVector(a,b):(()=>{for(let i=0;i<Math.max(a?.length||0,b?.length||0);i++){const x=Number(a?.[i])||0,y=Number(b?.[i])||0;if(x!==y)return x-y}return 0})()}
function playableDirectPlans(session,diff,options={}){
  const P=planner(),T=P._test;if(!T?.allowedDirectDeductions||!T?.evaluateStartingDeductions||!T?.buildSelectorCandidates)return null;
  const tierIndex=P.tierIndexForDifficulty(diff),direct=T.allowedDirectDeductions(session,tierIndex),evaluation=T.evaluateStartingDeductions(session,tierIndex,direct,options,false),frontierComplete=!evaluation.truncated&&!evaluation.branchBudgetHit;
  const candidates=T.buildSelectorCandidates(evaluation.plans||[]).filter(c=>c?.plan?.status==='move'&&Array.isArray(c.plan.target)&&!(c.blockedBy||[]).length);
  return {tierIndex,direct,evaluation,frontierComplete,candidates,plans:candidates.map(c=>c.plan)}
}
function evaluatePlanHumanProof(session,plan){
  const displayProof=Base.selectDisplayProof(session,plan),cost=Array.isArray(displayProof?.costVector)?displayProof.costVector.slice():[999,999,999,999,999,999];
  const plannerCost=planner()._test?.planCostVector?planner()._test.planCostVector(plan):[];
  return {plan,displayProof,cost,plannerCost,stableKey:planStableKey(plan)}
}
function compareHumanCandidate(a,b){return compareVector(a.cost,b.cost)||compareVector(a.plannerCost,b.plannerCost)||a.stableKey.localeCompare(b.stableKey)}
function chooseGloballySimplestPlan(session,diff,options={}){
  const frontier=playableDirectPlans(session,diff,options);
  if(!frontier||!frontier.frontierComplete||!frontier.plans.length)return Base.planHumanMove(session,diff);
  const bestByMove=new Map();
  for(const plan of frontier.plans){
    const scored=evaluatePlanHumanProof(session,plan),key=moveKey(plan),previous=bestByMove.get(key);
    if(!previous||compareHumanCandidate(scored,previous)<0)bestByMove.set(key,scored)
  }
  const ranked=[...bestByMove.values()].sort(compareHumanCandidate),chosen=ranked[0];
  if(!chosen)return Base.planHumanMove(session,diff);
  const plan=copy(chosen.plan),proof=copy(chosen.displayProof),displayDeduction=proof?.deduction||Base._test?.minimalDisplayDeduction?.(plan.deduction)||copy(plan.deduction);
  if(!displayDeduction)return Base.planHumanMove(session,diff);
  return {...plan,displayProof:proof,displayDeduction,selectionStatus:'human-proof-global-minimum',selectedCostVector:chosen.plannerCost.slice(),candidateCount:ranked.length,frontierComplete:true,budgetHit:false,humanGlobalSelection:true,humanCandidateCount:ranked.length,humanSignature:`${plan.target.join(',')}:${plan.value}|${plan.startingDeduction?.signature||plan.deduction?.signature||plan.deduction?.id||''}|${proof?.kind||'engine-proof'}|global`}
}

function locale(){try{return String(typeof lang==='function'?lang():'en').toLowerCase().split('-')[0]}catch(_){return'en'}}
function humanCell(cell){if(!Array.isArray(cell))return'';return `${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`}
function humanPiece(value){const fr=locale()==='fr';return Number(value)===1?(fr?'soleil ☀':'sun ☀'):(fr?'lune ☾':'moon ☾')}
function manualPresentation(base,{title=null,where='',why='',move='',showTutorMove=false}={}){const p=copy(base)||{};p.explanation={...(p.explanation||{}),title:title??p.explanation?.title??'',where,why,move};p.metadata={...(p.metadata||{}),showTutorMove};return p}
function stageFocusDeduction(parent,{kind,focusCells=[],focusUnits=[],premises=[],conclusions=[],explanationData={}}={}){return {schema:1,id:`pedagogy-${kind}-${parent?.id||parent?.signature||parent?.rule||'step'}`,signature:`PEDAGOGY_${String(kind||'step').toUpperCase()}|${parent?.signature||parent?.id||parent?.rule||''}`,rule:parent?.rule,rank:parent?.rank,techniqueLevel:parent?.techniqueLevel,priority:parent?.priority,clarity:parent?.clarity,premises:copy(premises),dependencies:[],focusCells:copy(focusCells),focusRelations:[],focusUnits:copy(focusUnits),conclusions:copy(conclusions),explanationData:copy(explanationData)}}
function traceForAdvanced(d){const x=d?.explanationData||{};if(d?.rule==='ASSUMPTION_CONTRADICTION')return Array.isArray(x.causalTrace)?x.causalTrace:(x.trace||[]);if(d?.rule==='COMMON_CONSEQUENCE')return [...(x.moonCausalTrace||x.moonTrace||[]),...(x.sunCausalTrace||x.sunTrace||[])];return[]}
function proofStagesForDeduction(d,presenter){
  const top=presenter.presentation(d),x=d?.explanationData||{},fr=locale()==='fr',stages=[];
  if(d?.rule==='ASSUMPTION_CONTRADICTION'&&x.assumption?.cell){
    const assumption=x.assumption,cell=humanCell(assumption.cell),value=humanPiece(assumption.value),focus=stageFocusDeduction(d,{kind:'hypothesis',focusCells:[assumption.cell],premises:[{kind:'ASSUMPTION',cell:copy(assumption.cell),value:assumption.value,hypothesis:true}],explanationData:{assumption:copy(assumption)}});
    stages.push({kind:'hypothesis',deduction:focus,presentation:manualPresentation(top,{where:fr?`Regarde ${cell}.`:`Look at ${cell}.`,why:fr?`Hypothèse : ${cell} = ${value}.`:`Assumption: ${cell} = ${value}.`})});
    for(const raw of traceForAdvanced(d)){const step=Base._test?.minimalDisplayDeduction?.(raw)||copy(raw),p=presenter.presentation(step);stages.push({kind:'reasoning',deduction:step,presentation:manualPresentation(p,{where:p.explanation?.where||'',why:p.explanation?.why||'',move:''})})}
    const w=x.witness||{},wCells=[...(w.cells||[]),...(w.block||[])],wUnits=w.family!=null&&w.id!=null?[{family:w.family,id:w.id}]:[],wFocus=stageFocusDeduction(d,{kind:'contradiction',focusCells:wCells,focusUnits:wUnits,explanationData:{witness:copy(w)}}),reason=presenter.contradictionText?.(w)||'';
    stages.push({kind:'contradiction',deduction:wFocus,presentation:manualPresentation(top,{where:fr?'Regarde maintenant l’impasse obtenue.':'Now look at the dead end.',why:fr?`Impasse : ${reason}`:`Dead end: ${reason}`})});
    const conclusion=presenter.conclusionText(d),aFocus=stageFocusDeduction(d,{kind:'action',conclusions:d.conclusions||[]});
    stages.push({kind:'action',deduction:aFocus,presentation:manualPresentation(top,{where:fr?'Reviens à l’hypothèse de départ.':'Return to the starting assumption.',why:fr?`L’hypothèse est impossible. Donc ${conclusion}.`:`The assumption is impossible. Therefore ${conclusion}.`,move:conclusion,showTutorMove:true})});
    return stages
  }
  if(d?.rule==='COMMON_CONSEQUENCE'&&x.branchCell){
    const branchCell=humanCell(x.branchCell),groups=[{label:humanPiece(0),steps:x.moonCausalTrace||x.moonTrace||[]},{label:humanPiece(1),steps:x.sunCausalTrace||x.sunTrace||[]}];
    for(const group of groups){const focus=stageFocusDeduction(d,{kind:'hypothesis',focusCells:[x.branchCell],premises:[{kind:'ASSUMPTION',cell:copy(x.branchCell),value:group.label===humanPiece(1)?1:0,hypothesis:true}]});stages.push({kind:'hypothesis',deduction:focus,presentation:manualPresentation(top,{where:fr?`Regarde ${branchCell}.`:`Look at ${branchCell}.`,why:fr?`Premier cas : ${branchCell} = ${group.label}.`:`Case: ${branchCell} = ${group.label}.`})});for(const raw of group.steps){const step=Base._test?.minimalDisplayDeduction?.(raw)||copy(raw),p=presenter.presentation(step);stages.push({kind:'reasoning',deduction:step,presentation:manualPresentation(p,{where:p.explanation?.where||'',why:p.explanation?.why||'',move:''})})}}
    const conclusion=presenter.conclusionText(d),aFocus=stageFocusDeduction(d,{kind:'action',conclusions:d.conclusions||[]});stages.push({kind:'action',deduction:aFocus,presentation:manualPresentation(top,{where:fr?'Compare les deux cas.':'Compare both cases.',why:fr?`La même conclusion apparaît dans les deux cas : ${conclusion}.`:`The same conclusion appears in both cases: ${conclusion}.`,move:conclusion,showTutorMove:true})});return stages
  }
  return [{kind:'action',deduction:Base._test?.minimalDisplayDeduction?.(d)||copy(d),presentation:manualPresentation(top,{where:top.explanation?.where||'',why:top.explanation?.why||'',move:top.explanation?.move||presenter.conclusionText(d),showTutorMove:true})}]
}

function valuePremises(d){return (d?.premises||[]).filter(p=>p?.kind==='VALUE'&&Array.isArray(p.cell)&&(Number(p.value)===0||Number(p.value)===1))}
function relationPremises(d){return (d?.premises||[]).filter(p=>p?.kind==='RELATION'||(Array.isArray(p?.a)&&Array.isArray(p?.b)))}
function unitName(d,trFn){const ref=d?.focusUnits?.[0]||(d?.explanationData?.family!=null?{family:d.explanationData.family,id:d.explanationData.id}:null);if(!ref)return'';const label=trFn?.(ref.family==='row'?'rowLabel':'columnLabel')||(ref.family==='row'?'row':'column');return `${label} ${ref.family==='row'?String.fromCharCode(65+Number(ref.id)):Number(ref.id)+1}`}
function witnessUnitName(w,h,fr){if(w?.family==null||w?.id==null)return'';const key=w.family==='row'?'rowLabel':'columnLabel',fallback=w.family==='row'?(fr?'ligne':'row'):(fr?'colonne':'column'),label=h?.tr?.(key)||fallback;return `${label} ${w.family==='row'?String.fromCharCode(65+Number(w.id)):Number(w.id)+1}`}
function relationParity(p){if(Number(p?.parity)===0||String(p?.relation||'').toUpperCase()==='SAME'||String(p?.relation||'')==='=')return 0;return 1}
function concreteExplanation(p,d,h){
  const L=String(h?.lang?.()||'en').toLowerCase().split('-')[0],fr=L==='fr';if(!(fr||L==='en'))return p.explanation(d);
  const cell=h?.cellName||((r,c)=>humanCell([r,c])),piece=v=>typeof h?.pieceName==='function'?h.pieceName('tango',Number(v)):humanPiece(v),conclusion=p.conclusionText(d),unit=unitName(d,h?.tr),values=valuePremises(d),relations=relationPremises(d);
  const target=(d?.conclusions||[]).find(c=>c?.type==='VALUE'&&Array.isArray(c.cell));
  if(d?.rule==='TRIPLE_CONSTRAINT'&&target){const pair=values.filter(v=>!sameCell(v.cell,target.cell)&&Number(v.value)!==Number(target.value)).length>=2?values.filter(v=>!sameCell(v.cell,target.cell)&&Number(v.value)!==Number(target.value)).slice(0,2):values.filter(v=>!sameCell(v.cell,target.cell)).slice(0,2);if(pair.length>=2){const v=Number(pair[0].value),a=cell(...pair[0].cell),b=cell(...pair[1].cell),t=cell(...target.cell);return fr?`${a} et ${b} contiennent déjà ${piece(v)}. Si ${t} contenait aussi ${piece(v)}, ces trois cases formeraient trois ${piece(v)} consécutifs, ce qui est interdit. Donc ${t} = ${piece(target.value)}.`:`${a} and ${b} already contain ${piece(v)}. If ${t} also contained ${piece(v)}, the three cells would make three consecutive ${piece(v)}, which is forbidden. Therefore ${t} = ${piece(target.value)}.`}}
  if(d?.rule==='BALANCE_QUOTA'){const suns=values.filter(v=>Number(v.value)===1).length,moons=values.filter(v=>Number(v.value)===0).length,targets=(d?.conclusions||[]).filter(c=>c?.type==='VALUE').map(c=>cell(...c.cell)).join(', ');return fr?`${unit} doit contenir autant de Soleils que de Lunes. Les valeurs déjà fixées donnent ${suns} Soleil${suns>1?'s':''} et ${moons} Lune${moons>1?'s':''}. Les cases ${targets||'restantes'} sont donc imposées : ${conclusion}.`:`${unit} must contain the same number of suns and moons. The fixed values give ${suns} sun${suns===1?'':'s'} and ${moons} moon${moons===1?'':'s'}. The remaining cells ${targets||''} are therefore forced: ${conclusion}.`}
  if(d?.rule==='BALANCE_RELATION'){const rel=(d?.conclusions||[]).find(c=>c?.type==='RELATION')||relations[0],a=rel?.a?cell(...rel.a):'',b=rel?.b?cell(...rel.b):'';if(a&&b)return fr?`Il ne reste que ${a} et ${b} à déterminer dans ${unit}. Pour garder autant de Soleils que de Lunes, il faut un Soleil et une Lune : ${a} et ${b} doivent donc être opposées.`:`Only ${a} and ${b} remain unresolved in ${unit}. To keep the row or column balanced, one must be a sun and the other a moon, so ${a} and ${b} must be opposite.`}
  if(d?.rule==='RELATION_BALANCE'&&relations.length){
    const rel=relations[0],a=cell(...rel.a),b=cell(...rel.b),parity=relationParity(rel),symbol=parity===0?'=':'×',outValues=(d?.conclusions||[]).filter(c=>c?.type==='VALUE'),witness=d?.explanationData?.rejected||null,wUnit=witnessUnitName(witness,h,fr)||unit;
    if(parity===0&&outValues.length>=2&&outValues.every(c=>Number(c.value)===Number(outValues[0].value))){
      const forced=Number(outValues[0].value),rejected=1-forced;
      if(witness?.kind==='TRIPLE_OVERFLOW'&&Number(witness.value)===rejected&&Array.isArray(witness.cells)&&witness.cells.length>=3){
        const witnessNames=witness.cells.map(c=>cell(...c)),known=witness.cells.filter(c=>!sameCell(c,rel.a)&&!sameCell(c,rel.b)).map(c=>cell(...c)),knownText=known.length?(fr?`${known.join(' et ')} ${known.length===1?'contient déjà':'contiennent déjà'} ${piece(rejected)}. `:`${known.join(' and ')} ${known.length===1?'already contains':'already contain'} ${piece(rejected)}. `):'';
        return fr?`L’indice visible ${a} ${symbol} ${b} impose que ${a} et ${b} aient le même symbole. ${knownText}Si ${a} et ${b} étaient aussi ${piece(rejected)}, ${witnessNames.join('–')} formeraient trois ${piece(rejected)} consécutifs${wUnit?` dans ${wUnit}`:''}, ce qui est interdit. Donc ${conclusion}.`:`The visible clue ${a} ${symbol} ${b} requires ${a} and ${b} to have the same symbol. ${knownText}If ${a} and ${b} were also ${piece(rejected)}, ${witnessNames.join('–')} would make three consecutive ${piece(rejected)}${wUnit?` in ${wUnit}`:''}, which is forbidden. Therefore ${conclusion}.`
      }
      const knownRejected=values.filter(v=>Number(v.value)===rejected);if(knownRejected.length>=2){const known=knownRejected.map(v=>cell(...v.cell)).join(fr?' et ':' and ');return fr?`${known} contiennent déjà ${piece(rejected)}${wUnit?` dans ${wUnit}`:''}. La relation ${symbol} impose que ${a} et ${b} soient identiques. Si elles étaient aussi ${piece(rejected)}, il y en aurait trop pour l’équilibre. Donc ${a} et ${b} = ${piece(forced)}.`:`${known} already contain ${piece(rejected)}${wUnit?` in ${wUnit}`:''}. The ${symbol} relation requires ${a} and ${b} to be identical. If they were also ${piece(rejected)}, the balance quota would be exceeded. Therefore ${a} and ${b} = ${piece(forced)}.`}
    }
    return fr?`${wUnit?`Dans ${wUnit}, `:''}l’indice ${a} ${symbol} ${b} relie ${a} et ${b}. Une seule orientation de cette relation respecte toutes les règles visibles de la grille. Donc ${conclusion}.`:`${wUnit?`In ${wUnit}, `:''}the ${a} ${symbol} ${b} clue links ${a} and ${b}. Only one orientation of this relation satisfies all visible grid rules. Therefore ${conclusion}.`
  }
  if(d?.rule==='RELATION_PROPAGATION')return p.explanation(d);
  return p.explanation(d)
}
function installPresenter(){
  const source=root.QuadludTangoReasoningPresenter;if(!source||typeof source.createPresenter!=='function'||source.__quadludHumanConcreteV4)return false;const previousCreate=source.createPresenter;
  const replacement={...source,createPresenter(h){const p=previousCreate(h),oldContradictionText=p.contradictionText;const contradictionText=w=>{const L=String(h?.lang?.()||'en').toLowerCase().split('-')[0],fr=L==='fr',piece=v=>typeof h?.pieceName==='function'?h.pieceName('tango',Number(v)):humanPiece(v),unit=w?.family!=null?`${h?.tr?.(w.family==='row'?'rowLabel':'columnLabel')||w.family} ${w.family==='row'?String.fromCharCode(65+Number(w.id)):Number(w.id)+1}`:'';if(w?.kind==='BALANCE_OVERFLOW'&&(Number(w?.value)===0||Number(w?.value)===1)){const count=Number(w?.count),quota=Number(w?.quota)||3,detail=Number.isFinite(count)?`${count} ${piece(w.value)}`:`${piece(w.value)}`;return fr?`${unit?unit+' : ':''}${detail}, maximum ${quota}.`:`${unit?unit+' : ':''}${detail}, maximum ${quota}.`}return oldContradictionText(w)};const explanation=d=>concreteExplanation(p,d,h);const advancedExplanation=d=>{if(d?.rule==='ASSUMPTION_CONTRADICTION'||d?.rule==='COMMON_CONSEQUENCE')return explanation(d);return p.advancedExplanation(d,p.advancedProofGroups(d))};const presentation=(d,automatic=[])=>{const q=copy(p.presentation(d,automatic)),why=(d?.rule==='ASSUMPTION_CONTRADICTION'||d?.rule==='COMMON_CONSEQUENCE')?explanation(d):concreteExplanation(p,d,h);if(q?.explanation)q.explanation.why=why;return q};return Object.freeze({...p,contradictionText,explanation,advancedExplanation,presentation})},__quadludHumanConcreteV4:true};root.QuadludTangoReasoningPresenter=Object.freeze(replacement);return true
}

function walkthroughGenerateHumanNext(){
  let s;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null}catch(_){s=null}if(!s||s.base?.game!=='tango'||s.done||s.stalled)return false;if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length;return false}
  const P=planner(),publicPuzzle={n:s.work?.n||s.base?.n||6,state:copy(s.work?.state),edges:copy(s.work?.edges||s.base?.edges||[])};let engine,plan;try{engine=P.sessionFromPublicBoard(publicPuzzle,s.work.state);plan=chooseGloballySimplestPlan(engine,s.base.diff)}catch(error){s.stalled=true;s.tangoTutorStatus='planner-error';s.logicContradiction={message:String(error?.message||error)};return false}
  if(plan?.status==='solved'){s.done=true;s.total=s.moves.length;s.tangoTutorStatus='solved';return false}if(plan?.status!=='move'||!Array.isArray(plan.target)){s.stalled=true;s.tangoTutorStatus=`planner-${plan?.status||'invalid'}`;if(plan?.contradiction)s.logicContradiction=copy(plan.contradiction);return false}
  const [r,c]=plan.target,value=plan.value;if(!Number.isInteger(r)||!Number.isInteger(c)||(value!==0&&value!==1)||s.work?.state?.[r]?.[c]!==-1){s.stalled=true;s.tangoTutorStatus='planner-invalid-move';return false}
  const beforeSnapshot=walkthroughSnapshot(s.work),presenter=tangoReasoningPresenter(),d=plan.displayDeduction||plan.deduction,stages=proofStagesForDeduction(d,presenter);s.work.state[r][c]=value;s.work.tangoDerivedRelations=[];s.tangoLogic=null;const finalSnapshot=walkthroughSnapshot(s.work);if(!stages.length){s.stalled=true;s.tangoTutorStatus='planner-empty-proof';s.work.state=copy(beforeSnapshot.state);return false}
  stages.forEach((stage,index)=>{const last=index===stages.length-1,reasoning=presenter.legacyReasoning(stage.deduction),presentation=stage.presentation,info={rule:presentation.rule||d.rule,technique:presentation.technique,rank:presentation.rank??d.rank,techniqueLevel:presentation.techniqueLevel??d.techniqueLevel,target:[r,c],presentation,deduction:reasoning,where:presentation.explanation?.where||'',why:presentation.explanation?.why||'',move:last?(presentation.explanation?.move||presenter.conclusionText(d)):'',automatic:[],pedagogyStageKind:stage.kind,metrics:{plannerStatus:'move',selectionStatus:plan.selectionStatus||null,candidateCount:Number(plan.candidateCount)||0,humanCandidateCount:Number(plan.humanCandidateCount)||0,humanGlobalSelection:!!plan.humanGlobalSelection,frontierComplete:plan.frontierComplete!==false,humanProofPolicy:POLICY,humanProofKind:plan.displayProof?.kind||'engine-proof',humanProofCostVector:Array.isArray(plan.displayProof?.costVector)?plan.displayProof.costVector.slice():null,humanProofTraceCollapsed:!!plan.displayProof?.traceCollapsed},beforeSnapshot:copy(beforeSnapshot)};info.snapshot=copy(last?finalSnapshot:beforeSnapshot);s.moves.push(info)});s.tangoTutorStatus='human-progressive-move';s.tangoTutorSelectionStatus=plan.selectionStatus||null;if(typeof walkthroughComplete==='function'&&walkthroughComplete()){s.done=true;s.total=s.moves.length}return true
}

function coordSet(entry){const nav=root.QuadludTutorActionFirstNavigation?._test,out=new Set();if(!nav?.entryReasoningCoords)return out;for(const key of nav.entryReasoningCoords(entry)||[])out.add(String(key));return out}
function applyCoord(board,key,classes){const [r,c]=String(key).split(',').map(Number),el=board?.querySelector?.(`[data-r="${r}"][data-c="${c}"]`);if(el)el.classList.add(...classes)}
function unitCells(unit,base){const n=Number(base?.n)||6,out=[];if(unit?.family==='row')for(let c=0;c<n;c++)out.push([Number(unit.id),c]);else if(unit?.family==='column')for(let r=0;r<n;r++)out.push([r,Number(unit.id)]);return out}
function decorateProgressiveProof(){
  let s,group;try{s=typeof walkthroughSession!=='undefined'?walkthroughSession:null;group=typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null}catch(_){return false}const board=root.document?.querySelector?.('.walkthrough-board'),panel=root.document?.querySelector?.('.walkthrough-panel'),navApi=root.QuadludTutorActionFirstNavigation;if(!s||!group||!board||!navApi?._test)return false;
  const index=Math.max(0,Math.min(group.entries.length-1,Number(s.navigation?.proofStepIndex)||0)),current=group.entries[index],past=group.entries.slice(0,index),test=navApi._test;
  panel?.querySelectorAll?.('.walkthrough-reasoning-context,.walkthrough-current-focus,.walkthrough-past-proof,.walkthrough-unit-context').forEach(el=>el.classList.remove('walkthrough-reasoning-context','walkthrough-current-focus','walkthrough-past-proof','walkthrough-unit-context','walkthrough-unit-context-row','walkthrough-unit-context-column'));
  const seenUnits=new Map();for(const entry of [...past,current])for(const unit of test.entryUnits?.(entry)||[])seenUnits.set(`${unit.family}:${unit.id}`,unit);for(const unit of seenUnits.values())for(const [r,c] of unitCells(unit,s.base)){const el=board.querySelector(`[data-r="${r}"][data-c="${c}"]`);if(el)el.classList.add('walkthrough-unit-context',`walkthrough-unit-context-${unit.family}`)}
  for(const entry of past)for(const key of coordSet(entry))applyCoord(board,key,['walkthrough-reasoning-context','walkthrough-past-proof']);for(const key of coordSet(current))applyCoord(board,key,['walkthrough-current-focus']);
  const action=test.actionEntry?.(group);for(const cell of test.actionCoords?.(action)||[]){const el=board.querySelector(`[data-r="${cell[0]}"][data-c="${cell[1]}"]`);if(el)el.classList.add('walkthrough-current-action')}
  if(panel)panel.dataset.proofStageKind=String(current?.move?.pedagogyStageKind||current?.move?.proofStage?.kind||'reasoning');board.dataset.pedagogyProgression='past-current-future-hidden';return true
}
function installProgressiveRender(){if(typeof renderWalkthrough!=='function'||renderWalkthrough.__quadludHumanProgressiveV4)return false;const previous=renderWalkthrough;const wrapped=function(options={}){const result=previous(options);decorateProgressiveProof();return result};wrapped.__quadludHumanProgressiveV4=true;wrapped.__quadludPrevious=previous;renderWalkthrough=wrapped;return true}

function showCoach(html){showHintNotice(html);root.QuadludCoachPresentationRuntime?.decorateCoachNotice?.('tango')}
function coachFailure(plan,presenter){try{current.hintFlow=null;clearHintFocus()}catch(_){ }if(plan?.status==='contradictory'||plan?.status==='contradiction')return showCoach(`<b>⚠ ${tr('contradictionFound')}</b><br>${presenter?.contradictionText?.(plan.contradiction)||tr('errorDetected')}`);if(plan?.status==='blocked'||plan?.status==='stuck')return showCoach(`<b>${tr('noLogicalHint')}</b>`);if(plan?.status==='solved')return showCoach(`<b>${tr('congrats')}</b>`);return showCoach(`<b>${tr('hintError')}</b>`)}
function focusCoachStage(stage,final=false){if(!stage?.deduction||typeof tangoFocusDeduction!=='function')return false;tangoFocusDeduction(stage.deduction,!!final);const board=root.document?.querySelector?.('#tboard')||root.document?.querySelector?.('.board');if(!final)board?.querySelectorAll?.('.hint-context').forEach(el=>{el.classList.remove('hint-context');el.classList.add('hint-substep-focus')});return true}
function installCoach(){
  if(typeof tangoCoachHandleDeduction!=='function'||tangoCoachHandleDeduction.__quadludHumanProgressiveV4)return false;
  const coherent=function(_raw){let engine;try{engine=tangoLogicSession()}catch(error){return coachFailure({status:'error',error},null)}const presenter=tangoReasoningPresenter(),plan=chooseGloballySimplestPlan(engine,current?.diff);if(plan?.status!=='move')return coachFailure(plan,presenter);const activeDeduction=plan.displayDeduction||plan.deduction,stages=proofStagesForDeduction(activeDeduction,presenter),boardKey=historySnapshotKey(),sig=plan.humanSignature||`${moveKey(plan)}|${plan.displayProof?.kind||''}`,flow=current.hintFlow,isSame=flow?.kind==='tango-human-progressive-proof'&&flow.boardKey===boardKey&&flow.signature===sig,total=stages.length+1;
    if(!isSame){current.hintFlow={kind:'tango-human-progressive-proof',boardKey,signature:sig,stageIndex:0,flowVersion:8,plan:copy(plan)};coachUsage(1,stages[0]?.presentation?.technique||null);focusCoachStage(stages[0],false);showCoach(`<span class="coach-progress">1/${total}</span><b>${tr('where')} :</b> ${stages[0]?.presentation?.explanation?.where||presenter.presentation(activeDeduction).explanation?.where||''}`);saveCurrent();return}
    const active=flow.plan||plan,activeD=active.displayDeduction||active.deduction,activeStages=proofStagesForDeduction(activeD,presenter),next=Math.min(activeStages.length,Number(flow.stageIndex||0)+1),stage=activeStages[next-1];if(!stage)return coachFailure({status:'error',reason:'missing-stage'},presenter);
    if(stage.kind!=='action'){flow.stageIndex=next;if(next===1)coachUsage(2,stage.presentation?.technique||null);focusCoachStage(stage,false);const title=stage.presentation?.explanation?.title||tr('logic'),why=stage.presentation?.explanation?.why||'';showCoach(`<span class="coach-progress">${next+1}/${activeStages.length+1}</span><b>${title}</b>${why?`<br>${why}`:''}`);saveCurrent();return}
    const before=historySnapshotKey();coachUsage(3,stage.presentation?.technique||null);markHintUsed();updateScoreFlags();focusCoachStage(stage,true);if(!Base._test?.applyVisibleMove?.(active)){current.hintFlow=null;showCoach(`<b>${tr('hintError')}</b>`);return}drawGameUi();const reasoning={...presenter.legacyReasoning(activeD,[]),humanProofPolicy:POLICY,humanProofKind:active.displayProof?.kind||'engine-proof',selectedMove:{target:copy(active.target),value:active.value}};historyRecord({type:'COACH_APPLY',reasoning,coachStage:3,coachFlowVersion:8},before);current.hintFlow=null;const title=stage.presentation?.explanation?.title||'',why=stage.presentation?.explanation?.why||'',action=stage.presentation?.explanation?.move||presenter.conclusionText(activeD);showCoach(`<span class="coach-progress">${activeStages.length+1}/${activeStages.length+1}</span>${title?`<b>${title}</b>`:''}${title&&why?'<br>':''}${why}${action?`<br><b>${tr('hintMove')} :</b> ${action}`:''}`);maybeAutoFinish();saveCurrent();haptic(12)
  };coherent.__quadludHumanProgressiveV4=true;tangoCoachHandleDeduction=coherent;return true
}

function installLate(){installPresenter();installProgressiveRender();installCoach();return true}
function installEarly(){
  const upgraded=Object.freeze({...Base,VERSION:7,HUMAN_PROOF_POLICY:POLICY,planHumanMove:chooseGloballySimplestPlan,_test:Object.freeze({...Base._test,playableDirectPlans,evaluatePlanHumanProof,compareHumanCandidate,chooseGloballySimplestPlan,proofStagesForDeduction,stageFocusDeduction,traceForAdvanced,concreteExplanation})});root.QuadludTangoPlayedMoveRuntime=upgraded;root.walkthroughGenerateTangoNext=walkthroughGenerateHumanNext;
  if(typeof document!=='undefined'){const run=()=>setTimeout(installLate,0);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run()}return true
}

return Object.freeze({VERSION,POLICY,installEarly,installLate,chooseGloballySimplestPlan,proofStagesForDeduction,decorateProgressiveProof,_test:Object.freeze({playableDirectPlans,evaluatePlanHumanProof,compareHumanCandidate,chooseGloballySimplestPlan,proofStagesForDeduction,stageFocusDeduction,traceForAdvanced,concreteExplanation,moveKey,planStableKey})});
});