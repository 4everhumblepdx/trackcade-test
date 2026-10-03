import copy,json,os,tempfile,unittest
from decimal import Decimal
from pathlib import Path
from unittest import mock
import execute_stage1_v9_grounded_v1 as e
import test_stage1_v9_grounded_execution_v1 as prior

class ExecutionHarnessTests(unittest.TestCase):
    def wf(self):return e.r.load(e.ROOT/e.WF)
    def test_exact_frozen_source_and_structural_wiring(self):self.assertEqual(e.wiring(self.wf()),50);e.static()
    def test_all_50_gate_ids_match_and_mutations_refused(self):
        for n in range(1,51):
            for variable in ['LOCK_ARTIFACT_ID','RESULT_ARTIFACT_ID']:
                for mode in ['missing','wrong']:
                    wf=self.wf();step=next(s for s in wf['jobs']['serial']['steps'] if s.get('id')==f'gate{n:02d}')
                    if mode=='missing':del step['env'][variable]
                    else:step['env'][variable]='${{ steps.lock99.outputs.artifact-id }}'
                    with self.subTest(n=n,variable=variable,mode=mode),self.assertRaises(ValueError):e.wiring(wf)
    def test_all_live_and_verify_lock_ids_required(self):
        for n in range(1,51):
            for prefix in ['verify','live']:
                wf=self.wf();step=next(s for s in wf['jobs']['serial']['steps'] if s.get('id')==f'{prefix}{n:02d}');step['env'].pop('LOCK_ARTIFACT_ID')
                with self.assertRaises(ValueError):e.wiring(wf)
    def test_secret_only_after_verified_lock(self):
        wf=self.wf();wf['jobs']['serial']['steps'][0]['env']={'OPENAI_API_KEY':'${{ secrets.OPENAI_API_KEY }}'}
        with self.assertRaises(ValueError):e.wiring(wf)
    def test_no_rerun_dispatch_or_cancel_in_progress(self):
        wf=self.wf();self.assertNotIn('workflow_dispatch',wf['on']);self.assertFalse(wf['concurrency']['cancel-in-progress'])
    def test_result_always_frozen_after_live_failure(self):
        for n in range(1,51):
            result=next(s for s in self.wf()['jobs']['serial']['steps'] if s.get('id')==f'result{n:02d}')
            self.assertEqual(result['if'],'${{ always() && steps.live'+f'{n:02d}'+".outcome != 'skipped' }}")
    def test_budget_stop_no_lock_no_transport(self):
        r=e.r;t=prior.InertContinuationTests()
        with tempfile.TemporaryDirectory() as temp,t.env(),mock.patch.object(r,'WORK',Path(temp)/'work'),mock.patch.object(e,'bound',return_value=Decimal('0.224999')),mock.patch.object(e,'output') as output,mock.patch.object(r,'one_provider_attempt') as transport:
            r.initialize(Decimal('0.224999'));e.prepare(1)
            self.assertFalse(r.lockfile(1).exists());self.assertTrue((r.WORK/'budget-stop.json').exists());output.assert_called_once_with(False);transport.assert_not_called()
    def test_corrupt_ledger_is_not_clean_budget_stop(self):
        r=e.r;t=prior.InertContinuationTests()
        with tempfile.TemporaryDirectory() as temp,t.env(),mock.patch.object(r,'WORK',Path(temp)/'work'),mock.patch.object(e,'bound',return_value=Decimal('2.74')):
            r.initialize(Decimal('2.74'));p=r.ledger_path();d=r.load(p);d['lastCompletedOrdinal']=7;e.save(p,d)
            with self.assertRaises(ValueError):e.prepare(1)
            self.assertFalse((r.WORK/'budget-stop.json').exists())
    def test_actual_gate_environment_reconciles_without_secret(self):
        r=e.r;t=prior.InertContinuationTests();budget=Decimal('2.74')
        with tempfile.TemporaryDirectory() as temp,t.env(),mock.patch.object(r,'WORK',Path(temp)/'work'),mock.patch.object(e,'bound',return_value=budget):
            r.initialize(budget);metadata=t.frozen_case_result(1,budget)
            gate=next(s for s in self.wf()['jobs']['serial']['steps'] if s.get('id')=='gate01')
            outputs={'lock01':{'artifact-id':101},'result01':{'artifact-id':201}}
            env={k:str(outputs['lock01' if k=='LOCK_ARTIFACT_ID' else 'result01']['artifact-id']) for k in gate['env'] if k.endswith('ARTIFACT_ID')}
            self.assertEqual(env,{'LOCK_ARTIFACT_ID':'101','RESULT_ARTIFACT_ID':'201'})
            with mock.patch.dict(os.environ,env),mock.patch.object(e,'gh',return_value=metadata):e.advance(1)
            self.assertEqual(r.load(r.ledger_path())['lastCompletedOrdinal'],1)
    def test_missing_auth_fails_before_credential_transport(self):
        self.assertFalse(e.r.AUTH.exists());self.assertFalse(e.r.ACT.exists())
        with self.assertRaises(FileNotFoundError):e.approval()
    def test_sparse_generation_excludes_terminal_labels_and_scores(self):
        paths=self.wf()['jobs']['serial']['steps'][0]['with']['sparse-checkout'].splitlines()
        self.assertFalse(any(any(k in p.lower() for k in ['reference_drops','terminal','forensic','scor','analyzer','compiler']) for p in paths))
    def test_no_provider_key_in_audit_workflow(self):self.assertNotIn('secrets.',json.dumps(e.r.load(e.ROOT/e.AUDIT_WF)))

if __name__=='__main__':unittest.main()
