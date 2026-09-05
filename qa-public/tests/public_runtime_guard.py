from pathlib import Path
import json
import subprocess

REPO = Path(__file__).resolve().parents[2]
EXPECTED_PRIVATE_RUNTIME_TREE = 'c1051006e27aed4573c764d80bf1d89404abeaa8'

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

qa_files = []
for namespace in ('qa-public', 'qa-release'):
    base = REPO / namespace
    if base.exists():
        qa_files.extend(p.relative_to(REPO).as_posix() for p in base.rglob('*') if p.is_file())
assert not any('/documentation/' in f'/{p}/' for p in qa_files), qa_files
assert not any('/research/' in f'/{p}/' for p in qa_files), qa_files
assert not any('/results/' in f'/{p}/' for p in qa_files), qa_files
assert not any(Path(p).name.startswith(('ROADMAP', 'REPRISE', 'CHECKPOINT', 'PROJECT_STATE', 'PROMPT_REPRISE')) for p in qa_files), qa_files

excluded = {'.github', '.gitignore', 'qa-public', 'qa-release'}
entries = []
for line in subprocess.check_output(['git', 'ls-tree', 'HEAD'], cwd=REPO, text=True).splitlines():
    name = line.split('\t', 1)[1]
    if name not in excluded:
        entries.append(line)
assert entries, 'runtime tree materialization is empty'
synthetic = subprocess.run(
    ['git', 'mktree'], cwd=REPO, input='\n'.join(entries) + '\n',
    text=True, capture_output=True, check=True
).stdout.strip()
assert synthetic == EXPECTED_PRIVATE_RUNTIME_TREE, (
    f'public runtime tree {synthetic} != private candidate tree {EXPECTED_PRIVATE_RUNTIME_TREE}'
)

print(f'public runtime boundary PASS — version {build["version"]}, tracked files {len(tracked)}, exact runtime tree {synthetic}')
