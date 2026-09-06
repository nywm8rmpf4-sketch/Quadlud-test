const assert=require('assert');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const Policy=require(path.join(ROOT,'GitHub','pedagogy-next-move-policy.js'));

function candidate(id,{baseCost=[0,0,1,2,3,1,1],premiseCells=[],focusCells=[],target=[0,0],stableKey=id}={}){
  return {id,stableKey,baseCost,premiseCells,focusCells,target,payload:{id}};
}

// 1) Structural simplicity remains dominant over attention locality.
{
  const result=Policy.rank([
    candidate('near-complex',{baseCost:[1,0,1,1,1,0,0],premiseCells:[[1,1]],focusCells:[[1,1]],target:[1,2]}),
    candidate('far-simple',{baseCost:[0,0,1,4,8,2,1],premiseCells:[[5,5]],focusCells:[[5,5]],target:[5,5]})
  ],{recentCells:[[1,1]]});
  assert.equal(result.selected.id,'far-simple');
}

// 2) At comparable structural cost, immediately reused conclusions beat a fresh area.
{
  const result=Policy.rank([
    candidate('A2-new-zone',{premiseCells:[[0,3],[1,3]],focusCells:[[0,1],[4,1]],target:[0,1],stableKey:'a'}),
    candidate('C3-reuse',{premiseCells:[[1,2],[1,1]],focusCells:[[1,2],[2,2]],target:[2,2],stableKey:'z'})
  ],{recentCells:[[1,1],[1,2]]});
  assert.equal(result.selected.id,'C3-reuse');
  assert.equal(result.selected.metrics.continuityPenalty,0);
  assert.ok(result.selected.metrics.reusedPremiseCount>=1);
}

// 3) With equal reuse, the smallest attention shift wins.
{
  const result=Policy.rank([
    candidate('far',{premiseCells:[[1,1]],focusCells:[[4,4]],target:[4,4]}),
    candidate('near',{premiseCells:[[1,1]],focusCells:[[1,2]],target:[1,2]})
  ],{recentCells:[[1,1]]});
  assert.equal(result.selected.id,'near');
}

// 4) Deterministic stable key for exact ties.
{
  const result=Policy.rank([
    candidate('b',{stableKey:'b'}),candidate('a',{stableKey:'a'})
  ],{recentCells:[]});
  assert.equal(result.selected.id,'a');
}

console.log('PASS v319-hf36-human-next-move-policy');
