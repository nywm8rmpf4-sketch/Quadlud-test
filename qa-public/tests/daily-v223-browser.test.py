from pathlib import Path
from qa_runtime_loader import runtime_sources, runtime_styles
import json,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'GitHub';FIXTURES=json.loads((ROOT.parent/'tests'/'fixtures'/'daily-v223.json').read_text());html=(ROOT/'index.html').read_text()
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']: html=re.sub(pat,'',html)
css=runtime_styles(ROOT);scripts=runtime_sources(ROOT)
def load(page):
    page.set_content(html,wait_until='domcontentloaded');page.add_style_tag(content=css);page.add_script_tag(content="""(()=>{const data=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}}});})();""")
    for src in scripts: page.add_script_tag(content=src)
    page.wait_for_selector('.cards');page.evaluate("startBackgroundPrecompute=()=>{}")
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)));page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None);load(page)
    assert page.evaluate("DAILY_SCHEMA===2 && DAILY_GENERATOR===1 && DAILY_NAMESPACE==='quadlud-daily-v2.23' && DAILY_DIFFICULTY==='medium'");assert page.evaluate("DAILY_KEY==='logic4-daily-v2'");assert page.evaluate("dailySeedString('2026-08-17','queens')==='quadlud-daily-v2.23:s2:g1:2026-08-17:queens:medium'")
    for fx in FIXTURES:
        got=page.evaluate("""fx=>{const a=dailyBuildCandidate(fx.day,fx.game),b=dailyBuildCandidate(fx.day,fx.game),pa=generatedCandidateProfile(a),pb=generatedCandidateProfile(b),fa=dailyFingerprintFromCandidate(fx.game,a),fb=dailyFingerprintFromCandidate(fx.game,b);return {fa,fb,profileFingerprint:pa?.fingerprint,status:pa?.status,difficulty:pa?.difficulty,tier:pa?.minimumRequiredTier,budgetHit:!!pa?.budgetHit,certified:generatedCandidateCertified(fx.game,DAILY_DIFFICULTY,a),sameCanonical:DifficultyRating.canonicalString(generatedPublicPuzzleFromCandidate(fx.game,a))===DifficultyRating.canonicalString(generatedPublicPuzzleFromCandidate(fx.game,b)),secondTier:pb?.minimumRequiredTier};}""",fx);assert got['fa']==got['fb']==fx['fingerprint']==got['profileFingerprint'],(fx,got);assert got['status']=='solved' and got['difficulty']=='medium' and got['tier']==fx['tier']==1 and got['secondTier']==1 and got['budgetHit'] is False and got['certified'] is True and got['sameCanonical'] is True,(fx,got)
    page.evaluate("dailyView()");mobile=page.evaluate("({scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth,cards:document.querySelectorAll('[data-daily]').length})");assert mobile['cards']==5 and mobile['scrollWidth']<=mobile['innerWidth']+1,mobile;assert not errors,errors;ctx.close();browser.close()
print('daily v2.23 browser tests: OK')
