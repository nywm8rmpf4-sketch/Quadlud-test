from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

from qa_runtime_loader import runtime_sources, runtime_styles

ROOT = Path(__file__).resolve().parents[1] / "GitHub"
DEFAULT_EVIDENCE = Path(os.environ.get("QUADLUD_SEMANTIC_EVIDENCE_DIR", "/tmp/quadlud-semantic-evidence/tango-expert-fr-mobile-v1"))
SEED = "qa-semantic-tango-expert-v1"
MAX_TRANSITIONS = 160
VIEWPORT = {"width": 390, "height": 844}


def load_build_info() -> dict:
    path = ROOT / "build-info.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


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


def open_real_tango_expert(page) -> dict:
    result = page.evaluate(
        """seed=>{
          closeHintNotice();
          document.body.classList.remove('tutor-active');
          return withSeed(seed,()=>{
            const generated=generateRegisteredCandidate('tango','expert');
            installGeneratedSession('tango','expert',generated,{context:'normal'});
            historyInit(true);
            startTimer(true,0,false);
            drawGameUi();
            let fingerprint=null;
            try{fingerprint=persistenceFingerprint(current)}catch(_){fingerprint=null}
            return {
              game:current?.game||null,
              difficulty:current?.diff||null,
              fingerprint,
              training:!!current?.training
            };
          });
        }""",
        SEED,
    )
    assert result["game"] == "tango", result
    assert result["difficulty"] == "expert", result
    assert not result["training"], result
    page.wait_for_selector("#walkthroughBtn")
    return result


def observable_snapshot(page) -> dict:
    return page.evaluate(
        """()=>{
          const visible=el=>{
            if(!el)return false;
            const s=getComputedStyle(el),r=el.getBoundingClientRect();
            return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
          };
          const text=sel=>{
            const el=document.querySelector(sel);
            return el&&visible(el)?(el.innerText||el.textContent||'').trim().replace(/\s+/g,' '):null;
          };
          const button=sel=>{
            const el=document.querySelector(sel);
            return el&&visible(el)?{
              text:(el.innerText||el.textContent||'').trim().replace(/\s+/g,' '),
              disabled:!!el.disabled,
              ariaLabel:el.getAttribute('aria-label')
            }:null;
          };
          const board=document.querySelector('.walkthrough-board');
          const cells=board?[...board.children].map((el,index)=>({
            index,
            text:(el.innerText||el.textContent||'').trim().replace(/\s+/g,' '),
            className:String(el.className||''),
            ariaLabel:el.getAttribute('aria-label'),
            row:el.dataset?.r??null,
            column:el.dataset?.c??null
          })):[];
          const visiblePedagogy=[...document.querySelectorAll('.walkthrough-panel [class]')]
            .filter(visible)
            .map(el=>String(el.className||''))
            .filter(Boolean);
          return {
            documentLang:document.documentElement.lang,
            title:text('.walkthrough-head h1'),
            subtitle:text('.walkthrough-head p'),
            counter:text('#walkthroughRestart'),
            visibleExplanation:text('.walkthrough-scroll'),
            stateComplete:text('.walkthrough-complete'),
            stateStalled:text('.walkthrough-stalled'),
            controls:{
              previous:button('#walkthroughPrev'),
              next:button('#walkthroughNext'),
              proofPrevious:button('#walkthroughProofPrev'),
              proofNext:button('#walkthroughProofNext'),
              restart:button('#walkthroughRestart'),
              close:button('#walkthroughClose')
            },
            board:{
              ariaLabel:board?.getAttribute('aria-label')||null,
              className:String(board?.className||''),
              cells
            },
            visibleClassNames:[...new Set(visiblePedagogy)].sort(),
            viewport:{width:innerWidth,height:innerHeight},
            bodyClass:String(document.body.className||'')
          };
        }"""
    )


def signature(snapshot: dict) -> str:
    compact = {
        "counter": snapshot.get("counter"),
        "explanation": snapshot.get("visibleExplanation"),
        "cells": [(c["text"], c["className"]) for c in snapshot["board"]["cells"]],
        "proofNext": snapshot["controls"].get("proofNext"),
        "next": snapshot["controls"].get("next"),
    }
    return json.dumps(compact, ensure_ascii=False, sort_keys=True)


