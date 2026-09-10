/* QUADLUD HF3.6 human retest — final Tango text/icon localization, semantic dedup and stale-focus regression */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);

// Reproduce the human-test failure: the shared helper may still return English
// labels/emoji while the Tutor document itself is French.
global.pieceName=(game,value)=>{
  assert.strictEqual(game,'tango');
  return Number(value)===1?'sun 🌞':'moon 🌙';
};
const Finalizer=require(runtime('tango-pedagogy-text-finalizer.js'));
global.document={documentElement:{lang:'fr'},querySelector:()=>null};
const rawToken=/\b(?:sun|moon)\b/i;
const divergentEmoji=/[🌞🌙🌛🌜🌚🌝]/;

const fr=Finalizer.finalizeText('Règle : B3 = sun 🌞. Conclusion intermédiaire : B3 = sun 🌞. Coup conseillé : B3 = sun 🌞.');
assert(!rawToken.test(fr),`raw technical piece token leaked: ${fr}`);
assert(!divergentEmoji.test(fr),`Tutor glyph must match board glyph: ${fr}`);
assert(!/Conclusion intermédiaire/i.test(fr),fr);
assert(fr.includes('B3 = soleil ☀'),fr);
assert.strictEqual((fr.match(/B3\s*=\s*soleil\s*☀/gi)||[]).length,1,'same logical proposition must not be repeated');

const moon=Finalizer.finalizeText('E3 = moon 🌙. Intermediate conclusion: E3 = moon 🌙.');
assert(!rawToken.test(moon),moon);
assert(!divergentEmoji.test(moon),moon);
assert(!/Intermediate conclusion/i.test(moon),moon);
assert.strictEqual((moon.match(/E3\s*=\s*lune\s*☾/gi)||[]).length,1,moon);

const alreadyFrench=Finalizer.finalizeText('C5 = soleil 🌞. C6 = lune 🌙. D1 = sun 🌞. D2 = moon 🌙.');
assert(!rawToken.test(alreadyFrench),alreadyFrench);
assert(!divergentEmoji.test(alreadyFrench),alreadyFrench);
assert(alreadyFrench.includes('C5 = soleil ☀'),alreadyFrench);
assert(alreadyFrench.includes('C6 = lune ☾'),alreadyFrench);
assert(alreadyFrench.includes('D1 = soleil ☀'),alreadyFrench);
assert(alreadyFrench.includes('D2 = lune ☾'),alreadyFrench);

const html='<span class="reason-step conclusion"><b>Conclusion intermédiaire : E3 = moon 🌙.</b></span><p class="walkthrough-move"><b>Coup conseillé :</b> E3 = moon 🌙.</p>';
const cleanHtml=Finalizer.finalizeHtml(html);
assert(!/Conclusion intermédiaire/i.test(cleanHtml),cleanHtml);
assert(!rawToken.test(cleanHtml),cleanHtml);
assert(!divergentEmoji.test(cleanHtml),cleanHtml);
assert(cleanHtml.includes('class="walkthrough-move"'),'HTML attributes/classes must be preserved');
assert(cleanHtml.includes('E3 = lune ☾'),cleanHtml);

const presentation={
  evidence:{primary:{rule:'RELATION_PROPAGATION',technicalValue:'sun'}},
  explanation:{where:'Regarde E3.',why:'E3 = moon 🌙. Conclusion intermédiaire : E3 = moon 🌙.',move:'E3 = moon 🌙.'},
  metadata:{showTutorMove:true}
};
const sanitized=Finalizer.sanitizePresentation(presentation);
assert.notStrictEqual(sanitized,presentation,'presentation must be copied, not mutated');
assert.strictEqual(presentation.explanation.move,'E3 = moon 🌙.','source presentation must remain unchanged');
assert(!rawToken.test(sanitized.explanation.why),sanitized.explanation.why);
assert(!divergentEmoji.test(sanitized.explanation.why),sanitized.explanation.why);
assert(!/Conclusion intermédiaire/i.test(sanitized.explanation.why),sanitized.explanation.why);
assert.strictEqual(sanitized.evidence.primary.rule,'RELATION_PROPAGATION','proof structure must remain intact');
assert.strictEqual(sanitized.metadata.showTutorMove,true);

