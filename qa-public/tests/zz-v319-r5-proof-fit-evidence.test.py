from pathlib import Path
import json

EVIDENCE = Path('/tmp/quadlud-semantic-evidence/tango-expert-fr-mobile-v1/steps')
HELP = 'Consulter cette résolution compte comme une aide de type solution'

assert EVIDENCE.is_dir(), f'semantic evidence directory missing: {EVIDENCE}'

ordinary_profiles = []
deep_profiles = []
for path in sorted(EVIDENCE.glob('*.json')):
    state = json.loads(path.read_text(encoding='utf-8'))
    classes = state.get('visibleClassNames') or []
    deep_proof = any('walkthrough-proof-chain-active' in value for value in classes)
    scroll = state.get('explanationScroll') or {}
    client = int(scroll.get('clientHeight') or 0)
    height = int(scroll.get('scrollHeight') or 0)
    top = int(scroll.get('scrollTop') or 0)
    assert client > 0 and height > 0, (path.name, scroll)
    overflow = max(0, height - client)
    full = state.get('fullExplanation') or ''

    if deep_proof:
        # Deep multi-step proofs are allowed to scroll when their logical depth
        # genuinely requires it. They must still open at the beginning, and the
        # repeated solution-help notice must not consume proof space.
        assert top == 0, f'{path.name}: deep proof must open at its beginning: {scroll}'
        assert HELP not in full, f'{path.name}: repeated solution-help notice must be reclaimed during deep proof'
        deep_profiles.append((path.name, client, height, overflow))
    else:
        # Ordinary/frequent Tutor explanations are the dominant interaction,
        # including Expert. They must fit without requiring vertical scrolling.
        assert height <= client, f'{path.name}: ordinary Tutor explanation requires scrolling: {scroll}'
        assert top == 0, f'{path.name}: ordinary Tutor explanation must remain at scrollTop 0: {scroll}'
        if any('walkthrough-help-note' in value for value in classes):
            assert HELP in full, f'{path.name}: ordinary Tutor step lost its solution-help notice'
        ordinary_profiles.append((path.name, client, height))

assert ordinary_profiles, 'no ordinary Tutor states were evaluated'
assert deep_profiles, 'no deep proof states were evaluated'
scrolling_deep = [p for p in deep_profiles if p[3] > 0]
print(
    'v319 R5.3 mobile message-fit policy: PASS — '
    f'ordinary={len(ordinary_profiles)} all scroll-free; '
    f'deep-proof={len(deep_profiles)}, scrolling={len(scrolling_deep)}; '
    f'deep-overflow={scrolling_deep}'
)
