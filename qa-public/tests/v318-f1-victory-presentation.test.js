const assert=require('assert');
const fs=require('fs');
const path=require('path');
const VP=require('../GitHub/victory-presentation.js');
const Manifest=require('../GitHub/game-manifest.js');

assert.strictEqual(VP.VERSION,2);
assert.strictEqual(VP.profileForGame('queens').id,'lighthouses');
for(const game of Manifest.IDS.filter(game=>game!=='queens'))assert.strictEqual(VP.profileForGame(game).id,'generic');
assert.strictEqual(VP.GENERIC_PROFILE.confettiCount,22);
assert.strictEqual(VP.GENERIC_PROFILE.cleanupMs,1700);

class ClassList{constructor(){this.s=new Set()}add(...xs){xs.forEach(x=>this.s.add(x))}remove(...xs){xs.forEach(x=>this.s.delete(x))}contains(x){return this.s.has(x)}}
function style(){const values=new Map();return {setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k),getPropertyValue:k=>values.get(k)||''}}
function node(tag='div'){return {tagName:tag.toUpperCase(),className:'',classList:new ClassList(),children:[],style:style(),attrs:new Map(),setAttribute(k,v){this.attrs.set(k,v)},appendChild(x){this.children.push(x);x.parentElement=this},remove(){this.removed=true}}}
const body=node('body');
const document={body,createElement:tag=>node(tag)};
let timerId=0,timers=new Map();
const timer=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id};
const clear=id=>timers.delete(id);

const gchildren=[node(),node(),node()];
const genericBoard=node();genericBoard.children=gchildren;genericBoard.querySelectorAll=sel=>sel==='.win-pop'?gchildren.filter(x=>x.classList.contains('win-pop')):[];
let controller=VP.createController({document,window:{matchMedia:()=>({matches:false})},random:()=>.5,setTimer:timer,clearTimer:clear});
const generic=controller.celebrate({gameId:'tango',board:genericBoard,victoryClass:'final-win'});
assert.deepStrictEqual(generic,{started:true,profile:'generic',confettiCount:22,cleanupMs:1700});
assert(genericBoard.classList.contains('board-complete'));assert(genericBoard.classList.contains('final-win'));assert(gchildren.every(x=>x.classList.contains('win-pop')));assert.strictEqual(body.children.at(-1).children.length,22);
controller.cancel({removeFinal:true,board:genericBoard,victoryClass:'final-win'});assert(!genericBoard.classList.contains('final-win'));

function lighthouseCell(x,y){
  const cell=node();cell.classList.add('cell');cell.getBoundingClientRect=()=>({left:x,top:y,width:100,height:100});
  const piece=node('span');piece.classList.add('lighthouse-piece');piece.getBoundingClientRect=()=>({left:x+25,top:y+25,width:50,height:50});piece.closest=sel=>sel==='.cell'?cell:null;piece.parentElement=cell;
  const halo=node('span');halo.classList.add('lighthouse-halo');piece.children.push(halo);halo.parentElement=piece;
  cell.piece=piece;cell.halo=halo;return cell;
}
function lighthouseBoard(){
  const board=node();board.getBoundingClientRect=()=>({left:0,top:0,width:300,height:300});
  const cells=[lighthouseCell(0,0),lighthouseCell(200,200)];board.children=cells;
  board.querySelectorAll=sel=>{
    if(sel==='.lighthouse-piece')return cells.map(c=>c.piece);
    if(sel==='.lighthouse-halo')return cells.map(c=>c.halo);
    if(sel==='.lighthouses-victory-halo')return cells.map(c=>c.halo).filter(h=>h.classList.contains('lighthouses-victory-halo'));
    if(sel==='.win-pop')return [];
    return [];
  };
  return {board,cells};
}

timers.clear();const normal=lighthouseBoard();
controller=VP.createController({document,window:{matchMedia:()=>({matches:false})},setTimer:timer,clearTimer:clear});
const started=controller.celebrate({gameId:'queens',board:normal.board,victoryClass:'queens-win'});
assert.strictEqual(started.profile,'lighthouses');assert.strictEqual(started.confettiCount,0);assert.strictEqual(started.lighthouseCount,2);assert.strictEqual(started.beamCount,8);assert.strictEqual(started.cleanupMs,1650);assert.strictEqual(started.reducedMotion,false);
assert(normal.board.classList.contains('lighthouses-victory-active'));assert(normal.board.classList.contains('queens-win'));assert(normal.cells.every(c=>!c.classList.contains('win-pop')));
const layer=body.children.at(-1);assert.strictEqual(layer.className,'lighthouses-victory-layer');assert.strictEqual(layer.children.length,2);assert.strictEqual(normal.board.children.length,2);assert.strictEqual(layer.style.getPropertyValue('--lh-board-width'),'300px');assert.strictEqual(layer.style.getPropertyValue('--lh-board-height'),'300px');
for(const origin of layer.children){assert.strictEqual(origin.children.length,4);assert.strictEqual(origin.style.getPropertyValue('--lh-range'),'300px');assert.deepStrictEqual(origin.children.map(b=>b.style.getPropertyValue('--lh-angle')),['0deg','90deg','180deg','270deg'])}
controller.cancel({removeFinal:false,board:normal.board,victoryClass:'queens-win'});assert(layer.removed);assert(normal.board.classList.contains('queens-win'));assert(!normal.board.classList.contains('lighthouses-victory-active'));
controller.cancel({removeFinal:true,board:normal.board,victoryClass:'queens-win'});assert(!normal.board.classList.contains('queens-win'));

