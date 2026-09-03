from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'GitHub'

index = (WEB / 'index.html').read_text(encoding='utf-8')
css = (WEB / 'ui-mobile-coach-fixes.css').read_text(encoding='utf-8')
core = (WEB / 'styles-core.css').read_text(encoding='utf-8')
pedagogy = (WEB / 'styles-pedagogy.css').read_text(encoding='utf-8')
tango = (WEB / 'tango-ui.js').read_text(encoding='utf-8')
sw = (WEB / 'sw.js').read_text(encoding='utf-8')

# The U10 Safari-facing compatibility asset remains versioned and cached even when
# later v3.1.8 UI checkpoints legitimately advance the Service Worker cache name.
assert 'ui-mobile-coach-fixes.css?v=3.1.8-u10' in index
assert "const CACHE='quadlud-v3.1.8-" in sw
assert "'./ui-mobile-coach-fixes.css?v=3.1.8-u10'" in sw

# The real Tutor renderer uses the same Tango coordinate wrapper and relation markup.
assert "className:'walkthrough-board-wrap board-wrap grid-coordinate-wrap tango-coordinate-wrap'" in tango
assert "classes=['cell','walkthrough-cell']" in tango
assert '<span class=\"relation ${dir}\"' in tango

# Preserve one source of truth for right/down offsets in styles-core.css.
assert '.relation.r{right:-11px;top:50%;transform:translateY(-50%)}' in core
assert '.relation.d{bottom:-11px;left:50%;transform:translateX(-50%)}' in core
assert '.walkthrough-board .cell>*{position:relative;z-index:2}' in pedagogy
assert '.tango-coordinate-wrap .cell>.relation{' in css
assert 'position:absolute!important;' in css
assert '.relation.r{' not in css
assert '.relation.d{' not in css

print('v3.1.8 U10 Tango relation delivery guards: OK')
