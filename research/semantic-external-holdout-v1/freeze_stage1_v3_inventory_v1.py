"""GitHub reads and offline collection only; never opens labels or provider clients."""
import base64
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import collect_stage1_v3_results_v1 as c

REPO='4everhumblepdx/trackcade-test'
BASE=Path(__file__).parent
SOURCE=BASE/'STAGE1_V3_GENERATION_SOURCE_INVENTORY_V1.json'

def api(path,pages=False):
    cmd=['gh','api','repos/'+REPO+'/'+path]
    if pages: cmd+=['--paginate','--slurp']
    return json.loads(subprocess.run(cmd,check=True,capture_output=True).stdout)

def download(artifact,dest):
    meta=api('actions/artifacts/'+str(artifact['id']))
    for key in ('id','name','digest','size_in_bytes','workflow_run'):
        c.require(meta[key]==artifact[key],f'artifact metadata changed: {artifact["id"]}/{key}')
    c.require(meta['expired'] is False,'expired artifact')
    with dest.open('xb') as f:
        subprocess.run(['gh','api','repos/'+REPO+'/actions/artifacts/'+str(artifact['id'])+'/zip'],stdout=f,check=True)
    c.require('sha256:'+c.digest(dest.read_bytes())==artifact['digest'],'download digest')
    c.require(dest.stat().st_size==artifact['size_in_bytes'],'download size')

def main():
    inv=c.load(SOURCE)
    c.require(os.environ['GITHUB_REPOSITORY']==REPO,'repo')
    c.require(os.environ['GITHUB_REF']=='refs/heads/'+inv['branch'],'branch')
    c.require(os.environ['GITHUB_RUN_ATTEMPT']=='1','rerun refused')
    c.require(api('branches/'+inv['branch'])['commit']['sha']==os.environ['GITHUB_SHA'],'branch moved')
    temp=Path(os.environ['RUNNER_TEMP']); evidence=temp/'generation-evidence'; evidence.mkdir()
    live=api('actions/artifacts?per_page=100',True)
    all_artifacts=[a for page in live for a in page['artifacts']]
    c.require(all(p['total_count']==len(all_artifacts) for p in live),'pagination changed')
    cases=[a for a in all_artifacts if a['name'].startswith('trackcade-semantic-external-stage1-v3-sol-v1-case-')]
    expected=[a for g in inv['runs'] for a in g['artifacts']]
    c.require({a['id'] for a in cases}=={a['id'] for a in expected},'new or missing V3 evidence; stop before labels')
    c.require(len(cases)==len(expected),'duplicate metadata')
    completed=[a for a in cases if a['name'].endswith('-completed')]
    ordinals=[int(c.NAME.fullmatch(a['name'])[1]) for a in completed]
    c.require(sorted(ordinals)==list(range(1,51)),'ambiguous completed inventory')
    c.require(next(a for a in completed if '-case-46-' in a['name'])['id']==11045692462,'wrong ordinal46 completion')
    for g in inv['runs']:
        run=api('actions/runs/'+str(g['run']['id']))
        for key in ('id','head_sha','head_branch','path','run_attempt','status','conclusion'):
            c.require(run[key]==g['latestRun'][key],'generation run drift: '+key)
        # Older run attempts remain separately bound, rather than relabeling their artifacts.
        for attempt in {a['run_attempt'] for a in g['artifacts']}:
            actual=api(f'actions/runs/{run["id"]}/attempts/{attempt}')
            c.require(actual['head_sha']==run['head_sha'] and actual['run_attempt']==attempt and actual['status']=='completed','attempt provenance')
    refs=[r for page in api('git/matching-refs/tags/trackcade-v3?per_page=100',True) for r in page]
    c.require({r['ref']:r['object']['sha'] for r in refs}=={r['ref']:r['object']['sha'] for r in inv['locks']},'permanent locks changed')
    c.write_json(evidence/'live-artifact-inventory.json',live)
    c.write_json(evidence/'permanent-locks.json',refs)
    artifacts=temp/'v3-artifacts'; artifacts.mkdir()
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda a:download(a,artifacts/f'{a["id"]}.zip'),expected))
    result=c.collect(temp/'v3-prep',artifacts,SOURCE,evidence/'collection')
    c.require(result['status']=='complete-ready-to-freeze','collection incomplete; no labels')
    collection=evidence/'collection'
    c.verify_freeze(collection/c.FREEZE_FILE,temp/'v3-prep',collection/'provider')
    selected=c.load(collection/c.FREEZE_FILE)
    canonical=dict(schema='trackcade-v3-canonical-completed-inventory-v1',benchmarkLabelsRead=False,
        terminalMaterialAccessed=False,providerCallsMade=0,compilerInvoked=False,trackCount=50,
        freezeRunId=os.environ['GITHUB_RUN_ID'],freezeSource=os.environ['GITHUB_SHA'],
        cases=selected['cases'],originalLocks=refs)
    c.write_json(evidence/'STAGE1_V3_CANONICAL_INVENTORY_V1.json',canonical)
    hashes={str(p.relative_to(evidence)):c.digest(p.read_bytes()) for p in evidence.rglob('*') if p.is_file()}
    c.write_json(evidence/'SHA256.json',hashes)
    # Machine-readable committed freeze evidence, without provider proposal contents or labels.
    export={str(p.relative_to(evidence)):p.read_text() for p in [
        evidence/'STAGE1_V3_CANONICAL_INVENTORY_V1.json',collection/c.FREEZE_FILE,
        collection/'STAGE1_V3_COLLECTION_AUDIT_V1.json',evidence/'SHA256.json']}
    print('FREEZE_EVIDENCE_B64='+base64.b64encode(gzip.compress(json.dumps(export).encode())).decode())
    print('INVENTORY_SHA256='+hashes['STAGE1_V3_CANONICAL_INVENTORY_V1.json'])
    print('GENERATION_FREEZE_SHA256='+hashes['collection/'+c.FREEZE_FILE])

if __name__=='__main__': main()
