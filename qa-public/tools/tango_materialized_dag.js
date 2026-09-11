#!/usr/bin/env node
'use strict';
/*
 * QUADLUD — lossless structural DAG codec for materialized Soleil-Lune Tutor proofs
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
const SCHEMA=1;

function pack(values){
  if(!Array.isArray(values))throw new Error('materialized DAG pack expects an array');
  const keys=[],strings=[],nodes=[],keyIds=new Map(),stringIds=new Map(),nodeIds=new Map();
  const keyId=key=>{if(keyIds.has(key))return keyIds.get(key);const id=keys.length;keyIds.set(key,id);keys.push(key);return id};
  const stringId=value=>{if(stringIds.has(value))return stringIds.get(value);const id=strings.length;stringIds.set(value,id);strings.push(value);return id};
  function intern(value){
    let identity,node;
    if(value===null){identity='z';node=[5]}
    else if(typeof value==='boolean'){identity=value?'b1':'b0';node=[4,value?1:0]}
    else if(typeof value==='number'){
      if(!Number.isFinite(value))throw new Error('materialized DAG only supports finite JSON numbers');
      identity=`n:${String(value)}`;node=[3,value]
    }else if(typeof value==='string'){
      const id=stringId(value);identity=`s:${id}`;node=[2,id]
    }else if(Array.isArray(value)){
      const children=value.map(intern);identity=`a:${children.join(',')}`;node=[0,...children]
    }else if(value&&typeof value==='object'){
      const flat=[];for(const key of Object.keys(value))flat.push(keyId(key),intern(value[key]));
      identity=`o:${flat.join(',')}`;node=[1,...flat]
    }else throw new Error(`materialized DAG unsupported value type ${typeof value}`);
    if(nodeIds.has(identity))return nodeIds.get(identity);
    const id=nodes.length;nodeIds.set(identity,id);nodes.push(node);return id
  }
  const roots=values.map(intern);
  return {schema:SCHEMA,keys,strings,nodes,roots}
}

function validate(dag){
  if(!dag||Number(dag.schema)!==SCHEMA||!Array.isArray(dag.keys)||!Array.isArray(dag.strings)||!Array.isArray(dag.nodes)||!Array.isArray(dag.roots))return false;
  if(dag.keys.some(key=>typeof key!=='string')||dag.strings.some(value=>typeof value!=='string'))return false;
  for(let index=0;index<dag.nodes.length;index++){
    const node=dag.nodes[index];if(!Array.isArray(node)||!node.length||!Number.isInteger(node[0]))return false;
    const type=node[0];
    if(type===0){if(node.slice(1).some(id=>!Number.isInteger(id)||id<0||id>=index))return false}
    else if(type===1){
      if(node.length%2!==1)return false;const seenKeys=new Set();
      for(let i=1;i<node.length;i+=2){const key=node[i],child=node[i+1];if(!Number.isInteger(key)||key<0||key>=dag.keys.length||seenKeys.has(key)||!Number.isInteger(child)||child<0||child>=index)return false;seenKeys.add(key)}
    }else if(type===2){if(node.length!==2||!Number.isInteger(node[1])||node[1]<0||node[1]>=dag.strings.length)return false}
    else if(type===3){if(node.length!==2||!Number.isFinite(node[1]))return false}
    else if(type===4){if(node.length!==2||(node[1]!==0&&node[1]!==1))return false}
    else if(type===5){if(node.length!==1)return false}
    else return false
  }
  return dag.roots.every(id=>Number.isInteger(id)&&id>=0&&id<dag.nodes.length)
}

function decode(dag,rootIndex){
  if(!validate(dag)||!Number.isInteger(rootIndex)||rootIndex<0||rootIndex>=dag.roots.length)return null;
  const memo=new Map();
  function expand(id){
    if(memo.has(id))return memo.get(id);
    const node=dag.nodes[id],type=node[0];let value;
    if(type===5)value=null;
    else if(type===4)value=node[1]===1;
    else if(type===3)value=node[1];
    else if(type===2)value=dag.strings[node[1]];
    else if(type===0){value=[];memo.set(id,value);for(let i=1;i<node.length;i++)value.push(expand(node[i]));return value}
    else if(type===1){value={};memo.set(id,value);for(let i=1;i<node.length;i+=2)value[dag.keys[node[i]]]=expand(node[i+1]);return value}
    memo.set(id,value);return value
  }
  return expand(dag.roots[rootIndex])
}

module.exports=Object.freeze({SCHEMA,pack,validate,decode});
