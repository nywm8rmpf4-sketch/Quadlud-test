from pathlib import Path
from qa_runtime_loader import runtime_source_order

ROOT = Path(__file__).resolve().parents[1] / 'GitHub'

order = runtime_source_order(ROOT, exclude=('tango-played-move-runtime.js',))
assert 'tango-played-move-runtime.js' not in order
assert 'tango-human-pedagogy-r4.js' not in order
assert 'tango-progressive-proof-bridge.js' not in order
assert 'sudoku-runtime.js' in order
assert 'tutor-action-first-navigation.js' in order

full = runtime_source_order(ROOT)
assert 'tango-played-move-runtime.js' in full
assert 'tango-human-pedagogy-r4.js' in full
assert 'tango-progressive-proof-bridge.js' in full

print('qa runtime loader dependent-excludes: PASS')
