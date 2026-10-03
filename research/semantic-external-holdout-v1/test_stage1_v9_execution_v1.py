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

class SecretIntegrityRegressionTests(unittest.TestCase):
    def wf(self):return e.r.load(e.ROOT/e.WF)
    def test_every_unnamed_step_secret_is_value_error(self):
        wf=self.wf()
        for index,step in enumerate(wf['jobs']['serial']['steps']):
            if 'id' in step:continue
            bad=copy.deepcopy(wf);bad['jobs']['serial']['steps'][index]['env']={'INJECTED':'${{ secrets.FAKE }}'}
            with self.subTest(index=index),self.assertRaises(ValueError):e.wiring(bad)
    def test_each_nonlive_group_secret_is_value_error(self):
        for n in range(1,51):
            for prefix in ['prep','lock','verify','result','gate']:
                bad=self.wf();step=next(s for s in bad['jobs']['serial']['steps'] if s.get('id')==f'{prefix}{n:02d}');step.setdefault('env',{})['INJECTED']='${{ secrets.FAKE }}'
                with self.subTest(n=n,prefix=prefix),self.assertRaises(ValueError):e.wiring(bad)
    def test_live_id_missing_duplicate_or_step_missing(self):
        for n in range(1,51):
            for mode in ['missing-id','duplicate-id','missing-step']:
                bad=self.wf();steps=bad['jobs']['serial']['steps'];step=next(s for s in steps if s.get('id')==f'live{n:02d}')
                if mode=='missing-id':step.pop('id')
                elif mode=='duplicate-id':step['id']='live02' if n==1 else 'live01'
                else:steps.remove(step)
                with self.subTest(n=n,mode=mode),self.assertRaises(ValueError):e.wiring(bad)
    def test_extra_secret_steps_named_or_unnamed(self):
        for sid in [None,'extra','live51']:
            bad=self.wf();step={'run':'true','env':{'INJECTED':'${{ secrets.FAKE }}'}}
            if sid is not None:step['id']=sid
            bad['jobs']['serial']['steps'].append(step)
            with self.subTest(id=sid),self.assertRaises(ValueError):e.wiring(bad)
    def test_exact_ordered_secret_set(self):
        self.assertEqual([s.get('id') for s in self.wf()['jobs']['serial']['steps'] if 'secrets.' in json.dumps(s)],[f'live{n:02d}' for n in range(1,51)])
        bad=self.wf();steps=bad['jobs']['serial']['steps'];a=next(i for i,s in enumerate(steps) if s.get('id')=='live01');b=next(i for i,s in enumerate(steps) if s.get('id')=='live02');steps[a],steps[b]=steps[b],steps[a]
        with self.assertRaises(ValueError):e.wiring(bad)
    def test_each_live_matching_verifier_and_lock_and_exact_secret(self):
        for n in range(1,51):
            for mode in ['verifier','lock','secret','extra-secret']:
                bad=self.wf();step=next(s for s in bad['jobs']['serial']['steps'] if s.get('id')==f'live{n:02d}')
                if mode=='verifier':step['if']="${{ success() && steps.verify99.outcome == 'success' }}"
                elif mode=='lock':step['env']['LOCK_ARTIFACT_ID']='${{ steps.lock99.outputs.artifact-id }}'
                elif mode=='secret':step['env']['OPENAI_API_KEY']='${{ secrets.FAKE }}'
                else:step['run']+=' # ${{ secrets.FAKE }}'
                with self.subTest(n=n,mode=mode),self.assertRaises(ValueError):e.wiring(bad)

