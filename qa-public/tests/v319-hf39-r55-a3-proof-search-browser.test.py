from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

from qa_runtime_loader import runtime_sources, runtime_styles

ROOT = Path(__file__).resolve().parents[2]
VIEWPORT = {"width": 390, "height": 844}


def prepare_html() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for pattern in [
        r'<link rel="stylesheet"[^>]+>',
        r'<link rel="manifest"[^>]+>',
        r'<link rel="apple-touch-icon"[^>]+>',
        r'<script src="[^"]+"></script>',
    ]:
        html = re.sub(pattern, "", html)
    return html


def load_runtime(page) -> None:
    page.set_content(prepare_html(), wait_until="domcontentloaded")
    page.add_style_tag(content=runtime_styles(ROOT))
    page.evaluate(
        """()=>{
          const data=new Map();
          const storage={
            getItem:k=>data.has(String(k))?data.get(String(k)):null,
            setItem:(k,v)=>data.set(String(k),String(v)),
            removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),
            key:i=>[...data.keys()][i]??null,
            get length(){return data.size}
          };
          Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
        }"""
    )
    for source in runtime_sources(ROOT):
        page.add_script_tag(content=source)
    page.wait_for_selector(".cards")


def analyze_seed(page, seed: str) -> dict:
    return page.evaluate(
        """seed=>{
          const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
          const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
          const human=cell=>Array.isArray(cell)?`${String.fromCharCode(65+Number(cell[0]))}${Number(cell[1])+1}`:'';
          const stageKind=m=>String(m?.pedagogyStageKind||m?.proofStage?.kind||'');
          const deduction=m=>m?.deduction||m?.presentation?.evidence?.primary||null;
          const valueConclusions=d=>(d?.conclusions||[]).filter(c=>c?.type==='VALUE'&&Array.isArray(c.cell));
          const valuePremises=d=>(d?.premises||[]).filter(p=>p?.kind==='VALUE'&&Array.isArray(p.cell));
          const assumptionOf=m=>{
            const d=deduction(m);
            const p=(d?.premises||[]).find(x=>(x?.kind==='ASSUMPTION'||x?.hypothesis===true)&&Array.isArray(x.cell));
            if(p)return {cell:copy(p.cell),value:Number(p.value)};
            const proof=m?.causalProof,step=(proof?.steps||[]).find(x=>x?.id===m?.causalStepId);
            const hp=(step?.premises||[]).find(x=>(x?.kind==='ASSUMPTION'||x?.hypothesis===true)&&Array.isArray(x.cell));
            return hp?{cell:copy(hp.cell),value:Number(hp.value)}:null;
          };
          const coordsFrom=value=>{
            const out=[],seen=new Set();
            const add=cell=>{if(!Array.isArray(cell)||cell.length<2)return;const c=[Number(cell[0]),Number(cell[1])],k=c.join(',');if(!seen.has(k)){seen.add(k);out.push(c)}};
            const visit=(x,depth=0)=>{if(x==null||depth>8)return;if(Array.isArray(x)){if(x.length>=2&&Number.isInteger(Number(x[0]))&&Number.isInteger(Number(x[1]))){add(x);return}for(const y of x)visit(y,depth+1);return}if(typeof x!=='object')return;for(const [k,v] of Object.entries(x)){if(['cell','a','b','target'].includes(k))add(v);else if(['cells','block','focusCells','producedCells','premises','conclusions','witness','assumption'].includes(k))visit(v,depth+1)}};
            visit(value);return out;
          };
          try{
            try{if(typeof closeHintNotice==='function')closeHintNotice()}catch(_){}
            try{if(typeof walkthroughSession!=='undefined'&&walkthroughSession){walkthroughSession=null;document.body.classList.remove('tutor-active')}}catch(_){}
            const generated=withSeed(seed,()=>generateRegisteredCandidate('tango','expert'));
            installGeneratedSession('tango','expert',generated,{context:'normal'});
            historyInit(true);drawGameUi();
            if(!openWalkthrough())return {seed,error:'openWalkthrough failed'};
            if(!walkthroughGenerateNext())return {seed,error:'logical step 1 generation failed'};
            if(!walkthroughGenerateNext())return {seed,error:'logical step 2 generation failed'};
            const groups=walkthroughGroups(walkthroughSession),g=groups.find(x=>x.logicalMoveIndex===1);
            if(!g)return {seed,error:'logical step 2 missing',groupCount:groups.length};
            const entries=g.entries.map((entry,index)=>{
              const m=entry.move,d=deduction(m),proof=m?.causalProof,cs=(proof?.steps||[]).find(x=>x?.id===m?.causalStepId)||null;
              const exp=m?.presentation?.explanation||{};
              return {
                index:index+1,
                stageKind:stageKind(m),
                proofStageKind:String(m?.proofStage?.kind||''),
                causalKind:String(cs?.kind||''),
                causalStepId:m?.causalStepId||null,
                sourceEntryIndex:cs?.sourceEntryIndex??null,
                sequenceIndex:cs?.sequenceIndex??null,
                synthetic:cs?.synthetic===true,
                hypothetical:cs?.hypothetical===true,
                rule:String(d?.rule||''),
                title:String(exp?.title||''),where:String(exp?.where||''),why:String(exp?.why||''),
                assumption:assumptionOf(m),
                valuePremises:valuePremises(d).map(p=>({cell:copy(p.cell),name:human(p.cell),value:Number(p.value)})),
                valueConclusions:valueConclusions(d).map(c=>({cell:copy(c.cell),name:human(c.cell),value:Number(c.value)})),
                focusCells:copy(d?.focusCells||[]),
                causalPremises:copy(cs?.premises||[]),
                causalConclusions:copy(cs?.conclusions||[]),
                cellRoles:copy(cs?.cellRoles||null),
                producedCells:copy(cs?.producedCells||[]),
                focusUnits:copy(d?.focusUnits||[]),
                explanationData:copy(d?.explanationData||null),
                causalCoords:coordsFrom(cs).map(cell=>human(cell))
              };
            });
            const hypothesis=entries.map(e=>e.assumption).find(Boolean)||null;
            const text=entries.map(e=>`${e.where} ${e.why}`).join(' | ');
            const allCoords=new Set(entries.flatMap(e=>e.causalCoords));
            const contradictionEntry=entries.find(e=>e.causalKind==='contradiction'||e.stageKind==='contradiction')||null;
            const witness=contradictionEntry?.explanationData?.witness||contradictionEntry?.causalPremises?.find?.(p=>p?.kind==='CONTRADICTION')||null;
            const exactHypothesis=hypothesis&&same(hypothesis.cell,[0,2])&&Number(hypothesis.value)===1;
            const chainCells=['A3','B3','B4','A4','B5','E3','E5','F5'];
            const chainText=chainCells.every(name=>text.includes(name)||allCoords.has(name));
            const textSignature=text.includes('A3')&&text.includes('B3')&&text.includes('B4')&&text.includes('A4')&&text.includes('B5')&&text.includes('E3')&&text.includes('E5')&&text.includes('F5');
            const column5=Number(witness?.id)===4&&String(witness?.family||'')==='column' || entries.some(e=>(e.focusUnits||[]).some(u=>u?.family==='column'&&Number(u?.id)===4)) || /colonne\s+5/i.test(text);
            const match=g.entries.length===10&&exactHypothesis&&textSignature&&column5;
            let fingerprint=null;try{fingerprint=persistenceFingerprint(current)}catch(_){}
            return {
              seed,match,groupLength:g.entries.length,groupCount:groups.length,fingerprint,
              hypothesis,chainText,textSignature,column5,
              initialVisibleState:copy(walkthroughSession?.initial?.state||null),
              edges:copy(walkthroughSession?.base?.edges||[]),
              entries
            };
          }catch(error){return {seed,error:String(error?.stack||error)}}
        }""",
        seed,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--count", type=int, default=80)
    parser.add_argument("--out", type=Path, default=Path("/tmp/hf39-r55-a3-search"))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    summary = {"start": args.start, "count": args.count, "matches": [], "near": [], "errors": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        context = browser.new_context(viewport=VIEWPORT, locale="fr-FR", has_touch=True, is_mobile=True)
        page = context.new_page()
        load_runtime(page)
        for ordinal in range(args.start, args.start + args.count):
            seed = f"hf39-r55-a3-{ordinal:04d}"
            result = analyze_seed(page, seed)
            if result.get("error"):
                summary["errors"].append({"seed": seed, "error": result["error"]})
                print(f"SEARCH_ERROR {seed} {result['error']}", flush=True)
                continue
            score = sum([
                result.get("groupLength") == 10,
                bool(result.get("hypothesis") and result["hypothesis"].get("cell") == [0, 2] and result["hypothesis"].get("value") == 1),
                bool(result.get("textSignature")),
                bool(result.get("column5")),
            ])
            if result.get("match"):
                path = args.out / f"MATCH-{seed}.json"
                path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                summary["matches"].append({"seed": seed, "path": str(path), "fingerprint": result.get("fingerprint")})
                print("HF39_R55_MATCH " + json.dumps({"seed":seed,"fingerprint":result.get("fingerprint")}, ensure_ascii=False), flush=True)
                break
            if score >= 2:
                compact = {"seed": seed, "score": score, "groupLength": result.get("groupLength"), "hypothesis": result.get("hypothesis"), "textSignature": result.get("textSignature"), "column5": result.get("column5"), "fingerprint": result.get("fingerprint")}
                summary["near"].append(compact)
                print("HF39_R55_NEAR " + json.dumps(compact, ensure_ascii=False), flush=True)
        context.close(); browser.close()

    (args.out / f"summary-{args.start:04d}.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("HF39_R55_SEARCH_SUMMARY " + json.dumps({"start":args.start,"count":args.count,"matches":len(summary['matches']),"near":len(summary['near']),"errors":len(summary['errors'])}), flush=True)


if __name__ == "__main__":
    main()
