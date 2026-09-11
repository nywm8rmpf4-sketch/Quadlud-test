from __future__ import annotations

import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("QUADLUD_R8_BASE_URL", "http://127.0.0.1:8765/")
BROWSER_NAME = os.environ.get("QUADLUD_BROWSER", "chromium").strip().lower()
SMOKE_ONLY = os.environ.get("QUADLUD_SMOKE_ONLY", "0") == "1"
VIEWPORT = {"width": 390, "height": 844}
EXPECTED_COUNTS = {"easy": 120, "medium": 120, "hard": 120, "expert": 120}
EXPECTED_CONTRACT = "61749a9d20f1dda8c2747e4129a480bc74323fb27dc9c84e8fd8ab49227b6c3c"
EXPECTED_PLANNER_TOKEN = "3.1.9-cognitive-r4-cache-contract-guard"
EXPECTED_SW_CACHE = "quadlud-v3.1.9-tango-r8-sync4-cognitive-dag-v22"


def main() -> None:
    console_errors: list[str] = []
    http_errors: list[dict] = []
    report: dict = {"viewport": VIEWPORT, "browser": BROWSER_NAME, "smokeOnly": SMOKE_ONLY}
    with sync_playwright() as p:
        browser_type = getattr(p, BROWSER_NAME)
        launch_args = {"headless": True}
        if BROWSER_NAME == "chromium":
            launch_args["args"] = ["--no-sandbox"]
        browser = browser_type.launch(**launch_args)
        context = browser.new_context(viewport=VIEWPORT, locale="fr-FR", has_touch=True, is_mobile=True)
        page = context.new_page()

        def record_console_error(msg) -> None:
            if msg.type != "error":
                return
            location = msg.location or {}
            url = location.get("url", "")
            implicit_favicon_url = BASE_URL.rstrip("/") + "/favicon.ico"
            if url == implicit_favicon_url and "404" in msg.text and msg.text.startswith("Failed to load resource:"):
                return
            console_errors.append(f"console:{msg.text}|location={location}")

        page.on("pageerror", lambda exc: console_errors.append("pageerror:" + str(exc)))
        page.on("console", record_console_error)
        page.on("response", lambda response: http_errors.append({"status": response.status, "url": response.url}) if response.status >= 400 else None)
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_selector(".cards")

        loaded = page.evaluate(
            """()=>({
              poolCounts:globalThis.QuadludTangoRuntimePoolData?.counts||null,
              poolInfo:globalThis.QuadludTangoPrecomputedPoolRuntime?.info?.()||null,
              cacheInfo:globalThis.QuadludTangoTutorPrecomputedCache?.info?.()||null,
              cacheData:{schema:globalThis.QuadludTangoTutorCacheDataR8?.schema||null,version:globalThis.QuadludTangoTutorCacheDataR8?.version||null},
              plannerToken:globalThis.QuadludTangoTutorSinglePlannerR5?.TOKEN||null,
              directVisible:globalThis.QuadludTangoHumanPedagogyR4?.__quadludDirectVisiblePriorityR1===true,
              cognitiveModel:globalThis.QuadludTangoPlayedMoveRuntime?.cognitiveModel||null
            })"""
        )
        assert loaded["poolCounts"] == EXPECTED_COUNTS, loaded
        assert loaded["poolInfo"]["exactRegistered"] == EXPECTED_COUNTS, loaded["poolInfo"]
        assert loaded["cacheInfo"]["registered"] is True, loaded["cacheInfo"]
        assert loaded["cacheInfo"]["version"] == 6, loaded["cacheInfo"]
        assert loaded["cacheInfo"]["dataSchema"] == 9, loaded["cacheInfo"]
        assert loaded["cacheInfo"]["dataVersion"] == "tango-tutor-cache-r8-sync4-cognitive-dag", loaded["cacheInfo"]
        assert loaded["cacheInfo"]["contract"]["digest"] == EXPECTED_CONTRACT, loaded["cacheInfo"]
        assert loaded["cacheData"] == {"schema": 9, "version": "tango-tutor-cache-r8-sync4-cognitive-dag"}, loaded
        assert loaded["plannerToken"] == EXPECTED_PLANNER_TOKEN, loaded
        assert loaded["directVisible"] is True, loaded
        report["loaded"] = loaded

        page.evaluate("QuadludTangoPrecomputedPoolRuntime._test.resetForTests()")
        page.evaluate("launch('tango','expert')")
        page.wait_for_selector("#walkthroughBtn")
        direct = page.evaluate(
            """()=>{
              const P=QuadludTangoPlayedMovePlanner,C=QuadludTangoTutorPrecomputedCache,T=QuadludTangoTutorSinglePlannerR5;
              const publicPuzzle={n:current.n,state:current.state.map(r=>r.slice()),edges:(current.edges||[]).map(e=>e.slice())};
              const engine=P.sessionFromPublicBoard(publicPuzzle,publicPuzzle.state);
              C._test.resetStats();const t0=performance.now();const plan=T.humanizeTutorPlan(engine,current.diff);const ms=performance.now()-t0;
              return {ms,status:plan?.status||null,mode:plan?.tutorPlannerMode||null,target:plan?.target||null,value:plan?.value,proofKind:plan?.displayProof?.kind||null,profile:plan?.displayProof?.cognitiveProfile||null,cache:C.info()};
            }"""
        )
        assert direct["status"] == "move", direct
        assert direct["mode"] == "precomputed-guarded", direct
        assert direct["cache"]["stats"]["hits"] == 1, direct
        assert direct["cache"]["stats"]["misses"] == 0, direct
        report["directTutor"] = direct

        # Opening Tutor intentionally starts at step 0 with no generated move.
        # The first cache-backed Tutor deduction is requested by the user's
        # first Next action, matching app.js openWalkthrough/renderWalkthrough.
        page.evaluate("QuadludTangoTutorPrecomputedCache._test.resetStats()")
        page.locator("#walkthroughBtn").click(timeout=15000)
        page.wait_for_selector(".walkthrough-panel", timeout=15000)
        initial_ui = page.evaluate("()=>({cache:QuadludTangoTutorPrecomputedCache.info(),status:walkthroughSession?.tangoTutorStatus||null,moves:walkthroughSession?.moves?.length||0,atStart:walkthroughSession?.atStart===true})")
        assert initial_ui["moves"] == 0 and initial_ui["atStart"] is True, initial_ui
        assert initial_ui["cache"]["stats"]["hits"] == 0, initial_ui

        t0 = time.perf_counter()
        page.locator("#walkthroughNext").click(timeout=15000)
        page.wait_for_function(
            "()=>QuadludTangoTutorPrecomputedCache.info().stats.hits>=1 || (walkthroughSession?.tangoTutorStatus!=null) || ((walkthroughSession?.moves?.length||0)>0)",
            timeout=15000,
        )
        first_step_ms = round((time.perf_counter() - t0) * 1000, 2)
        ui_state = page.evaluate("()=>({cache:QuadludTangoTutorPrecomputedCache.info(),status:walkthroughSession?.tangoTutorStatus||null,moves:walkthroughSession?.moves?.length||0,atStart:walkthroughSession?.atStart===true})")
        assert ui_state["cache"]["stats"]["hits"] >= 1, ui_state
        assert ui_state["cache"]["stats"]["misses"] == 0, ui_state
        assert ui_state["moves"] >= 1, ui_state
        report["uiTutorInitial"] = initial_ui
        report["uiTutorFirstStep"] = {**ui_state, "elapsedMs": first_step_ms}

        if not SMOKE_ONLY:
            page.evaluate("()=>navigator.serviceWorker?.ready")
            page.reload(wait_until="networkidle")
            page.wait_for_selector(".cards")
            pwa = page.evaluate("""async()=>({controller:!!navigator.serviceWorker?.controller,caches:await caches.keys(),pool:!!globalThis.QuadludTangoRuntimePoolData,cache:!!globalThis.QuadludTangoTutorCacheDataR8})""")
            assert EXPECTED_SW_CACHE in pwa["caches"], pwa
            assert pwa["pool"] and pwa["cache"], pwa
            context.set_offline(True)
            page.reload(wait_until="domcontentloaded", timeout=15000)
            page.wait_for_selector(".cards", timeout=10000)
            offline = page.evaluate("()=>({pool:!!globalThis.QuadludTangoRuntimePoolData,cache:!!globalThis.QuadludTangoTutorCacheDataR8,viewport:{width:innerWidth,height:innerHeight}})")
            assert offline["pool"] and offline["cache"], offline
            assert offline["viewport"] == VIEWPORT, offline
            report["pwaOnline"] = pwa
            report["offlineReload"] = offline

        report["consoleErrors"] = console_errors
        report["httpErrors"] = http_errors
        out = Path(os.environ.get("QUADLUD_R8_BROWSER_REPORT", f"/tmp/quadlud-r8-postinstall-{BROWSER_NAME}.json"))
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        assert not console_errors and not http_errors, {"console": console_errors, "http": http_errors}
        context.close(); browser.close()

    print("COGNITIVE_R8_POSTINSTALL_BROWSER_PASS", json.dumps({"browser": BROWSER_NAME, "smokeOnly": SMOKE_ONLY, "directTutorMs": round(report["directTutor"]["ms"],2), "uiTutorFirstStepMs": report["uiTutorFirstStep"]["elapsedMs"], "profile": report["directTutor"]["profile"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
