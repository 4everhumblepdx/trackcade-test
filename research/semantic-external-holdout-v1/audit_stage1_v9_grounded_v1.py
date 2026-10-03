"""Provider-free V9 audit; deny network, run mocked instruction/runtime tests.

No execution workflow is created or dispatched. No model behavior is validated.
"""
import argparse
import contextlib
import io
import json
import os
from pathlib import Path
import socket
import unittest
from unittest import mock
import urllib.request

BASE=Path(__file__).resolve().parent

def audit(prep,log):
    if os.environ.get('OPENAI_API_KEY'):raise ValueError('Credential forbidden during offline audit')
    # Explicit Stage1-only hash-pinned prep directory, never a repository scan.
    os.environ['V9_SOURCE_PREP']=str(prep.resolve())
    import run_stage1_v9_grounded_v1 as r
    r.SOURCE=prep.resolve()
    suite=unittest.TestSuite()
    for name in ['test_stage1_v9_grounded_contract_v1','test_stage1_v9_grounded_execution_v1']:
        suite.addTests(unittest.defaultTestLoader.loadTestsFromName(name))
    stream=io.StringIO();stdout=io.StringIO()
    with mock.patch.object(socket.socket,'connect',side_effect=AssertionError('Network forbidden')) as connect, mock.patch.object(socket,'create_connection',side_effect=AssertionError('Network forbidden')) as connection, mock.patch.object(urllib.request,'urlopen',side_effect=AssertionError('Real HTTP forbidden')) as http, contextlib.redirect_stdout(stdout):
        result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
    log.write_bytes((stream.getvalue()+'\nSynthetic local status output (not provider evidence):\n'+stdout.getvalue()).encode())
    receipt={'schema':'trackcade-stage1-v9-grounded-offline-audit-v1','testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'passed':result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),'result':'PASS' if result.wasSuccessful() else 'FAIL','realSocketConnectsAttempted':connect.call_count+connection.call_count,'realHttpAttempts':http.call_count,'providerCalls':0,'providerSpendUsd':'0','credentialExposed':False,'terminalAccessed':False,'realAuthorizationExists':r.AUTH.exists(),'realActivationExists':r.ACT.exists(),'modelBehaviorValidated':False,'instructionContractTestsOnly':True,'paidWorkflowCreated':False,'logSha256':r.sha(log)}
    if receipt['realSocketConnectsAttempted'] or receipt['realHttpAttempts'] or receipt['realAuthorizationExists'] or receipt['realActivationExists']:receipt['result']='FAIL'
    path=BASE/'STAGE1_V9_GROUNDED_AUDIT_RESULT_V1.json';path.write_bytes((json.dumps(receipt,indent=2,sort_keys=True)+'\n').encode())
    print(json.dumps(receipt))
    if receipt['result']!='PASS':raise SystemExit(1)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--prep',type=Path,required=True);ap.add_argument('--log',type=Path,required=True)
    args=ap.parse_args();audit(args.prep,args.log)
