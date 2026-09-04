from pathlib import Path
import json, re, subprocess
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
TOKEN='3.1.8-u14r1-coach-stability'
index_html=(ROOT/'index.html').read_text()
service_worker=(ROOT/'sw.js').read_text()
GAMES=json.loads(subprocess.check_output(['node','-e',f"console.log(JSON.stringify(require({json.dumps(str(ROOT/'game-manifest.js'))}).IDS))"],text=True))
CANONICAL=['newBtn','resetBtn','undoBtn','redoBtn','hintBtn','walkthroughBtn','rulesBtn']

assert f'ui-consistency-v318.css?v={TOKEN}' in index_html,'U14R1 coherence stylesheet missing from page'
assert f'ui-consistency-v318.js?v={TOKEN}' in index_html,'U14R1 coherence runtime missing from page'
cache_match=re.search(r"const CACHE='([^']+)'",service_worker)
assert cache_match and cache_match.group(1).startswith('quadlud-v3.1.8-'),'v3.1.8 cache identity missing'
for asset in ['ui-consistency-v318.css','ui-consistency-v318.js']:
    assert f"'./{asset}?v={TOKEN}'" in service_worker,(asset,'U14R1 precache mismatch')
manifest_match=re.search(r'game-manifest\.js\?v=([^"\']+)',index_html)
assert manifest_match,'game manifest cache-bust token missing'
assert f"'./game-manifest.js?v={manifest_match.group(1)}'" in service_worker,'current game manifest token must be precached exactly'

html=index_html
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    html=re.sub(pat,'',html)
css=runtime_styles(ROOT)
scripts=runtime_sources(ROOT)

def load(page):
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    page.evaluate("""()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}""")
    for src in scripts: page.add_script_tag(content=src)
    page.wait_for_selector('.cards')

def open_game(page,game):
    page.evaluate("""game=>{closeHintNotice();document.body.classList.remove('tutor-active');withSeed('v318-u14-'+game,()=>{const g=generateRegisteredCandidate(game,'easy');installGeneratedSession(game,'easy',g,{context:'normal'});historyInit(true);startTimer(true,0,false);drawGameUi()})}""",game)
    page.wait_for_selector('.panel .toolbar')

def action_state(page):
    return page.evaluate("""()=>{const toolbar=document.querySelector('.toolbar'),visible=[...toolbar.querySelectorAll('button')].filter(b=>{const s=getComputedStyle(b),r=b.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0});return {ids:visible.map(b=>b.id),texts:visible.map(b=>b.textContent.trim().replace(/\s+/g,' ')),scrollWidth:document.documentElement.scrollWidth,innerWidth,rects:Object.fromEntries(visible.map(b=>{const r=b.getBoundingClientRect();return [b.id,{l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}]}))}}""")

def assert_action_parity(page,game,reference=None):
    state=action_state(page)
    assert state['ids']==CANONICAL,(game,state)
    assert state['scrollWidth']<=state['innerWidth']+1,(game,state)
    if reference is not None: assert state['texts']==reference,(game,state['texts'],reference)
    return state

def wide_coach_geometry(page):
    page.locator('#hintBtn').click()
    page.wait_for_selector('#hintNotice')
    page.wait_for_function("()=>document.querySelector('#hintNotice')?.classList.contains('coach-docked-wide')")
    # U14R1 regression: docking must remain true after the post-render settle window,
    # not merely appear transiently for a single animation frame.
    page.wait_for_timeout(140)
    return page.evaluate("""()=>{const r=s=>document.querySelector(s)?.getBoundingClientRect(),panel=r('#app>.panel'),surface=r('#app>.panel>.board-wrap')||r('#app>.panel>.nonogram-game'),toolbar=r('#app>.panel>.toolbar'),notice=r('#hintNotice');return {innerWidth,scrollWidth:document.documentElement.scrollWidth,panel:{l:panel.left,r:panel.right,t:panel.top,b:panel.bottom},surface:{l:surface.left,r:surface.right,t:surface.top,b:surface.bottom},toolbar:{l:toolbar.left,r:toolbar.right,t:toolbar.top,b:toolbar.bottom},notice:{l:notice.left,r:notice.right,t:notice.top,b:notice.bottom,w:notice.width,h:notice.height},docked:document.querySelector('#hintNotice').classList.contains('coach-docked-wide')}}""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    contexts=[
        ('phone-portrait',{'width':390,'height':844},True),
        ('phone-landscape',{'width':844,'height':390},True),
        ('ipad-portrait',{'width':1024,'height':1366},False),
        ('ipad-landscape',{'width':1366,'height':900},False),
        ('desktop-landscape',{'width':1440,'height':900},False),
        ('desktop-portrait',{'width':900,'height':1200},False),
    ]
    for name,viewport,mobile in contexts:
        ctx=browser.new_context(viewport=viewport,locale='fr-FR',has_touch=mobile,is_mobile=mobile)
        page=ctx.new_page();errors=[]
        page.on('pageerror',lambda e,errors=errors:errors.append('pageerror:'+str(e)))
        page.on('console',lambda m,errors=errors:errors.append('console:'+m.text) if m.type=='error' else None)
        load(page);reference=None
        for game in GAMES:
            open_game(page,game)
            state=assert_action_parity(page,game,reference)
            if reference is None: reference=state['texts']
            if name=='phone-portrait':
                r=state['rects']
                row1=[r[x] for x in CANONICAL[:4]];row2=[r[x] for x in CANONICAL[4:]]
                assert max(abs(x['t']-row1[0]['t']) for x in row1)<=2,(game,r)
                assert max(abs(x['t']-row2[0]['t']) for x in row2)<=2,(game,r)
                assert row2[0]['t']>=max(x['b'] for x in row1)-1,(game,r)
                assert r['hintBtn']['t']==row2[0]['t'],(game,r)
            if name in ('ipad-landscape','desktop-landscape'):
                geom=wide_coach_geometry(page)
                assert geom['docked'],(game,geom)
                assert geom['notice']['l']>=geom['panel']['l']-1,(game,geom)
                assert geom['notice']['r']<=geom['surface']['l']-4,(game,geom)
                assert geom['notice']['t']>=geom['toolbar']['b']-1,(game,geom)
                assert geom['notice']['b']<=geom['panel']['b']+1,(game,geom)
                assert geom['notice']['w']>=279,(game,geom)
                assert geom['scrollWidth']<=geom['innerWidth']+1,(game,geom)
                page.evaluate("closeHintNotice();current.hintFlow=null")
        assert not errors,(name,errors)
        ctx.close()
    browser.close()

print('v3.1.8-U14R2 UI coherence PASS — canonical 7 actions across 5 games/6 viewports + phone portrait Coach row 2 + stable wide-landscape Coach rail + current manifest/PWA delivery')
