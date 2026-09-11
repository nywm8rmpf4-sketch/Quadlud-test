from __future__ import annotations

import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get('QUADLUD_R8_BASE_URL', 'http://127.0.0.1:8765/')
VIEWPORT = {'width': 390, 'height': 844}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport=VIEWPORT, locale='fr-FR', has_touch=True, is_mobile=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda exc: errors.append('pageerror:' + str(exc)))
    page.goto(BASE_URL, wait_until='networkidle')
    page.wait_for_selector('.cards')
    games = page.evaluate('()=>Array.from(globalThis.QuadludGameRegistry?.IDS||[])')
    assert games, 'game registry is empty'
    reports = []

    for game in games:
        page.evaluate("""game=>withSeed('v319-final-shared-'+game,()=>{
          closeHintNotice();
          const g=generateRegisteredCandidate(game,'easy');
          installGeneratedSession(game,'easy',g,{context:'normal'});
          historyInit(true);
          startTimer(true,0,false);
          drawGameUi();
        })""", game)
        page.wait_for_selector('.panel .toolbar')
        state = page.evaluate("""()=>({
          game:current?.game||null,
          toolbarButtons:document.querySelectorAll('.panel .toolbar .btn').length,
          undoDisabled:document.querySelector('#undoBtn')?.disabled===true,
          redoDisabled:document.querySelector('#redoBtn')?.disabled===true,
          scrollWidth:document.documentElement.scrollWidth,
          innerWidth
        })""")
        assert state['game'] == game, state
        assert state['toolbarButtons'] >= 6, state
        assert state['undoDisabled'] and state['redoDisabled'], state
        assert state['scrollWidth'] <= state['innerWidth'] + 1, state
        page.locator('#walkthroughBtn').click(timeout=15000)
        page.wait_for_selector('.walkthrough-panel', timeout=15000)
        tutor = page.evaluate("""()=>({
          present:!!document.querySelector('.walkthrough-panel'),
          scrollWidth:document.documentElement.scrollWidth,
          innerWidth
        })""")
        assert tutor['present'], (game, tutor)
        assert tutor['scrollWidth'] <= tutor['innerWidth'] + 1, (game, tutor)
        close = page.locator('#walkthroughClose')
        if close.count():
            close.click()
            page.wait_for_selector('.walkthrough-panel', state='detached')
        else:
            page.evaluate('()=>closeWalkthrough()')
        reports.append({'game': game, 'toolbar': state['toolbarButtons'], 'tutor': True})

    assert not errors, errors
    context.close(); browser.close()

print('PASS v319-shared-games-smoke-browser', json.dumps(reports, ensure_ascii=False))
