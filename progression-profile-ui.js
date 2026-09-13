/*
 * QUADLUD — v3.2-B / UX-2 progression profile presentation
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root){
  'use strict';
  const Model=root.QuadludProgressionProfile;
  if(!Model)return;

  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function available(){
    try{return typeof safeStats==='function'&&typeof effectiveMasteryByTechnique==='function'&&typeof tr==='function'&&typeof gameLabel==='function'&&typeof GAME_IDS!=='undefined'&&typeof PEDAGOGY_TECHNIQUES!=='undefined'&&typeof MasteryModel!=='undefined'}catch(_){return false}
  }
  function achievementLabel(a,profile){
    if(a.id==='first-solve')return `✓ ${tr('solved')}`;
    if(a.id.startsWith('difficulty-'))return `✓ ${esc(DIFF?.[a.diff]||a.diff)} · ${tr('solved')}`;
    if(a.id==='no-help')return `✓ ${tr('logicCoach')} 0 · ${tr('walkthrough')} 0`;
    if(a.id==='three-games'||a.id==='all-games')return `✓ ${a.count}/${a.total} · ${tr('byGame')}`;
    if(a.id==='advanced-solo')return `✓ R2+ · ${tr('masterySolo')}`;
    if(a.id==='mastery-excellent')return `✓ ${tr('masteryExcellent')}`;
    return `✓ ${tr('stats')}`;
  }
  function buildProfile(){
    const stats=safeStats(),effective=effectiveMasteryByTechnique(stats);
    return Model.deriveProfile({stats,effectiveMastery:effective,gameIds:GAME_IDS,catalog:PEDAGOGY_TECHNIQUES,masteryModel:MasteryModel});
  }
  function render(){
    if(!available())return false;
    const panel=document.querySelector('.stats-panel');if(!panel||panel.querySelector('[data-ux2-profile]'))return false;
    const profile=buildProfile(),unlocked=profile.achievements.filter(a=>a.unlocked),mastery=profile.mastery.score==null?'—':`${profile.mastery.score}%`;
    const badges=profile.achievements.map(a=>`<span class="progress-achievement ${a.unlocked?'unlocked':'locked'}" aria-disabled="${a.unlocked?'false':'true'}">${a.unlocked?achievementLabel(a,profile):'○ '+achievementLabel(a,profile).replace(/^✓\s*/,'')}</span>`).join('');
    const games=Object.entries(profile.games.byGame).filter(([,v])=>v.solved>0).map(([g])=>`<span class="progress-game" title="${esc(gameLabel(g))}">${esc(gameIcon(g))}<span class="sr-only">${esc(gameLabel(g))}</span></span>`).join('');
    const html=`<section class="progression-profile" data-ux2-profile data-profile-schema="${profile.schema}" aria-label="${esc(tr('stats'))} · ${esc(tr('mastery'))}">
      <div class="progression-profile-head"><div><b>${esc(tr('stats'))} · ${esc(tr('mastery'))}</b><small>${esc(tr('statsLocal'))}</small></div><span class="progression-games" aria-label="${profile.games.solvedCount}/${profile.games.total}">${games||'○'}</span></div>
      <div class="progression-kpis"><div><strong>${profile.games.solvedCount}/${profile.games.total}</strong><span>${esc(tr('byGame'))}</span></div><div><strong>${mastery}</strong><span>${esc(tr('mastery'))}</span></div><div><strong>${profile.helpFreeSolved}</strong><span>${esc(tr('logicCoach'))} 0 · ${esc(tr('walkthrough'))} 0</span></div><div><strong>${unlocked.length}/${profile.achievements.length}</strong><span>${esc(tr('stats'))}</span></div></div>
      <div class="progress-achievements">${badges}</div>
    </section>`;
    const anchor=panel.querySelector('.stat-kpis')||panel.querySelector('.stats-head');
    if(anchor)anchor.insertAdjacentHTML('afterend',html);else panel.insertAdjacentHTML('afterbegin',html);
    return true;
  }
  const appRoot=document.getElementById('app');
  if(appRoot){new MutationObserver(()=>queueMicrotask(render)).observe(appRoot,{childList:true,subtree:true});queueMicrotask(render)}
  root.QuadludProgressionProfileUi=Object.freeze({render,buildProfile});
})(typeof globalThis!=='undefined'?globalThis:this);