timers.clear();const reduced=lighthouseBoard();
controller=VP.createController({document,window:{matchMedia:()=>({matches:true})},setTimer:timer,clearTimer:clear});
const r=controller.celebrate({gameId:'queens',board:reduced.board,victoryClass:'queens-win'});
assert.strictEqual(r.reducedMotion,true);assert.strictEqual(r.beamCount,0);assert.strictEqual(r.cleanupMs,900);assert.strictEqual(r.lighthouseCount,2);assert(reduced.cells.every(c=>c.halo.classList.contains('lighthouses-victory-halo')));assert(reduced.board.classList.contains('queens-win'));
const cleanup=[...timers.values()].find(x=>x.ms===900);assert(cleanup);cleanup.fn();assert(reduced.cells.every(c=>!c.halo.classList.contains('lighthouses-victory-halo')));assert(reduced.board.classList.contains('queens-win'));assert(!reduced.board.classList.contains('board-complete'));

const plan=VP.buildApplausePlan(()=>.5);assert.strictEqual(plan.length,16);assert(plan.every((x,i)=>i===0||x.at>=plan[i-1].at));assert(Math.max(...plan.map(x=>x.at+x.duration))<1.8);assert(plan.every(x=>x.gain<=.115&&x.pan>=-.4&&x.pan<=.4));
let constructed=0;
class Param{constructor(){this.value=0}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.value=v}exponentialRampToValueAtTime(v){this.value=v}}
class FakeNode{connect(x){return x}}
const starts=[];
class FakeAudioContext{
  constructor(){constructed++;this.currentTime=1;this.sampleRate=12000;this.destination={};this.state='running'}
  createGain(){const n=new FakeNode();n.gain=new Param();return n}
  createBuffer(_c,len){return {getChannelData(){return new Float32Array(len)}}}
  createBufferSource(){const n=new FakeNode();n.start=t=>starts.push(t);n.stop=()=>{};return n}
  createBiquadFilter(){const n=new FakeNode();n.frequency={value:0};n.Q={value:0};return n}
  createStereoPanner(){const n=new FakeNode();n.pan={value:0};return n}
  close(){return Promise.resolve()}
  resume(){return Promise.resolve()}
}
assert.deepStrictEqual(VP.playApplause({scope:{AudioContext:FakeAudioContext},enabled:false}),{played:false,reason:'disabled'});assert.strictEqual(constructed,0);
const audio=VP.playApplause({scope:{AudioContext:FakeAudioContext},enabled:true,random:()=>.5,setTimer:()=>1});assert.strictEqual(audio.played,true);assert.strictEqual(audio.claps,16);assert.strictEqual(constructed,1);assert.strictEqual(starts.length,16);assert(audio.durationSeconds<1.8);

const src=fs.readFileSync(path.join(__dirname,'../GitHub/victory-presentation.js'),'utf8');assert(!/solutionGrid|validationState|current\.sol|\.mp3|\.wav|XMLHttpRequest|\bfetch\s*\(/i.test(src));

timers.clear();const empty=node();empty.getBoundingClientRect=()=>({left:10,top:20,width:240,height:240});empty.querySelectorAll=()=>[];
controller=VP.createController({document,window:{},setTimer:timer,clearTimer:clear});const noPieces=controller.celebrate({gameId:'queens',board:empty,victoryClass:'queens-win'});assert.strictEqual(noPieces.started,true);assert.strictEqual(noPieces.lighthouseCount,0);assert.strictEqual(noPieces.beamCount,0);controller.cancel({removeFinal:true,board:empty,victoryClass:'queens-win'});
timers.clear();const throwing=lighthouseBoard();controller=VP.createController({document,window:{matchMedia(){throw new Error('unsupported')}},setTimer:timer,clearTimer:clear});assert.strictEqual(controller.celebrate({gameId:'queens',board:throwing.board,victoryClass:'queens-win'}).reducedMotion,false);controller.cancel({removeFinal:true,board:throwing.board,victoryClass:'queens-win'});

console.log('v3.1.8-F2 victory presentation: generic parity + LIGHTHOUSES override + local applause PASS');
