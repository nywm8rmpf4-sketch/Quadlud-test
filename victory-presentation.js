/*
 * QUADLUD — victory presentation
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuadludVictoryPresentation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION=5;
  const GENERIC_PROFILE=Object.freeze({id:'generic',confettiCount:22,cleanupMs:1700});
  const LIGHTHOUSES_PROFILE=Object.freeze({id:'lighthouses',confettiCount:0,cleanupMs:1650,reducedCleanupMs:900,beamRangeCells:3});
  const TANGO_PROFILE=Object.freeze({id:'tango-balance',confettiCount:0,cleanupMs:1500,reducedCleanupMs:550});
  const SUDOKU_PROFILE=Object.freeze({id:'sudoku-scan',confettiCount:0,cleanupMs:1500,reducedCleanupMs:550});
  const PATCHES_PROFILE=Object.freeze({id:'patches-assembly',confettiCount:0,cleanupMs:1500,reducedCleanupMs:550});
  const NONOGRAM_PROFILE=Object.freeze({id:'nonogram-reveal',confettiCount:0,cleanupMs:1650,reducedCleanupMs:600});
  const PROFILE_BY_GAME=Object.freeze({queens:LIGHTHOUSES_PROFILE,tango:TANGO_PROFILE,sudoku:SUDOKU_PROFILE,patches:PATCHES_PROFILE,nonogram:NONOGRAM_PROFILE});

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  function profileForGame(gameId){return PROFILE_BY_GAME[String(gameId||'')]||GENERIC_PROFILE}
  function reducedMotionRequested(scope){try{return !!scope?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches}catch(_){return false}}

  function createController({document=null,window=null,random=Math.random,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
    let active=null,cleanupTimer=null;

    function cleanupTransient(){
      if(cleanupTimer!=null){try{clearTimer(cleanupTimer)}catch(_){}cleanupTimer=null}
      if(!active)return false;
      const {board,layer}=active;
      try{layer?.remove?.()}catch(_){}
      try{board?.classList?.remove('board-complete','lighthouses-victory-active','lighthouses-victory-reduced')}catch(_){}
      try{board?.querySelectorAll?.('.lighthouses-victory-halo')?.forEach?.(halo=>halo.classList.remove('lighthouses-victory-halo'))}catch(_){}
      try{board?.querySelectorAll?.('.win-pop')?.forEach?.(cell=>{cell.classList.remove('win-pop');cell.style?.removeProperty?.('--win-delay')})}catch(_){}
      try{board?.querySelectorAll?.('.tango-victory-cell,.sudoku-victory-cell')?.forEach?.(cell=>{cell.classList.remove('tango-victory-cell','tango-victory-sun','tango-victory-moon','sudoku-victory-cell');cell.style?.removeProperty?.('--victory-delay');cell.style?.removeProperty?.('--victory-ring')})}catch(_){}
      try{board?.querySelectorAll?.('.patches-victory-cell,.nonogram-victory-cell')?.forEach?.(cell=>{cell.classList.remove('patches-victory-cell','nonogram-victory-cell','nonogram-victory-filled','nonogram-victory-empty');cell.style?.removeProperty?.('--victory-delay')})}catch(_){ }
      try{board?.classList?.remove('tango-victory-active','sudoku-victory-active','patches-victory-active','nonogram-victory-active','sensorial-victory-reduced')}catch(_){ }
      active=null;return true
    }

    function cancel({removeFinal=false,board=null,victoryClass=''}={}){
      const activeBoard=active?.board||board,activeVictoryClass=active?.victoryClass||victoryClass;
      cleanupTransient();
      const target=board||activeBoard,finalClass=victoryClass||activeVictoryClass;
      if(removeFinal&&target&&finalClass)try{target.classList.remove(finalClass)}catch(_){}
      return true
    }

    function celebrateGeneric({board,victoryClass,profile}){
      board.classList.add('board-complete');
      if(victoryClass)board.classList.add(victoryClass);
      [...(board.children||[])].forEach((cell,index)=>{cell.style?.setProperty?.('--win-delay',`${Math.min(index,80)*16}ms`);cell.classList?.add?.('win-pop')});
      const layer=document.createElement('div');layer.className='celebration-layer';layer.setAttribute?.('aria-hidden','true');
      for(let i=0;i<profile.confettiCount;i++){
        const particle=document.createElement('i');
        particle.style?.setProperty?.('--x',`${8+random()*84}%`);
        particle.style?.setProperty?.('--dx',`${-55+random()*110}px`);
        particle.style?.setProperty?.('--delay',`${random()*220}ms`);
        particle.style?.setProperty?.('--rot',`${random()*500-250}deg`);
        layer.appendChild(particle)
      }
      document.body.appendChild(layer);active={board,layer,victoryClass,profile};
      cleanupTimer=setTimer(()=>cleanupTransient(),profile.cleanupMs);
      return {started:true,profile:profile.id,confettiCount:profile.confettiCount,cleanupMs:profile.cleanupMs}
    }

    function lighthouseGeometry(board,profile){
      const boardRect=board.getBoundingClientRect?.(),pieces=[...(board.querySelectorAll?.('.lighthouse-piece')||[])];
      const layer=document.createElement('div');layer.className='lighthouses-victory-layer';layer.setAttribute?.('aria-hidden','true');
      layer.style?.setProperty?.('--lh-board-left',`${finite(boardRect?.left,0)}px`);
      layer.style?.setProperty?.('--lh-board-top',`${finite(boardRect?.top,0)}px`);
      layer.style?.setProperty?.('--lh-board-width',`${Math.max(0,finite(boardRect?.width,0))}px`);
      layer.style?.setProperty?.('--lh-board-height',`${Math.max(0,finite(boardRect?.height,0))}px`);
      layer.style?.setProperty?.('pointer-events','none');
      let beamCount=0;
      for(const [index,piece] of pieces.entries()){
        const rect=piece.getBoundingClientRect?.();
        if(!boardRect||!rect)continue;
        const cell=piece.closest?.('.cell')||piece.parentElement,cellRect=cell?.getBoundingClientRect?.();
        const fallbackWidth=Math.max(1,finite(rect.width,1)/.68),fallbackHeight=Math.max(1,finite(rect.height,1)/.68);
        const cellSize=Math.max(1,Math.min(finite(cellRect?.width,fallbackWidth),finite(cellRect?.height,fallbackHeight)));
        const range=cellSize*profile.beamRangeCells;
        const origin=document.createElement('span');origin.className='lighthouses-victory-origin';
        origin.style?.setProperty?.('--lh-delay',`${Math.min(index,12)*35}ms`);
        origin.style?.setProperty?.('--lh-x',`${rect.left-boardRect.left+rect.width/2}px`);
        origin.style?.setProperty?.('--lh-y',`${rect.top-boardRect.top+rect.height/2}px`);
        origin.style?.setProperty?.('--lh-range',`${range}px`);
        for(const angle of [0,90,180,270]){
          const beam=document.createElement('i');beam.className='lighthouses-victory-beam';beam.style?.setProperty?.('--lh-angle',`${angle}deg`);origin.appendChild(beam);beamCount++
        }
        layer.appendChild(origin)
      }
      return {layer,lighthouseCount:layer.children?.length||0,beamCount,cascadeStepMs:35}
    }

    function celebrateLighthouses({board,victoryClass,profile}){
      board.classList.add('board-complete');
      if(victoryClass)board.classList.add(victoryClass);
      const reduced=reducedMotionRequested(window),cleanupMs=reduced?profile.reducedCleanupMs:profile.cleanupMs;
      let layer=null,lighthouseCount=0,beamCount=0,cascadeStepMs=0;
      if(reduced){
        board.classList.add('lighthouses-victory-reduced');
        const halos=[...(board.querySelectorAll?.('.lighthouse-halo')||[])];halos.forEach(halo=>halo.classList?.add?.('lighthouses-victory-halo'));lighthouseCount=halos.length
      }else{
        board.classList.add('lighthouses-victory-active');
        const built=lighthouseGeometry(board,profile);layer=built.layer;lighthouseCount=built.lighthouseCount;beamCount=built.beamCount;cascadeStepMs=built.cascadeStepMs;document.body.appendChild?.(layer)
      }
      active={board,layer,victoryClass,profile};cleanupTimer=setTimer(()=>cleanupTransient(),cleanupMs);
      return {started:true,profile:profile.id,confettiCount:0,cleanupMs,lighthouseCount,beamCount,cascadeStepMs,reducedMotion:reduced}
    }

    function celebrateGridSignature({board,victoryClass,profile}){
      const reduced=reducedMotionRequested(window),cells=[...(board.children||[])],cleanupMs=reduced?profile.reducedCleanupMs:profile.cleanupMs;
      board.classList.add('board-complete',profile.id==='tango-balance'?'tango-victory-active':'sudoku-victory-active');if(victoryClass)board.classList.add(victoryClass);if(reduced)board.classList.add('sensorial-victory-reduced');
      cells.forEach((cell,index)=>{const r=Math.floor(index/6),c=index%6;
        if(profile.id==='tango-balance'){
          const symbol=String(cell.querySelector?.('.tango-symbol')?.textContent||'');cell.classList.add('tango-victory-cell',symbol.includes('☀')?'tango-victory-sun':'tango-victory-moon');cell.style?.setProperty?.('--victory-delay',`${(symbol.includes('☀')?r+c:8+r+c)*35}ms`)
        }else{
          const ring=Math.max(Math.abs(r-2.5),Math.abs(c-2.5));cell.classList.add('sudoku-victory-cell');cell.style?.setProperty?.('--victory-delay',`${(r+c)*45}ms`);cell.style?.setProperty?.('--victory-ring',`${ring*90}ms`)
        }
      });
      active={board,layer:null,victoryClass,profile};cleanupTimer=setTimer(()=>cleanupTransient(),cleanupMs);
      return {started:true,profile:profile.id,confettiCount:0,cleanupMs,cellCount:cells.length,reducedMotion:reduced}
    }

    function boardColumns(board,cells){
      const declared=String(board.closest?.('[data-ng-size]')?.dataset?.ngSize||'').match(/^\d+x(\d+)$/);if(declared)return Math.max(1,Number(declared[1]));
      const square=Math.sqrt(cells.length);return Number.isInteger(square)&&square>0?square:Math.max(1,cells.length)
    }

    function celebrateAssemblySignature({board,victoryClass,profile}){
      const reduced=reducedMotionRequested(window),cells=[...(board.children||[])],cols=boardColumns(board,cells),cleanupMs=reduced?profile.reducedCleanupMs:profile.cleanupMs;
      board.classList.add('board-complete',profile.id==='patches-assembly'?'patches-victory-active':'nonogram-victory-active');if(victoryClass)board.classList.add(victoryClass);if(reduced)board.classList.add('sensorial-victory-reduced');
      let filledCount=0;
      cells.forEach((cell,index)=>{const r=Math.floor(index/cols),c=index%cols;cell.style?.setProperty?.('--victory-delay',`${(r+c)*38}ms`);
        if(profile.id==='patches-assembly')cell.classList.add('patches-victory-cell');
        else{const filled=cell.classList?.contains?.('ng-filled');cell.classList.add('nonogram-victory-cell',filled?'nonogram-victory-filled':'nonogram-victory-empty');if(filled)filledCount++}
      });
      active={board,layer:null,victoryClass,profile};cleanupTimer=setTimer(()=>cleanupTransient(),cleanupMs);
      return {started:true,profile:profile.id,confettiCount:0,cleanupMs,cellCount:cells.length,filledCount,reducedMotion:reduced}
    }

    function celebrate({gameId='',board=null,victoryClass=''}={}){
      if(!board||!document?.body)return {started:false,reason:'board-unavailable'};
      cleanupTransient();
      const profile=profileForGame(gameId);
      if(profile.id==='lighthouses')return celebrateLighthouses({board,victoryClass,profile});
      if(profile.id==='tango-balance'||profile.id==='sudoku-scan')return celebrateGridSignature({board,victoryClass,profile});
      if(profile.id==='patches-assembly'||profile.id==='nonogram-reveal')return celebrateAssemblySignature({board,victoryClass,profile});
      return celebrateGeneric({board,victoryClass,profile})
    }

    return Object.freeze({
      VERSION,
      profileForGame,
      celebrate,
      cancel
    })
  }

  return Object.freeze({VERSION,GENERIC_PROFILE,LIGHTHOUSES_PROFILE,TANGO_PROFILE,SUDOKU_PROFILE,PATCHES_PROFILE,NONOGRAM_PROFILE,profileForGame,createController})
});
