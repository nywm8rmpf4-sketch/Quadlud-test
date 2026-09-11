#!/usr/bin/env python3
# QUADLUD — R8 sharded Tutor cache browser/offline regression
# Copyright © 2026 Serge Benoliel. All rights reserved.
from __future__ import annotations
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL=os.environ.get('QUADLUD_R8_BASE_URL','http://127.0.0.1:8765/')
BROWSER=os.environ.get('QUADLUD_BROWSER','chromium').strip().lower()
VIEWPORT={'width':390,'height':844}
DIFFS=['easy','medium','hard','expert']
EXPECTED_STEPS={'easy':3469,'medium':3721,'hard':3811,'expert':3860}
EXPECTED_CACHE='quadlud-v3.1.9-tango-r8-sync5-cognitive-sharded-lz4-v23'
EXPECTED_CONTRACT='61749a9d20f1dda8c2747e4129a480bc74323fb27dc9c84e8fd8ab49227b6c3c'

def cache_info(page):
    return page.evaluate('()=>QuadludTangoTutorPrecomputedCache.info()')

def wait_decoded(page,diff):
    page.wait_for_function("d=>QuadludTangoTutorPrecomputedCache.info().decodedDifficulties.includes(d)",arg=diff,timeout=15000)

def run_one(browser_type,diff,offline_roundtrip=False):
    browser=browser_type.launch(headless=True,**({'args':['--no-sandbox']} if BROWSER=='chromium' else {}))
    context=browser.new_context(viewport=VIEWPORT,locale='fr-FR',has_touch=True,is_mobile=True)
    page=context.new_page();errors=[];http=[]
    page.on('pageerror',lambda exc:errors.append('pageerror:'+str(exc)))
    def console(msg):
        if msg.type=='error' and 'favicon.ico' not in (msg.location or {}).get('url',''):errors.append('console:'+msg.text)
    page.on('console',console);page.on('response',lambda r:http.append((r.status,r.url)) if r.status>=400 and 'favicon.ico' not in r.url else None)
    page.goto(BASE_URL,wait_until='networkidle');page.wait_for_selector('.cards')
    initial=cache_info(page)
    assert initial['version']==7 and initial['dataSchema']==10 and initial['registered'] is False,initial
    assert initial['registeredDifficulties']==[] and initial['decodedDifficulties']==[],initial
    assert initial['contract']['digest']==EXPECTED_CONTRACT,initial
    page.evaluate("([d])=>launch('tango',d)",[diff]);page.wait_for_selector('#walkthroughBtn');wait_decoded(page,diff)
    ready=cache_info(page)
    assert ready['registeredDifficulties']==[diff],ready
    assert ready['decodedDifficulties']==[diff],ready
    assert ready['steps']=={diff:EXPECTED_STEPS[diff]},ready
    assert ready['puzzles']=={diff:120},ready
    scripts=page.evaluate("()=>[...document.querySelectorAll('script[data-quadlud-tango-cache-shard]')].map(s=>({difficulty:s.dataset.quadludTangoCacheShard,src:s.src}))")
    assert len(scripts)==1 and scripts[0]['difficulty']==diff,scripts
    assert f'tango-tutor-cache-r8-{diff}.js' in scripts[0]['src'],scripts
    direct=page.evaluate("""()=>{const P=QuadludTangoPlayedMovePlanner,C=QuadludTangoTutorPrecomputedCache,T=QuadludTangoTutorSinglePlannerR5;const q={n:current.n,state:current.state.map(r=>r.slice()),edges:(current.edges||[]).map(e=>e.slice())};const e=P.sessionFromPublicBoard(q,q.state);C._test.resetStats();const t=performance.now();const plan=T.humanizeTutorPlan(e,current.diff);return {ms:performance.now()-t,status:plan?.status||null,mode:plan?.tutorPlannerMode||null,cache:C.info()}}""")
    assert direct['status']=='move' and direct['mode']=='precomputed-guarded',direct
    assert direct['cache']['stats']['hits']==1 and direct['cache']['stats']['misses']==0,direct
    page.evaluate('QuadludTangoTutorPrecomputedCache._test.resetStats()')
    page.locator('#walkthroughBtn').click(timeout=15000);page.wait_for_selector('.walkthrough-panel',timeout=15000)
    t=time.perf_counter();page.locator('#walkthroughNext').click(timeout=15000)
    page.wait_for_function("()=>QuadludTangoTutorPrecomputedCache.info().stats.hits>=1 || (walkthroughSession?.moves?.length||0)>0",timeout=15000)
    ui_ms=round((time.perf_counter()-t)*1000,2);ui=page.evaluate("()=>({cache:QuadludTangoTutorPrecomputedCache.info(),moves:walkthroughSession?.moves?.length||0,status:walkthroughSession?.tangoTutorStatus||null})")
    assert ui['cache']['stats']['hits']>=1 and ui['cache']['stats']['misses']==0 and ui['moves']>=1,ui
    result={'difficulty':diff,'directMs':round(direct['ms'],2),'uiMs':ui_ms,'scripts':scripts,'info':ready}
    if offline_roundtrip:
        page.evaluate('()=>navigator.serviceWorker.ready');page.wait_for_timeout(300)
        pwa=page.evaluate("""async()=>{const names=await caches.keys();const name=names.find(x=>x.includes('sync5-cognitive-sharded-lz4'));if(!name)return {controller:!!navigator.serviceWorker.controller,names,urls:[]};const c=await caches.open(name);const keys=await c.keys();return {controller:!!navigator.serviceWorker.controller,names,urls:keys.map(r=>r.url)}}""")
        assert EXPECTED_CACHE in pwa['names'],pwa
        for d in DIFFS:assert any(f'tango-tutor-cache-r8-{d}.js' in u for u in pwa['urls']),pwa
        context.set_offline(True);page.reload(wait_until='domcontentloaded',timeout=15000);page.wait_for_selector('.cards',timeout=10000)
        off0=cache_info(page);assert off0['registered'] is False,off0
        page.evaluate("launch('tango','expert')");page.wait_for_selector('#walkthroughBtn');wait_decoded(page,'expert')
        off=cache_info(page);assert off['registeredDifficulties']==['expert'] and off['decodedDifficulties']==['expert'],off
        result['pwa']={'cache':EXPECTED_CACHE,'assetCount':len(pwa['urls']),'offlineExpert':off}
    assert not errors and not http,{'errors':errors,'http':http}
    context.close();browser.close();return result

def main():
    results=[]
    with sync_playwright() as p:
        bt=getattr(p,BROWSER)
        for diff in DIFFS:results.append(run_one(bt,diff,offline_roundtrip=(diff=='expert')))
    out=Path(os.environ.get('QUADLUD_R8_SHARD_BROWSER_REPORT',f'/tmp/quadlud-r8-shards-{BROWSER}.json'));out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print('PASS v319-r8-sharded-cache-browser',json.dumps({'browser':BROWSER,'results':[{'difficulty':r['difficulty'],'directMs':r['directMs'],'uiMs':r['uiMs']} for r in results]},ensure_ascii=False))
if __name__=='__main__':main()
