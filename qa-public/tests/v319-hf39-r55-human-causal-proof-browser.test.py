from __future__ import annotations

import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright

HUMAN_TEST = Path(__file__).with_name("v319-hf39-r54-human-regression-browser.test.py")
spec = importlib.util.spec_from_file_location("quadlud_r54_human", HUMAN_TEST)
assert spec and spec.loader
human = importlib.util.module_from_spec(spec)
spec.loader.exec_module(human)


def current_state(page):
    return page.evaluate(r"""()=>{
      const s=typeof walkthroughSession!=='undefined'?walkthroughSession:null;
      const g=typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null;
      const i=Math.max(0,Math.min((g?.entries?.length||1)-1,Number(s?.navigation?.proofStepIndex)||0));
      const m=g?.entries?.[i]?.move||{},d=m?.deduction||m?.presentation?.evidence?.primary||null;
      const cell=x=>Array.isArray(x)?`${String.fromCharCode(65+Number(x[0]))}${Number(x[1])+1}`:null;
      const step=m?.causalProof?.steps?.find(x=>x?.id===m?.causalStepId)||null;
      const markers=[...document.querySelectorAll('.hf39-marker-badge')].map(b=>{const c=b.closest('[data-r][data-c]');return {label:String(b.textContent||'').trim(),cell:c?cell([Number(c.dataset.r),Number(c.dataset.c)]):null}});
      return {index:i,count:g?.entries?.length||0,kind:String(m?.pedagogyStageKind||m?.proofStage?.kind||''),rule:String(d?.rule||''),step,text:String(document.querySelector('.walkthrough-scroll')?.innerText||'').replace(/\s+/g,' ').trim(),markers,actionVisible:!!document.querySelector('.walkthrough-move')};
    }""")


def main():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        context=browser.new_context(viewport=human.VIEWPORT, locale="fr-FR", has_touch=True, is_mobile=True)
        page=context.new_page(); page.set_default_timeout(45000)
        page.on("pageerror", lambda exc: errors.append("pageerror:"+str(exc)))
        page.on("console", lambda msg: errors.append("console:"+msg.text) if msg.type=="error" else None)
        human.load_runtime(page); human.install_human_fixture(page)
        page.locator("#walkthroughBtn").click(); page.wait_for_selector(".walkthrough-panel"); page.wait_for_timeout(150)
        # Advance until the deterministic fixture reaches its first multi-stage contradiction proof.
        states=[]
        for logical_step in range(1, 12):
            human.next_logical_move(page, logical_step)
            s0=current_state(page)
            if s0['count'] >= 8 and s0['kind'] in ('hypothesis','reasoning','contradiction','rollback'):
                states=[s0]
                break
        assert states, "No multi-stage contradiction proof found in deterministic fixture"
        while True:
            nxt=page.locator("#walkthroughProofNext")
            if not (nxt.count() and nxt.is_visible() and not nxt.is_disabled()): break
            nxt.click(); page.wait_for_timeout(120); states.append(current_state(page))
            assert len(states)<30
        assert not errors, errors
        assert len(states)>=8, f"Expected a multi-step contradiction proof, got {len(states)}"
        contradiction_indices=[i for i,s in enumerate(states) if s['kind']=='contradiction']
        rollback_indices=[i for i,s in enumerate(states) if s['kind']=='rollback']
        action_indices=[i for i,s in enumerate(states) if s['kind']=='action']
        assert contradiction_indices, [(s['kind'],s['text']) for s in states]
        assert rollback_indices, [(s['kind'],s['text']) for s in states]
        assert action_indices, [(s['kind'],s['text']) for s in states]
        assert max(contradiction_indices)<min(rollback_indices)<min(action_indices)
        for i,s in enumerate(states):
            if i<min(contradiction_indices):
                assert 'conduit à une contradiction' not in s['text'].lower(), (i,s['text'])
                assert not s['actionVisible'], (i,s)
        for s in states:
            nums=sorted({int(m['label']) for m in s['markers'] if m['label'].isdigit()})
            if nums: assert nums==list(range(1,max(nums)+1)), (s['index'],s['markers'])
        for s in states:
            if s['kind']=='reasoning' and s['step'] and s['step'].get('hypothetical') and s['step'].get('producedCells'):
                produced=s['step']['producedCells'][0]
                name=f"{chr(65+int(produced[0]))}{int(produced[1])+1}"
                assert name in s['text'], (s['index'],name,s['text'])
        context.close(); browser.close()
    print('PASS HF3.9-R5.5 browser causal proof: contradiction/rollback/action ordered, badges consecutive, each produced value named.')

if __name__=='__main__': main()
