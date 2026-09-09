/*
 * QUADLUD — compact Soleil-Lune logical trace codec
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 * Proprietary software. Copying, modification, redistribution or exploitation
 * without prior written authorization is prohibited.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.QuadludTangoTraceCodec=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION=1;
  const ENCODING='flat-int-v1';
  const RULES=Object.freeze([
    'GIVEN_VALUE','EXPLICIT_RELATION','RELATION_PROPAGATION','RELATION_CLOSURE',
    'TRIPLE_CONSTRAINT','BALANCE_QUOTA','BALANCE_RELATION','RELATION_BALANCE',
    'RELATION_BALANCE_COMPONENT','LINE_DOMAIN_SUPPORT','ASSUMPTION_CONTRADICTION','COMMON_CONSEQUENCE'
  ]);
  const RULE_INDEX=Object.freeze(Object.fromEntries(RULES.map((rule,index)=>[rule,index])));

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function integer(value,label,min=0){let n=Number(value);if(!Number.isInteger(n)||n<min)throw new Error(`Invalid compact Tango trace ${label}`);return n}
  function cellIndex(cell,n){if(!Array.isArray(cell)||cell.length!==2)throw new Error('Invalid compact Tango trace cell');let r=integer(cell[0],'cell row'),c=integer(cell[1],'cell column');if(r>=n||c>=n)throw new Error('Invalid compact Tango trace cell');return r*n+c}
  function cellFromIndex(index,n){index=integer(index,'cell index');if(index>=n*n)throw new Error('Invalid compact Tango trace cell index');return [Math.floor(index/n),index%n]}
  function relationName(parity){return Number(parity)===0?'SAME':'OPPOSITE'}

  function encode(logicTrace,n=6){
    if(!logicTrace||!Array.isArray(logicTrace.trace))throw new Error('Invalid Soleil-Lune logical trace');
    n=integer(n,'board size',2);
    const data=[];
    for(const step of logicTrace.trace){
      const ruleIndex=RULE_INDEX[step?.rule];if(!Number.isInteger(ruleIndex))throw new Error(`Unknown Soleil-Lune trace rule: ${step?.rule}`);
      const conclusions=Array.isArray(step?.conclusions)?step.conclusions:[];
      data.push(ruleIndex,integer(step.policyTier,'policy tier'),integer(step.engineTechniqueLevel,'engine technique level'),integer(step.rank,'rank'),conclusions.length);
      for(const conclusion of conclusions){
        if(conclusion?.type==='VALUE'){
          const value=Number(conclusion.value);if(value!==0&&value!==1)throw new Error('Invalid Soleil-Lune VALUE conclusion');
          data.push(0,cellIndex(conclusion.cell,n),value);
        }else if(conclusion?.type==='RELATION'){
          const parity=Number(conclusion.parity);if(parity!==0&&parity!==1)throw new Error('Invalid Soleil-Lune RELATION conclusion');
          data.push(1,cellIndex(conclusion.a,n),cellIndex(conclusion.b,n),parity);
        }else throw new Error(`Unknown Soleil-Lune conclusion type: ${conclusion?.type}`);
      }
    }
    return Object.freeze({
      schema:2,
      codecVersion:VERSION,
      encoding:ENCODING,
      policy:String(logicTrace.policy||''),
      sourceFingerprint:String(logicTrace.sourceFingerprint||''),
      tierIndex:integer(logicTrace.tierIndex,'tier index'),
      stepCount:logicTrace.trace.length,
      data
    });
  }

  function decode(compact,n=6){
    if(!compact||compact.schema!==2||compact.codecVersion!==VERSION||compact.encoding!==ENCODING||!Array.isArray(compact.data))throw new Error('Invalid compact Soleil-Lune trace payload');
    n=integer(n,'board size',2);
    let offset=0;const trace=[];
    for(let stepIndex=0;stepIndex<integer(compact.stepCount,'step count');stepIndex++){
      if(offset+5>compact.data.length)throw new Error('Truncated compact Soleil-Lune trace step');
      const ruleIndex=integer(compact.data[offset++],'rule index'),rule=RULES[ruleIndex];if(!rule)throw new Error('Unknown compact Soleil-Lune rule index');
      const policyTier=integer(compact.data[offset++],'policy tier'),engineTechniqueLevel=integer(compact.data[offset++],'engine technique level'),rank=integer(compact.data[offset++],'rank'),conclusionCount=integer(compact.data[offset++],'conclusion count');
      const conclusions=[];
      for(let i=0;i<conclusionCount;i++){
        if(offset>=compact.data.length)throw new Error('Truncated compact Soleil-Lune conclusion');
        const type=integer(compact.data[offset++],'conclusion type');
        if(type===0){
          if(offset+2>compact.data.length)throw new Error('Truncated compact Soleil-Lune VALUE conclusion');
          const cell=cellFromIndex(compact.data[offset++],n),value=Number(compact.data[offset++]);if(value!==0&&value!==1)throw new Error('Invalid compact Soleil-Lune VALUE');
          conclusions.push({type:'VALUE',cell,value,rank});
        }else if(type===1){
          if(offset+3>compact.data.length)throw new Error('Truncated compact Soleil-Lune RELATION conclusion');
          const a=cellFromIndex(compact.data[offset++],n),b=cellFromIndex(compact.data[offset++],n),parity=Number(compact.data[offset++]);if(parity!==0&&parity!==1)throw new Error('Invalid compact Soleil-Lune relation parity');
          conclusions.push({type:'RELATION',a,b,parity,relation:relationName(parity),rank});
        }else throw new Error(`Unknown compact Soleil-Lune conclusion type ${type}`);
      }
      trace.push({rule,policyTier,engineTechniqueLevel,rank,conclusions});
    }
    if(offset!==compact.data.length)throw new Error('Trailing data in compact Soleil-Lune trace');
    return {
      schema:1,
      policy:String(compact.policy||''),
      sourceFingerprint:String(compact.sourceFingerprint||''),
      tierIndex:integer(compact.tierIndex,'tier index'),
      stepCount:trace.length,
      trace
    };
  }

  function roundTripEqual(logicTrace,n=6){try{return JSON.stringify(decode(encode(logicTrace,n),n))===JSON.stringify(logicTrace)}catch(_){return false}}
  function encodedIntegerCount(compact){return Array.isArray(compact?.data)?compact.data.length:0}

  return Object.freeze({VERSION,ENCODING,RULES,encode,decode,roundTripEqual,encodedIntegerCount,_test:Object.freeze({cellIndex,cellFromIndex,relationName,clone})});
});
