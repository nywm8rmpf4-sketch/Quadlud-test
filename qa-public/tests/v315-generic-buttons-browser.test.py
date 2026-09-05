from pathlib import Path
import json, re, subprocess
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT = Path(__file__).resolve().parents[1] / 'GitHub'
GAMES=json.loads(subprocess.check_output(['node','-e',f"console.log(JSON.stringify(require({json.dumps(str(ROOT/'game-manifest.js'))}).IDS))"],text=True))
index_html=(ROOT/'index.html').read_text()
service_worker=(ROOT/'sw.js').read_text()
assert 'styles-mobile.css?v=3.1.8-u12-ipad-balance' in index_html,'adaptive iPad CSS cache-bust token missing'
cache_match=re.search(r"const CACHE='([^']+)'",service_worker)
assert cache_match and cache_match.group(1).startswith('quadlud-v3.1.'),'v3.1 service-worker cache identity missing'
assert "'./styles-mobile.css?v=3.1.8-u12-ipad-balance'" in service_worker,'adaptive iPad CSS must be precached under the cache-busted URL'
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

def open_game(page, game):
    page.evaluate("""game=>withSeed('v315-lh7-'+game,()=>{const g=generateRegisteredCandidate(game,'easy');installGeneratedSession(game,'easy',g,{context:'normal'});historyInit(true);startTimer(true,0,false);drawGameUi()})""",game)
    page.wait_for_selector('.panel .toolbar .btn')

def button_state(page):
    return page.evaluate("""()=>{const normal=document.querySelector('#resetBtn'),primary=document.querySelector('#newBtn'),toolbar=document.querySelector('.toolbar');normal.focus();const n=getComputedStyle(normal),p=getComputedStyle(primary),r=normal.getBoundingClientRect();return {height:r.height,borderRadius:parseFloat(n.borderRadius),boxShadow:n.boxShadow,background:n.backgroundImage,primaryBackground:p.backgroundImage,primaryColor:p.color,outlineStyle:n.outlineStyle,outlineWidth:n.outlineWidth,scrollWidth:document.documentElement.scrollWidth,innerWidth,toolbarButtons:toolbar.querySelectorAll('.btn').length}}""")

