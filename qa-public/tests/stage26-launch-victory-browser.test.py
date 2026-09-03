from pathlib import Path
from qa_runtime_loader import runtime_sources, runtime_styles
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent/'GitHub'
html=(ROOT/'index.html').read_text()
for pat in [r'<link rel="stylesheet"[^>]+>',r'<link rel="manifest"[^>]+>',r'<link rel="apple-touch-icon"[^>]+>',r'<script src="[^"]+"></script>']: html=re.sub(pat,'',html)
css=runtime_styles(ROOT);scripts=runtime_sources(ROOT)
def load(page):
    page.set_content(html);page.add_style_tag(content=css)
    for src in scripts: page.add_script_tag(content=src)
def launch_sync(page,game,diff):
    return page.evaluate("""([game,diff])=>{const oldRaf=window.requestAnimationFrame,oldSetTimeout=window.setTimeout;window.requestAnimationFrame=fn=>{fn();return 1};window.setTimeout=(fn,ms,...args)=>{if(ms<=20)fn(...args);return 1};try{return withSeed(`stage26-launch:${game}:${diff}`,()=>{launch(game,diff);const profile=current?.difficultyProfile||{};return {game:current?.game,diff:current?.diff,tier:profile.minimumRequiredTier,completed:current?.completed,hasLifecycle:GameRegistry.hasCapability(game,'sessionLifecycle')};});}finally{window.requestAnimationFrame=oldRaf;window.setTimeout=oldSetTimeout}}""",[game,diff])
def force_win(page,game):
    return page.evaluate("""game=>{if(game==='queens'){current.state=Array.from({length:current.n},()=>Array(current.n).fill(0));for(let r=0;r<current.n;r++)current.state[r][current.sol[r]]=2}else if(game==='tango'||game==='sudoku')current.state=current.sol.map(row=>[...row]);else if(game==='patches')current.paint=current.reg.map(row=>[...row]);else if(game==='nonogram')current.state=current.validationState.solutionGrid.map(row=>row.map(v=>v?NonogramLogic.FILLED:NonogramLogic.EMPTY));const result=validateRegisteredVictory(current,{strictGeneratedSolution:true});return {solved:result.solved,reasonKey:result.reasonKey,game:current.game,diff:current.diff};}""",game)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':844});load(page);tiers={'easy':0,'medium':1,'hard':2,'expert':3};games=page.evaluate("()=>[...GameRegistry.IDS]")
    for game in games:
        for diff,tier in tiers.items():
            state=launch_sync(page,game,diff);assert state['game']==game and state['diff']==diff and state['tier']==tier and state['completed'] is False and state['hasLifecycle'] is True,(game,diff,state);victory=force_win(page,game);assert victory['solved'] is True,(game,diff,victory)
    browser.close()
print('stage26 launch/victory browser: 20/20 generic launches + registered victory validation OK')
