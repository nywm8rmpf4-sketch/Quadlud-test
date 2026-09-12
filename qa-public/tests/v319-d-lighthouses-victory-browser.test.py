from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT=Path(__file__).resolve().parents[1]/'GitHub'
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
for pattern in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']:
    HTML=re.sub(pattern,'',HTML)
CSS=runtime_styles(ROOT)
SCRIPTS=runtime_sources(ROOT)

def load(page):
    page.set_content(HTML);page.add_style_tag(content=CSS)
    page.add_script_tag(content="""(()=>{const d=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>d.get(String(k))??null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear()}})})()""")
    for source in SCRIPTS: page.add_script_tag(content=source)
    page.evaluate("""()=>withSeed('v319-d-lighthouses',()=>{const p=prefs();p.sound=false;savePrefs(p);const g=generateRegisteredCandidate('queens','easy');installGeneratedSession('queens','easy',g,{context:'normal'});historyInit(true);statsStart(current);const before=historySnapshotKey();current.state=Array.from({length:current.n},()=>Array(current.n).fill(0));for(let r=0;r<current.n;r++)current.state[r][current.sol[r]]=2;drawGameUi(current);historyRecord({type:'QA_D_LIGHTHOUSES_WIN'},before);finish('QA D')})""")
    page.wait_for_timeout(80)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for viewport,scheme in [({'width':390,'height':844},'light'),({'width':844,'height':390},'dark'),({'width':768,'height':1024},'dark')]:
        context=browser.new_context(viewport=viewport,color_scheme=scheme,reduced_motion='no-preference')
        page=context.new_page();load(page)
        result=page.evaluate("""()=>{const board=document.querySelector('#qboard'),layer=document.querySelector('.lighthouses-victory-layer'),origins=[...document.querySelectorAll('.lighthouses-victory-origin')],br=board.getBoundingClientRect(),lr=layer?.getBoundingClientRect();return {layer:!!layer,origins:origins.length,beams:document.querySelectorAll('.lighthouses-victory-beam').length,delays:origins.map(x=>getComputedStyle(x).getPropertyValue('--lh-delay').trim()),outline:getComputedStyle(layer,'::after').animationName,rect:lr&&[Math.abs(br.left-lr.left),Math.abs(br.top-lr.top),Math.abs(br.width-lr.width),Math.abs(br.height-lr.height)],overflow:document.documentElement.scrollWidth<=innerWidth}}""")
        assert result['layer'] and result['origins']>0 and result['beams']==result['origins']*4,result
        assert result['delays']==[f'{i*35}ms' for i in range(result['origins'])],result
        assert result['outline'] in ('lighthouseVictoryOutline','lighthouseVictoryOutlineDark'),result
        assert max(result['rect'])<=1 and result['overflow'],result
        context.close()
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    page=context.new_page();load(page)
    reduced=page.evaluate("""()=>({layer:!!document.querySelector('.lighthouses-victory-layer'),reduced:document.querySelector('#qboard').classList.contains('lighthouses-victory-reduced'),halos:document.querySelectorAll('.lighthouses-victory-halo').length,n:current.n})""")
    assert not reduced['layer'] and reduced['reduced'] and reduced['halos']==reduced['n'],reduced
    context.close();browser.close()
print('v3.1.9-D LIGHTHOUSES browser: light/dark + portrait/landscape/iPad + reduced motion PASS')
