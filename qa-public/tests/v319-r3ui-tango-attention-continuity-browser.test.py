# QUADLUD — Soleil/Lune Tutor attention continuity regression
# Copyright © 2026 Serge Benoliel. All rights reserved.
from pathlib import Path
import json
import re
from playwright.sync_api import sync_playwright
from qa_runtime_loader import runtime_sources, runtime_styles

ROOT = Path(__file__).resolve().parents[1] / 'GitHub'
SEED = 'qa-semantic-tango-expert-v1'
VIEWPORT = {'width': 390, 'height': 844}

html = (ROOT / 'index.html').read_text(encoding='utf-8')
for pat in [r'<link rel="stylesheet"[^>]+>', r'<link rel="manifest"[^>]+>', r'<link rel="apple-touch-icon"[^>]+>', r'<script src="[^"]+"></script>']:
    html = re.sub(pat, '', html)
css = runtime_styles(ROOT)
scripts = runtime_sources(ROOT)


def load(page):
    page.set_content(html, wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    page.evaluate("""()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}""")
    for src in scripts:
        page.add_script_tag(content=src)
    page.wait_for_selector('.cards')


def start_expert(page):
    result = page.evaluate("""seed=>withSeed(seed,()=>{const generated=generateRegisteredCandidate('tango','expert');installGeneratedSession('tango','expert',generated,{context:'normal'});historyInit(true);startTimer(true,0,false);drawGameUi();return {game:current?.game,diff:current?.diff}})""", SEED)
    assert result == {'game': 'tango', 'diff': 'expert'}, result
    page.locator('#walkthroughBtn').click()
    page.wait_for_selector('.walkthrough-panel')
    page.wait_for_timeout(120)


def current_action(page):
    return page.evaluate("""()=>{const cell=document.querySelector('.walkthrough-board .walkthrough-current-action');if(!cell)return null;return `${String.fromCharCode(65+Number(cell.dataset.r))}${Number(cell.dataset.c)+1}`;}""")


def advance_logical(page):
    for _ in range(32):
        proof = page.locator('#walkthroughProofNext')
        if proof.count() and proof.is_visible() and not proof.is_disabled():
            proof.click(); page.wait_for_timeout(120); continue
        break
    nxt = page.locator('#walkthroughNext')
    assert nxt.count() and nxt.is_visible() and not nxt.is_disabled(), 'Tutor next logical control unavailable'
    nxt.click(); page.wait_for_timeout(650)
    return current_action(page)


def attention_diagnostics(page):
    return page.evaluate("""()=>{
      const P=QuadludTangoPlayedMovePlanner,A=P?._attentionTest,Q=QuadludPedagogyNextMovePolicy,s=walkthroughSession;
      const safe=(fn,fallback=null)=>{try{return fn()}catch(e){return {error:String(e?.stack||e)}}};
      const summarizePlan=plan=>plan?{target:plan.target,value:plan.value,rule:plan.deduction?.rule||null,selectionStatus:plan.selectionStatus||null,selectedCostVector:plan.selectedCostVector||null,localAttentionContinuation:!!plan.localAttentionContinuation,localAttentionAxis:plan.localAttentionAxis||null,humanRecentCells:plan.humanRecentCells||null}:null;
      const ctx=safe(()=>A.tutorRecentContext(),{});
      const axis=safe(()=>A.dominantAxis(ctx.recentCells),null);
      const expanded=safe(()=>A.expandContextAlongAxis(ctx,s?.work?.state,A.LOCAL_AXIS_RADIUS),{});
      const exact=safe(()=>A.contextualDirectPlan(s,'expert',{},ctx),null);
      const local=safe(()=>A.contextualDirectPlan(s,'expert',{},expanded),null);
      const candidates=safe(()=>{
        const direct=P._test.allowedDirectDeductions(s,3),ev=P._test.evaluateStartingDeductions(s,3,direct,{},false),selectors=P._test.buildSelectorCandidates(ev.plans);
        return selectors.map(c=>{
          const cells=A.planCells(c.plan),base=P._test.planCostVector(c.plan),target=c.plan?.target||null;
          const originalMetrics=Q.contextualMetrics({target:c.plan?.target,value:c.plan?.value,baseCost:base,premiseCells:cells.premiseCells,focusCells:cells.focusCells,payload:c.plan},{recentCells:ctx.recentCells||[],pendingConclusions:ctx.pendingConclusions||[]});
          const expandedMetrics=Q.contextualMetrics({target:c.plan?.target,value:c.plan?.value,baseCost:base,premiseCells:cells.premiseCells,focusCells:cells.focusCells,payload:c.plan},{recentCells:expanded.recentCells||[],pendingConclusions:ctx.pendingConclusions||[]});
          const human=target?`${String.fromCharCode(65+Number(target[0]))}${Number(target[1])+1}`:'';
          return {human,target,value:c.plan?.value,rule:c.plan?.deduction?.rule||null,baseCost:base,premiseCells:cells.premiseCells,focusCells:cells.focusCells,originalMetrics,expandedMetrics,eligibleOriginal:A.simpleDirectContinuationCandidate({target:c.plan?.target,value:c.plan?.value,baseCost:base,premiseCells:cells.premiseCells,focusCells:cells.focusCells,payload:c.plan},ctx.recentCells||[]),eligibleExpanded:A.simpleDirectContinuationCandidate({target:c.plan?.target,value:c.plan?.value,baseCost:base,premiseCells:cells.premiseCells,focusCells:cells.focusCells,payload:c.plan},expanded.recentCells||[])};
        }).filter(x=>x.human==='C3'||x.human==='C1'||x.eligibleOriginal||x.eligibleExpanded);
      },[]);
      return {attentionVersion:P.attentionContinuityVersion,ctx,axis,expanded,exact:summarizePlan(exact),local:summarizePlan(local),candidates};
    }""")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport=VIEWPORT, locale='fr-FR', has_touch=True, is_mobile=True)
    page = ctx.new_page(); errors=[]
    page.on('pageerror', lambda e: errors.append('pageerror:'+str(e)))
    page.on('console', lambda m: errors.append('console:'+m.text) if m.type=='error' else None)
    load(page); start_expert(page)

    observed = [advance_logical(page), advance_logical(page)]
    assert observed == ['B4', 'C6'], observed
    diagnostics = attention_diagnostics(page)
    third = advance_logical(page)
    observed.append(third)
    assert third == 'C3', (
        'Attention continuity regression: after B4 then C6, the directly visible R0 '
        f'propagation C3 must be preferred before changing zone; observed={observed}; '
        f'diagnostics={json.dumps(diagnostics, ensure_ascii=False, sort_keys=True)}'
    )
    assert not errors, errors
    ctx.close(); browser.close()

print('v319-r3ui-tango-attention-continuity-browser.test.py: PASS — local demonstrated R0 continuation stays in attention zone')
