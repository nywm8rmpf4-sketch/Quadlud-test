#!/usr/bin/env python3
# QUADLUD — apply exact Tango Tutor/cache contract guard R4
# Copyright © 2026 Serge Benoliel. All rights reserved.
from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing patch anchor in {path}: {old[:100]!r}")
    if s.count(old) != 1:
        raise SystemExit(f"non-unique patch anchor in {path}: {old[:100]!r}")
    p.write_text(s.replace(old, new, 1))


planner = 'tango-tutor-single-planner-r5.js'
replace_once(
    planner,
    "const VERSION=4;\nconst TOKEN='3.1.9-cognitive-r3-bounded-relation-fallback';",
    "const VERSION=5;\nconst TOKEN='3.1.9-cognitive-r4-cache-contract-guard';",
)
replace_once(
    planner,
    "function precomputedCache(){const c=root.QuadludTangoTutorPrecomputedCache;return c&&typeof c.tryPlan==='function'?c:null}",
    "function precomputedCache(){\n"
    "  const c=root.QuadludTangoTutorPrecomputedCache;\n"
    "  if(!c||typeof c.tryPlan!=='function'||typeof c.info!=='function')return null;\n"
    "  let info=null;try{info=c.info()}catch(_){return null}\n"
    "  const contract=info?.contract||null;\n"
    "  if(info?.registered!==true||!contract)return null;\n"
    "  if(Number(contract.tutorPlannerVersion)!==VERSION||String(contract.tutorPlannerToken||'')!==TOKEN)return null;\n"
    "  return c\n"
    "}",
)

owner = 'qa-public/tests/v319-r3ui-tango-tutor-single-planner-owner.test.js'
replace_once(
    owner,
    "assert.strictEqual(Bridge.VERSION,3);",
    "assert.strictEqual(Bridge.VERSION,5);\n"
    "assert.strictEqual(Bridge.TOKEN,'3.1.9-cognitive-r4-cache-contract-guard');",
)

materializer = 'qa-public/tools/materialize_tango_tutor_cognitive_contract.js'
replace_once(
    materializer,
    "const c={...base,tutorPlannerToken:Tutor.TOKEN||null,humanPolicy:Human.POLICY||null,proofPolicy:Runtime.HUMAN_PROOF_POLICY||null,cognitiveModel:Runtime.cognitiveModel||null,cognitivePatternCatalog:Runtime.cognitivePatternCatalog||null};",
    "const c={...base,tutorPlannerVersion:Number(Tutor.VERSION)||null,tutorPlannerToken:Tutor.TOKEN||null,humanPolicy:Human.POLICY||null,proofPolicy:Runtime.HUMAN_PROOF_POLICY||null,cognitiveModel:Runtime.cognitiveModel||null,cognitivePatternCatalog:Runtime.cognitivePatternCatalog||null};",
)

Path('qa-public/tests/v319-r8-cache-planner-contract-guard.test.js').write_text(r'''#!/usr/bin/env node
/* QUADLUD — R8 exact cache/Tutor contract guard regression
 * Copyright © 2026 Serge Benoliel. All rights reserved.
 */
'use strict';
const assert=require('assert');
const path=require('path');
const runtime=name=>path.join(__dirname,'..','GitHub',name);
const Bridge=require(runtime('tango-tutor-single-planner-r5.js'));
assert.strictEqual(Bridge.VERSION,5);
assert.strictEqual(Bridge.TOKEN,'3.1.9-cognitive-r4-cache-contract-guard');
let tryCalls=0;
const cache={
  tryPlan(){tryCalls++;throw new Error('stale cache must never be queried')},
  info(){return {registered:true,contract:{tutorPlannerVersion:4,tutorPlannerToken:'3.1.9-cognitive-r3-bounded-relation-fallback'}}}
};
global.QuadludTangoTutorPrecomputedCache=cache;
assert.strictEqual(Bridge._test.precomputedCache(),null,'stale planner contract must reject cache before lookup');
assert.strictEqual(tryCalls,0);
cache.info=()=>({registered:false,contract:{tutorPlannerVersion:Bridge.VERSION,tutorPlannerToken:Bridge.TOKEN}});
assert.strictEqual(Bridge._test.precomputedCache(),null,'unregistered cache must be rejected');
cache.info=()=>({registered:true,contract:{tutorPlannerVersion:Bridge.VERSION,tutorPlannerToken:Bridge.TOKEN}});
assert.strictEqual(Bridge._test.precomputedCache(),cache,'exact synchronized contract must be accepted');
assert.strictEqual(tryCalls,0);
delete global.QuadludTangoTutorPrecomputedCache;
console.log('v319-r8-cache-planner-contract-guard.test.js: PASS — stale/unregistered cache rejected; exact Tutor contract accepted');
''')

