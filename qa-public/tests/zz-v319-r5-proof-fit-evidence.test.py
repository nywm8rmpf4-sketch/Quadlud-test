from pathlib import Path
import json

EVIDENCE = Path('/tmp/quadlud-semantic-evidence/tango-expert-fr-mobile-v1/steps')
HELP = 'Consulter cette résolution compte comme une aide de type solution'

assert EVIDENCE.is_dir(), f'semantic evidence directory missing: {EVIDENCE}'

ordinary_path = EVIDENCE / '019-logical.json'
assert ordinary_path.is_file(), ordinary_path
ordinary = json.loads(ordinary_path.read_text(encoding='utf-8'))
assert HELP in (ordinary.get('fullExplanation') or ''), 'solution-help notice must remain visible on an ordinary Tutor step'

proof_names = [
    '020-logical.json',
    '021-proof.json',
    '022-proof.json',
    '023-proof.json',
    '024-proof.json',
    '025-proof.json',
    '026-proof.json',
]
profiles = []
for name in proof_names:
    path = EVIDENCE / name
    assert path.is_file(), path
    state = json.loads(path.read_text(encoding='utf-8'))
    scroll = state.get('explanationScroll') or {}
    client = int(scroll.get('clientHeight') or 0)
    height = int(scroll.get('scrollHeight') or 0)
    top = int(scroll.get('scrollTop') or 0)
    assert client > 0 and height > 0, (name, scroll)
    assert height <= client, f'{name}: proof explanation still requires vertical scrolling: {scroll}'
    assert top == 0, f'{name}: proof explanation should open at scrollTop 0 after fitting: {scroll}'
    full = state.get('fullExplanation') or ''
    visible = state.get('visibleExplanation') or ''
    assert HELP not in full, f'{name}: repeated solution-help notice must be reclaimed during proof chain'
    assert visible == full, f'{name}: current proof explanation is not fully visible in the mobile viewport'
    profiles.append((name, client, height))

print('v319 R5.3 mobile proof fit evidence: PASS —', profiles)
