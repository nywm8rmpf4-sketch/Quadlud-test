from __future__ import annotations

import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
JOURNEY = HERE / 'v319-hf39-r54-human-regression-browser.test.py'
spec = importlib.util.spec_from_file_location('v319_hf39_r54_human_for_adr18', JOURNEY)
journey = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(journey)


def install_planner_counter(page) -> None:
    page.evaluate(
        """()=>{
          const original=globalThis.QuadludTangoPlayedMovePlanner;
          if(!original)throw new Error('Tango planner missing');
          globalThis.__adr18Planner={sessionCalls:0,nextCalls:0};
          globalThis.QuadludTangoPlayedMovePlanner=Object.freeze({
            ...original,
            sessionFromPublicBoard(...args){globalThis.__adr18Planner.sessionCalls++;return original.sessionFromPublicBoard(...args)},
            nextPlayedMove(...args){globalThis.__adr18Planner.nextCalls++;return original.nextPlayedMove(...args)}
          });
        }"""
    )


def counters(page) -> dict:
    return page.evaluate("()=>({...globalThis.__adr18Planner})")


def delta(after: dict, before: dict) -> dict:
    return {key: after[key] - before[key] for key in before}


def action_state(page) -> dict:
    return page.evaluate(
        """()=>{
          const g=typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null;
          const human=cell=>Array.isArray(cell)?`${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`:null;
          const entry=[...(g?.entries||[])].reverse().find(e=>String(e?.move?.pedagogyStageKind||e?.move?.proofStage?.kind||'')==='action')||(g?.entries||[]).at(-1)||null;
          const m=entry?.move||{},metrics=m.metrics||{},batch=m.conclusionBatch||null;
          return {
            target:human(m.target),
            batchId:metrics.conclusionBatchId||batch?.id||null,
            batchIndex:Number(metrics.conclusionBatchIndex||batch?.index)||null,
            batchSize:Number(metrics.conclusionBatchSize||batch?.size)||null,
            zeroCost:metrics.zeroCognitiveCostConclusion===true||batch?.zeroCognitiveCost===true,
            solverRequired:metrics.solverRequiredForConclusion,
            selectionStatus:metrics.selectionStatus||null,
            batchRuntimeToken:globalThis.QuadludTangoTutorConclusionBatchR6?.TOKEN||null
          };
        }"""
    )


def proof_marker_states(page) -> list[list[dict]]:
    out=[]
    while True:
        out.append(page.evaluate("""()=>[...document.querySelectorAll('.hf39-marker-badge')].map(b=>{const c=b.closest('[data-r][data-c]');return {label:String(b.textContent||'').trim(),cell:c?`${String.fromCharCode(65+Number(c.dataset.r))}${Number(c.dataset.c)+1}`:null}})"""))
        nxt=page.locator('#walkthroughProofNext')
        if not (nxt.count() and nxt.is_visible() and not nxt.is_disabled()):
            break
        nxt.click(timeout=10000)
        page.wait_for_timeout(120)
    return out


def main() -> None:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context=browser.new_context(viewport=journey.VIEWPORT, locale='fr-FR', has_touch=True, is_mobile=True)
        page=context.new_page();page.set_default_timeout(45000)
        journey.load_runtime(page);journey.install_human_fixture(page);install_planner_counter(page)
        page.locator('#walkthroughBtn').click();page.wait_for_selector('.walkthrough-panel');page.wait_for_timeout(120)

        journey.next_logical_move(page,1)
        step1=action_state(page)
        journey.next_logical_move(page,2)
        step2=action_state(page)

        before23=counters(page)
        journey.next_logical_move(page,3)
        after23=counters(page);step3=action_state(page)
        d23=delta(after23,before23)

        before34=counters(page)
        journey.next_logical_move(page,4)
        after34=counters(page);step4=action_state(page)
        d34=delta(after34,before34)

        before45=counters(page)
        journey.next_logical_move(page,5)
        after45=counters(page);step5=action_state(page)
        d45=delta(after45,before45)

        journey.next_logical_move(page,6)
        step6=action_state(page)
        markers=proof_marker_states(page)

        print('ADR18_STEPS', {'s1':step1,'s2':step2,'s3':step3,'s4':step4,'s5':step5,'s6':step6,'d23':d23,'d34':d34,'d45':d45,'markers':markers}, flush=True)

        assert step2['target']=='B2', (step1,step2,step3)
        assert step3['target']=='B3', (step1,step2,step3)
        assert step2['batchId'] and step2['batchId']==step3['batchId'], (step2,step3)
        assert step2['batchIndex']==1 and step3['batchIndex']==2 and step2['batchSize']==step3['batchSize']==2, (step2,step3)
        assert step3['zeroCost'] and step3['solverRequired'] is False, step3
        assert d23['sessionCalls']==0 and d23['nextCalls']==0, d23

        assert step4['target']=='E2', step4
        assert d34['sessionCalls']>0, d34
        assert step5['target']=='A2', step5
        assert step4['batchId'] and step4['batchId']==step5['batchId'], (step4,step5)
        assert step4['batchIndex']==1 and step5['batchIndex']==2 and step4['batchSize']==step5['batchSize']==2, (step4,step5)
        assert step5['zeroCost'] and step5['solverRequired'] is False, step5
        assert d45['sessionCalls']==0 and d45['nextCalls']==0, d45
        assert step5['batchRuntimeToken']=='3.1.9-hf3.9-r6-cognitive-batch-v1', step5

        flat=[m for state in markers for m in state]
        labels={m['label'] for m in flat}
        assert '3.1' in labels and '3.2' in labels, flat
        a5=[m for m in flat if m['cell']=='A5' and m['label'].startswith('3.')]
        assert a5, flat
        assert all(m['label']=='3.2' for m in a5), a5

        context.close();browser.close()

    print('PASS ADR-018 browser: B2→B3 and E2→A2 consume same-proof batches with zero planner calls; hypothetical multi-conclusions use x.y labels.')


if __name__=='__main__':
    main()
