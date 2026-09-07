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
            candidateTimings.push({id:String(d?.id||d?.signature||''),rule:String(d?.rule||'UNKNOWN'),fast,ms});
            if(plan?.status==='move')plans.push(plan);
          }
          const candidatePlanMs=now()-t;

          t=now();
          const selectorCandidates=P._test.buildSelectorCandidates(plans);
          const selectorMs=now()-t;

          t=now();
          const activeIds=new Set(selectorCandidates.map(c=>c.id));
          const blocked=new Set(selectorCandidates.filter(c=>(c.blockedBy||[]).some(id=>activeIds.has(id))).map(c=>c.id));
          const frontier=selectorCandidates.filter(c=>!blocked.has(c.id));
          const dominanceMs=now()-t;

          t=now();
          const policyCandidates=frontier.map(c=>{const cells=A.planCells(c.plan);return {id:c.id,stableKey:c.stableKey,baseCost:P._test.planCostVector(c.plan),target:c.plan.target,value:c.plan.value,premiseCells:cells.premiseCells,focusCells:cells.focusCells,payload:c.plan}});
          const policyMs=now()-t;
          const directMs=allowedMs+candidatePlanMs+selectorMs+dominanceMs+policyMs;

          const byRule={};
          for(const item of candidateTimings){const x=byRule[item.rule]||(byRule[item.rule]={count:0,ms:0,maxMs:0});x.count++;x.ms+=item.ms;x.maxMs=Math.max(x.maxMs,item.ms)}
          const slowest=candidateTimings.slice().sort((a,b)=>b.ms-a.ms).slice(0,6);

          t=now();
          const advanced=P._test.advancedDeductionsDetailed(engine,tier)||{deductions:[],budgetHit:false};
          const advancedDiscoveryMs=now()-t;
          return {
            attentionVersion:P.attentionContinuityVersion||null,
            orchestratorMarker:!!globalThis.walkthroughGenerateTangoNext?.__quadludTutorAttentionOrchestratorR5,
            allowedMs,allowedCount:allowed.length,ruleCounts,
            candidatePlanMs,fastCandidateCount:candidateTimings.filter(x=>x.fast).length,
            selectorMs,dominanceMs,policyMs,directMs,
            directPlans:plans.length,frontierCount:frontier.length,policyCandidateCount:policyCandidates.length,
            candidateTimingByRule:byRule,slowestCandidates:slowest,
            advancedDiscoveryMs,
            advancedDeductionCount:(advanced.deductions||[]).length,
            advancedDiscoveryBudgetHit:!!advanced.budgetHit
          };
        }""")
        print('R5_D5_COST_PROFILE ' + json.dumps(profile, sort_keys=True), flush=True)
        assert profile['attentionVersion'] == 10, profile
        assert profile['allowedCount'] == 20 and profile['directPlans'] == 20 and profile['fastCandidateCount'] == 20, profile
        context.close()
        browser.close()


if __name__ == '__main__':
    main()
