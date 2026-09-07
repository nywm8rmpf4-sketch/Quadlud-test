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
          const R=globalThis.QuadludTangoPlayedMoveRuntime;
          if(!s||!P||!P._test||!R||typeof R.selectDisplayProof!=='function'||typeof R.planHumanMove!=='function')throw new Error('missing Tango Tutor planner/runtime');
          const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
          const puzzle={n:s.work?.n||s.base?.n||6,state:clone(s.work?.state),edges:clone(s.work?.edges||s.base?.edges||[])};
          const fresh=()=>P.sessionFromPublicBoard(puzzle,s.work.state);
          const now=()=>performance.now();

          const directEngine=fresh();
          let started=now();
          const directPlan=P.nextPlayedMove(directEngine,'expert',{});
          const directPlannerMs=now()-started;
          started=now();
          const directSerialized=JSON.stringify(directPlan);
          const directSerializeMs=now()-started;
          const descriptors={};
          for(const name of ['engineVisiblePlacementCount','engineVisiblePlacements']){
            const d=Object.getOwnPropertyDescriptor(directPlan,name);
            descriptors[name]=d?{enumerable:!!d.enumerable,hasGetter:typeof d.get==='function',hasValue:Object.prototype.hasOwnProperty.call(d,'value')}:null;
          }

          const humanEngine=fresh();
          const originalPlannerObject=globalThis.QuadludTangoPlayedMovePlanner;
          let innerPlannerCalls=0;
          const innerPlannerMs=[];
          const timedPlanner={...originalPlannerObject,nextPlayedMove(...args){
            innerPlannerCalls++;
            const t=now();
            const result=originalPlannerObject.nextPlayedMove(...args);
            innerPlannerMs.push(now()-t);
            return result;
          }};
          globalThis.QuadludTangoPlayedMovePlanner=Object.freeze(timedPlanner);
          started=now();
          let humanPlan;
          try{humanPlan=R.planHumanMove(humanEngine,'expert')}finally{globalThis.QuadludTangoPlayedMovePlanner=originalPlannerObject}
          const humanPlanMs=now()-started;

          const postEngine=fresh();
          started=now();
          const postPlan=P.nextPlayedMove(postEngine,'expert',{});
          const postPlannerMs=now()-started;

          return {
            attentionVersion:P.attentionContinuityVersion||null,
            prunerVersion:P.relationFrontierPrunerVersion||null,
            runtimeVersion:R.VERSION||null,
            directPlannerMs,
            directSerializeMs,
            directSerializedLength:directSerialized.length,
            directDescriptors:descriptors,
            innerPlannerCalls,
            innerPlannerMs,
            innerPlannerTotalMs:innerPlannerMs.reduce((a,b)=>a+b,0),
            humanPlanMs,
            humanOverheadMs:humanPlanMs-innerPlannerMs.reduce((a,b)=>a+b,0),
            postPlannerMs,
            status:directPlan?.status||null,
            humanStatus:humanPlan?.status||null,
            postStatus:postPlan?.status||null,
            target:clone(directPlan?.target||null),
            humanTarget:clone(humanPlan?.target||null),
            postTarget:clone(postPlan?.target||null),
            value:directPlan?.value,
            humanValue:humanPlan?.value,
            postValue:postPlan?.value,
            engineStepCount:Number(directPlan?.engineStepCount)||null,
            selectionStatus:directPlan?.selectionStatus||null,
            relationFrontierPruned:!!directPlan?.relationFrontierPruned,
            estimatedCandidateCount:Number(directPlan?.relationFrontierEstimatedCandidateCount)||0,
            hydratedCandidateCount:Number(directPlan?.relationFrontierHydratedCandidateCount)||0,
            prunedCandidateCount:Number(directPlan?.relationFrontierPrunedCandidateCount)||0,
            advancedStateCount:Number(directPlan?.relationFrontierAdvancedStateCount)||0,
            minimumEngineStepCount:Number(directPlan?.relationFrontierMinimumEngineStepCount)||null,
            proofChainLength:Array.isArray(directPlan?.proofChain)?directPlan.proofChain.length:0
          };
        }""")
        print('R5_D5_SERIALIZATION_INNER_PROFILE ' + json.dumps(profile, sort_keys=True), flush=True)
        assert profile['attentionVersion'] == 11, profile
        assert profile['prunerVersion'] == 1, profile
        assert profile['status'] == profile['humanStatus'] == profile['postStatus'] == 'move', profile
        assert profile['target'] == profile['humanTarget'] == profile['postTarget'], profile
        assert profile['value'] == profile['humanValue'] == profile['postValue'], profile
        assert profile['innerPlannerCalls'] == 1, profile
        assert profile['relationFrontierPruned'], profile
        assert profile['estimatedCandidateCount'] == 20, profile
        assert 0 < profile['hydratedCandidateCount'] < profile['estimatedCandidateCount'], profile
        assert profile['prunedCandidateCount'] == profile['estimatedCandidateCount'] - profile['hydratedCandidateCount'], profile
        assert profile['advancedStateCount'] > 0, profile
        assert profile['minimumEngineStepCount'] == profile['engineStepCount'] == 15, profile
        assert profile['proofChainLength'] > 0, profile
        context.close()
        browser.close()


if __name__ == '__main__':
    main()
