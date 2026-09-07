from pathlib import Path
import importlib.util
import json
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
JOURNEY = HERE / 'v319-semantic-tango-tutor-journey-browser.test.py'
spec = importlib.util.spec_from_file_location('v319_semantic_journey', JOURNEY)
journey = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(journey)


def current_action(page):
    return page.evaluate("""()=>{const el=document.querySelector('.walkthrough-current-action');if(!el)return null;const r=Number(el.dataset.r),c=Number(el.dataset.c);return Number.isInteger(r)&&Number.isInteger(c)?`${String.fromCharCode(65+r)}${c+1}`:null}""")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport=journey.VIEWPORT, locale='fr-FR', has_touch=True, is_mobile=True)
        page = context.new_page()
        journey.load_runtime(page)
        journey.open_real_tango_expert(page)
        page.locator('#walkthroughBtn').click()
        page.wait_for_selector('.walkthrough-panel')
        page.wait_for_timeout(120)

        seen = []
        for _ in range(24):
            action = current_action(page)
            if action:
                seen.append(action)
            if action == 'D5':
                break
            proof_next = page.locator('#walkthroughProofNext')
            if proof_next.count() and proof_next.is_visible() and not proof_next.is_disabled():
                proof_next.click(timeout=10000)
            else:
                nxt = page.locator('#walkthroughNext')
                assert nxt.count() and nxt.is_visible() and not nxt.is_disabled(), {'seen': seen, 'action': action}
                nxt.click(timeout=10000)
            page.wait_for_timeout(120)

        assert current_action(page) == 'D5', {'seen': seen, 'current': current_action(page)}

        profile = page.evaluate("""()=>{
          const s=typeof walkthroughSession!=='undefined'?walkthroughSession:null;
          const P=globalThis.QuadludTangoPlayedMovePlanner;
          const TD=globalThis.TangoDifficulty;
          if(!s||!P||!P._test||!TD)throw new Error('missing Tango Tutor forensic runtime');
          const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
          const puzzle={n:s.work?.n||s.base?.n||6,state:copy(s.work?.state),edges:copy(s.work?.edges||s.base?.edges||[])};
          const engine=P.sessionFromPublicBoard(puzzle,s.work.state);
          const tier=3, options={}, now=()=>performance.now();
          const allowed=P._test.allowedDirectDeductions(engine,tier);

          function visibleConclusion(session,deduction){
            const values=[];
            for(const c of deduction?.conclusions||[]){
              if(c?.type!=='VALUE'||!Array.isArray(c.cell)||(Number(c.value)!==0&&Number(c.value)!==1))continue;
              const r=Number(c.cell[0]),col=Number(c.cell[1]);
              if(session?.state?.[r]?.[col]===-1)values.push({target:[r,col],value:Number(c.value)});
            }
            values.sort((a,b)=>a.target[0]-b.target[0]||a.target[1]-b.target[1]||a.value-b.value);
            return values[0]||null;
          }
          function relationOnly(deduction){
            const cs=deduction?.conclusions||[];
            return cs.length>0&&cs.every(c=>c?.type==='RELATION'&&Array.isArray(c.a)&&Array.isArray(c.b));
          }
          function lightApplyRelations(session,deduction){
            if(!relationOnly(deduction))return false;
            const applied=copy(deduction);applied.id='D'+(++session.dedSeq);
            let changed=false;
            for(const c of applied.conclusions){
              const old=session.relationBetween(c.a,c.b);
              if(old&&Number(old.parity)===Number(c.parity)&&Number(old.rank)<=Number(applied.rank||0))continue;
              const fact=session.addBaseRelation(c.a,c.b,Number(c.parity),{rank:Number(applied.rank)||0,deductionId:applied.id,dependencies:[applied.id],source:'derived'});
              if(fact)changed=true;
            }
            if(!changed)return false;
            session.appliedDeductions.push(applied);
            session.rebuildRelationClosure();
            return true;
          }
          function stateSignature(session){
            const values=(session.state||[]).map(row=>row.join(',')).join('/');
            const relations=[...session.relationClosure.values()].map(rel=>{
              const a=rel.a||[],b=rel.b||[];
              return `${a[0]}:${a[1]}|${b[0]}:${b[1]}=${Number(rel.parity)}@${Number(rel.rank)||0}`;
            }).sort().join(';');
            return `${values}#${relations}`;
          }
          function advancedStructural(result){
            const d=result?.deduction||null;
            return {budgetHit:!!result?.budgetHit,rule:String(d?.rule||''),conclusions:copy(d?.conclusions||[])};
          }

          const advancedCache=new Map();let advancedCacheHits=0,advancedCacheMisses=0,advancedDiscoveryMs=0;
          function cachedLightPlan(first){
            const fork=engine.clone(),rules=[],start=now();
            let deduction=copy(first),preAdvancedSignature=null;
            for(let step=1;step<=48;step++){
              const visible=visibleConclusion(fork,deduction);
              rules.push(String(deduction?.rule||''));
              if(visible)return {status:'move',...visible,engineStepCount:step,visibleRule:String(deduction?.rule||''),rules,ms:now()-start,preAdvancedSignature};
              if(!lightApplyRelations(fork,deduction))return {status:'unsupported',engineStepCount:step,rules,ms:now()-start,preAdvancedSignature};
              const direct=P._test.allowedDirectDeductions(fork,tier);
              if(direct.length){deduction=copy(direct[0]);continue}
              preAdvancedSignature=stateSignature(fork);
              let next=advancedCache.get(preAdvancedSignature);
              if(next){advancedCacheHits++}
              else{
                const t=now();next=TD.nextAllowedDeduction(fork,tier,false);advancedDiscoveryMs+=now()-t;
                advancedCache.set(preAdvancedSignature,copy(next));advancedCacheMisses++;
              }
              deduction=copy(next?.deduction||null);
              if(!deduction)return {status:next?.budgetHit?'budget-exhausted':'blocked',engineStepCount:step,rules,ms:now()-start,preAdvancedSignature};
              const advancedVisible=visibleConclusion(fork,deduction);
              if(advancedVisible){rules.push(String(deduction?.rule||''));return {status:'move',...advancedVisible,engineStepCount:step+1,visibleRule:String(deduction?.rule||''),rules,ms:now()-start,preAdvancedSignature}}
              return {status:'unsupported-advanced-relation',engineStepCount:step+1,rules:[...rules,String(deduction?.rule||'')],ms:now()-start,preAdvancedSignature};
            }
            return {status:'budget-exhausted',engineStepCount:48,rules,ms:now()-start,preAdvancedSignature};
          }

          const rows=[];let fullMs=0,cachedLightMs=0;
          for(const d of allowed){
            let t=now();const full=P._test.planFromFirstDeduction(engine,tier,d,{...options,advancedStart:false});fullMs+=now()-t;
            t=now();const light=cachedLightPlan(d);cachedLightMs+=now()-t;
            rows.push({
              id:String(d?.id||d?.signature||''),startingRule:String(d?.rule||''),
              full:{status:full?.status||null,target:copy(full?.target||null),value:full?.value,engineStepCount:full?.engineStepCount||null,visibleRule:String(full?.deduction?.rule||'')},
              light:{status:light.status,target:copy(light.target||null),value:light.value,engineStepCount:light.engineStepCount||null,visibleRule:light.visibleRule||null,preAdvancedSignature:light.preAdvancedSignature,rules:light.rules}
            });
          }
          const mismatches=rows.filter(row=>JSON.stringify([row.full.status,row.full.target,row.full.value,row.full.engineStepCount,row.full.visibleRule])!==JSON.stringify([row.light.status,row.light.target,row.light.value,row.light.engineStepCount,row.light.visibleRule]));
          const fullMin=Math.min(...rows.filter(r=>r.full.status==='move').map(r=>r.full.engineStepCount));
          const lightMin=Math.min(...rows.filter(r=>r.light.status==='move').map(r=>r.light.engineStepCount));
          const groups={};
          for(const row of rows){const k=row.light.preAdvancedSignature||'none';const g=groups[k]||(groups[k]={count:0,structural:new Set()});g.count++;g.structural.add(JSON.stringify([row.light.visibleRule,row.light.target,row.light.value,row.light.engineStepCount]));}
          const groupStructuralMismatchCount=Object.values(groups).filter(g=>g.structural.size!==1).length;
          return {
            attentionVersion:P.attentionContinuityVersion||null,
            candidateCount:allowed.length,fullMs,cachedLightMs,mismatchCount:mismatches.length,
            fullMin,lightMin,fullMinIds:rows.filter(r=>r.full.engineStepCount===fullMin).map(r=>r.id),lightMinIds:rows.filter(r=>r.light.engineStepCount===lightMin).map(r=>r.id),
            advancedStateCount:advancedCache.size,advancedCacheHits,advancedCacheMisses,advancedDiscoveryMs,
            groupStructuralMismatchCount,
            advancedStructural:[...advancedCache.entries()].map(([signature,result])=>({signature,structural:advancedStructural(result)})),
            mismatches
          };
        }""")
        print('R5_D5_ADVANCED_CACHE_PROFILE ' + json.dumps(profile, sort_keys=True), flush=True)
        assert profile['attentionVersion'] == 10, profile
        assert profile['candidateCount'] == 20, profile
        assert profile['mismatchCount'] == 0, profile
        assert profile['fullMin'] == profile['lightMin'] == 15, profile
        assert profile['fullMinIds'] == profile['lightMinIds'], profile
        assert profile['advancedStateCount'] == profile['advancedCacheMisses'] == 6, profile
        assert profile['advancedCacheHits'] == 14, profile
        assert profile['groupStructuralMismatchCount'] == 0, profile
        assert profile['cachedLightMs'] < 9000, profile
        context.close()
        browser.close()


if __name__ == '__main__':
    main()