def tutor_persona(page):
    return page.evaluate("""()=>{const el=document.querySelector('.walkthrough-panel .pedagogy-persona-tutor');if(!el)return null;const r=el.getBoundingClientRect();return {count:document.querySelectorAll('.walkthrough-panel .pedagogy-persona-tutor').length,persona:el.dataset.persona,hidden:el.getAttribute('aria-hidden'),width:r.width,height:r.height,scrollWidth:document.documentElement.scrollWidth,innerWidth}}""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True)
    page=ctx.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)
    for game in GAMES:
        open_game(page,game)
        state=button_state(page)
        assert state['toolbarButtons']>=6,(game,state)
        assert state['height']>=43.5,(game,state)
        assert state['borderRadius']>=12,(game,state)
        assert state['boxShadow']!='none',(game,state)
        assert 'gradient' in state['background'],(game,state)
        assert state['primaryBackground']!=state['background'],(game,state)
        if game=='queens': assert state['outlineStyle']!='none' and float(state['outlineWidth'].replace('px',''))>=3,(game,state)
        assert state['scrollWidth']<=state['innerWidth']+1,(game,state)
        page.locator('#rulesBtn').tap()
        page.wait_for_selector('#modal')
        page.locator('#modalClose').tap()
        assert page.locator('#modal').count()==0,game

        page.locator('#walkthroughBtn').tap()
        page.wait_for_selector('.walkthrough-panel .pedagogy-persona-tutor')
        persona=tutor_persona(page)
        assert persona and persona['count']==1,(game,persona)
        assert persona['persona']==('sailor' if game=='queens' else 'guide'),(game,persona)
        assert persona['hidden']=='true',(game,persona)
        assert 32<=persona['width']<=40 and 32<=persona['height']<=40,(game,persona)
        assert persona['scrollWidth']<=persona['innerWidth']+1,(game,persona)
        page.locator('#walkthroughClose').tap()
        page.wait_for_selector('.walkthrough-panel',state='detached')

    page.evaluate("document.documentElement.dataset.theme='dark'")
    dark=button_state(page)
    assert dark['boxShadow']!='none' and dark['primaryBackground']!=dark['background'],dark
    assert not errors,errors
    ctx.close()

    # v3.1.8-U12: iPad portrait gameplay uses the same compact tablet scale
    # across all games instead of expanding toward the historical 760px cap.
    portrait=browser.new_context(viewport={'width':1024,'height':1366},locale='fr-FR',has_touch=True)
    page=portrait.new_page(); portrait_errors=[]
    page.on('pageerror',lambda e:portrait_errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:portrait_errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)
    for game in GAMES:
        open_game(page,game)
        geom=page.evaluate("""()=>{const surface=document.querySelector('.panel>.board-wrap')||document.querySelector('.panel .nonogram-layout');const panel=document.querySelector('.panel');const r=surface?.getBoundingClientRect(),pr=panel?.getBoundingClientRect();return {width:r?.width||0,left:r?.left||0,right:r?.right||0,panelLeft:pr?.left||0,panelRight:pr?.right||0,scrollWidth:document.documentElement.scrollWidth,innerWidth}}""")
        assert 500<=geom['width']<=561,(game,geom)
        assert geom['left']>=geom['panelLeft']-1 and geom['right']<=geom['panelRight']+1,(game,geom)
        assert geom['scrollWidth']<=geom['innerWidth']+1,(game,geom)
    assert not portrait_errors,portrait_errors
    portrait.close()

    # v3.1.8-U11/U12 regression: iPad landscape Tutor must use the available
    # width, keep the full LIGHTHOUSES coordinate board inside the panel, and
    # never create horizontal page overflow.
    ipad=browser.new_context(viewport={'width':1366,'height':900},locale='fr-FR',has_touch=True)
    page=ipad.new_page(); ipad_errors=[]
    page.on('pageerror',lambda e:ipad_errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:ipad_errors.append('console:'+m.text) if m.type=='error' else None)
    load(page); open_game(page,'queens')
    page.locator('#walkthroughBtn').tap()
    page.wait_for_selector('.walkthrough-panel .walkthrough-queens-coordinate-wrap')
    layout=page.evaluate("""()=>{const app=document.querySelector('main#app'),panel=document.querySelector('.walkthrough-panel'),board=document.querySelector('.walkthrough-queens-coordinate-wrap');const ar=app.getBoundingClientRect(),pr=panel.getBoundingClientRect(),br=board.getBoundingClientRect(),ps=getComputedStyle(panel);return {tutorActive:document.body.classList.contains('tutor-active'),innerWidth,appWidth:ar.width,panelWidth:pr.width,panelLeft:pr.left,panelRight:pr.right,boardWidth:br.width,boardLeft:br.left,boardRight:br.right,display:ps.display,scrollWidth:document.documentElement.scrollWidth}}""")
    assert layout['tutorActive'] is True,layout
    assert layout['display']=='grid',layout
    assert layout['appWidth']>=layout['innerWidth']*.88,layout
    assert layout['panelWidth']>=layout['innerWidth']*.82,layout
    assert layout['boardWidth']>=559,layout
    assert layout['panelLeft']>=-1 and layout['panelRight']<=layout['innerWidth']+1,layout
    assert layout['boardLeft']>=layout['panelLeft']-1 and layout['boardRight']<=layout['panelRight']+1,layout
    assert layout['scrollWidth']<=layout['innerWidth']+1,layout
    assert not ipad_errors,ipad_errors
    ipad.close()

    reduced=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True,reduced_motion='reduce')
    page=reduced.new_page(); load(page); open_game(page,'queens')
    motion=page.evaluate("""()=>({duration:getComputedStyle(document.querySelector('#resetBtn')).transitionDuration})""")
    assert all(float(x.rstrip('s'))==0 for x in motion['duration'].split(', ')),motion
    reduced.close()

    forced=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True,forced_colors='active')
    page=forced.new_page(); load(page); open_game(page,'queens')
    forced_state=page.evaluate("""()=>{const b=document.querySelector('#resetBtn');b.focus();const s=getComputedStyle(b);return {active:matchMedia('(forced-colors: active)').matches,shadow:s.boxShadow,outline:s.outlineStyle,adjust:s.forcedColorAdjust,height:b.getBoundingClientRect().height}}""")
    assert forced_state['active'] is True,forced_state
    assert forced_state['shadow']=='none',forced_state
    assert forced_state['outline']!='none',forced_state
    assert forced_state['adjust']=='auto',forced_state
    assert forced_state['height']>=43.5,forced_state
    forced.close();browser.close()

print('v3.1.5 LH7 buttons + v3.1.8 Tutor persona + U11 landscape Tutor + U12 iPad portrait balance PASS')
