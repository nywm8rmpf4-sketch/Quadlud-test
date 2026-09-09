'use strict';

/*
 * QUADLUD — Soleil-Lune precomputed pool v5 contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */

const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');

const DifficultyRating=require(path.join(ROOT,'difficulty-rating.js'));
const TangoDifficulty=require(path.join(ROOT,'tango-difficulty.js'));
const Pool=require(path.join(ROOT,'tango-diversity-pool.js'));
const Generator=require(path.join(ROOT,'tango-pool-generator.js'));

const TARGET=120;
assert.strictEqual(Pool.schema,3,'pool schema mismatch');
assert.strictEqual(Pool.version,'tango-precompute-pool-v5','pool version mismatch');
assert.strictEqual(Pool.certification?.difficulty,'exact-current-engine-tier','difficulty certification mismatch');
assert.strictEqual(Pool.certification?.logicalTrace,'current-engine-minimum-tier-visible-state-v1','logical trace policy mismatch');
assert.strictEqual(Pool.certification?.traceReuse,'exact-source-fingerprint-only','trace reuse policy mismatch');
assert.strictEqual(typeof Generator.precomputedTraceForPublicPuzzle,'function','guarded trace lookup missing');
assert.strictEqual(typeof Generator.generationIdentity,'function','generation identity missing');

