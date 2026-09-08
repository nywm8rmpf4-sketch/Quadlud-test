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
              const R=globalThis.QuadludTangoTutorHumanRegressionR54;
              const stageKind=m=>String(m?.pedagogyStageKind||m?.proofStage?.kind||'');
              const last=[...(s?.moves||[])].reverse().find(m=>stageKind(m)==='action')||null;
              const human=cell=>Array.isArray(cell)?`${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`:null;
              const result={
                humanRegressionVersion:R?.VERSION||null,
                humanRegressionToken:R?.TOKEN||null,
                generationWrapperInstalled:typeof walkthroughGenerateTangoNext==='function'&&walkthroughGenerateTangoNext.__quadludTutorHumanRegressionR54===true,
                lastAction:{target:human(last?.target),kind:stageKind(last),metrics:clone(last?.metrics||null)},
                alternative:null,
                error:null
              };
              try{
                const alternative=R?._test?.relationLocalityAlternative?.(s)||null;
                const plan=alternative?.plan||null;
                const d=plan?.startingDeduction||plan?.deduction||null;
                result.alternative=plan?{
                  target:human(plan.target),
                  value:plan.value,
                  status:plan.status||null,
                  selectionStatus:plan.selectionStatus||null,
                  siblingConclusionProjection:plan.siblingConclusionProjection===true,
                  relationLocalityTieBreak:plan.relationLocalityTieBreak===true,
                  relationLocalityDistance:plan.relationLocalityDistance,
                  rule:String(d?.rule||''),
                  conclusions:(d?.conclusions||[]).filter(c=>c?.type==='VALUE').map(c=>({cell:human(c.cell),value:c.value}))
                }:null;
              }catch(error){result.error=String(error?.stack||error)}
              return result;
            }"""
        )
        print('R54_E2_DIAGNOSTIC ' + json.dumps(diagnostic, ensure_ascii=False, sort_keys=True), flush=True)
        assert diagnostic['lastAction']['target'] == 'B3', diagnostic
        assert diagnostic['humanRegressionVersion'] == 6, diagnostic
        assert diagnostic['humanRegressionToken'] == '3.1.9-hf3.9-r5.4f', diagnostic
        assert diagnostic['alternative'] is not None, diagnostic
        assert diagnostic['alternative']['target'] == 'E2', diagnostic
        assert diagnostic['alternative']['rule'] == 'RELATION_BALANCE', diagnostic
        assert diagnostic['alternative']['siblingConclusionProjection'] is True, diagnostic
        assert diagnostic['alternative']['relationLocalityTieBreak'] is True, diagnostic
        assert {'cell': 'A2', 'value': 1} in diagnostic['alternative']['conclusions'], diagnostic
        assert {'cell': 'E2', 'value': 1} in diagnostic['alternative']['conclusions'], diagnostic
        context.close()
        browser.close()


if __name__ == '__main__':
    main()
