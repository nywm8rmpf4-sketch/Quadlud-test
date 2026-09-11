from __future__ import annotations

import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("QUADLUD_R8_BASE_URL", "http://127.0.0.1:8765/")
VIEWPORT = {"width": 390, "height": 844}


def main() -> None:
    console_errors: list[str] = []
    http_errors: list[dict] = []
    report: dict = {"viewport": VIEWPORT}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
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

        # 1) Exact runtime data really loaded by index.html, with 120 certified puzzles per tier.
        loaded = page.evaluate(
            """()=>({
              poolCounts:globalThis.QuadludTangoRuntimePoolData?.counts||null,
              poolInfo:globalThis.QuadludTangoPrecomputedPoolRuntime?.info?.()||null,
              cacheInfo:globalThis.QuadludTangoTutorPrecomputedCache?.info?.()||null,
              plannerToken:globalThis.QuadludTangoTutorSinglePlannerR5?.TOKEN||null
            })"""
        )
        expected = {"easy": 120, "medium": 120, "hard": 120, "expert": 120}
        assert loaded["poolCounts"] == expected, loaded
        assert loaded["poolInfo"]["exactRegistered"] == expected, loaded["poolInfo"]
        assert loaded["cacheInfo"]["registered"] is True, loaded["cacheInfo"]
        assert loaded["plannerToken"] == "3.1.9-hf3.9-r5.1b-single-planner-v3-precomputed-guarded", loaded
        report["loaded"] = loaded

        # 2) One shuffle bag exposes all 120 entries of each tier exactly once before refill.
        diversity = page.evaluate(
            """()=>{
              const out={};
              for(const d of ['easy','medium','hard','expert']){
                const ids=[];
                for(let i=0;i<120;i++){
                  const p=QuadludTangoPrecomputedPoolRuntime.takePuzzle(d,Math.random);
                  if(!p)throw new Error(`missing precomputed ${d} puzzle at ${i}`);
                  ids.push(p.generationStats?.poolEntryId||null);
                }
                out[d]={count:ids.length,unique:new Set(ids).size,allCertified:ids.every(Boolean)};
              }
              return out;
            }"""
        )
        for d in expected:
            assert diversity[d] == {"count": 120, "unique": 120, "allCertified": True}, diversity
        report["diversity"] = diversity

        # 3) Real product launch path consumes the exact pool, not the live generator.
        page.evaluate("QuadludTangoPrecomputedPoolRuntime._test.resetForTests()")
        page.evaluate("launch('tango','expert')")
        page.wait_for_selector("#walkthroughBtn")
        page.wait_for_timeout(100)
        launch_state = page.evaluate(
            """()=>({
              game:current?.game||null,diff:current?.diff||null,
              strategy:current?.generationStats?.strategy||null,
              poolEntryId:current?.generationStats?.poolEntryId||null,
              fingerprint:current?.difficultyProfile?.fingerprint||null,
              poolStats:QuadludTangoPrecomputedPoolRuntime.info().stats
            })"""
        )
        assert launch_state["game"] == "tango" and launch_state["diff"] == "expert", launch_state
        assert launch_state["poolStats"]["exactHits"] >= 1, launch_state
        if launch_state["strategy"] is not None:
            assert launch_state["strategy"] == "certified-precomputed-pool", launch_state
        report["launch"] = launch_state

        # 4) Real Tutor first logical transition hits the exact fingerprint cache.
        page.evaluate("QuadludTangoTutorPrecomputedCache._test.resetStats()")
        page.locator("#walkthroughBtn").click()
        page.wait_for_selector(".walkthrough-panel")
        page.wait_for_timeout(100)
        next_btn = page.locator("#walkthroughNext")
        assert next_btn.count() and next_btn.is_visible() and not next_btn.is_disabled()
        t0 = time.perf_counter()
        next_btn.click(timeout=15000)
        page.wait_for_timeout(300)
        cached_ms = round((time.perf_counter() - t0) * 1000, 2)
        tutor = page.evaluate(
            """()=>{
              const s=walkthroughSession,g=walkthroughCurrentGroup?.(),i=Math.max(0,Math.min((g?.entries?.length||1)-1,Number(s?.navigation?.proofStepIndex)||0)),m=g?.entries?.[i]?.move||null;
              return {cache:QuadludTangoTutorPrecomputedCache.info(),mode:m?.metrics?.tutorPlannerMode||null,status:s?.tangoTutorStatus||null,stage:m?.pedagogyStageKind||m?.proofStage?.kind||null};
            }"""
        )
        assert tutor["cache"]["stats"]["hits"] >= 1, tutor
        assert tutor["mode"] == "precomputed-guarded", tutor
        report["cachedTutor"] = {**tutor, "logicalTransitionMs": cached_ms}

        # 5) Diverge by one correct but non-canonical visible placement. Cache rejection + live fallback are mandatory.
        divergence = page.evaluate(
            """()=>{
              const P=QuadludTangoPlayedMovePlanner,C=QuadludTangoTutorPrecomputedCache,S=QuadludTangoTutorSinglePlannerR5;
              const publicPuzzle={n:current.n,state:current.state.map(r=>r.slice()),edges:(current.edges||[]).map(e=>e.slice())};
              const base=P.sessionFromPublicBoard(publicPuzzle,publicPuzzle.state);
              const canonical=C.tryPlan(base,current.diff);
              const avoid=canonical?.target?.join(',');
              let chosen=null;
              for(let r=0;r<current.n&&!chosen;r++)for(let c=0;c<current.n&&!chosen;c++){
                if(current.state[r][c]!==-1||`${r},${c}`===avoid)continue;
                const value=Number(current.sol?.[r]?.[c]);if(value!==0&&value!==1)continue;
                const state=current.state.map(row=>row.slice());state[r][c]=value;
                const e=P.sessionFromPublicBoard({n:current.n,state,edges:(current.edges||[]).map(x=>x.slice())},state);
                if(C.lookup(e,current.diff)===null){chosen={r,c,value,state};break}
              }
              if(!chosen)return {ok:false,reason:'no divergent correct visible placement'};
              const engine=P.sessionFromPublicBoard({n:current.n,state:chosen.state,edges:(current.edges||[]).map(e=>e.slice())},chosen.state);
              C._test.resetStats();
              const cachePlan=C.tryPlan(engine,current.diff);
              const live=S.humanizeTutorPlan(engine,current.diff);
              return {ok:true,chosen:{r:chosen.r,c:chosen.c,value:chosen.value},cachePlan,cacheStats:C.info().stats,liveStatus:live?.status||null,liveMode:live?.tutorPlannerMode||null,liveTarget:live?.target||null};
            }"""
        )
        assert divergence["ok"], divergence
        assert divergence["cachePlan"] is None, divergence
        assert divergence["cacheStats"]["misses"] >= 1, divergence
        assert divergence["liveStatus"] in {"move", "solved"}, divergence
        if divergence["liveStatus"] == "move":
            assert divergence["liveMode"] != "precomputed-guarded", divergence
        report["divergence"] = divergence

        # 6) PWA exact assets survive an offline reload at iPhone viewport.
        page.evaluate("()=>navigator.serviceWorker?.ready")
        page.reload(wait_until="networkidle")
        page.wait_for_selector(".cards")
        pwa = page.evaluate(
            """async()=>({controller:!!navigator.serviceWorker?.controller,caches:await caches.keys(),pool:!!globalThis.QuadludTangoRuntimePoolData,cache:!!globalThis.QuadludTangoTutorCacheDataR8})"""
        )
        assert any("quadlud-v3.1.9-tango-r8-sync2-7d-v18" == x for x in pwa["caches"]), pwa
        assert pwa["pool"] and pwa["cache"], pwa
        context.set_offline(True)
        page.reload(wait_until="domcontentloaded", timeout=15000)
        page.wait_for_selector(".cards", timeout=10000)
        offline = page.evaluate("()=>({title:document.title,pool:!!globalThis.QuadludTangoRuntimePoolData,cache:!!globalThis.QuadludTangoTutorCacheDataR8,viewport:{width:innerWidth,height:innerHeight}})")
        assert offline["pool"] and offline["cache"], offline
        assert offline["viewport"] == VIEWPORT, offline
        report["pwaOnline"] = pwa
        report["offlineReload"] = offline
        report["consoleErrors"] = console_errors
        report["httpErrors"] = http_errors

        out = Path(os.environ.get("QUADLUD_R8_BROWSER_REPORT", "/tmp/quadlud-r8-browser-report.json"))
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        assert not console_errors and not http_errors, {"console": console_errors, "http": http_errors}
        context.close(); browser.close()

    print("integrated exact R8 browser gate PASS — 120x4 unique bag, real launch pool hit, Tutor cache hit, divergence fallback, PWA offline")
    print(json.dumps({"cachedTutorMs": report["cachedTutor"]["logicalTransitionMs"], "divergence": report["divergence"], "pwa": report["pwaOnline"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
