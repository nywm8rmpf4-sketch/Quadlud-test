/*
 * QUADLUD — v3.2-B / UX-2 derived progression profile
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludProgressionProfile=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION=1,SCHEMA=1;
  const DEFAULT_DIFFICULTIES=Object.freeze(['easy','medium','hard','expert']);
  const num=v=>Math.max(0,Number(v)||0);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function deriveProfile(options={}){
    const stats=options.stats&&typeof options.stats==='object'?options.stats:{};
    const gameIds=Array.isArray(options.gameIds)?[...options.gameIds]:[];
    const difficulties=Array.isArray(options.difficulties)&&options.difficulties.length?[...options.difficulties]:[...DEFAULT_DIFFICULTIES];
    const catalog=options.catalog&&typeof options.catalog==='object'?options.catalog:{};
    const masteryModel=options.masteryModel;
    const effectiveMastery=options.effectiveMastery&&typeof options.effectiveMastery==='object'?options.effectiveMastery:{};

    const byGame={},solvedByDifficulty=Object.fromEntries(difficulties.map(d=>[d,0]));
    let solvedGames=0;
    for(const game of gameIds){
      const byDifficulty={};let gameSolved=0,gameStarted=0;
      for(const diff of difficulties){
        const b=stats.byGame?.[game]?.[diff]||{},solved=num(b.solved),started=num(b.started);
        byDifficulty[diff]={started,solved,revealed:num(b.revealed),best:b.best==null?null:num(b.best)};
        gameSolved+=solved;gameStarted+=started;solvedByDifficulty[diff]+=solved;
      }
      if(gameSolved>0)solvedGames++;
      byGame[game]={started:gameStarted,solved:gameSolved,byDifficulty};
    }

    const history=Array.isArray(stats.history)?stats.history:[];
    const helpFreeSolved=history.filter(r=>r?.outcome==='solved'&&!r.hintUsed&&!r.walkthroughUsed).length;
    const masteryByTechnique={};let masteryCounts={levels:[0,0,0,0,0],samples:0,soloTechniques:0,advancedSoloTechniques:0,scoreTotal:0,scoreN:0};
    for(const id of Object.keys(catalog)){
      const counts=effectiveMastery[id]||stats.mastery?.byTechnique?.[id]||{};
      const metrics=masteryModel?.metrics?masteryModel.metrics(counts):clone(counts)||{};
      const level=masteryModel?.level?masteryModel.level(metrics):{level:0,key:'masteryInsufficient'};
      masteryByTechnique[id]={metrics:clone(metrics),level:clone(level),rank:num(catalog[id]?.rank)};
      const lv=Math.max(0,Math.min(4,Number(level?.level)||0));masteryCounts.levels[lv]++;
      masteryCounts.samples+=num(metrics?.samples);
      if(num(metrics?.solo)>0){masteryCounts.soloTechniques++;if(num(catalog[id]?.rank)>=2)masteryCounts.advancedSoloTechniques++}
      if(metrics?.score!=null){masteryCounts.scoreTotal+=num(metrics.score);masteryCounts.scoreN++}
    }
    const masteryScore=masteryCounts.scoreN?Math.round(masteryCounts.scoreTotal/masteryCounts.scoreN):null;

    const achievements=[];
    const add=(id,unlocked,meta={})=>achievements.push({id,unlocked:!!unlocked,...meta});
    add('first-solve',num(stats.solved)>0);
    for(const diff of difficulties)add(`difficulty-${diff}`,solvedByDifficulty[diff]>0,{diff});
    add('no-help',helpFreeSolved>0,{count:helpFreeSolved});
    add('three-games',solvedGames>=Math.min(3,gameIds.length),{count:solvedGames,total:gameIds.length});
    add('all-games',gameIds.length>0&&solvedGames===gameIds.length,{count:solvedGames,total:gameIds.length});
    add('advanced-solo',masteryCounts.advancedSoloTechniques>0,{count:masteryCounts.advancedSoloTechniques});
    add('mastery-excellent',masteryCounts.levels[4]>0,{count:masteryCounts.levels[4]});

    return Object.freeze({
      schema:SCHEMA,source:'derived-existing-persistence',
      totals:{started:num(stats.started),solved:num(stats.solved),revealed:num(stats.revealed)},
      games:{total:gameIds.length,solvedCount:solvedGames,byGame,solvedByDifficulty},
      helpFreeSolved,
      mastery:{score:masteryScore,byTechnique:masteryByTechnique,...masteryCounts},
      achievements,
      nextAchievement:clone(achievements.find(a=>!a.unlocked)||null)
    });
  }

  return Object.freeze({VERSION,SCHEMA,DEFAULT_DIFFICULTIES,deriveProfile});
});
