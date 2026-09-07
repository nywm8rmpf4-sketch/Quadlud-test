from __future__ import annotations

import json
import os
import re
from pathlib import Path

EVIDENCE_DIR = Path(os.environ.get(
    'QUADLUD_SEMANTIC_EVIDENCE_DIR',
    '/tmp/quadlud-semantic-evidence/tango-expert-fr-mobile-v1',
))


def main() -> None:
    manifest_path = EVIDENCE_DIR / 'manifest.json'
    steps_dir = EVIDENCE_DIR / 'steps'
    assert manifest_path.is_file(), f'missing semantic manifest: {manifest_path}'
    assert steps_dir.is_dir(), f'missing semantic steps: {steps_dir}'

    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    files = sorted(steps_dir.glob('*.json'))
    assert files, 'no semantic step JSON files'
    assert manifest.get('automaticJourneyStatus') == 'SCRIPTED_PASS', manifest.get('automaticJourneyStatus')
    assert manifest.get('semanticStatus') == 'SEMANTIC_NOT_EXECUTED', manifest.get('semanticStatus')
    assert manifest.get('hiddenSolutionIncluded') is False, 'semantic evidence must not include the hidden solution'
    assert manifest.get('captureCount') == len(files), (manifest.get('captureCount'), len(files))

    scenario = manifest.get('scenario') or {}
    assert scenario.get('game') == 'tango', scenario
    assert scenario.get('difficulty') == 'expert', scenario
    assert scenario.get('locale') == 'fr-FR', scenario
    assert scenario.get('viewport') == {'width': 390, 'height': 844}, scenario
    assert scenario.get('seed') == 'qa-semantic-tango-expert-v1', scenario

    defects: list[str] = []
    action_states = 0
    for path in files:
        state = json.loads(path.read_text(encoding='utf-8'))
        full = str(state.get('fullExplanation') or '')
        visible = str(state.get('visibleExplanation') or '')

        for cell in (state.get('board') or {}).get('cells') or []:
            text = str(cell.get('text') or '')
            if re.search(r'(?<!\d)([1-9])\s+\1(?!\d)', text):
                defects.append(f'{path.name}: duplicate hypothetical badge in cell text {text!r}')

        if re.search(r'\bDans (?:ligne|colonne)\b', full):
            defects.append(f'{path.name}: missing French article in explanation')
        if re.search(r'\bUne troisième lune\b[^.!?;]*\best interdit\b', full):
            defects.append(f'{path.name}: feminine agreement error "lune ... interdit"')
        if re.search(r'\b(?:sun|moon)\b', full, re.IGNORECASE):
            defects.append(f'{path.name}: untranslated Sun/Moon vocabulary')
        if '🌙' in full or '🌞' in full:
            defects.append(f'{path.name}: non-canonical Sun/Moon emoji')
        if re.search(r'\bNaN\b', full):
            defects.append(f'{path.name}: invalid NaN unit label')
        if ':Regarde' in full or ':Raisonnement' in full:
            defects.append(f'{path.name}: missing semantic-label spacing')

        if 'Coup conseillé :' in full:
            action_states += 1
            if 'Coup conseillé :' not in visible:
                defects.append(f'{path.name}: advised move is outside the visible Tutor explanation viewport')

    assert action_states > 0, 'semantic journey exposed no advised-move state'
    assert not defects, '\n'.join(defects)

    print(
        f'semantic evidence guard PASS — {len(files)} states, {action_states} advised-move states; '
        'no duplicate badges, malformed French, legacy symbols, NaN labels or hidden advised moves'
    )
    print('semantic review remains SEMANTIC_NOT_EXECUTED — this guard is not a semantic PASS')


if __name__ == '__main__':
    main()
