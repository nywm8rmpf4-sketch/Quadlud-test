'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'../GitHub'),VP=require(path.join(root,'victory-presentation.js'));
class ClassList{constructor(items=[]){this.s=new Set(items)}add(...xs){xs.forEach(x=>this.s.add(x))}remove(...xs){xs.forEach(x=>this.s.delete(x))}contains(x){return this.s.has(x)}}
function style(){const m=new Map();return{setProperty:(k,v)=>m.set(k,v),removeProperty:k=>m.delete(k),getPropertyValue:k=>m.get(k)||''}}
function cell(...classes){return{classList:new ClassList(classes),style:style()}}
function board(cells,size=''){return{children:cells,classList:new ClassList(),querySelectorAll(selector){if(selector.includes('patches-victory-cell'))return cells.filter(x=>x.classList.contains('patches-victory-cell')||x.classList.contains('nonogram-victory-cell'));return[]},closest(){return size?{dataset:{ngSize:size}}:null}}}
const document={body:{},createElement(){throw new Error('specialized F signatures must not create an overlay')}};
let timers=[];const controller=VP.createController({document,window:{matchMedia:()=>({matches:false})},setTimer:(fn,ms)=>(timers.push({fn,ms}),timers.length),clearTimer(){}});
const patches=board(Array.from({length:36},()=>cell('patch-cell','paint'))),p=controller.celebrate({gameId:'patches',board:patches});
assert.deepStrictEqual({profile:p.profile,count:p.cellCount,confetti:p.confettiCount},{profile:'patches-assembly',count:36,confetti:0});assert(patches.classList.contains('patches-victory-active'));assert(patches.children.every(x=>x.classList.contains('patches-victory-cell')&&x.style.getPropertyValue('--victory-delay')));
controller.cancel();assert(!patches.classList.contains('patches-victory-active'));assert(patches.children.every(x=>!x.classList.contains('patches-victory-cell')));
const mosaicCells=Array.from({length:25},(_,i)=>cell('ng-cell',i%3?'ng-filled':'ng-empty')),mosaic=board(mosaicCells,'5x5'),m=controller.celebrate({gameId:'nonogram',board:mosaic});
assert.strictEqual(m.profile,'nonogram-reveal');assert.strictEqual(m.cellCount,25);assert.strictEqual(m.filledCount,mosaicCells.filter(x=>x.classList.contains('ng-filled')).length);assert(mosaic.classList.contains('nonogram-victory-active'));assert(mosaicCells.every(x=>x.classList.contains('nonogram-victory-cell')));
const reducedBoard=board(Array.from({length:25},()=>cell('ng-cell','ng-filled')),'5x5'),reducedController=VP.createController({document,window:{matchMedia:()=>({matches:true})},setTimer:(fn,ms)=>(timers.push({fn,ms}),timers.length),clearTimer(){}}),reduced=reducedController.celebrate({gameId:'nonogram',board:reducedBoard});assert(reduced.reducedMotion&&reduced.cleanupMs===600&&reducedBoard.classList.contains('sensorial-victory-reduced'));
const src=fs.readFileSync(path.join(root,'victory-presentation.js'),'utf8');assert(!/solutionGrid|hiddenSolution|validationState|current\.sol/.test(src),'F signatures must remain visible-DOM-only');assert(!/AudioEvents|AudioContext|QuadludAudio/.test(src),'F signatures must remain visual-only');
console.log('v3.1.9-F Rectangles + Mosaïque victory contract: PASS');
