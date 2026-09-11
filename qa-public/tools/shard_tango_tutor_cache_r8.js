#!/usr/bin/env node
/*
 * QUADLUD — Soleil-Lune R8 difficulty-shard builder
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const SOURCE=process.argv[2]?path.resolve(process.argv[2]):path.join(ROOT,'tango-tutor-cache-data-r8.js');
const OUT=process.argv[3]?path.resolve(process.argv[3]):ROOT;
const DIFFS=['easy','medium','hard','expert'];
const SHARD_SCHEMA=10;
const SHARD_VERSION='tango-tutor-cache-r8-sync5-cognitive-sharded-lz4';
const CODEC='lz4-block-v1';
const MAX_FILE_BYTES=1000000;
const MAX_CHAIN=32;

function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex')}
function copy(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function requireFresh(file){delete require.cache[require.resolve(file)];return require(file)}

function reachableNodeIds(dag,rootIndices){
  const seen=new Set(),stack=rootIndices.map(i=>dag.roots[i]);
  while(stack.length){
    const id=stack.pop();if(seen.has(id))continue;seen.add(id);const node=dag.nodes[id],type=node[0];
    if(type===0)for(let i=1;i<node.length;i++)stack.push(node[i]);
    else if(type===1)for(let i=2;i<node.length;i+=2)stack.push(node[i]);
  }
  return [...seen].sort((a,b)=>a-b)
}
function remapList(values){const list=[...new Set(values)].sort((a,b)=>a-b),map=new Map(list.map((v,i)=>[v,i]));return {list,map}}
function buildShard(data,diff){
  const steps=copy(data.steps[diff]);
  const usedSelection=remapList(steps.map(s=>s[6])),usedProof=remapList(steps.map(s=>s[9]));
  const signatureIds=[],rootIds=[];
  for(const s of steps){(s[2]===0?signatureIds:rootIds).push(s[5]);(s[7]===0?signatureIds:rootIds).push(s[8])}
  const usedSignatures=remapList(signatureIds),usedRoots=remapList(rootIds);
  const pairs=usedSignatures.list.map(id=>data.signaturePairs[id]);
  const usedRules=remapList(pairs.map(p=>p[0])),usedPayloads=remapList(pairs.filter(p=>p[1]>=0).map(p=>p[1]));
  const signaturePairs=pairs.map(([rule,payload])=>[usedRules.map.get(rule),payload<0?-1:usedPayloads.map.get(payload)]);
  const oldDag=data.materializedDag,usedNodes=reachableNodeIds(oldDag,usedRoots.list),nodeMap=new Map(usedNodes.map((v,i)=>[v,i]));
  const keyIds=[],stringIds=[];
  for(const old of usedNodes){const n=oldDag.nodes[old];if(n[0]===1)for(let i=1;i<n.length;i+=2)keyIds.push(n[i]);else if(n[0]===2)stringIds.push(n[1])}
  const usedKeys=remapList(keyIds),usedStrings=remapList(stringIds),nodes=[];
  for(const old of usedNodes){const n=oldDag.nodes[old],type=n[0];let x;
    if(type===0)x=[0,...n.slice(1).map(id=>nodeMap.get(id))];
    else if(type===1){x=[1];for(let i=1;i<n.length;i+=2)x.push(usedKeys.map.get(n[i]),nodeMap.get(n[i+1]))}
    else if(type===2)x=[2,usedStrings.map.get(n[1])];
    else x=n.slice();nodes.push(x)
  }
  const materializedDag={schema:oldDag.schema,keys:usedKeys.list.map(i=>oldDag.keys[i]),strings:usedStrings.list.map(i=>oldDag.strings[i]),nodes,roots:usedRoots.list.map(i=>nodeMap.get(oldDag.roots[i]))};
  for(const s of steps){
    s[5]=s[2]===0?usedSignatures.map.get(s[5]):usedRoots.map.get(s[5]);s[6]=usedSelection.map.get(s[6]);
    s[8]=s[7]===0?usedSignatures.map.get(s[8]):usedRoots.map.get(s[8]);s[9]=usedProof.map.get(s[9]);
  }
  return {
    schema:SHARD_SCHEMA,version:SHARD_VERSION,difficulty:diff,sourcePoolVersion:data.sourcePoolVersion,
    tutorContract:copy(data.tutorContract),tutorPlannerToken:data.tutorPlannerToken,humanPolicy:data.humanPolicy,proofPolicy:data.proofPolicy,
    cognitiveModel:data.cognitiveModel,cognitivePatternCatalog:data.cognitivePatternCatalog,
    rules:usedRules.list.map(i=>data.rules[i]),payloads:usedPayloads.list.map(i=>data.payloads[i]),signaturePairs,
    materializedDag,selectionMeta:usedSelection.list.map(i=>copy(data.selectionMeta[i])),proofMeta:usedProof.list.map(i=>copy(data.proofMeta[i])),
    puzzleCount:Number(data.puzzleCounts[diff]),steps
  }
}

function lz4Compress(input,maxChain=MAX_CHAIN){
  const src=Buffer.isBuffer(input)?input:Buffer.from(input),n=src.length,out=[];
  const HASH_BITS=16,HASH_SIZE=1<<HASH_BITS,head=new Int32Array(HASH_SIZE),prev=new Int32Array(n);head.fill(-1);prev.fill(-1);
  const hash4=i=>{const v=src.readUInt32LE(i);return (Math.imul(v,0x9e3779b1)>>>0)>>>16};
  const add=pos=>{if(pos+4>n)return;const h=hash4(pos);prev[pos]=head[h];head[h]=pos};
  const emitLen=value=>{let x=value;while(x>=255){out.push(255);x-=255}out.push(x)};
  let anchor=0,i=0;
  while(i+4<=n){
    const h=hash4(i);let cand=head[h],bestLen=0,bestPos=-1,depth=0;
    while(cand>=0&&i-cand<=65535&&depth<maxChain){
      if(src[cand]===src[i]&&src[cand+1]===src[i+1]&&src[cand+2]===src[i+2]&&src[cand+3]===src[i+3]){
        let len=4,max=n-i;while(len<max&&src[cand+len]===src[i+len])len++;
        if(len>bestLen){bestLen=len;bestPos=cand;if(len>1024)break}
      }
      cand=prev[cand];depth++
    }
    if(bestLen>=4){
      const literalLength=i-anchor,tokenIndex=out.length;out.push(0);let token=(Math.min(15,literalLength)<<4);
      if(literalLength>=15)emitLen(literalLength-15);for(let p=anchor;p<i;p++)out.push(src[p]);
      const offset=i-bestPos;out.push(offset&255,(offset>>>8)&255);
      const matchLength=bestLen-4;token|=Math.min(15,matchLength);if(matchLength>=15)emitLen(matchLength-15);out[tokenIndex]=token;
      const end=i+bestLen;for(let p=i;p<Math.min(end,n-3);p++)add(p);i=end;anchor=i;
    }else{add(i);i++}
  }
  const literalLength=n-anchor,tokenIndex=out.length;out.push(0);out[tokenIndex]=Math.min(15,literalLength)<<4;if(literalLength>=15)emitLen(literalLength-15);for(let p=anchor;p<n;p++)out.push(src[p]);
  return Buffer.from(out)
}
function lz4Decompress(block,expectedBytes){
  const src=Buffer.from(block),out=Buffer.allocUnsafe(expectedBytes);let p=0,o=0;
  while(p<src.length){const token=src[p++];let lit=token>>>4;if(lit===15){let x;do{x=src[p++];lit+=x}while(x===255)}src.copy(out,o,p,p+lit);p+=lit;o+=lit;if(p>=src.length)break;
    const offset=src[p]|(src[p+1]<<8);p+=2;if(!offset||offset>o)throw new Error('Invalid LZ4 offset');let match=(token&15)+4;if((token&15)===15){let x;do{x=src[p++];match+=x}while(x===255)}
    let start=o-offset;for(let k=0;k<match;k++)out[o++]=out[start+k]
  }
  if(o!==expectedBytes)throw new Error(`LZ4 size mismatch: ${o} != ${expectedBytes}`);return out
}
function wrapperFor(diff,json,compressed){
  const envelope={schema:1,difficulty:diff,codec:CODEC,dataSchema:SHARD_SCHEMA,dataVersion:SHARD_VERSION,sourcePoolVersion:'tango-runtime-pool-r8',tutorContractDigest:null,puzzleCount:120,stepCount:0,materializedRootCount:0,uncompressedBytes:json.length,contentSha256:sha256(json),compressedSha256:sha256(compressed),payload:compressed.toString('base64')};
  const parsed=JSON.parse(json.toString('utf8'));envelope.tutorContractDigest=String(parsed.tutorContract?.digest||'');envelope.puzzleCount=parsed.puzzleCount;envelope.stepCount=parsed.steps.length;envelope.materializedRootCount=parsed.materializedDag.roots.length;
  return `/* QUADLUD — synchronized generated Soleil-Lune Tutor cache R8 ${diff}. Copyright © 2026 Serge Benoliel. All rights reserved. */\n(function(root){'use strict';const e=${JSON.stringify(envelope)};const bag=root.QuadludTangoTutorCacheShardEnvelopesR8||(root.QuadludTangoTutorCacheShardEnvelopesR8={});bag[e.difficulty]=e;const c=root.QuadludTangoTutorPrecomputedCache;if(c&&typeof c.registerEncodedShard==='function'){try{c.registerEncodedShard(e)}catch(_){}}if(typeof module!=='undefined'&&module.exports)module.exports=e;})(typeof globalThis!=='undefined'?globalThis:this);\n`;
}

fs.mkdirSync(OUT,{recursive:true});const source=requireFresh(SOURCE);const report={source:path.relative(ROOT,SOURCE),sourceSha256:sha256(fs.readFileSync(SOURCE)),schema:SHARD_SCHEMA,version:SHARD_VERSION,codec:CODEC,maxFileBytes:MAX_FILE_BYTES,difficulties:{}};
for(const diff of DIFFS){
  const shard=buildShard(source,diff),json=Buffer.from(JSON.stringify(shard),'utf8'),compressed=lz4Compress(json),roundtrip=lz4Decompress(compressed,json.length);
  if(!roundtrip.equals(json))throw new Error(`${diff}: LZ4 roundtrip mismatch`);
  const filename=`tango-tutor-cache-r8-${diff}.js`,content=wrapperFor(diff,json,compressed),bytes=Buffer.byteLength(content);
  if(bytes>=MAX_FILE_BYTES)throw new Error(`${diff}: shard ${bytes} exceeds ${MAX_FILE_BYTES}`);
  fs.writeFileSync(path.join(OUT,filename),content);
  report.difficulties[diff]={filename,bytes,rawJsonBytes:json.length,compressedBytes:compressed.length,contentSha256:sha256(json),fileSha256:sha256(Buffer.from(content)),steps:shard.steps.length,puzzles:shard.puzzleCount,dagNodes:shard.materializedDag.nodes.length,dagRoots:shard.materializedDag.roots.length};
}
const reportPath=path.join(OUT,'tango-tutor-cache-r8-shards-report.json');fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log('TANGO_R8_SHARDS_BUILT',JSON.stringify(report));
