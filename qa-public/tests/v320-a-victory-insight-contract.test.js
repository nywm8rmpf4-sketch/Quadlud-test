'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const UX=require('../../victory-insight.js');

assert.strictEqual(UX.VERSION,1);
assert.strictEqual(UX.MAX_REPLAY_MOMENTS,6);

function node(id,parent,{status='justified',technique=null,rank=null,cell=null}={}){
  const justification=status?{status,...(technique?{technique}:{}),...(rank==null?{}:{rank}),...(cell?{target:cell}:{})}:null;
  return {id,parent,children:[],preferred:null,action:{type:'MOVE',game:'tango',changes:cell?[{row:cell[0],column:cell[1],from:null,to:1}]:[]},snapshot:{game:'tango'},justification};
}
const nodes={h0:{id:'h0',parent:null,children:['h1'],action:{type:'START',game:'tango'},snapshot:{game:'tango'}},h1:node('h1','h0',{technique:'direct',rank:0,cell:[0,0]}),h2:node('h2','h1',{technique:'pair',rank:2,cell:[1,1]}),h3:node('h3','h2',{status:'unjustified',cell:[2,2]}),h4:node('h4','h3',{technique:'single',rank:1,cell:[3,3]})};
nodes.h1.children=['h2'];nodes.h2.children=['h3'];nodes.h3.children=['h4'];
const session={game:'tango',diff:'hard',completed:true,hintUsed:true,walkthroughUsed:false,backtrackUsed:true,reasoningAudit:{justified:3,unjustified:1},postVictoryReview:{schema:1,outcome:'solved',officialSeconds:87},moveHistory:{schema:1,cursor:'h4',nodes,stats:{undos:2,redos:1,branches:0}}};

assert.deepStrictEqual(UX.currentPath(session).map(x=>x.id),['h0','h1','h2','h3','h4']);
const moments=UX.justifiedMoments(session);assert.deepStrictEqual(moments.map(x=>x.node.id),['h1','h2','h4']);
const key=UX.selectKeyMoment(moments);assert.strictEqual(key.node.id,'h2');
const model=UX.buildModel(session);assert(model&&model.ephemeral===true);assert.strictEqual(model.officialSeconds,87);assert.strictEqual(model.justifiedCount,3);assert.strictEqual(model.undoCount,2);assert.strictEqual(model.hintUsed,true);assert.strictEqual(model.walkthroughUsed,false);assert.strictEqual(model.keyMoment.node.id,'h2');assert(model.replay.length<=6);

const noProof={...session,moveHistory:{...session.moveHistory,nodes:{h0:nodes.h0},cursor:'h0'}};const empty=UX.buildModel(noProof);assert.strictEqual(empty.keyMoment,null);assert.deepStrictEqual(empty.replay,[]);
assert.strictEqual(UX.buildModel({...session,completed:false}),null);

const many={...session,moveHistory:{schema:1,cursor:'h10',stats:{undos:0,redos:0},nodes:{}}};many.moveHistory.nodes.h0={id:'h0',parent:null,children:['h1'],action:{type:'START'}};for(let i=1;i<=10;i++){many.moveHistory.nodes[`h${i}`]=node(`h${i}`,i===1?'h0':`h${i-1}`,{technique:`t${i}`,rank:i===7?9:i%3,cell:[i%6,(i+1)%6]});if(i<10)many.moveHistory.nodes[`h${i}`].children=[`h${i+1}`]}
const sampled=UX.buildModel(many);assert.strictEqual(sampled.replay.length,6);assert(sampled.replay.some(x=>x.node.id==='h7'));

const html=UX.renderHtml(model,{tr:k=>k,formatNode:n=>`node-${n.id}`,techniqueLabel:t=>`tech-${t}`,formatSeconds:s=>`${s}s`});assert(html.includes('victory-insight'));assert(html.includes('tech-pair'));assert(html.includes('node-h2'));assert(!html.includes('unjustified'));

const source=fs.readFileSync(path.join(__dirname,'../../victory-insight.js'),'utf8');
for(const forbidden of ['localStorage','PersistentData','saveCurrent(','writeStats(','statsFinish(','solutionGrid','hiddenSolution','current.sol','AudioEvents.emit','SemanticAudio','fetch(','XMLHttpRequest'])assert(!source.includes(forbidden),`forbidden UX-1 dependency: ${forbidden}`);
assert(source.includes("justification?.status==='justified'"));assert(source.includes('ephemeral:true'));
console.log('v3.2-A UX-1 ephemeral victory insight contract: PASS');
