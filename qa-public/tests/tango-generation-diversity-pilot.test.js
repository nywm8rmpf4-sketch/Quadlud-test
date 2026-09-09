const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const materializedRoot=path.resolve(__dirname,'../GitHub');
const ROOT=fs.existsSync(path.join(materializedRoot,'index.html'))?materializedRoot:path.resolve(__dirname,'../..');
const sandbox={console};sandbox.globalThis=sandbox;vm.createContext(sandbox);
const runtime=['game-contract.js','game-manifest.js','game-registry.js','difficulty-rating.js','tango-logic.js','tango-difficulty.js','generation-common.js'];
for(const file of runtime)vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),sandbox,{filename:file});
const poolPath=path.join(ROOT,'tango-diversity-pool.js');
if(fs.existsSync(poolPath))vm.runInContext(fs.readFileSync(poolPath,'utf8'),sandbox,{filename:'tango-diversity-pool.js'});
vm.runInContext(fs.readFileSync(path.join(ROOT,'tango-generator.js'),'utf8'),sandbox,{filename:'tango-generator.js'});

const generator=sandbox.QuadludTangoGenerator;
const common=sandbox.QuadludGenerationCommon;
const rating=sandbox.DifficultyRating;
const registry=sandbox.QuadludGameRegistry;

assert.strictEqual(typeof generator.generationIdentity,'function','Soleil-Lune must expose a public-state generation identity');
assert.strictEqual(registry.hasCapability('tango','generationIdentity'),true,'Soleil-Lune must participate in session anti-repeat');
assert(sandbox.QuadludTangoDiversityPool,'the certified diversity pool must be loaded');
assert.strictEqual(sandbox.QuadludTangoDiversityPool.version,'tango-diversity-pilot-v4','the contextual Tutor-qualified pool must be loaded');
assert.strictEqual(sandbox.QuadludTangoDiversityPool.certification?.expertTutor,'full-contextual-tutor-journey-v2-fastest-portfolio','expert certification policy mismatch');

const expectedMinimumFamilies={medium:20,hard:28,expert:16};
for(const diff of Object.keys(expectedMinimumFamilies)){
  const entries=sandbox.QuadludTangoDiversityPool.entries[diff];
  assert(Array.isArray(entries),`${diff} diversity pool missing`);
  const identities=new Set();
  const reasoning=new Set();
  const fingerprints=new Set();
  for(const entry of entries){
    if(diff==='expert'){
      assert.strictEqual(entry.tutorProfile?.schema,2,'expert entry needs a contextual Tutor certification profile');
      assert.strictEqual(entry.tutorProfile?.status,'solved','expert entry Tutor journey must solve');
      assert.strictEqual(entry.tutorProfile?.policy,'full-contextual-tutor-journey-v2','expert entry Tutor policy mismatch');
      assert(entry.tutorProfile.moves>0&&entry.tutorProfile.moves<=36,'expert Tutor journey move count must stay bounded');
      assert(entry.tutorProfile.maxMoveMs<=1500,`expert entry exceeded the contextual offline Tutor interaction budget: ${entry.tutorProfile.maxMoveMs} ms`);
    }
    const candidate=generator.fromDiversityEntry(diff,entry);
    const publicPuzzle=generator.publicPuzzleFromCandidate(candidate);
    const fingerprint=rating.fingerprintPublicPuzzle(publicPuzzle);
    const rerated=sandbox.TangoDifficulty.ratePuzzle(publicPuzzle);
    assert.strictEqual(candidate.difficultyProfile.status,'solved',`${diff} entry must be solved`);
    assert.strictEqual(candidate.difficultyProfile.difficulty,diff,`${diff} entry tier mismatch`);
    assert.strictEqual(candidate.difficultyProfile.minimumRequiredTier,rating.tierIndex(diff),`${diff} entry minimum tier mismatch`);
    assert.strictEqual(candidate.difficultyProfile.budgetHit,false,`${diff} entry budget hit`);
    assert.strictEqual(candidate.difficultyProfile.fingerprint,fingerprint,`${diff} entry fingerprint mismatch`);
    assert.strictEqual(rerated.status,'solved',`${diff} entry must still solve with the current engine`);
    assert.strictEqual(rerated.difficulty,diff,`${diff} entry must still rate at the exact tier`);
    assert.strictEqual(rerated.minimumRequiredTier,rating.tierIndex(diff),`${diff} rerated minimum tier mismatch`);
    assert.strictEqual(rerated.profile.fingerprint,fingerprint,`${diff} rerated fingerprint mismatch`);
    assert.strictEqual(generator.countTangoSolutions(new Map([...candidate.givens].map(i=>[i,candidate.sol[Math.floor(i/6)][i%6]])),candidate.edges,2),1,`${diff} entry must be unique`);
    identities.add(generator.generationIdentity(candidate));
    reasoning.add(generator.reasoningSignature(candidate.difficultyProfile));
    fingerprints.add(fingerprint);
  }
  assert(identities.size>=expectedMinimumFamilies[diff],`${diff} needs at least ${expectedMinimumFamilies[diff]} non-isomorphic clue families, got ${identities.size}`);
  assert(reasoning.size>=3,`${diff} needs at least three reasoning signatures, got ${reasoning.size}`);
  assert.strictEqual(fingerprints.size,entries.length,`${diff} pool fingerprints must be unique`);

  const sampledFingerprints=new Set(),sampledFamilies=new Set();
  for(let i=0;i<64;i++){
    const candidate=common.withSeed(`diversity-contract:${diff}:${i}`,()=>generator.generateTangoPuzzle(diff));
    assert.strictEqual(candidate.difficultyProfile.difficulty,diff,`${diff} generated tier mismatch`);
    assert.strictEqual(candidate.generationStats.source,'certified-diversity-pool',`${diff} must use the diversity pool`);
    sampledFingerprints.add(candidate.difficultyProfile.fingerprint);
    sampledFamilies.add(generator.generationIdentity(candidate));
  }
  assert(sampledFingerprints.size>=Math.min(14,entries.length),`${diff} sampled fingerprint diversity too low: ${sampledFingerprints.size}`);
  assert(sampledFamilies.size>=Math.min(14,expectedMinimumFamilies[diff]),`${diff} sampled family diversity too low: ${sampledFamilies.size}`);

  const seen=new Set();
  for(let round=0;round<Math.min(20,expectedMinimumFamilies[diff]);round++){
    let fresh=null;
    for(let guard=0;guard<40&&!fresh;guard++){
      const candidate=common.withSeed(`anti-repeat:${diff}:${round}:${guard}`,()=>generator.generateTangoPuzzle(diff));
      const identity=generator.generationIdentity(candidate);
      if(!seen.has(identity))fresh={candidate,identity};
    }
    assert(fresh,`${diff} anti-repeat must find a fresh family at round ${round+1}`);
    seen.add(fresh.identity);
  }
}

// Exact symmetry variants share one family identity, so rotations/inversions do
// not masquerade as genuinely different puzzles in the anti-repeat contract.
const expert=sandbox.QuadludTangoDiversityPool.entries.expert[0];
const base=generator.fromDiversityEntry('expert',expert);
for(let transform=0;transform<8;transform++)for(const invert of [false,true]){
  const variant=generator.transformCandidate(base,transform,invert);
  assert.strictEqual(generator.generationIdentity(variant),generator.generationIdentity(base),'symmetry must preserve family identity');
}

console.log('tango-generation-diversity-pilot.test.js: OK');
