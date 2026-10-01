"""Provider-free hosted validation. This is never a generation entry point."""
import argparse
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import unittest
from unittest.mock import patch
import urllib.request

import yaml

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WORKFLOW = ROOT/'.github/workflows/trackcade-semantic-external-stage1-v6-remaining49-v1.yml'
FREEZE = ROOT/'.github/workflows/trackcade-semantic-external-stage1-v6-generation-freeze-v1.yml'
TEST_WORKFLOW = ROOT/'.github/workflows/trackcade-semantic-external-stage1-v6-reconciliation-tests-v1.yml'


def load_yaml(path):
    return yaml.load(path.read_text(encoding='utf-8'), Loader=yaml.BaseLoader)


def require(value, message):
    if not value: raise ValueError(message)


def validate_workflows():
    generation, freeze, hosted = (load_yaml(p) for p in (WORKFLOW, FREEZE, TEST_WORKFLOW))
    job = generation['jobs']['generate']
    require('strategy' not in job and len(generation['jobs']) == 1, 'one explicit serial job required')
    require(generation['on']['push']['paths'] == ['research/semantic-external-holdout-v1/STAGE1_V6_REMAINING49_PROVIDER_ACTIVATE_V1.json'], 'paid activation trigger changed')
    steps = job['steps']
    groups = []
    for ordinal in range(2,51):
        pad = f'{ordinal:02d}'
        ids = {s.get('id'): i for i,s in enumerate(steps) if s.get('id')}
        lock, run, result = (ids[f'{key}_{pad}'] for key in ('lock','run','result'))
        reserve, check = lock-1, result+1
        require(lock == reserve+1 and run == lock+1 and result == run+1, 'ordinal phase order mismatch')
        require(f'--mode prepare --ordinal {ordinal} ' in steps[reserve]['run'], 'reservation phase missing')
        require(steps[lock]['uses'] == 'actions/upload-artifact@v4', 'pre-call lock must upload')
        require(steps[lock]['with']['name'].endswith(f'case-{pad}-attempt-lock'), 'wrong reservation name')
        require(f'--mode run --ordinal {ordinal} ' in steps[run]['run'], 'sole runner phase missing')
        require(steps[run]['env']['LOCK_ARTIFACT_ID'] == '${{ steps.lock_'+pad+'.outputs.artifact-id }}', 'uploaded reservation binding missing')
        require(steps[result]['uses'] == 'actions/upload-artifact@v4', 'result upload missing')
        require(f'--mode check --ordinal {ordinal} ' in steps[check]['run'], 'result progression check missing')
        require(steps[check]['env']['RESULT_UPLOAD_OUTCOME'] == '${{ steps.result_'+pad+'.outcome }}', 'upload outcome gate missing')
        require('test "$RESULT_UPLOAD_OUTCOME" = \'success\'' in steps[check]['run'], 'upload success not enforced')
        for index in (reserve, lock, run):
            require('if' not in steps[index] and 'continue-on-error' not in steps[index], 'later attempts must use implicit success gate')
        require(all('continue-on-error' not in steps[i] for i in (result,check)), 'failure cannot be ignored')
        groups.append((reserve,check))
    require(all(groups[i][1] < groups[i+1][0] for i in range(48)), 'ascending ordinal order changed')
    require(sum('--mode run ' in str(s.get('run','')) for s in steps) == 49, 'provider runner count mismatch')
    require(sum('OPENAI_API_KEY' in s.get('env',{}) for s in steps) == 49, 'credentials may only enter the 49 live steps')
    collector_bytes=(HERE/'collect_stage1_v6_results_v1.py').read_bytes().replace(b'\r\n',b'\n')
    require(freeze['jobs']['freeze']['env']['COLLECTOR_BLOB'] == hashlib.sha1(b'blob '+str(len(collector_bytes)).encode()+b'\0'+collector_bytes).hexdigest(), 'collector blob pin mismatch')
    require(hosted['permissions'] == {'contents':'read'}, 'hosted validation permissions changed')
    require(hosted['jobs']['offline-tests']['runs-on'] == 'ubuntu-24.04', 'standard public-repo runner required')
    require('secrets.' not in TEST_WORKFLOW.read_text(encoding='utf-8'), 'test workflow must not expose secrets')
    return {'yamlDocumentsParsed':3, 'remainingOrdinalGroupsVerified':49, 'orderedProgressionVerified':True,
        'preCallReservationsVerified':True,'resultUploadGatesVerified':True,'collectorBlobPinVerified':True}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output-dir', type=Path, required=True)
    ap.add_argument('--require-sparse-workspace', action='store_true')
    args=ap.parse_args(); args.output_dir.mkdir(parents=True,exist_ok=False)
    require('OPENAI_API_KEY' not in os.environ, 'provider credentials must be absent')
    for name in ('STAGE1_V6_REMAINING49_PROVIDER_ACTIVATE_V1.json','STAGE1_V6_GENERATION_FREEZE_ACTIVATE_V1.json'):
        require(not (HERE/name).exists(), 'an activation file is present')
    if args.require_sparse_workspace:
        allowed = {'test_stage1_v6_contract.py','test_stage1_v6_remaining49_reconciliation_v1.py',
            'run_stage1_v6_hosted_reconciliation_tests_v1.py','run_stage1_v6_remaining49_case_v1.py',
            'collect_stage1_v6_results_v1.py','STAGE1_V6_REMAINING49_PROVIDER_AUTHORIZATION_V1.json',
            'STAGE1_V6_REMAINING49_PROVIDER_AUTHORIZATION_TEMPLATE_V1.json',
            'STAGE1_V6_REMAINING49_PROVIDER_ACTIVATION_TEMPLATE_V1.json',
            'STAGE1_V6_REMAINING49_ARTIFACT_CONTRACT_V1.json','STAGE1_V6_REMAINING49_RECONCILIATION_RECEIPT_V1.json'}
        require({p.name for p in HERE.iterdir() if p.is_file()} <= allowed, 'non-test research files entered hosted checkout')
        require({p.name for p in (ROOT/'research').iterdir()} == {'learned-interpretation-v1','semantic-external-holdout-v1'}, 'unexpected data directory entered hosted checkout')
    validations=validate_workflows()
    blocked=[]
    def deny(*args,**kwargs):
        blocked.append('unmocked network or subprocess attempted')
        raise AssertionError(blocked[-1])
    log=io.StringIO()
    with contextlib.ExitStack() as stack:
        for target in ('socket.socket','socket.create_connection','urllib.request.urlopen','subprocess.Popen','subprocess.run'):
            stack.enter_context(patch(target, side_effect=deny))
        suite=unittest.defaultTestLoader.loadTestsFromNames(['test_stage1_v6_remaining49_reconciliation_v1','test_stage1_v6_contract'])
        result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    report={'schema':'trackcade-stage1-v6-provider-free-hosted-test-result-v1',
        'headSha':os.environ.get('GITHUB_SHA'), 'runId':os.environ.get('GITHUB_RUN_ID'),
        'runAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'), 'platform':sys.platform,'pythonVersion':sys.version,
        'yamlReaderVersion':yaml.__version__, **validations,
        'testsRun':result.testsRun,'testsPassed':result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),
        'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
        'unmockedNetworkOrSubprocessAttempts':len(blocked),
        'providerCalls':0,'paidSpendUsd':0,'referenceLabelsOpened':False,'partialScoringPerformed':False,
        'terminalHoldoutAccessed':False,'compilerInvoked':False,'analyzerExecutedOrModified':False,
        'frozenSemanticContractChanged':False,'syntheticOnly':True,'paidActivationPresent':False,
        'status':'pass' if result.wasSuccessful() and not blocked else 'fail'}
    (args.output_dir/'test-log.txt').write_text(log.getvalue(),encoding='utf-8')
    (args.output_dir/'TEST_RESULT_V1.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(log.getvalue()); print(json.dumps(report,indent=2))
    raise SystemExit(0 if report['status']=='pass' else 1)


if __name__=='__main__': main()