// Final contradiction action: keep the actionable move once, not both
// "Donc X = ..." and an identical "Coup conseillé : X = ...".
const contradiction=Finalizer.sanitizePresentation({
  explanation:{where:'Regarde A1.',why:'L’hypothèse est impossible. Donc A1 = moon 🌙.',move:'A1 = moon 🌙.'},
  metadata:{showTutorMove:true}
});
assert.strictEqual(contradiction.explanation.why,'L’hypothèse est impossible.',contradiction.explanation.why);
assert(contradiction.explanation.move.includes('A1 = lune ☾'),contradiction.explanation.move);
assert(!/Donc\s+A1\s*=/i.test(contradiction.explanation.why),contradiction.explanation.why);
assert.strictEqual(Finalizer.dedupWhyAgainstMove('L’hypothèse est impossible. Donc F6 = moon 🌙.','F6 = moon 🌙.'),'L’hypothèse est impossible.');

// Reproduce step N -> N+1: stale semantic classes from the previous Tutor
// step must be removed from the board before the current step is reprojected.
const semantic=['walkthrough-unit-context','walkthrough-reasoning-context','walkthrough-current-focus','walkthrough-current-action'];
const classes=new Set([...semantic,'walkthrough-unit-context-column']);
const staleCell={
  classList:{remove:(...names)=>names.forEach(name=>classes.delete(name))},
  removeAttribute:name=>{if(name==='data-pedagogy-unit')staleCell.hasUnit=false},
  hasUnit:true
};
const board={querySelectorAll(selector){
  if(selector==='[data-pedagogy-unit]')return staleCell.hasUnit?[staleCell]:[];
  if(selector.startsWith('.'))return classes.has(selector.slice(1))?[staleCell]:[];
  return [];
}};
let redecorated=0;
global.walkthroughSession={base:{game:'tango'}};
global.document={documentElement:{lang:'fr'},querySelector:selector=>selector==='.walkthrough-board'?board:null};
global.QuadludTutorActionFirstNavigation={decorateCurrentAction(){redecorated+=1;return true}};
assert.strictEqual(Finalizer.refreshWalkthroughSemanticRoles(),true,'Tutor semantic roles must be reprojected');
for(const cls of semantic)assert(!classes.has(cls),`stale ${cls} survived step transition`);
assert(!classes.has('walkthrough-unit-context-column'),'stale unit family class survived step transition');
assert.strictEqual(staleCell.hasUnit,false,'stale pedagogy unit metadata survived step transition');
assert.strictEqual(redecorated,1,'current step must be decorated exactly once after cleanup');

const index=fs.readFileSync(runtime('index.html'),'utf8');
const clarity=index.indexOf('tango-tutor-clarity.js');
const finalizer=index.indexOf('tango-pedagogy-text-finalizer.js');
const causalAtomic=index.indexOf('tango-tutor-causal-atomic-r55.js');
assert(clarity>=0&&causalAtomic>clarity&&finalizer>causalAtomic,'text finalizer must load after every late Tango Tutor wrapper');
assert(index.includes('tango-pedagogy-text-finalizer.js?v=3.1.9-hf3.6-retest3'),'Safari cache-busting query must identify RETEST3 finalizer');

const source=fs.readFileSync(runtime('tango-pedagogy-text-finalizer.js'),'utf8');
assert(!/hiddenSolution|solutionGrid|solvedGrid/.test(source),'text finalizer must not depend on hidden solution data');
console.log('PASS HF3.6 RETEST3: French sun/moon localization, board-consistent ☀/☾ glyphs, semantic dedup, and stale Tutor step focus cleanup/reprojection.');
