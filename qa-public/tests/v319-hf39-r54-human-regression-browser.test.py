from __future__ import annotations

import json
import os
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

from qa_runtime_loader import runtime_sources, runtime_styles

ROOT = Path(__file__).resolve().parents[1] / "GitHub"
EVIDENCE = Path(os.environ.get("QUADLUD_HUMAN_R54_EVIDENCE_DIR", "/tmp/quadlud-human-r54-evidence"))
VIEWPORT = {"width": 390, "height": 844}
TARGET_GROUPS = 18


def prepare_html() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for pattern in [
        r'<link rel="stylesheet"[^>]+>',
        r'<link rel="manifest"[^>]+>',
        r'<link rel="apple-touch-icon"[^>]+>',
        r'<script src="[^"]+"></script>',
    ]:
        html = re.sub(pattern, "", html)
    return html


def load_runtime(page) -> None:
    page.set_content(prepare_html(), wait_until="domcontentloaded")
    page.add_style_tag(content=runtime_styles(ROOT))
    page.evaluate(
        """()=>{
          const data=new Map();
          const storage={
            getItem:k=>data.has(String(k))?data.get(String(k)):null,
            setItem:(k,v)=>data.set(String(k),String(v)),
            removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),
            key:i=>[...data.keys()][i]??null,
            get length(){return data.size}
          };
          Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
        }"""
    )
    for source in runtime_sources(ROOT):
        page.add_script_tag(content=source)
    page.wait_for_selector(".cards")


def install_human_fixture(page) -> dict:
    result = page.evaluate(
        """()=>{
          closeHintNotice();
          document.body.classList.remove('tutor-active');
          const fixture={
            sol:[
              [1,0,0,1,1,0],
              [0,1,1,0,1,0],
              [0,0,1,1,0,1],
              [1,1,0,0,1,0],
              [1,0,0,1,0,1],
              [0,1,1,0,0,1]
            ],
            givens:new Set([6,9,10,11,20,31]),
            edges:[[2,0,'d','×'],[2,2,'r','='],[2,1,'d','×'],[3,3,'d','×'],[0,0,'d','×'],[0,3,'r','=']],
            difficultyProfile:{id:'expert',qaFixture:'HF3.9-R5.4-human'},
            generationStats:{strategy:'certified-template-human-regression',qaFixture:true}
          };
          installGeneratedSession('tango','expert',fixture,{context:'normal'});
          historyInit(true);
          startTimer(true,0,false);
          drawGameUi();
          let fingerprint=null;
          try{fingerprint=persistenceFingerprint(current)}catch(_){fingerprint=null}
          return {game:current?.game,difficulty:current?.diff,fingerprint,state:current?.state,edges:current?.edges};
        }"""
    )
    assert result["game"] == "tango", result
    assert result["difficulty"] == "expert", result
    return result


def group_state(page) -> dict:
    return page.evaluate(
        """()=>{
          const s=typeof walkthroughSession!=='undefined'?walkthroughSession:null;
          const g=typeof walkthroughCurrentGroup==='function'?walkthroughCurrentGroup():null;
          const humanCell=cell=>Array.isArray(cell)?`${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`:null;
          const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
          const entries=(g?.entries||[]).map((entry,index)=>{
            const move=entry?.move||{},kind=String(move?.pedagogyStageKind||move?.proofStage?.kind||''),d=move?.deduction||move?.presentation?.evidence?.primary||null;
            return {index,kind,target:humanCell(move?.target),value:Number(move?.value),rule:String(d?.rule||move?.rule||''),causalStepId:move?.causalStepId||null,causalStep:move?.causalProof?.steps?.find(step=>step?.id===move?.causalStepId)||null};
          });
          const actionEntry=[...(g?.entries||[])].reverse().find(entry=>String(entry?.move?.pedagogyStageKind||entry?.move?.proofStage?.kind||'')==='action')||(g?.entries||[]).at(-1)||null;
          const move=actionEntry?.move||{},target=Array.isArray(move?.target)?move.target:null,value=Number(move?.value),d=move?.deduction||move?.presentation?.evidence?.primary||null;
          const allConclusions=[...(d?.conclusions||[]),...(move?.presentation?.action?.conclusions||[]),...(move?.presentation?.evidence?.final?.conclusions||[])];
          const demonstrated=!!target&&allConclusions.some(c=>c?.type==='VALUE'&&same(c.cell,target)&&Number(c.value)===value);
          const beforeValue=target?move?.beforeSnapshot?.state?.[Number(target[0])]?.[Number(target[1])]??null:null;
          const markers=[...document.querySelectorAll('.hf39-marker-badge')].map(b=>{const cell=b.closest('[data-r][data-c]');return {label:String(b.textContent||'').trim(),cell:cell?humanCell([Number(cell.dataset.r),Number(cell.dataset.c)]):null};});
          const scroll=document.querySelector('.walkthrough-scroll');
          const explanation=String(document.querySelector('.walkthrough-scroll')?.innerText||'').trim().replace(/\s+/g,' ');
          return {
            logicalMoveIndex:g?.logicalMoveIndex??null,
            proofStepIndex:Number(s?.navigation?.proofStepIndex)||0,
            entries,
            action:{target:humanCell(target),value:Number.isFinite(value)?value:null,demonstrated,beforeValue,rule:String(d?.rule||move?.rule||'')},
            markers,
            explanation,
            scroll:scroll?{clientHeight:Math.round(scroll.clientHeight),scrollHeight:Math.round(scroll.scrollHeight),scrollTop:Math.round(scroll.scrollTop)}:null,
            plannerOwner:globalThis.QuadludTangoTutorSinglePlannerR5?.TOKEN||null,
            orchestratorToken:globalThis.QuadludTangoTutorAttentionOrchestratorR5?.TOKEN||null
          };
        }"""
    )


