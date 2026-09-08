from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
JOURNEY = HERE / 'v319-hf39-r54-human-regression-browser.test.py'
spec = importlib.util.spec_from_file_location('v319_hf39_r54_human', JOURNEY)
journey = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(journey)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport=journey.VIEWPORT, locale='fr-FR', has_touch=True, is_mobile=True)
        page = context.new_page()
        page.set_default_timeout(45000)
        journey.load_runtime(page)
        journey.install_human_fixture(page)
        page.locator('#walkthroughBtn').click()
        page.wait_for_selector('.walkthrough-panel')
        page.wait_for_timeout(120)
        journey.next_logical_move(page, 1)
        journey.next_logical_move(page, 2)
        journey.next_logical_move(page, 3)

        diagnostic = page.evaluate(
            """()=>{
              const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
              const s=typeof walkthroughSession!=='undefined'?walkthroughSession:null;
              const P=globalThis.QuadludTangoPlayedMovePlanner;
              const A=P?._attentionTest;
              const R=globalThis.QuadludTangoTutorHumanRegressionR54;
              const stageKind=m=>String(m?.pedagogyStageKind||m?.proofStage?.kind||'');
              const last=[...(s?.moves||[])].reverse().find(m=>stageKind(m)==='action')||null;
              const human=cell=>Array.isArray(cell)?`${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`:null;
              const planSummary=plan=>{
                if(!plan)return null;
                const d=R?._test?.sourceDeduction?.(plan)||plan?.startingDeduction||plan?.deduction||null;
                return {
                  target:human(plan?.target),value:plan?.value,status:plan?.status||null,
                  selectionStatus:plan?.selectionStatus||null,
                  rule:String(d?.rule||''),deductionId:d?.id||null,deductionSignature:d?.signature||null,
                  conclusions:(d?.conclusions||[]).filter(c=>c?.type==='VALUE').map(c=>({cell:human(c.cell),value:c.value}))
                };
              };
              const result={
                humanRegressionVersion:R?.VERSION||null,humanRegressionToken:R?.TOKEN||null,
                generationWrapperInstalled:typeof walkthroughGenerateTangoNext==='function'&&walkthroughGenerateTangoNext.__quadludTutorHumanRegressionR54===true,
                lastAction:{target:human(last?.target),kind:stageKind(last),metrics:clone(last?.metrics||null)},
                alternative:null,baseline:null,evaluationPlans:[],frontierPlans:[],error:null
              };
              try{
                const puzzle={n:s.work?.n||s.base?.n||6,state:clone(s.work?.state),edges:clone(s.work?.edges||s.base?.edges||[])};
                const engine=P.sessionFromPublicBoard(puzzle,s.work.state);
                const tier=typeof P.tierIndexForDifficulty==='function'?P.tierIndexForDifficulty(String(s.base?.diff||'expert')):3;
                const fd=A.directFrontierCandidates(engine,tier,{});
                const baseline=A.baselineDirectPlan(fd);
                const alternative=R?._test?.relationLocalityAlternative?.(s)||null;
                result.baseline=planSummary(baseline);
                result.evaluationPlans=(fd?.evaluation?.plans||[]).map(planSummary);
                result.frontierPlans=(fd?.frontier||[]).map(entry=>planSummary(entry?.plan));
                result.alternative=planSummary(alternative?.plan||null);
              }catch(error){result.error=String(error?.stack||error)}
              return result;
            }"""
        )
        print('R54_E2_DIAGNOSTIC ' + json.dumps(diagnostic, ensure_ascii=False, sort_keys=True), flush=True)
        assert diagnostic['lastAction']['target'] == 'B3', diagnostic
        assert diagnostic['humanRegressionVersion'] == 4, diagnostic
        context.close()
        browser.close()


if __name__ == '__main__':
    main()
