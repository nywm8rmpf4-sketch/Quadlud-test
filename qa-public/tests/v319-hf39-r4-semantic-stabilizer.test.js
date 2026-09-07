const assert = require('assert');
const fs = require('fs');
const path = require('path');
function runtime(name){
  const candidates=[path.resolve(__dirname,'../..',name),path.resolve(__dirname,'../GitHub',name),path.resolve(__dirname,'../../GitHub',name)];
  const found=candidates.find(fs.existsSync);assert(found,`cannot locate ${name}`);return found;
}
const Finalizer = require(runtime('tango-pedagogy-text-finalizer.js'));
const Stabilizer = require(runtime('tango-semantic-stabilizer-hf39-r4.js'));

global.document={documentElement:{lang:'fr'}};
global.QuadludTangoPedagogyTextFinalizer=Finalizer;
{
  const line=Stabilizer._test.normalizeLateText('Dans ligne A, il reste deux cases.');
  const column=Stabilizer._test.normalizeLateText('Dans colonne 3, il reste deux cases.');
  const agreement=Stabilizer._test.normalizeLateText('Un troisième lune 🌙 dans ce groupe de trois est interdit ; E4 doit changer.');
  const sentence=Stabilizer._test.normalizeLateText('colonne 4 doit contenir 3 soleils et 3 lunes.');
  assert.strictEqual(line,'Dans la ligne A, il reste deux cases.');
  assert.strictEqual(column,'Dans la colonne 3, il reste deux cases.');
  assert.strictEqual(agreement,'Une troisième lune ☾ dans ce groupe de trois est interdite ; E4 doit changer.');
  assert.strictEqual(sentence,'La colonne 4 doit contenir 3 soleils ☀ et 3 lunes ☾.');
}
{
  const scroll={scrollTop:0,scrollHeight:358,clientHeight:308,getBoundingClientRect(){return {top:0,bottom:308,height:308}}};
  const move={getBoundingClientRect(){return {top:320-scroll.scrollTop,bottom:350-scroll.scrollTop,height:30}}};
  const panel={dataset:{proofStageKind:'action'},querySelector(sel){return sel==='.walkthrough-scroll'?scroll:sel==='.walkthrough-move'?move:null}};
  assert.strictEqual(Stabilizer._test.ensureActionVisible(panel),true);assert.strictEqual(scroll.scrollTop,50);
  panel.dataset.proofStageKind='reasoning';scroll.scrollTop=0;assert.strictEqual(Stabilizer._test.ensureActionVisible(panel),false);assert.strictEqual(scroll.scrollTop,0);
}
{
  const order=[];
  global.walkthroughSession={base:{game:'tango'}};
  global.document={documentElement:{lang:'fr'},querySelector(){return null}};
  global.QuadludTangoSemanticCoherenceHF39={decorate(){order.push('canonical');return true}};
  global.walkthroughNavigateProof=function(delta){order.push('lower');return delta};
  assert.strictEqual(Stabilizer.installNavigation(),true);
  assert.strictEqual(global.walkthroughNavigateProof.__quadludSemanticStabilizerHF39R4,true);
  assert.strictEqual(global.walkthroughNavigateProof(1),1);
  assert.deepStrictEqual(order,['lower','canonical']);
}
assert.strictEqual(Stabilizer.VERSION,1);assert.strictEqual(Stabilizer.TOKEN,'3.1.9-hf3.9-r4');
console.log('HF3.9-R4 semantic stabilizer PASS — final marker ordering, late French normalization, action visibility');
