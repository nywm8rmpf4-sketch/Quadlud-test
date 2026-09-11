#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — materialize synchronized cognitive Tutor/cache contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(ROOT,'tango-tutor-cache-contract-r8.js'));
global.document={body:{classList:{contains:name=>name==='tutor-active'}}};
for(const file of [
  'tango-logic.js','tango-difficulty.js','tutor-move-selector.js','pedagogy-next-move-policy.js',
  'tango-played-move-planner.js','tango-attention-continuity-bridge.js','tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js','tango-human-cost-bridge.js','cognitive-cost.js','tango-cognitive-patterns.js',
  'tango-cognitive-pedagogy-bridge.js','tango-human-pedagogy-r4.js','tango-cognitive-proof-stages-bridge.js','tango-tutor-single-planner-r5.js'
])require(path.join(ROOT,file));
const Contract=require('./tango_tutor_cache_contract.js'),base=Contract.compute(ROOT),Tutor=global.QuadludTangoTutorSinglePlannerR5,Human=global.QuadludTangoHumanPedagogyR4,Runtime=global.QuadludTangoPlayedMoveRuntime;
if(!Tutor||!Human||!Runtime?.__quadludCognitivePedagogyR1||!Human.__quadludCognitiveProofStagesR1)throw new Error('Cognitive Tutor stack not active while materializing contract');
const c={...base,tutorPlannerToken:Tutor.TOKEN||null,humanPolicy:Human.POLICY||null,proofPolicy:Runtime.HUMAN_PROOF_POLICY||null,cognitiveModel:Runtime.cognitiveModel||null,cognitivePatternCatalog:Runtime.cognitivePatternCatalog||null};
const js=`/* QUADLUD — Soleil-Lune cognitive Tutor cache contract R8. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root){'use strict';const c=${JSON.stringify(c)};root.QuadludTangoTutorCacheContractR8=Object.freeze(c);if(typeof module!=='undefined'&&module.exports)module.exports=Object.freeze(c);})(typeof globalThis!=='undefined'?globalThis:this);\n`;
fs.writeFileSync(out,js);console.log(JSON.stringify(c,null,2));