def capture(page, evidence_dir: Path, ordinal: int, phase: str) -> tuple[dict, str]:
    steps = evidence_dir / "steps"
    steps.mkdir(parents=True, exist_ok=True)
    snapshot = observable_snapshot(page)
    snapshot["ordinal"] = ordinal
    snapshot["phase"] = phase
    stem = f"{ordinal:03d}-{phase}"
    (steps / f"{stem}.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    page.screenshot(path=str(steps / f"{stem}.png"), full_page=True)
    return snapshot, signature(snapshot)


def main() -> None:
    evidence_dir = DEFAULT_EVIDENCE
    evidence_dir.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    captures: list[dict] = []
    seen: set[str] = set()
    build = load_build_info()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        context = browser.new_context(viewport=VIEWPORT, locale="fr-FR", has_touch=True, is_mobile=True)
        page = context.new_page()
        page.on("pageerror", lambda exc: errors.append("pageerror:" + str(exc)))
        page.on("console", lambda msg: errors.append("console:" + msg.text) if msg.type == "error" else None)

        load_runtime(page)
        session = open_real_tango_expert(page)
        page.locator("#walkthroughBtn").click()
        page.wait_for_selector(".walkthrough-panel")
        page.wait_for_timeout(120)

        ordinal = 0
        snap, sig = capture(page, evidence_dir, ordinal, "start")
        captures.append({"ordinal": ordinal, "phase": "start", "counter": snap.get("counter")})
        seen.add(sig)
        ordinal += 1

        terminated = False
        for transition in range(MAX_TRANSITIONS):
            proof_next = page.locator("#walkthroughProofNext")
            if proof_next.count() and proof_next.is_visible() and not proof_next.is_disabled():
                proof_next.click()
                page.wait_for_timeout(160)
                snap, sig = capture(page, evidence_dir, ordinal, "proof")
                assert sig not in seen, f"Tutor proof navigation made no observable progress at capture {ordinal}"
                seen.add(sig)
                captures.append({"ordinal": ordinal, "phase": "proof", "counter": snap.get("counter")})
                ordinal += 1
                continue

            next_button = page.locator("#walkthroughNext")
            assert next_button.count() and next_button.is_visible(), "Tutor next control disappeared"
            if next_button.is_disabled():
                terminated = True
                break

            next_button.click()
            page.wait_for_timeout(700)
            snap, sig = capture(page, evidence_dir, ordinal, "logical")
            assert sig not in seen, f"Tutor logical navigation made no observable progress at capture {ordinal}"
            seen.add(sig)
            captures.append({"ordinal": ordinal, "phase": "logical", "counter": snap.get("counter")})
            ordinal += 1

        final = observable_snapshot(page)
        assert terminated, f"Tutor journey exceeded bounded guard ({MAX_TRANSITIONS} transitions)"
        assert len(captures) >= 2, "Tutor journey did not expose any logical progression"
        assert final["controls"]["next"] and final["controls"]["next"]["disabled"], final["controls"]
        assert final["documentLang"].lower().startswith("fr"), final["documentLang"]
        assert final["viewport"] == VIEWPORT, final["viewport"]
        assert not errors, errors

        context.close()
        browser.close()

    manifest = {
        "schema": 1,
        "policyId": "QUADLUD_SEMANTIC_VALIDATION_V1",
        "journeyId": "tango-expert-fr-mobile-v1",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "build": build,
        "scenario": {
            "game": "tango",
            "difficulty": "expert",
            "locale": "fr-FR",
            "viewport": VIEWPORT,
            "hasTouch": True,
            "isMobile": True,
            "seed": SEED,
            "fingerprint": session.get("fingerprint"),
        },
        "captures": captures,
        "captureCount": len(captures),
        "consoleErrors": errors,
        "automaticJourneyStatus": "SCRIPTED_PASS",
        "semanticStatus": "SEMANTIC_NOT_EXECUTED",
        "humanStatus": "HUMAN_PENDING",
        "semanticReviewRequired": True,
        "hiddenSolutionIncluded": False,
    }
    (evidence_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (evidence_dir / "review.md").write_text(
        "# Revue sémantique — EN ATTENTE\n\n"
        "Statut : `SEMANTIC_NOT_EXECUTED`\n\n"
        "Le parcours réel et les captures ont été produits automatiquement. "
        "Ils doivent être examinés séquentiellement selon la politique privée QUADLUD. "
        "Un PASS de ce test ne constitue pas un `SEMANTIC_PASS`.\n",
        encoding="utf-8",
    )

    print(
        f"semantic Tango Tutor journey evidence PASS — {len(captures)} observable states captured; "
        f"semantic review remains SEMANTIC_NOT_EXECUTED; evidence={evidence_dir}"
    )


if __name__ == "__main__":
    main()