const summary={counts:{},traceSteps:{},maxTutorMs:0};
for(const difficulty of ['easy','medium','hard','expert']){
  const entries=Pool.entries?.[difficulty];
  assert(Array.isArray(entries),`${difficulty}: entries missing`);
  assert(entries.length>=TARGET,`${difficulty}: expected at least ${TARGET}, got ${entries.length}`);
  assert.strictEqual(Pool.counts?.[difficulty],entries.length,`${difficulty}: metadata count mismatch`);
  const fingerprints=new Set(),families=new Set();
  let traceSteps=0;
  for(let index=0;index<entries.length;index++){
    const entry=entries[index],candidate=Generator._poolTest.candidateFromEntry(difficulty,entry,index);
    assert(candidate,`${difficulty}[${index}]: invalid pool candidate`);
    const puzzle=Generator.publicPuzzleFromCandidate(candidate),fingerprint=DifficultyRating.fingerprintPublicPuzzle(puzzle);
    assert.strictEqual(entry.difficultyProfile?.status,'solved',`${difficulty}[${index}]: profile not solved`);
    assert.strictEqual(entry.difficultyProfile?.difficulty,difficulty,`${difficulty}[${index}]: profile tier mismatch`);
    assert.strictEqual(entry.difficultyProfile?.minimumRequiredTier,DifficultyRating.tierIndex(difficulty),`${difficulty}[${index}]: minimum tier mismatch`);
    assert.strictEqual(entry.difficultyProfile?.budgetHit,false,`${difficulty}[${index}]: budget hit`);
    assert.strictEqual(entry.difficultyProfile?.fingerprint,fingerprint,`${difficulty}[${index}]: fingerprint mismatch`);
    assert.strictEqual(entry.logicTrace?.schema,1,`${difficulty}[${index}]: trace schema mismatch`);
    assert.strictEqual(entry.logicTrace?.policy,'current-engine-minimum-tier-visible-state-v1',`${difficulty}[${index}]: trace policy mismatch`);
    assert.strictEqual(entry.logicTrace?.sourceFingerprint,fingerprint,`${difficulty}[${index}]: trace source fingerprint mismatch`);
    assert.strictEqual(entry.logicTrace?.tierIndex,DifficultyRating.tierIndex(difficulty),`${difficulty}[${index}]: trace tier mismatch`);
    assert.strictEqual(entry.logicTrace?.stepCount,entry.logicTrace?.trace?.length,`${difficulty}[${index}]: trace step count mismatch`);

    const rerated=TangoDifficulty.ratePuzzle(puzzle);
    assert.strictEqual(rerated.status,'solved',`${difficulty}[${index}]: rerating did not solve`);
    assert.strictEqual(rerated.difficulty,difficulty,`${difficulty}[${index}]: rerating tier mismatch`);
    assert.strictEqual(rerated.minimumRequiredTier,DifficultyRating.tierIndex(difficulty),`${difficulty}[${index}]: rerating minimum tier mismatch`);
    assert.strictEqual(rerated.profile.fingerprint,fingerprint,`${difficulty}[${index}]: rerating fingerprint mismatch`);
    const replay=TangoDifficulty.solveTier({puzzle,tierIndex:DifficultyRating.tierIndex(difficulty)},{collectSecondaryMetrics:false});
    assert.strictEqual(replay.status,'solved',`${difficulty}[${index}]: trace replay did not solve`);
    assert.deepStrictEqual(replay.trace,entry.logicTrace.trace,`${difficulty}[${index}]: stored trace differs from current engine replay`);

    const givens=new Map([...candidate.givens].map(i=>[i,candidate.sol[Math.floor(i/6)][i%6]]));
    assert.strictEqual(Generator.countTangoSolutions(givens,candidate.edges,2),1,`${difficulty}[${index}]: puzzle is not unique`);
    fingerprints.add(fingerprint);families.add(entry.familyKey);traceSteps+=entry.logicTrace.stepCount;
    if(difficulty==='expert'){
      assert.strictEqual(entry.tutorProfile?.schema,2,`expert[${index}]: Tutor profile schema mismatch`);
      assert.strictEqual(entry.tutorProfile?.status,'solved',`expert[${index}]: Tutor journey did not solve`);
      assert.strictEqual(entry.tutorProfile?.policy,'full-contextual-tutor-journey-v2',`expert[${index}]: Tutor policy mismatch`);
      assert(entry.tutorProfile.moves>0&&entry.tutorProfile.moves<=36,`expert[${index}]: Tutor move count out of range`);
      summary.maxTutorMs=Math.max(summary.maxTutorMs,entry.tutorProfile.maxMoveMs||0);
    }
  }
  assert.strictEqual(fingerprints.size,entries.length,`${difficulty}: duplicate fingerprints`);
  assert.strictEqual(families.size,entries.length,`${difficulty}: duplicate canonical families`);

  for(let sample=0;sample<Math.min(16,entries.length);sample++){
    const candidate=Generator.generateTangoPuzzle(difficulty,{poolIndex:sample});
    assert.strictEqual(candidate.generationStats?.source,'certified-precomputed-pool',`${difficulty}: provider did not use pool`);
    assert.strictEqual(candidate.generationStats?.poolIndex,sample,`${difficulty}: forced pool index mismatch`);
    const initial=Generator.publicPuzzleFromCandidate(candidate),trace=Generator.precomputedTraceForPublicPuzzle(candidate,initial);
    assert(trace,`${difficulty}[${sample}]: certified initial trace was not reusable`);
    const mutated={...initial,state:initial.state.map(row=>row.slice()),edges:initial.edges.map(edge=>edge.slice())};
    let changed=false;
    for(let r=0;r<6&&!changed;r++)for(let c=0;c<6&&!changed;c++)if(mutated.state[r][c]===-1){mutated.state[r][c]=candidate.sol[r][c];changed=true}
    assert(changed,`${difficulty}[${sample}]: no mutable empty cell found`);
    assert.strictEqual(Generator.precomputedTraceForPublicPuzzle(candidate,mutated),null,`${difficulty}[${sample}]: stale trace reused after visible-state change`);
  }
  summary.counts[difficulty]=entries.length;summary.traceSteps[difficulty]=traceSteps;
}
assert(Pool.total>=TARGET*4,`pool total below ${TARGET*4}`);
console.log(`tango-precompute-pool-v5-contract.test.js: OK ${JSON.stringify(summary)}`);
