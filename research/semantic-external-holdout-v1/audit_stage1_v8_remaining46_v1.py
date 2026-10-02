#!/usr/bin/env python3
"""Provider-free conformance; GitHub-only metadata gates for future authorized execution."""
import argparse,hashlib,json,os,socket,subprocess,sys,unittest
from pathlib import Path
from unittest import mock
import urllib.request
import run_stage1_v8_remaining46_v1 as r

ROOT=r.ROOT;BASE=r.BASE
WF='.github/workflows/trackcade-semantic-external-stage1-v8-remaining46-v1.yml'
AUDIT_WF='.github/workflows/trackcade-semantic-external-stage1-v8-remaining46-audit-v1.yml'
ACT='research/semantic-external-holdout-v1/STAGE1_V8_REMAINING46_ACTIVATE_V1.json'
AUTH='research/semantic-external-holdout-v1/STAGE1_V8_REMAINING46_AUTHORIZATION_V1.json'
def sha(p):return hashlib.sha256(p.read_bytes().replace(b'\r\n',b'\n')).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def ensure_no_credential():
    if os.environ.get('OPENAI_API_KEY'):raise ValueError('provider credential in provider-free phase')
def gh(path):return json.loads(subprocess.check_output(['gh','api','repos/'+os.environ['GITHUB_REPOSITORY']+'/'+path],text=True))
def pages(path,key):
    values=[];page=1
    while True:
        d=gh(path+('?' if '?' not in path else '&')+'per_page=100&page='+str(page));items=d[key];values+=items
        if len(items)<100:return values
        page+=1

def verify_prep_metadata():
    ensure_no_credential()
    for expected in r.CONTRACT['artifacts']:
        actual=gh('actions/artifacts/'+str(expected['id']))
        r.base.exact(actual,{'id':expected['id'],'name':expected['name'],'digest':expected['digest'],'expired':False})
        if actual['workflow_run']['id']!=expected['runId']:raise ValueError('prep run mismatch')

def static_checks(inert=True):
    ensure_no_credential();c=r.CONTRACT
    assert c['ordinals']==list(range(5,51)) and c['attemptsPerOrdinal']==1 and c['retries']==0
    assert c['providerContract']=={'provider':'openai','api':'responses','model':'gpt-6-sol','reasoningEffort':'high','maxOutputTokens':25000,'serviceTier':'flex','store':False}
    assert c['spendGuard']['authorizedCeilingUsd'] is None and c['spendGuard']['reservationUsdPerAttempt']=='0.225'
    if inert:assert not r.ACT.exists() and not r.AUTH.exists(),'real activation/authorization must remain absent during inert audit'
    assert r.base.sha(BASE/'STAGE1_V8_REMAINING46_MAPPING_V1.json')==c['mappingSha256']
    for p,h in c['frozenDependenciesSha256'].items():assert sha(ROOT/p)==h,p
    for n in range(5,51):
        row,paths,payload=r.frozen_case(n)
        old=r.load(paths['flexPayload']);new=json.loads(payload)
        assert {k for k in old if old[k]!=new[k]}=={'max_output_tokens'}
        assert old['input']==new['input'] and old['instructions']==new['instructions'] and old['text']==new['text']
    old=(BASE/'run_stage1_v8_ordinal04_budget_v1.py').read_text()
    expected=old[old.index('def one_provider_attempt('):old.index('\ndef main(')].strip()
    new=(BASE/'run_stage1_v8_remaining46_v1.py').read_text()
    actual=new[new.index('def one_provider_attempt('):new.index('\nif __name__==')].strip()
    assert expected==actual and actual.count('urllib.request.urlopen(')==1
    assert 'while ' not in actual and 'range(' not in actual
    changes=git('diff','--name-only',c['preTaskFrozenHead'],'HEAD').splitlines()
    assert all('v8_remaining46' in p.lower() or 'v8-remaining46' in p.lower() for p in changes),changes
    wf=r.load(ROOT/WF);af=r.load(ROOT/AUDIT_WF)
    assert wf['on']=={'push':{'branches':['trackcade-semantic-external-holdout-v1'],'paths':[ACT]}}
    assert len(wf['jobs'])==1 and wf['permissions']=={'contents':'read','actions':'read'}
    assert wf['concurrency']['cancel-in-progress'] is False
    job=wf['jobs']['serial'];assert 'secrets.' not in json.dumps(job.get('env',{}))
    steps=job['steps'];groups=steps[4:];assert len(groups)==46*6
    for j,n in enumerate(range(5,51)):
        prep,lock,verify,live,result,advance=groups[j*6:j*6+6]
        assert [s['id'] for s in [prep,lock,verify,live,result,advance]]==[f'{x}{n:02d}' for x in ['prep','lock','verify','live','result','gate']]
        assert prep['run'].endswith('prepare '+str(n)) and 'secrets.' not in json.dumps(prep)
        assert lock['uses']=='actions/upload-artifact@v4' and lock['with']['overwrite'] is False
        assert verify['run'].endswith('--lock '+str(n)) and 'secrets.' not in json.dumps(verify)
        assert live['run'].endswith('run '+str(n)) and live['env']['OPENAI_API_KEY']=='${{ secrets.OPENAI_API_KEY }}'
        assert result['uses']=='actions/upload-artifact@v4' and result['with']['overwrite'] is False and result['if']==f"${{{{ always() && steps.live{n:02d}.outcome != 'skipped' }}}}"
        assert advance['run'].endswith('--advance '+str(n)) and 'secrets.' not in json.dumps(advance)
        assert all('continue-on-error' not in s for s in [prep,lock,verify,live,result,advance])
        assert all('if' not in s for s in [prep,lock,verify,live,advance])
    assert [i for i,s in enumerate(steps) if 'secrets.' in json.dumps(s)]==[4+j*6+3 for j in range(46)]
    assert 'secrets.' not in json.dumps(af) and ACT not in af['on']['push']['paths'] and AUTH not in af['on']['push']['paths']
    allow={p.lstrip('/') for p in steps[0]['with']['sparse-checkout'].splitlines()}
    assert all('reference' not in p.lower() and 'terminal' not in p.lower() and 'score' not in p.lower() and 'analyzer' not in p.lower() and 'compiler' not in p.lower() for p in allow)
    assert steps[0]['with']['persist-credentials'] is False
    if os.environ.get('GITHUB_ACTIONS')=='true':
        for p in ROOT.glob('research/**/*'):
            if p.is_file():assert p.relative_to(ROOT).as_posix() in allow,p
    return {'activationAbsent':not r.ACT.exists(),'realAuthorizationAbsent':not r.AUTH.exists(),'frozenCasesChecked':46,'ordinals1Through4Excluded':True,'oneAttemptPerOrdinal':True,'noRetryOrFallback':True,'outputCapOnlyDeltaForAll46':True,'transportIdenticalToV8Diagnostic':True,'lockBeforeSecretForAll46':True,'resultFreezeAfterEachAttempt':True,'uploadedResultRequiredBeforeProgression':True,'noLabelsHoldoutAnalyzerCompilerOrScoring':True,'spendGuardFailClosed':True,'priorRecordsUnmodified':True,'nonDropGameplayEligibilityPreserved':True}