cog = Path('.github/workflows/cognitive-chunks-r1.yml')
s = cog.read_text()
s = s.replace("          node --check qa-public/tests/v319-r8-relation-lightweight-planner.test.js\n", "")
s = s.replace(
    "          node --check qa-public/tests/v319-r8-cognitive-live-priority.test.js\n",
    "          node --check qa-public/tests/v319-r8-cognitive-live-priority.test.js\n"
    "          node --check qa-public/tests/v319-r8-cache-planner-contract-guard.test.js\n",
)
obsolete = (
    "      - name: Lightweight relation-only planning\n"
    "        run: node qa-public/tests/v319-r8-relation-lightweight-planner.test.js\n"
)
if obsolete not in s:
    raise SystemExit('obsolete lightweight workflow step anchor missing')
s = s.replace(
    obsolete,
    "      # Superseded prototype heuristic: current bounded fallback is covered by\n"
    "      # relation-frontier + live-priority tests against the real Tutor owner.\n",
)
anchor = (
    "      - name: Live C5 cognitive priority\n"
    "        run: node qa-public/tests/v319-r8-cognitive-live-priority.test.js\n"
)
if anchor not in s:
    raise SystemExit('cognitive live-priority anchor missing')
s = s.replace(
    anchor,
    anchor
    + "      - name: Exact cache/planner contract guard\n"
      "        run: node qa-public/tests/v319-r8-cache-planner-contract-guard.test.js\n",
)
cog.write_text(s)

wf = Path('.github/workflows/tango-cognitive-cache-full.yml')
s = wf.read_text()
old_trigger = """  push:
    branches: [candidate/v3.1.9-tango-cognitive-chunks-r1]
    paths: ['.github/workflows/tango-cognitive-cache-full.yml']
"""
new_trigger = """  push:
    branches: [candidate/v3.1.9-tango-cognitive-chunks-r1]
    paths:
      - '.github/workflows/tango-cognitive-cache-full.yml'
      - 'difficulty-rating.js'
      - 'tango-logic.js'
      - 'tango-difficulty.js'
      - 'tutor-move-selector.js'
      - 'pedagogy-next-move-policy.js'
      - 'tango-played-move-planner.js'
      - 'tango-attention-continuity-bridge.js'
      - 'tango-tutor-frontier-pruner-r5.js'
      - 'tango-played-move-runtime.js'
      - 'tango-human-cost-bridge.js'
      - 'cognitive-cost.js'
      - 'tango-cognitive-patterns.js'
      - 'tango-cognitive-pedagogy-bridge.js'
      - 'tango-human-pedagogy-r4.js'
      - 'tango-cognitive-proof-stages-bridge.js'
      - 'tango-direct-visible-priority-bridge.js'
      - 'tango-tutor-single-planner-r5.js'
      - 'tango-runtime-pool-data.js'
      - 'qa-public/tools/tango_tutor_cache_contract.js'
      - 'qa-public/tools/materialize_tango_tutor_cognitive_contract.js'
      - 'qa-public/tools/build_tango_tutor_sync_shard_r8.js'
      - 'qa-public/tools/merge_tango_tutor_cognitive_slices.js'
      - 'qa-public/tools/compact_tango_tutor_sync_r8.js'
  workflow_dispatch:
"""
if old_trigger not in s:
    raise SystemExit('full-cache trigger anchor missing')
