/* QUADLUD HF3.6-D — final Tango text localization and semantic dedup regression */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);

global.pieceName=(game,value)=>{
  assert.strictEqual(game,'tango');
  return Number(value)===1?'soleil ☀':'lune ☾';
};
const Finalizer=require(runtime('tango-pedagogy-text-finalizer.js'));
const rawToken=/\b(?:sun|moon)\b/i;

const fr=Finalizer.finalizeText('Règle : B3 = sun ☀. Conclusion intermédiaire : B3 = sun ☀. Coup conseillé : B3 = sun ☀.');
assert(!rawToken.test(fr),`raw technical piece token leaked: ${fr}`);
assert(!/Conclusion intermédiaire/i.test(fr),fr);
assert(fr.includes('B3 = soleil'),fr);
assert.strictEqual((fr.match(/B3\s*=\s*soleil/gi)||[]).length,1,'same logical proposition must not be repeated');

const moon=Finalizer.finalizeText('E3 = moon ☾. Intermediate conclusion: E3 = moon ☾.');
assert(!rawToken.test(moon),moon);
assert(!/Intermediate conclusion/i.test(moon),moon);
assert.strictEqual((moon.match(/E3\s*=\s*lune/gi)||[]).length,1,moon);

const html='<span class="reason-step conclusion"><b>Conclusion intermédiaire : E3 = moon ☾.</b></span><p class="walkthrough-move"><b>Coup conseillé :</b> E3 = moon ☾.</p>';
const cleanHtml=Finalizer.finalizeHtml(html);
assert(!/Conclusion intermédiaire/i.test(cleanHtml),cleanHtml);
assert(!rawToken.test(cleanHtml),cleanHtml);
assert(cleanHtml.includes('class="walkthrough-move"'),'HTML attributes/classes must be preserved');
assert(cleanHtml.includes('E3 = lune'),cleanHtml);

const presentation={
  evidence:{primary:{rule:'RELATION_PROPAGATION',technicalValue:'sun'}},
  explanation:{where:'Regarde E3.',why:'E3 = moon ☾. Conclusion intermédiaire : E3 = moon ☾.',move:'E3 = moon ☾.'},
  metadata:{showTutorMove:true}
};
const sanitized=Finalizer.sanitizePresentation(presentation);
assert.notStrictEqual(sanitized,presentation,'presentation must be copied, not mutated');
assert.strictEqual(presentation.explanation.move,'E3 = moon ☾.','source presentation must remain unchanged');
assert(!rawToken.test(sanitized.explanation.why),sanitized.explanation.why);
assert(!/Conclusion intermédiaire/i.test(sanitized.explanation.why),sanitized.explanation.why);
assert.strictEqual(sanitized.evidence.primary.rule,'RELATION_PROPAGATION','proof structure must remain intact');
assert.strictEqual(sanitized.metadata.showTutorMove,true);

const index=fs.readFileSync(runtime('index.html'),'utf8');
const clarity=index.indexOf('tango-tutor-clarity.js');
const finalizer=index.indexOf('tango-pedagogy-text-finalizer.js');
assert(clarity>=0&&finalizer>clarity,'text finalizer must load after Tutor clarity so it is the final presentation layer');

const source=fs.readFileSync(runtime('tango-pedagogy-text-finalizer.js'),'utf8');
assert(!/hiddenSolution|solutionGrid|solvedGrid/.test(source),'text finalizer must not depend on hidden solution data');
console.log('PASS HF3.6-D Tango final text localization/dedup: raw sun/moon removed, intermediate conclusions deduplicated, proof structure preserved, finalizer loaded last.');
