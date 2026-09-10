#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — Soleil-Lune Tutor/cache algorithm contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const CONTRACT_VERSION=1;
const FILES=Object.freeze([
  'difficulty-rating.js',
  'tango-logic.js',
  'tango-difficulty.js',
  'tutor-move-selector.js',
  'pedagogy-next-move-policy.js',
  'tango-played-move-planner.js',
  'tango-attention-continuity-bridge.js',
  'tango-tutor-frontier-pruner-r5.js',
  'tango-played-move-runtime.js',
  'tango-human-pedagogy-r4.js',
  'tango-tutor-single-planner-r5.js',
  'tango-tutor-precomputed-cache.js'
]);
function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex')}
function compute(root=path.resolve(__dirname,'../..')){
  const hashes={};
  const aggregate=crypto.createHash('sha256');
  aggregate.update(`quadlud-tango-tutor-cache-contract-v${CONTRACT_VERSION}\0`);
  for(const name of FILES){
    const full=path.join(root,name);
    if(!fs.existsSync(full))throw new Error(`Tutor/cache contract input missing: ${name}`);
    const digest=sha256(fs.readFileSync(full));
    hashes[name]=digest;
    aggregate.update(`${name}\0${digest}\0`);
  }
  return Object.freeze({schema:1,version:CONTRACT_VERSION,algorithm:'sha256',digest:aggregate.digest('hex'),files:Object.freeze({...hashes})});
}
if(require.main===module)console.log(JSON.stringify(compute(path.resolve(process.argv[2]||path.resolve(__dirname,'../..'))),null,2));
module.exports=Object.freeze({CONTRACT_VERSION,FILES,compute});