s = s.replace(old_trigger, new_trigger, 1)
compact = (
    "          node qa-public/tools/compact_tango_tutor_sync_r8.js merged compact\n"
    "          cp merged/*.json compact/\n"
)
if compact not in s:
    raise SystemExit('compact workflow anchor missing')
s = s.replace(
    compact,
    "          node qa-public/tools/compact_tango_tutor_sync_r8.js merged compact\n"
    "          node qa-public/tools/materialize_tango_tutor_cognitive_contract.js compact/tango-tutor-cache-contract-r8.js\n"
    "          cp merged/*.json compact/\n",
    1,
)
old_install = (
    "      - name: Install generated cognitive cache for exact-source parity\n"
    "        run: cp certified/tango-tutor-cache-data-r8.js ./tango-tutor-cache-data-r8.js\n"
)
new_install = (
    "      - name: Install generated cognitive cache + exact runtime contract for parity\n"
    "        run: |\n"
    "          cp certified/tango-tutor-cache-data-r8.js ./tango-tutor-cache-data-r8.js\n"
    "          cp certified/tango-tutor-cache-contract-r8.js ./tango-tutor-cache-contract-r8.js\n"
)
if old_install not in s:
    raise SystemExit('parity install anchor missing')
s = s.replace(old_install, new_install, 1)

install_job = r'''

  install-cache:
    needs: [merge-cache,parity,certify]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.sha }}
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with: {node-version: '22'}
      - uses: actions/download-artifact@v4
        with:
          name: cognitive-r8-cache-full
          path: certified
      - name: Install certified exact-source cache and bump browser cache keys
        shell: bash
        run: |
          set -euo pipefail
          cp certified/tango-tutor-cache-data-r8.js ./tango-tutor-cache-data-r8.js
          cp certified/tango-tutor-cache-contract-r8.js ./tango-tutor-cache-contract-r8.js
          python3 - <<'PY2'
          from pathlib import Path
          for name in ['index.html','sw.js']:
              p=Path(name)
              text=p.read_text()
              text=text.replace('3.1.9-r8-sync3-cognitive','3.1.9-r8-sync3-cognitive-r4')
              text=text.replace('3.1.9-cognitive-r3-bounded-relation-fallback','3.1.9-cognitive-r4-cache-contract-guard')
              if name=='sw.js':
                  text=text.replace('quadlud-v3.1.9-tango-r8-sync3-cognitive-v21','quadlud-v3.1.9-tango-r8-sync3-cognitive-v22')
              p.write_text(text)
          PY2
          node --check tango-tutor-single-planner-r5.js
          node --check tango-tutor-cache-contract-r8.js
          node --check tango-tutor-precomputed-cache.js
          node --check tango-tutor-cache-data-r8.js
          node qa-public/tests/v319-r8-cache-planner-contract-guard.test.js
          node qa-public/tests/v319-r3ui-tango-tutor-single-planner-owner.test.js
          node qa-public/tests/v319-r8-cognitive-live-priority.test.js
          node qa-public/tests/v319-r8-simple-before-contradiction.test.js
          git diff --check
      - name: Commit exact certified cache integration
        shell: bash
        run: |
          set -euo pipefail
          git config user.name 'QUADLUD QA Bot'
          git config user.email 'actions@users.noreply.github.com'
          git add tango-tutor-cache-data-r8.js tango-tutor-cache-contract-r8.js index.html sw.js
          if git diff --cached --quiet; then
            echo 'Certified cache already installed.'
            exit 0
          fi
          git commit -m 'build(tango): install certified cognitive R8 cache'
          git push origin HEAD:candidate/v3.1.9-tango-cognitive-chunks-r1
'''
if '\n  install-cache:' in s:
    raise SystemExit('install-cache already present')
s = s.rstrip() + install_job + '\n'
wf.write_text(s)
print('apply_tango_cache_contract_guard_r4.py: PATCHED')
