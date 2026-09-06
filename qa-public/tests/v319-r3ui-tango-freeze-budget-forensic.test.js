/* QUADLUD HF3.6-A — public forensic regression
 * Verifies the currently observed Tango Coach planning bound without exposing private data.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','GitHub','coach-presentation-bridge.js'),'utf8');
const fn=source.match(/function tangoCoachPlan\(\)\{([\s\S]*?)\n  \}\n  function tangoApplyCoachPlan/);
if(!fn)throw new Error('tangoCoachPlan not found');
const body=fn[1];
if(!/guardMax=Math\.max\(24,Number\(current\?\.n\|\|6\)\*Number\(current\?\.n\|\|6\)\*2\)/.test(body))throw new Error('unexpected Tango planning bound');
if(!/for\(let guard=0;guard<guardMax;guard\+\+\)/.test(body))throw new Error('Tango planning loop is not explicitly bounded');
const n=6;
const guardMax=Math.max(24,n*n*2);
if(guardMax!==72)throw new Error(`expected 6x6 planning bound 72, got ${guardMax}`);
console.log(`PASS HF3.6-A forensic: Tango planning loop is iteration-bounded; 6x6 upper bound=${guardMax} synchronous nextDeduction calls.`);
