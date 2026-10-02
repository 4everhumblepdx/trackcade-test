#!/usr/bin/env python3
"""Provider-free static/conformance audit and credential-free GitHub metadata gates."""
import argparse, hashlib, json, os, socket, subprocess, sys, unittest
from pathlib import Path
from unittest import mock
import urllib.request
import run_stage1_v8_ordinal04_budget_v1 as runner

BASE=Path(__file__).resolve().parent
ROOT=BASE.parent.parent
WF='.github/workflows/trackcade-semantic-external-stage1-v8-ordinal04-budget-v1.yml'
AUDIT_WF='.github/workflows/trackcade-semantic-external-stage1-v8-ordinal04-static-audit-v1.yml'
ACT='research/semantic-external-holdout-v1/STAGE1_V8_ORDINAL04_ACTIVATE_V1.json'
def sha(path):return hashlib.sha256(path.read_bytes().replace(b'\r\n',b'\n')).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def gh(path):return json.loads(subprocess.check_output(['gh','api','repos/'+os.environ['GITHUB_REPOSITORY']+'/'+path],text=True))
def pages(path,key):
    values=[];page=1
    while True:
        data=gh(path+('?' if '?' not in path else '&')+'per_page=100&page='+str(page));items=data[key];values.extend(items)
        if len(items)<100:return values
        page+=1
def ensure_no_credential():
    if os.environ.get('OPENAI_API_KEY'):raise ValueError('credential in provider-free phase')

def static_checks():
    ensure_no_credential();contract=runner.CONTRACT
    assert contract['ordinal']==4 and contract['maximumProviderAttempts']==1 and contract['retries']==0
    assert all(v is False for v in contract['boundaries'].values())
    forensic=runner.load(BASE/'STAGE1_V7_ORDINAL04_FORENSIC_AUTOPSY_V1.json')
    assert forensic['supportsSingleVariableV8Diagnostic'] is True and forensic['identicalSubmittedPayloadBytes'] is True
    payload=runner.verify_inputs();old=runner.load(runner.INPUT/'openai-payload-v7-flex8192.json')
    assert {k for k in old if old[k]!=payload[k]}=={'max_output_tokens'}
    assert old['max_output_tokens']==8192 and payload['max_output_tokens']==25000
    assert payload['text']==old['text'] and payload['instructions']==old['instructions'] and payload['input']==old['input']
    for path,h in contract['frozenDependenciesSha256'].items():assert sha(ROOT/path)==h,path
    source=(BASE/'run_stage1_v7_remaining49_case_v1.py').read_text()
    copied=(BASE/'run_stage1_v8_ordinal04_budget_v1.py').read_text()
    expected=source[source.index('def one_provider_attempt('):source.index('\ndef finalize_manifest(')].strip()
    actual=copied[copied.index('def one_provider_attempt('):copied.index('\ndef main(')].strip()
    assert actual.replace('"openai-payload-v8-flex25000.json"','"openai-payload-v7-flex8192.json"')==expected
    assert actual.count('urllib.request.urlopen(')==1
    assert 'range(' not in actual and 'while ' not in actual
    changed=git('diff','--name-only',contract['frozenV7Commit'],'HEAD').splitlines()
    for p in changed:
        assert 'v8' in p.lower() or 'STAGE1_V7_ORDINAL04_FORENSIC_AUTOPSY_V1.' in p,p
    wf=runner.load(ROOT/WF);auditwf=runner.load(ROOT/AUDIT_WF)
    assert wf['on']=={'push':{'branches':['trackcade-semantic-external-holdout-v1'],'paths':[ACT]}}
    assert wf['permissions']=={'contents':'read','actions':'read'} and len(wf['jobs'])==1
    job=wf['jobs']['diagnostic'];assert job['runs-on']=='ubuntu-24.04'
    assert 'OPENAI_API_KEY' not in json.dumps(job.get('env',{}))
    steps=job['steps'];assert len(steps)==10
    assert [s.get('id') for s in steps]==[None,None,None,None,None,'lock',None,'live','result',None]
    assert steps[5]['uses']=='actions/upload-artifact@v4' and steps[5]['with']['overwrite'] is False
    assert '--uploaded-lock' in steps[6]['run'] and 'OPENAI_API_KEY' not in json.dumps(steps[6])
    assert steps[7]['env']['OPENAI_API_KEY']=='${{ secrets.OPENAI_API_KEY }}'
    assert [i for i,s in enumerate(steps) if 'secrets.' in json.dumps(s)]==[7]
    assert all('continue-on-error' not in s for s in steps)
    assert sum('--mode run' in s.get('run','') for s in steps)==1
    assert '--ordinal 4' in steps[4]['run'] and '--ordinal 4' in steps[7]['run']
    assert steps[8]['uses']=='actions/upload-artifact@v4' and 'always()' in steps[8]['if']
    assert steps[9]['run'].endswith('--mode check')
    assert auditwf['permissions']=={'contents':'read','actions':'read'} and 'secrets.' not in json.dumps(auditwf)
    for data in [steps,auditwf['jobs']['audit']['steps']]:
        assert data[2]['uses']=='actions/download-artifact@v4'
        assert data[2]['with']['run-id']==36940271204
        assert data[2]['with']['name']=='trackcade-semantic-external-stage1-v7-remaining49-v1-case-04-retry-01-attempted-no-valid-response'
        assert '--verify-evidence' in data[1]['run']
    assert ACT not in auditwf['on']['push']['paths']
    allow={p.lstrip('/') for p in steps[0]['with']['sparse-checkout'].splitlines()}
    assert all('reference' not in p.lower() and 'terminal' not in p.lower() for p in allow)
    if os.environ.get('GITHUB_ACTIONS')=='true':
        for p in ROOT.glob('research/**/*'):
            if p.is_file():assert p.relative_to(ROOT).as_posix() in allow,p
    assert steps[0]['with']['persist-credentials'] is False
    return {'singleVariablePayloadDeltaVerified':True,'copiedV7TransportFunctionVerified':True,'frozenDependenciesVerified':len(contract['frozenDependenciesSha256']),
            'oneOrdinal4CallOnly':True,'noRetryOrFallback':True,'ordinals5Through50Unreachable':True,'credentialOnlyAfterImmutableLockUploadAndVerification':True,
            'labelAndHoldoutSparseIsolation':True,'v7RecordsUnmodified':True,'nonDropGameplayEligibilityPreserved':True}

