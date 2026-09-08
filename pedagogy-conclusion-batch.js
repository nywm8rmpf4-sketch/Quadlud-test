/*
 * QUADLUD — generic demonstrated-conclusion cognitive batch contract
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludPedagogyConclusionBatch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION=1;
const SCHEMA='quadlud-cognitive-conclusion-batch-v1';

function copy(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function plainObject(value){if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Conclusion batch item must be an object');return value}
function nonEmpty(value,name){const text=String(value??'').trim();if(!text)throw new TypeError(`${name} must be non-empty`);return text}
function itemKey(item,index){const value=plainObject(item),key=String(value.key??'').trim();return key||`item:${index}`}
function normalizeItems(items){
  if(!Array.isArray(items)||!items.length)throw new TypeError('Conclusion batch items must be a non-empty array');
  const seen=new Set();return items.map((item,index)=>{const out=copy(plainObject(item)),key=itemKey(out,index);if(seen.has(key))throw new TypeError(`Duplicate conclusion batch item key: ${key}`);seen.add(key);out.key=key;return Object.freeze(out)})
}
function create({sourceKey,items,primaryKey=null,metadata=null}={}){
  const normalized=normalizeItems(items),wanted=primaryKey==null?normalized[0].key:String(primaryKey),primaryIndex=normalized.findIndex(item=>item.key===wanted);
  if(primaryIndex<0)throw new TypeError(`Conclusion batch primary key not found: ${wanted}`);
  const ordered=[normalized[primaryIndex],...normalized.filter((_,index)=>index!==primaryIndex)];
  const id=`${nonEmpty(sourceKey,'sourceKey')}|${ordered.map(item=>item.key).join('|')}`;
  return Object.freeze({schema:SCHEMA,version:VERSION,id,sourceKey:String(sourceKey),size:ordered.length,items:Object.freeze(ordered),metadata:metadata==null?null:Object.freeze(copy(metadata))})
}
function remaining(batch,{consumedKeys=[],isPlayable=null}={}){
  if(!batch||batch.schema!==SCHEMA||!Array.isArray(batch.items))return Object.freeze([]);
  const consumed=new Set((consumedKeys||[]).map(String)),playable=typeof isPlayable==='function'?isPlayable:()=>true;
  return Object.freeze(batch.items.filter(item=>!consumed.has(String(item.key))&&playable(item)).map(copy))
}
function firstRemaining(batch,options={}){return remaining(batch,options)[0]||null}
function label(major,minorIndex=0,count=1){
  const x=Number(major);if(!Number.isInteger(x)||x<1)return '';
  const n=Math.max(1,Number(count)||1),minor=Math.max(0,Number(minorIndex)||0);
  return n>1?`${x}.${minor+1}`:String(x)
}
function labels(major,count=1){const n=Math.max(1,Number(count)||1);return Object.freeze(Array.from({length:n},(_,index)=>label(major,index,n)))}

return Object.freeze({VERSION,SCHEMA,create,remaining,firstRemaining,label,labels,_test:Object.freeze({normalizeItems,itemKey})});
});
