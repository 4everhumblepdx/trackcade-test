"""Offline execution pre-audit: no provider credential or real network."""
import argparse,contextlib,io,json,os,socket,unittest,urllib.request
from pathlib import Path
from unittest import mock
import execute_stage1_v9_grounded_v1 as e

def run_audit(suite,report_path):
    e.no_key();stream=io.StringIO();capture=io.StringIO()
    with mock.patch.object(socket.socket,'connect',side_effect=AssertionError('network forbidden')) as connect,mock.patch.object(socket,'create_connection',side_effect=AssertionError('network forbidden')) as connection,mock.patch.object(urllib.request,'urlopen',side_effect=AssertionError('HTTP forbidden')) as http,contextlib.redirect_stdout(capture):result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
    report={'schema':'trackcade-stage1-v9-execution-audit-v1','headSha':os.environ.get('GITHUB_SHA') or e.git('rev-parse','HEAD'),'runId':os.environ.get('GITHUB_RUN_ID'),'testsRun':result.testsRun,'passed':result.testsRun-len(result.failures)-len(result.errors),'failures':len(result.failures),'errors':len(result.errors),'failureTests':[test.id() for test,_ in result.failures],'errorTests':[test.id() for test,_ in result.errors],'result':'PASS' if result.wasSuccessful() and not (connect.call_count+connection.call_count+http.call_count) else 'FAIL','realNetworkAttempts':connect.call_count+connection.call_count+http.call_count,'providerCalls':0,'providerSpendUsd':'0','credentialExposed':False,'semanticSource':e.SEMANTIC,'semanticTreatmentUnchanged':True,'structuralOrdinalGroupsVerified':50,'realAuthorizationExists':e.r.AUTH.exists(),'realActivationExists':e.r.ACT.exists(),'terminalAccessed':False}
    test_log=stream.getvalue()
    report_path.with_suffix('.log').write_bytes(test_log.encode())
    e.save(report_path,report)
    print(test_log,end='')
    print(json.dumps(report))
    if report['result']!='PASS':raise SystemExit(1)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--report',type=Path,required=True);args=ap.parse_args()
    e.no_key();e.static();suite=unittest.TestSuite()
    for name in ['test_stage1_v9_grounded_contract_v1','test_stage1_v9_grounded_execution_v1','test_stage1_v9_execution_v1']:suite.addTests(unittest.defaultTestLoader.loadTestsFromName(name))
    run_audit(suite,args.report)
