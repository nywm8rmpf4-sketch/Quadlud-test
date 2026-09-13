from pathlib import Path
import json,re,time
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources,runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
for pattern in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    HTML=re.sub(pattern,'',HTML)
CSS=runtime_styles(ROOT);SCRIPTS=runtime_sources(ROOT)

def load(page):
    page.set_content(HTML,wait_until='domcontentloaded')
    page.add_style_tag(content=CSS)
    page.evaluate("""()=>{const d=new Map();const s={getItem:k=>d.get(String(k))??null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>[...d.keys()][i]??null,get length(){return d.size}};Object.defineProperty(window,'localStorage',{configurable:true,value:s})}""")
    for source in SCRIPTS: page.add_script_tag(content=source)
    page.wait_for_selector('.cards')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR',has_touch=True,is_mobile=True,color_scheme='light')
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    load(page)
    page.evaluate('settingsView()')
    assert page.locator('#soundToggle').get_attribute('aria-pressed')=='true'
    assert page.locator('#soundPedagogyToggle').get_attribute('aria-pressed')=='true'
    volume=page.locator('#soundVolume')
    assert volume.get_attribute('aria-label') and volume.get_attribute('aria-valuetext')=='72%'
    page.locator('#soundPedagogyToggle').click()
    volume.fill('35')
    settings=page.evaluate("""()=>({p:prefs(),audio:AudioEvents.diagnostics().preferences,overflow:document.documentElement.scrollWidth>innerWidth+1,rangeHeight:document.querySelector('#soundVolume').getBoundingClientRect().height})""")
    assert settings['p']['soundPedagogy'] is False and settings['p']['soundVolume']==.35,settings
    assert settings['audio']=={'enabled':True,'pedagogicalEnabled':False,'masterVolume':.35},settings
    assert not settings['overflow'] and settings['rangeHeight']>=44,settings
    page.evaluate('settingsView()')
    assert page.locator('#soundPedagogyToggle').get_attribute('aria-pressed')=='false'
    assert page.locator('#soundVolume').input_value()=='35'
    page.select_option('#themeSelect','dark')
    assert page.evaluate("document.documentElement.dataset.theme")=='dark'

    timings={}
    for game in page.evaluate('()=>[...QuadludGameRegistry.IDS]'):
        report=page.evaluate("""game=>{const t=performance.now();let g;withSeed('v319-g-'+game,()=>{g=generateRegisteredCandidate(game,'easy')});const generated=performance.now()-t;installGeneratedSession(game,'easy',g,{context:'normal'});historyInit(true);drawGameUi();const board=document.querySelector('.board'),before=board.getBoundingClientRect();celebrateBoard(game);const after=board.getBoundingClientRect();return{generated,role:board.getAttribute('role'),rows:board.getAttribute('aria-rowcount'),cols:board.getAttribute('aria-colcount'),before:[before.width,before.height],after:[after.width,after.height],overflow:document.documentElement.scrollWidth>innerWidth+1,toolbar:document.querySelectorAll('.toolbar button').length}}""",game)
        timings[game]=report['generated']
        assert report['generated']<3500,(game,report)
        assert report['role']=='grid' and report['rows'] and report['cols'],(game,report)
        assert report['toolbar']>=7 and not report['overflow'],(game,report)
        assert all(abs(a-b)<1 for a,b in zip(report['before'],report['after'])),(game,report)

    unique=page.evaluate("""()=>withSeed('v319-g-single-victory',()=>{const g=generateRegisteredCandidate('patches','easy');installGeneratedSession('patches','easy',g,{context:'normal'});historyInit(true);statsStart(current);current.paint=current.reg.map(r=>[...r]);drawGameUi();const before=AudioEvents.diagnostics().service.requested,a=maybeAutoFinish(),b=maybeAutoFinish(),after=AudioEvents.diagnostics().service.requested;return{a,b,delta:after-before,completed:current.completed}})""")
    assert unique=={'a':True,'b':False,'delta':1,'completed':True},unique
    assert sum(timings.values())<8000,timings
    assert not errors,errors
    context.close()

    reduced=browser.new_context(viewport={'width':844,'height':390},locale='fr-FR',has_touch=True,is_mobile=True,color_scheme='dark',reduced_motion='reduce')
    page=reduced.new_page();load(page)
    for game in page.evaluate('()=>[...QuadludGameRegistry.IDS]'):
        result=page.evaluate("""game=>withSeed('v319-g-reduced-'+game,()=>{const g=generateRegisteredCandidate(game,'easy');installGeneratedSession(game,'easy',g,{context:'normal'});historyInit(true);drawGameUi();const board=document.querySelector('.board');const celebration=celebrateBoard(game);return{reduced:celebration.reducedMotion===true||board.classList.contains('sensorial-victory-reduced')||board.classList.contains('lighthouses-victory-reduced'),overflow:document.documentElement.scrollWidth>innerWidth+1}})""",game)
        assert result['reduced'] and not result['overflow'],(game,result)
    reduced.close();browser.close()

print('v3.1.9-G browser PASS',json.dumps({'audioControls':'persisted + accessible','themes':['light','dark'],'viewports':['phone portrait','phone landscape'],'games':5,'performanceMs':timings,'victoryEvents':1},ensure_ascii=False))
