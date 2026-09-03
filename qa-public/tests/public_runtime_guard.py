from pathlib import Path
import json
import subprocess

REPO = Path(__file__).resolve().parents[2]

# Public pre-production repository must contain only deployable runtime plus
# explicitly public QA harness/workflow material.
forbidden_top = {
    'documentation', 'tests', 'ROADMAP.md', 'REPRISE.md', 'PROMPT_REPRISE.md',
    'PROJECT_STATE.md', 'CHECKPOINT_REPORT.md', 'CHECKPOINT_STATE.json'
}
actual_top = {p.name for p in REPO.iterdir()}
found = sorted(forbidden_top & actual_top)
assert not found, f'private/project-state material present at public root: {found}'

required = ['index.html', 'app.js', 'build-info.json', 'game-manifest.js', 'sw.js']
missing = [name for name in required if not (REPO / name).is_file()]
assert not missing, f'missing runtime files: {missing}'

build = json.loads((REPO / 'build-info.json').read_text(encoding='utf-8'))
assert build.get('version'), 'build-info.json has no version'

tracked = set(subprocess.check_output(['git', 'ls-files'], cwd=REPO, text=True).splitlines())
for prefix in ('qa-results/', 'playwright-report/', 'test-results/', '.qa-tmp/', '.tmp/'):
    assert not any(path == prefix.rstrip('/') or path.startswith(prefix) for path in tracked), f'generated QA output is tracked: {prefix}'
assert not any(path.endswith(('.pyc', '.pyo', '.log')) for path in tracked), 'generated/transient file is tracked'

# Public QA files themselves must not masquerade as project documentation.
public_qa = [p.relative_to(REPO).as_posix() for p in (REPO / 'qa-public').rglob('*') if p.is_file()]
assert not any('/documentation/' in f'/{p}/' for p in public_qa), public_qa
assert not any(Path(p).name.startswith(('ROADMAP', 'REPRISE', 'CHECKPOINT', 'PROJECT_STATE')) for p in public_qa), public_qa

print(f'public runtime boundary PASS — version {build["version"]}, tracked files {len(tracked)}')
