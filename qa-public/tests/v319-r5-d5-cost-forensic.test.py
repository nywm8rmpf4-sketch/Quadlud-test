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
          const A=P?._attentionTest;
          if(!s||!P||!A)throw new Error('missing Tango Tutor forensic runtime');
          const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
          const puzzle={n:s.work?.n||s.base?.n||6,state:copy(s.work?.state),edges:copy(s.work?.edges||s.base?.edges||[])};
          const engine=P.sessionFromPublicBoard(puzzle,s.work.state);
          const tier=3, options={}, now=()=>performance.now();

          let t=now();
          const allowed=P._test.allowedDirectDeductions(engine,tier);
          const allowedMs=now()-t;
          const ruleCounts={};
          for(const d of allowed){const rule=String(d?.rule||'UNKNOWN');ruleCounts[rule]=(ruleCounts[rule]||0)+1}

          const plans=[],candidateTimings=[];
          t=now();
          for(const d of allowed){
            const c0=now();
            let plan=A.fastDirectPlan(engine,tier,d,options);
            let fast=true;
            if(!plan){fast=false;plan=P._test.planFromFirstDeduction(engine,tier,d,{...options,advancedStart:false})}
            const ms=now()-c0;
            const conclusionTypes=(d?.conclusions||[]).reduce((acc,c)=>{const k=String(c?.type||'UNKNOWN');acc[k]=(acc[k]||0)+1;return acc},{});
            candidateTimings.push({
              id:String(d?.id||d?.signature||''),rule:String(d?.rule||'UNKNOWN'),fast,ms,conclusionTypes,
              status:plan?.status||null,target:copy(plan?.target||null),value:plan?.value,
              engineStepCount:plan?.engineStepCount||null,visibleRule:String(plan?.deduction?.rule||''),
              proofRules:(plan?.proofChain||[]).map(x=>String(x?.rule||'')),
              proofDepth:(plan?.proofChain||[]).length,
              costVector:plan?.status==='move'?P._test.planCostVector(plan):null
            });
            if(plan?.status==='move')plans.push(plan);
          }
          const candidatePlanMs=now()-t;

          t=now();
          const selectorCandidates=P._test.buildSelectorCandidates(plans);
          const selectorMs=now()-t;
          t=now();
          const selected=P._test.selectPlans(plans,{frontierComplete:true});
          const selectMs=now()-t;

          const byRule={};
          for(const item of candidateTimings){const x=byRule[item.rule]||(byRule[item.rule]={count:0,ms:0,maxMs:0});x.count++;x.ms+=item.ms;x.maxMs=Math.max(x.maxMs,item.ms)}
          const slowest=candidateTimings.slice().sort((a,b)=>b.ms-a.ms).slice(0,6);
          const summaries=candidateTimings.map(({id,rule,conclusionTypes,target,value,engineStepCount,visibleRule,proofRules,proofDepth,costVector,ms})=>({id,rule,conclusionTypes,target,value,engineStepCount,visibleRule,proofRules,proofDepth,costVector,ms}));
          return {
            attentionVersion:P.attentionContinuityVersion||null,
            allowedMs,allowedCount:allowed.length,ruleCounts,
            candidatePlanMs,fastCandidateCount:candidateTimings.filter(x=>x.fast).length,
            selectorMs,selectMs,directPlans:plans.length,
            candidateTimingByRule:byRule,slowestCandidates:slowest,
            selected: selected?.plan?{target:copy(selected.plan.target),value:selected.plan.value,engineStepCount:selected.plan.engineStepCount,startingRule:selected.plan.startingDeduction?.rule||null,visibleRule:selected.plan.deduction?.rule||null,costVector:P._test.planCostVector(selected.plan)}:null,
            candidates:summaries
          };
        }""")
        print('R5_D5_SUCCESSOR_PROFILE ' + json.dumps(profile, sort_keys=True), flush=True)
        assert profile['attentionVersion'] == 10, profile
        assert profile['allowedCount'] == 20 and profile['directPlans'] == 20, profile
        context.close()
        browser.close()


if __name__ == '__main__':
    main()