def capture(page, group_number: int, phase: str, ordinal: int) -> dict:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    state = group_state(page)
    stem = f"g{group_number:02d}-{ordinal:02d}-{phase}"
    (EVIDENCE / f"{stem}.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    page.screenshot(path=str(EVIDENCE / f"{stem}.png"), full_page=False)
    return state


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    groups: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        context = browser.new_context(viewport=VIEWPORT, locale="fr-FR", has_touch=True, is_mobile=True)
        page = context.new_page()
        page.on("pageerror", lambda exc: console_errors.append("pageerror:" + str(exc)))
        page.on("console", lambda msg: console_errors.append("console:" + msg.text) if msg.type == "error" else None)
        load_runtime(page)
        fixture = install_human_fixture(page)
        page.locator("#walkthroughBtn").click()
        page.wait_for_selector(".walkthrough-panel")
        page.wait_for_timeout(150)

        for group_number in range(1, TARGET_GROUPS + 1):
            states = [capture(page, group_number, "start", 0)]
            ordinal = 1
            while True:
                proof_next = page.locator("#walkthroughProofNext")
                if not (proof_next.count() and proof_next.is_visible() and not proof_next.is_disabled()):
                    break
                proof_next.click()
                page.wait_for_timeout(120)
                states.append(capture(page, group_number, "proof", ordinal))
                ordinal += 1
                assert ordinal < 40, f"Unbounded proof navigation in logical group {group_number}"
            canonical = states[-1]
            groups.append({"number": group_number, "action": canonical["action"], "states": states})
            print("R54_HUMAN_GROUP " + json.dumps({"group": group_number, "action": canonical["action"], "markers": [x["markers"] for x in states], "texts": [x["explanation"] for x in states]}, ensure_ascii=False), flush=True)
            if group_number < TARGET_GROUPS:
                next_button = page.locator("#walkthroughNext")
                assert next_button.count() and next_button.is_visible() and not next_button.is_disabled(), f"Tutor stopped before group {group_number + 1}"
                next_button.click(timeout=10000)
                page.wait_for_timeout(500)

        context.close()
        browser.close()

    summary = {
        "fixture": fixture,
        "viewport": VIEWPORT,
        "actions": [g["action"]["target"] for g in groups],
        "groups": groups,
        "consoleErrors": console_errors,
    }
    (EVIDENCE / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    assert not console_errors, console_errors
    assert len(groups) == TARGET_GROUPS
    assert groups[2]["action"]["target"] == "B3", f"Human regression: step 3 must be B3; sequence={summary['actions']}"
    assert groups[3]["action"]["target"] == "E2", f"Human regression: step 4 must be E2; sequence={summary['actions']}"
    assert groups[2]["action"]["demonstrated"] and groups[2]["action"]["beforeValue"] == -1, groups[2]["action"]
    assert groups[3]["action"]["demonstrated"] and groups[3]["action"]["beforeValue"] == -1, groups[3]["action"]

    marker3 = [m for state in groups[5]["states"] for m in state["markers"] if m["label"] == "3"]
    assert marker3, "Human regression: step 6 must expose hypothetical marker 3"
    assert all(m["cell"] == "A5" for m in marker3), f"Human regression: marker 3 must be on A5; got {marker3}"

    step18_text = " ".join(state["explanation"] for state in groups[17]["states"])
    normalized18 = step18_text.lower()
    for token in ["d4", "e4", "colonne 4", "f4", "soleil"]:
        assert token in normalized18, f"Human regression: step 18 explanation must contain {token!r}; text={step18_text}"

    print("PASS HF3.9-R5.4 deterministic human Tutor regression: steps 3/4, marker 3 and step 18.")


if __name__ == "__main__":
    main()
