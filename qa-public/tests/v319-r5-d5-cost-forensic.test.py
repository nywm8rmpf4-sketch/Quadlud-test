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
        journey.load_runtime(page, use_diversity_pool=False)
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
          const S=globalThis.QuadludTangoTutorSinglePlannerR5;
          if(!s||!P||!S||typeof S.humanizeTutorPlan!=='function')throw new Error('missing Tango Tutor single-planner runtime');
          const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
          const puzzle={n:s.work?.n||s.base?.n||6,state:clone(s.work?.state),edges:clone(s.work?.edges||s.base?.edges||[])};
          const engine=P.sessionFromPublicBoard(puzzle,s.work.state);
          const original=P;
          let plannerCalls=0,plannerMs=0;
          const timed=Object.freeze({...original,nextPlayedMove(...args){
            plannerCalls++;
            const t=performance.now();
            const result=original.nextPlayedMove(...args);
            plannerMs+=performance.now()-t;
            return result;
          }});
          globalThis.QuadludTangoPlayedMovePlanner=timed;
          const started=performance.now();
          let plan;
          try{plan=S.humanizeTutorPlan(engine,'expert',{})}finally{globalThis.QuadludTangoPlayedMovePlanner=original}
          const elapsedMs=performance.now()-started;
          return {
            attentionVersion:original.attentionContinuityVersion||null,
            prunerVersion:original.relationFrontierPrunerVersion||null,
            singlePlannerVersion:S.VERSION||null,
            singlePlannerToken:S.TOKEN||null,
            elapsedMs,
            plannerCalls,
            plannerMs,
            overheadMs:elapsedMs-plannerMs,
            status:plan?.status||null,
            target:clone(plan?.target||null),
            value:plan?.value,
            selectionStatus:plan?.selectionStatus||null,
            humanGlobalSelection:plan?.humanGlobalSelection,
            humanCandidateCount:Number(plan?.humanCandidateCount)||0,
            relationFrontierPruned:!!plan?.relationFrontierPruned,
            estimatedCandidateCount:Number(plan?.relationFrontierEstimatedCandidateCount)||0,
            hydratedCandidateCount:Number(plan?.relationFrontierHydratedCandidateCount)||0,
            prunedCandidateCount:Number(plan?.relationFrontierPrunedCandidateCount)||0,
            advancedStateCount:Number(plan?.relationFrontierAdvancedStateCount)||0,
            minimumEngineStepCount:Number(plan?.relationFrontierMinimumEngineStepCount)||null,
            engineStepCount:Number(plan?.engineStepCount)||null,
            proofChainLength:Array.isArray(plan?.proofChain)?plan.proofChain.length:0,
            humanProofKind:plan?.displayProof?.kind||null
          };
        }""")
        print('R5_D5_SINGLE_PLANNER_PROFILE ' + json.dumps(profile, sort_keys=True), flush=True)
        assert profile['attentionVersion'] == 11, profile
        assert profile['prunerVersion'] == 1, profile
        assert profile['singlePlannerVersion'] == 2, profile
        assert profile['plannerCalls'] == 1, profile
        assert profile['status'] == 'move', profile
        assert profile['target'] == [0, 0] and profile['value'] == 1, profile
        assert profile['selectionStatus'] == 'PROVEN_MINIMUM', profile
        assert profile['humanGlobalSelection'] is False, profile
        assert profile['relationFrontierPruned'], profile
        assert profile['estimatedCandidateCount'] == 20, profile
        assert profile['hydratedCandidateCount'] == 2, profile
        assert profile['prunedCandidateCount'] == 18, profile
        # Structural lower bounds must not trigger advanced solves; only the two
        # surviving candidates are fully hydrated before the proven minimum.
        assert profile['advancedStateCount'] == 0, profile
        assert profile['minimumEngineStepCount'] == profile['engineStepCount'] == 15, profile
        assert profile['proofChainLength'] > 0, profile
        assert profile['elapsedMs'] < 9000, profile
        context.close()
        browser.close()


if __name__ == '__main__':
    main()
