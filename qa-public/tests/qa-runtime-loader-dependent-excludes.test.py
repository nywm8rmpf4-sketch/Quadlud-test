from pathlib import Path
from qa_runtime_loader import runtime_source_order

ROOT = Path(__file__).resolve().parents[1] / 'GitHub'

order = runtime_source_order(ROOT, exclude=('tango-played-move-runtime.js',))
assert 'tango-played-move-runtime.js' not in order
assert 'tango-human-pedagogy-r4.js' not in order
assert 'tango-progressive-proof-bridge.js' not in order
assert 'sudoku-runtime.js' in order
assert 'tutor-action-first-navigation.js' in order

r8_partial = runtime_source_order(ROOT, exclude=('difficulty-rating.js', 'tango-played-move-planner.js'))
assert 'tango-precomputed-pool-runtime.js' not in r8_partial
assert 'tango-tutor-precomputed-cache.js' not in r8_partial
assert 'sudoku-runtime.js' in r8_partial

full = runtime_source_order(ROOT)
assert 'tango-played-move-runtime.js' in full
assert 'tango-human-pedagogy-r4.js' in full
assert 'tango-progressive-proof-bridge.js' in full

print('qa runtime loader dependent-excludes: PASS')