def live_preflight():
    ensure_no_credential();static_checks()
    act=runner.load(ROOT/ACT);commit=os.environ['GITHUB_SHA'];runner.execution_gate(runner.load(BASE/'STAGE1_V8_ORDINAL04_AUTHORIZATION_V1.json'),act,commit)
    assert git('diff','--name-only','HEAD^','HEAD')==ACT
    assert git('rev-parse','HEAD^')==act['executionSourceCommit']
    assert set(act['sourceSha256'])=={p.lstrip('/') for p in runner.load(ROOT/AUDIT_WF)['jobs']['audit']['steps'][0]['with']['sparse-checkout'].splitlines()}
    for path,h in act['sourceSha256'].items():assert sha(ROOT/path)==h,path
    audit=gh('actions/runs/'+str(act['staticAuditRunId']))
    assert audit['conclusion']=='success' and audit['status']=='completed' and audit['head_sha']==act['executionSourceCommit'] and audit['path']==AUDIT_WF and audit['run_attempt']==1
    runs=pages('actions/workflows/'+WF.split('/')[-1]+'/runs','workflow_runs')
    assert [r['id'] for r in runs]==[int(os.environ['GITHUB_RUN_ID'])], 'previous V8 execution run exists, including failed/expired: stop'
    artifacts=pages('actions/artifacts','artifacts')
    assert not any(a['name'].startswith(runner.NAMESPACE) for a in artifacts),'prior immutable V8 evidence exists: stop'

def uploaded_lock(path):
    ensure_no_credential();metadata=gh('actions/artifacts/'+os.environ['LOCK_ARTIFACT_ID'])
    runner.verify_lock(runner.load(Path('/tmp/v8-lock/attempt-lock.json')),metadata,os.environ['GITHUB_SHA'])
    path.write_text(json.dumps(metadata,indent=2)+'\n')

def verify_evidence():
    ensure_no_credential();e=gh('actions/artifacts/11200315147')
    runner.base.exact(e,{'id':11200315147,'expired':False,'name':'trackcade-semantic-external-stage1-v7-remaining49-v1-case-04-retry-01-attempted-no-valid-response','digest':'sha256:89da81776587ba591490da9bbee83ab1638cb2fd2b174c8309847d90b7901c50'})
    runner.base.exact(e['workflow_run'],{'id':36940271204,'head_sha':'5bea9bd5aec9e178cbbcef73e4058078f260e392'})

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--report',type=Path);ap.add_argument('--live-preflight',action='store_true');ap.add_argument('--uploaded-lock',type=Path);ap.add_argument('--verify-evidence',action='store_true');args=ap.parse_args()
    if args.verify_evidence:verify_evidence();return
    if args.live_preflight:live_preflight();return
    if args.uploaded_lock:uploaded_lock(args.uploaded_lock);return
    checks=static_checks()
    def deny(*a,**kw):raise AssertionError('unmocked network/subprocess in synthetic conformance')
    with mock.patch('socket.socket',side_effect=deny),mock.patch('socket.create_connection',side_effect=deny),mock.patch('urllib.request.urlopen',side_effect=deny),mock.patch('subprocess.Popen',side_effect=deny),mock.patch('subprocess.run',side_effect=deny):
        suite=unittest.defaultTestLoader.loadTestsFromName('test_stage1_v8_ordinal04_budget_v1');result=unittest.TextTestRunner(verbosity=2).run(suite)
    report={'schema':'trackcade-stage1-v8-ordinal04-provider-free-audit-v1','headSha':os.environ.get('GITHUB_SHA',git('rev-parse','HEAD')),'runId':os.environ.get('GITHUB_RUN_ID'),**checks,'testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'providerCalls':0,'spendUsd':0,'status':'pass' if result.wasSuccessful() else 'fail'}
    if args.report:args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2));sys.exit(0 if result.wasSuccessful() else 1)
if __name__=='__main__':main()
