/*
 * QUADLUD — v3.2-A / UX-1 post-victory insight
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludVictoryInsight=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION=1;
  const MAX_REPLAY_MOMENTS=6;

  function finiteNumber(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}

  function currentPath(session){
    const history=session?.moveHistory,nodes=history?.nodes,cursor=history?.cursor;
    if(!nodes||!cursor||!nodes[cursor])return [];
    const out=[];let node=nodes[cursor],guard=0;
    while(node&&guard++<10000){out.push(node);node=node.parent?nodes[node.parent]:null}
    return out.reverse()
  }

  function justifiedMoments(session){
    return currentPath(session)
      .filter(node=>node?.action?.type!=='START'&&node?.justification?.status==='justified')
      .map((node,index)=>({
        node,
        index,
        technique:typeof node.justification?.technique==='string'?node.justification.technique:null,
        proof:clone(node.justification),
        action:clone(node.action)
      }))
  }

  function explicitProofWeight(moment){
    const proof=moment?.proof||{};
    const candidates=[proof.humanCost,proof.cost,proof.rank,proof.depth,proof.proofDepth,proof.logicalDepth]
      .map(v=>Number(v)).filter(Number.isFinite);
    return candidates.length?Math.max(...candidates):0
  }

  function selectKeyMoment(moments){
    const list=Array.isArray(moments)?moments:[];
    if(!list.length)return null;
    let best=list[0],bestWeight=explicitProofWeight(best),bestTechnique=best.technique?1:0;
    for(const moment of list.slice(1)){
      const weight=explicitProofWeight(moment),technique=moment.technique?1:0;
      if(weight>bestWeight||(weight===bestWeight&&technique>bestTechnique)||(weight===bestWeight&&technique===bestTechnique&&moment.index>best.index)){
        best=moment;bestWeight=weight;bestTechnique=technique
      }
    }
    return best
  }

  function sampleReplay(moments,maxMoments=MAX_REPLAY_MOMENTS,keyMoment=null){
    const list=Array.isArray(moments)?moments:[],limit=Math.max(1,Math.floor(finiteNumber(maxMoments,MAX_REPLAY_MOMENTS)));
    if(list.length<=limit)return list.slice();
    const picked=new Set([0,list.length-1]);
    for(let i=1;i<limit-1;i++)picked.add(Math.round(i*(list.length-1)/(limit-1)));
    if(keyMoment){const keyIndex=list.indexOf(keyMoment);if(keyIndex>=0)picked.add(keyIndex)}
    let ordered=[...picked].sort((a,b)=>a-b);
    while(ordered.length>limit){
      const removable=ordered.findIndex((idx,pos)=>pos>0&&pos<ordered.length-1&&list[idx]!==keyMoment);
      ordered.splice(removable>=0?removable:Math.max(1,ordered.length-2),1)
    }
    return ordered.map(i=>list[i])
  }

  function buildModel(session,{seconds=null,maxMoments=MAX_REPLAY_MOMENTS}={}){
    if(!session||session.completed!==true)return null;
    const moments=justifiedMoments(session),keyMoment=selectKeyMoment(moments),history=session.moveHistory||{},audit=session.reasoningAudit||{};
    const officialSeconds=seconds==null?finiteNumber(session.postVictoryReview?.officialSeconds,0):finiteNumber(seconds,0);
    return Object.freeze({
      schema:1,
      ephemeral:true,
      game:String(session.game||''),
      difficulty:String(session.diff||''),
      officialSeconds,
      hintUsed:!!session.hintUsed,
      walkthroughUsed:!!session.walkthroughUsed,
      backtrackUsed:!!session.backtrackUsed,
      undoCount:Math.max(0,Math.floor(finiteNumber(history.stats?.undos,0))),
      redoCount:Math.max(0,Math.floor(finiteNumber(history.stats?.redos,0))),
      justifiedCount:moments.length,
      auditJustified:Math.max(0,Math.floor(finiteNumber(audit.justified,0))),
      keyMoment,
      replay:sampleReplay(moments,maxMoments,keyMoment)
    })
  }

  function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  function renderHtml(model,{tr=k=>k,formatNode=()=>'',techniqueLabel=t=>String(t||''),formatSeconds=s=>String(s)}={}){
    if(!model)return '';
    const facts=[];
    facts.push(`<span class="victory-insight-chip"><b>${escapeHtml(tr('moveJustified'))}</b> ${model.justifiedCount}</span>`);
    if(model.undoCount)facts.push(`<span class="victory-insight-chip"><b>${escapeHtml(tr('undo'))}</b> ${model.undoCount}</span>`);
    if(model.hintUsed)facts.push(`<span class="victory-insight-chip">${escapeHtml(tr('hint'))}</span>`);
    if(model.walkthroughUsed)facts.push(`<span class="victory-insight-chip">${escapeHtml(tr('walkthrough'))}</span>`);
    const key=model.keyMoment;
    const keyHtml=key?`<div class="victory-insight-key"><small>${escapeHtml(tr('reasoningAudit'))}</small><strong>${escapeHtml(key.technique?techniqueLabel(key.technique):tr('moveJustified'))}</strong><span>${escapeHtml(formatNode(key.node)||tr('moveJustified'))}</span></div>`:'';
    const replay=model.replay.length?`<div class="victory-insight-replay" aria-label="${escapeHtml(tr('history'))}">${model.replay.map((moment,i)=>`<span class="victory-insight-step"${moment===key?' data-key="true"':''}><b>${i+1}</b>${escapeHtml(moment.technique?techniqueLabel(moment.technique):formatNode(moment.node)||tr('moveJustified'))}</span>`).join('')}</div>`:'';
    return `<section class="victory-insight" aria-label="${escapeHtml(tr('logic'))}"><div class="victory-insight-head"><strong>${escapeHtml(tr('logic'))}</strong><span>${escapeHtml(formatSeconds(model.officialSeconds))}</span></div><div class="victory-insight-facts">${facts.join('')}</div>${keyHtml}${replay}</section>`
  }

  function installBrowserEnhancer({document,getSession,tr,formatNode,techniqueLabel,formatSeconds,maxMoments=MAX_REPLAY_MOMENTS}={}){
    if(!document?.body||typeof MutationObserver==='undefined'||typeof getSession!=='function')return {installed:false,reason:'environment-unavailable'};
    let lastRoot=null;
    function enhance(){
      const root=document.querySelector('#victory'),card=root?.querySelector?.('.victory-card');
      if(!root||!card||root===lastRoot||card.querySelector('.victory-insight'))return false;
      const session=getSession(),model=buildModel(session,{seconds:session?.postVictoryReview?.officialSeconds,maxMoments});
      if(!model)return false;
      const actions=card.querySelector('.victory-actions'),html=renderHtml(model,{tr,formatNode,techniqueLabel,formatSeconds});
      if(!html)return false;
      if(actions)actions.insertAdjacentHTML('beforebegin',html);else card.insertAdjacentHTML('beforeend',html);
      lastRoot=root;return true
    }
    const observer=new MutationObserver(()=>enhance());observer.observe(document.body,{childList:true,subtree:true});enhance();
    return {installed:true,disconnect(){observer.disconnect()},enhance}
  }

  return Object.freeze({VERSION,MAX_REPLAY_MOMENTS,currentPath,justifiedMoments,explicitProofWeight,selectKeyMoment,sampleReplay,buildModel,renderHtml,installBrowserEnhancer})
});

if(typeof document!=='undefined'&&typeof QuadludVictoryInsight!=='undefined'){
  queueMicrotask(()=>{
    try{
      QuadludVictoryInsight.installBrowserEnhancer({
        document,
        getSession:()=>typeof current!=='undefined'?current:null,
        tr:key=>typeof tr==='function'?tr(key):key,
        formatNode:node=>typeof historyActionShort==='function'?historyActionShort(node):'',
        techniqueLabel:technique=>typeof techniqueTitle==='function'?techniqueTitle(technique):String(technique||''),
        formatSeconds:seconds=>typeof fmt==='function'?fmt(seconds):String(seconds),
        maxMoments:6
      })
    }catch(_){/* UX-1 is strictly additive: never break the game shell. */}
  })
}