def live_preflight():
    ensure_no_credential();static_checks(inert=False);auth=r.load(r.AUTH);act=r.load(r.ACT);budget=r.gate(auth,act)
    assert git('diff','--name-only','HEAD^','HEAD')==ACT and git('rev-parse','HEAD^')==act['authorizationCommit']
    assert git('rev-parse',act['authorizationCommit']+':'+AUTH)==git('rev-parse','HEAD:'+AUTH)
    pins={p.lstrip('/') for p in r.load(ROOT/AUDIT_WF)['jobs']['audit']['steps'][0]['with']['sparse-checkout'].splitlines()}
    assert set(act['sourceSha256'])==pins
    for p,h in act['sourceSha256'].items():assert sha(ROOT/p)==h,p
    audit=gh('actions/runs/'+str(act['staticAuditRunId']))
    assert audit['status']=='completed' and audit['conclusion']=='success' and audit['run_attempt']==1 and audit['head_sha']==act['auditedSourceCommit'] and audit['path']==AUDIT_WF
    runs=pages('actions/workflows/'+WF.split('/')[-1]+'/runs','workflow_runs')
    assert [x['id'] for x in runs]==[int(os.environ['GITHUB_RUN_ID'])],'prior execution run exists, including failed/expired; cannot resume'
    artifacts=pages('actions/artifacts','artifacts')
    assert not any(a['name'].startswith(r.NAMESPACE+'-case-') for a in artifacts),'prior attempt or result exists'
    verify_prep_metadata();r.initialize(budget)

def verify_uploaded_lock(n):
    ensure_no_credential();m=gh('actions/artifacts/'+os.environ['LOCK_ARTIFACT_ID']);r.verify_lock(n,r.load(r.lockfile(n)),m);r.save_json(r.lockfile(n).parent/'uploaded.json',m)
def advance(n):
    ensure_no_credential();budget=r.gate(r.load(r.AUTH),r.load(r.ACT));m=gh('actions/artifacts/'+os.environ['RESULT_ARTIFACT_ID']);r.advance(n,budget,m)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--report',type=Path);ap.add_argument('--verify-prep',action='store_true');ap.add_argument('--live',action='store_true');ap.add_argument('--lock',type=int,choices=range(5,51));ap.add_argument('--advance',type=int,choices=range(5,51));args=ap.parse_args()
    if args.verify_prep:verify_prep_metadata();return
    if args.live:live_preflight();return
    if args.lock is not None:verify_uploaded_lock(args.lock);return
    if args.advance is not None:advance(args.advance);return
    checks=static_checks()
    def deny(*a,**kw):raise AssertionError('unmocked network or subprocess in synthetic audit')
    with mock.patch('socket.socket',side_effect=deny),mock.patch('socket.create_connection',side_effect=deny),mock.patch('urllib.request.urlopen',side_effect=deny),mock.patch('subprocess.Popen',side_effect=deny),mock.patch('subprocess.run',side_effect=deny):
        result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromName('test_stage1_v8_remaining46_v1'))
    report={'schema':'trackcade-stage1-v8-remaining46-inert-audit-v1','headSha':os.environ.get('GITHUB_SHA') or git('rev-parse','HEAD'),'runId':os.environ.get('GITHUB_RUN_ID'),**checks,'testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'providerCalls':0,'estimatedProviderSpendUsd':0,'status':'pass' if result.wasSuccessful() else 'fail'}
    if args.report:args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2));sys.exit(0 if result.wasSuccessful() else 1)
if __name__=='__main__':main()
