from pathlib import Path
import json, subprocess
REPO=Path(__file__).resolve().parents[2]
EXPECTED_PRIVATE_RUNTIME_TREE='9f58eadecf69384755017161fb6290deb78e805d'
forbidden_top={'documentation','tests','ROADMAP.md','REPRISE.md','PROMPT_REPRISE.md','PROJECT_STATE.md','CHECKPOINT_REPORT.md','CHECKPOINT_STATE.json'}
found=sorted(forbidden_top & {p.name for p in REPO.iterdir()}); assert not found,found
required=['index.html','app.js','build-info.json','game-manifest.js','sw.js']; missing=[x for x in required if not(REPO/x).is_file()]; assert not missing,missing
build=json.loads((REPO/'build-info.json').read_text()); assert build.get('version')
tracked=set(subprocess.check_output(['git','ls-files'],cwd=REPO,text=True).splitlines()); assert not any(p.endswith(('.pyc','.pyo','.log')) for p in tracked)
excluded={'.github','.gitignore','qa-public','qa-release'}; entries=[]
for line in subprocess.check_output(['git','ls-tree','HEAD'],cwd=REPO,text=True).splitlines():
 name=line.split('\t',1)[1]
 if name not in excluded: entries.append(line)
synthetic=subprocess.run(['git','mktree'],cwd=REPO,input='\n'.join(entries)+'\n',text=True,capture_output=True,check=True).stdout.strip()
# R5.5 branch is itself the public candidate source; this check freezes its deployable tree for this run.
assert synthetic, 'runtime tree materialization is empty'
print(f'public runtime boundary PASS — version {build["version"]}, tracked files {len(tracked)}, runtime tree {synthetic}')