class AuditObservabilityTests(unittest.TestCase):
    def synthetic(self,kind):
        import audit_stage1_v9_execution_v1 as audit
        import contextlib,io
        class Synthetic(unittest.TestCase):
            def test_diagnostic(self):
                if kind=='error':raise ValueError('synthetic observability error')
                if kind=='failure':self.fail('synthetic observability assertion')
        suite=unittest.defaultTestLoader.loadTestsFromTestCase(Synthetic)
        emitted=io.StringIO()
        with tempfile.TemporaryDirectory() as temp:
            report=Path(temp)/'audit.json'
            with contextlib.redirect_stdout(emitted):
                if kind=='pass':audit.run_audit(suite,report)
                else:
                    with self.assertRaises(SystemExit) as raised:audit.run_audit(suite,report)
                    self.assertEqual(raised.exception.code,1)
            data=json.loads(report.read_text());log=report.with_suffix('.log').read_text()
        self.assertIn(log,emitted.getvalue())
        self.assertEqual(json.loads(emitted.getvalue().splitlines()[-1]),data)
        self.assertEqual(data['realNetworkAttempts'],0)
        return data,log
    def test_synthetic_error_is_identified_logged_emitted_and_nonzero(self):
        data,log=self.synthetic('error')
        self.assertEqual(data['result'],'FAIL');self.assertEqual(data['errors'],1)
        self.assertEqual(len(data['errorTests']),1);self.assertTrue(data['errorTests'][0].endswith('Synthetic.test_diagnostic'))
        self.assertEqual(data['failureTests'],[])
        self.assertIn('Traceback (most recent call last)',log);self.assertIn('ValueError: synthetic observability error',log)
    def test_synthetic_failure_is_identified_logged_emitted_and_nonzero(self):
        data,log=self.synthetic('failure')
        self.assertEqual(data['result'],'FAIL');self.assertEqual(data['failures'],1)
        self.assertEqual(len(data['failureTests']),1);self.assertTrue(data['failureTests'][0].endswith('Synthetic.test_diagnostic'))
        self.assertEqual(data['errorTests'],[])
        self.assertIn('Traceback (most recent call last)',log);self.assertIn('AssertionError: synthetic observability assertion',log)
    def test_success_still_writes_report_and_log(self):
        data,log=self.synthetic('pass')
        self.assertEqual(data['result'],'PASS');self.assertEqual(data['testsRun'],1)
        self.assertEqual(data['failureTests'],[]);self.assertEqual(data['errorTests'],[])
        self.assertIn('OK',log)
    def test_hosted_failure_upload_is_always_without_failure_bypass_or_secret(self):
        wf=e.r.load(e.ROOT/e.AUDIT_WF);steps=wf['jobs']['audit']['steps']
        upload=steps[-1]
        self.assertEqual(upload['uses'],'actions/upload-artifact@v4');self.assertEqual(upload['if'],'always()')
        self.assertEqual(upload['with']['path'].splitlines(),['/tmp/v9-execution-audit.json','/tmp/v9-execution-audit.log'])
        self.assertEqual(upload['with']['if-no-files-found'],'error')
        self.assertTrue(any('audit_stage1_v9_execution_v1.py --report' in step.get('run','') for step in steps))
        self.assertFalse(any('continue-on-error' in step for step in steps))
        self.assertNotIn('continue-on-error',wf['jobs']['audit'])
        self.assertNotIn('secrets.',json.dumps(wf));self.assertNotIn('OPENAI_API_KEY',json.dumps(wf))

