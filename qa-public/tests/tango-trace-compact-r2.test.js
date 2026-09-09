'use strict';

/*
 * QUADLUD — Soleil-Lune compact trace round-trip contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Codec=require(path.resolve(__dirname,'../../tango-trace-codec.js'));

const arg=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const rawPath=path.resolve(arg('--raw')||'raw/tango-diversity-pool.js');
const compactPath=path.resolve(arg('--compact')||'tango-diversity-pool.js');
const Raw=require(rawPath),Compact=require(compactPath);

assert.strictEqual(Raw.schema,3,'raw pool schema mismatch');
assert.strictEqual(Raw.version,'tango-precompute-pool-v5','raw pool version mismatch');
assert.strictEqual(Compact.schema,4,'compact pool schema mismatch');
assert.strictEqual(Compact.version,'tango-precompute-pool-v6-compact','compact pool version mismatch');
assert.strictEqual(Compact.certification?.logicalTraceEncoding,Codec.ENCODING,'compact encoding metadata mismatch');
assert.strictEqual(Compact.certification?.logicalTraceCodecVersion,Codec.VERSION,'compact codec metadata mismatch');
assert.deepStrictEqual(Compact.counts,Raw.counts,'pool counts changed during compaction');
assert.strictEqual(Compact.total,Raw.total,'pool total changed during compaction');

let steps=0,integers=0;
for(const difficulty of ['easy','medium','hard','expert']){
  const rawEntries=Raw.entries[difficulty],compactEntries=Compact.entries[difficulty];
  assert.strictEqual(compactEntries.length,rawEntries.length,`${difficulty}: entry count changed`);
  for(let index=0;index<rawEntries.length;index++){
    const source=rawEntries[index],compact=compactEntries[index];
    assert.deepStrictEqual(compact.sol,source.sol,`${difficulty}[${index}]: solution changed`);
    assert.deepStrictEqual(compact.givens,source.givens,`${difficulty}[${index}]: givens changed`);
    assert.deepStrictEqual(compact.edges,source.edges,`${difficulty}[${index}]: relations changed`);
    assert.strictEqual(compact.familyKey,source.familyKey,`${difficulty}[${index}]: family identity changed`);
    assert.deepStrictEqual(compact.difficultyProfile,source.difficultyProfile,`${difficulty}[${index}]: difficulty profile changed`);
    assert.deepStrictEqual(compact.tutorProfile,source.tutorProfile,`${difficulty}[${index}]: Tutor QA profile changed`);
    assert.strictEqual(compact.logicTrace.schema,2,`${difficulty}[${index}]: compact trace schema mismatch`);
    assert.strictEqual(compact.logicTrace.encoding,Codec.ENCODING,`${difficulty}[${index}]: compact trace encoding mismatch`);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(compact.logicTrace,'trace'),false,`${difficulty}[${index}]: verbose trace leaked into compact payload`);
    const hydrated=Codec.decode(compact.logicTrace,6);
    assert.deepStrictEqual(hydrated,source.logicTrace,`${difficulty}[${index}]: hydrated trace differs from certified source`);
    assert.strictEqual(Codec.roundTripEqual(source.logicTrace,6),true,`${difficulty}[${index}]: codec round-trip helper failed`);
    steps+=compact.logicTrace.stepCount;integers+=Codec.encodedIntegerCount(compact.logicTrace);
  }
}
const rawBytes=fs.statSync(rawPath).size,compactBytes=fs.statSync(compactPath).size,ratio=compactBytes/rawBytes;
assert(compactBytes<7000000,`compact pool too large for Web/PWA target: ${compactBytes} bytes`);
assert(ratio<0.35,`compact pool ratio too high: ${ratio}`);
console.log(`tango-trace-compact-r2.test.js: OK ${JSON.stringify({rawBytes,compactBytes,ratio:Number(ratio.toFixed(4)),steps,integers})}`);