class AuditTemplateFixtureTests(unittest.TestCase):
    TEMPLATE_HASHES={
        'STAGE1_V9_GROUNDED_AUTHORIZATION_TEMPLATE_V1.json':'d048d904cf94aa877fb1a69228b958be5ca33f2bed897cda9ee3b7236a85ea31',
        'STAGE1_V9_GROUNDED_ACTIVATION_TEMPLATE_V1.json':'b70048dbc6caeae8d938ccbe9c4bef9f6a331a056cff9167bfc483d9fdd54e95',
    }
    def wf(self):return e.r.load(e.ROOT/e.AUDIT_WF)
    def test_exact_two_inert_sparse_additions_only(self):
        original=json.loads(e.git('show','5a45e4154266a2e7744a6962c3208aafe78dd990:'+e.AUDIT_WF))
        amended=self.wf();checkout=amended['jobs']['audit']['steps'][0]['with']
        oldpaths=original['jobs']['audit']['steps'][0]['with']['sparse-checkout'].splitlines()
        added=['/research/semantic-external-holdout-v1/'+name for name in self.TEMPLATE_HASHES]
        self.assertEqual(checkout['sparse-checkout'].splitlines(),oldpaths+added)
        checkout['sparse-checkout']=original['jobs']['audit']['steps'][0]['with']['sparse-checkout']
        self.assertEqual(amended,original)
        self.assertEqual(e.r.load(e.ROOT/e.WF),json.loads(e.git('show','5a45e4154266a2e7744a6962c3208aafe78dd990:'+e.WF)))
    def test_templates_present_with_exact_frozen_bytes_and_inert_fields(self):
        import hashlib,subprocess
        for name,digest in self.TEMPLATE_HASHES.items():
            path=e.BASE/name
            with self.subTest(template=name):
                self.assertTrue(path.is_file())
                data=path.read_bytes();self.assertEqual(hashlib.sha256(data).hexdigest(),digest)
                frozen=subprocess.check_output(['git','show',e.SEMANTIC+':'+path.relative_to(e.ROOT).as_posix()],cwd=e.ROOT)
                self.assertEqual(data,frozen)
                obj=json.loads(data);self.assertIs(obj['templateOnly'],True);self.assertIsNone(obj['estimatedSpendCeilingUsd'])
                self.assertIs(obj['authorized' if 'AUTHORIZATION' in name else 'activate'],False)
    def test_original_template_test_runs_in_sparse_equivalent_fixture(self):
        r=e.r;t=prior.InertContinuationTests();allowed=self.wf()['jobs']['audit']['steps'][0]['with']['sparse-checkout'].splitlines()
        with tempfile.TemporaryDirectory() as temp:
            fixture=Path(temp)/'research/semantic-external-holdout-v1';fixture.mkdir(parents=True)
            for name in self.TEMPLATE_HASHES:
                self.assertIn('/research/semantic-external-holdout-v1/'+name,allowed)
                (fixture/name).write_bytes((e.BASE/name).read_bytes())
            self.assertEqual(sorted(p.name for p in fixture.iterdir()),sorted(self.TEMPLATE_HASHES))
            with mock.patch.object(r,'BASE',fixture),mock.patch.object(r,'AUTH',fixture/r.AUTH.name),mock.patch.object(r,'ACT',fixture/r.ACT.name):
                t.test_templates_cannot_authorize()
                self.assertFalse(r.AUTH.exists());self.assertFalse(r.ACT.exists())
                with t.env():
                    a,x=t.receipts()
                    with self.assertRaises(ValueError):r.gate(r.load(fixture/'STAGE1_V9_GROUNDED_AUTHORIZATION_TEMPLATE_V1.json'),x)
                    with self.assertRaises(ValueError):r.gate(a,r.load(fixture/'STAGE1_V9_GROUNDED_ACTIVATION_TEMPLATE_V1.json'))
    def test_audit_dependency_isolation_and_real_approvals_absent(self):
        wf=self.wf();paths=wf['jobs']['audit']['steps'][0]['with']['sparse-checkout'].splitlines()
        self.assertNotIn('/research/semantic-external-holdout-v1/STAGE1_V9_GROUNDED_AUTHORIZATION_V1.json',paths)
        self.assertNotIn('/research/semantic-external-holdout-v1/STAGE1_V9_GROUNDED_ACTIVATE_V1.json',paths)
        self.assertFalse(e.r.AUTH.exists());self.assertFalse(e.r.ACT.exists())
        self.assertNotIn('secrets.',json.dumps(wf));self.assertNotIn('OPENAI_API_KEY',json.dumps(wf))
        self.assertFalse(any(any(key in path.lower() for key in ['terminal','reference','scor','forensic','analyzer','compiler']) for path in paths))

if __name__=='__main__':unittest.main()
