import copy,io,json,os,tempfile,unittest
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
import run_stage1_v8_remaining46_v1 as r

class InertContinuationTests(unittest.TestCase):
    def env(self):return mock.patch.dict(os.environ,{'GITHUB_RUN_ID':'123','GITHUB_SHA':'synthetic','GITHUB_REF':r.base.BRANCH,'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ATTEMPT':'1'},clear=True)
    def receipts(self):
        common={'budgetAccounting':r.ACCOUNTING,'ordinals':list(range(5,51)),'maximumInitialProviderAttempts':46,'retries':0,'ordinals1Through4Authorized':False,'providerContract':copy.deepcopy(r.CONTRACT['providerContract']),'estimatedSpendCeilingUsd':'10.35'}
        return {'schema':'trackcade-stage1-v8-remaining46-authorization-v1','authorized':True,**copy.deepcopy(common)},{'schema':'trackcade-stage1-v8-remaining46-activation-v1','activate':True,**copy.deepcopy(common)}
    def ledger(self):return {'schema':'trackcade-stage1-v8-remaining46-ledger-v2','budgetAccounting':r.ACCOUNTING,'runId':'123','commit':'synthetic','lastCompletedOrdinal':4,'estimatedSpendCeilingUsd':'10.35','reconciledEstimatedSpendUsd':'0','reconciledAttempts':[],'resultArtifactId':None,'resultArtifactDigest':None}
    def usage(self):return {'input_tokens':12921,'output_tokens':9627,'total_tokens':22548,'input_tokens_details':{'cache_write_tokens':12918,'cached_tokens':0},'output_tokens_details':{'reasoning_tokens':7768}}
    def test_no_activation_or_real_authorization(self):self.assertFalse(r.ACT.exists());self.assertFalse(r.AUTH.exists())
    def test_templates_cannot_authorize(self):
        with self.env(),self.assertRaises(ValueError):r.gate(r.load(r.BASE/'STAGE1_V8_REMAINING46_AUTHORIZATION_TEMPLATE_V1.json'),r.load(r.BASE/'STAGE1_V8_REMAINING46_ACTIVATION_TEMPLATE_V1.json'))
    def test_cli_fails_before_provider_without_authorization(self):
        with self.env(),mock.patch.object(r.sys,'argv',['runner','run','5']),mock.patch.object(r,'one_provider_attempt') as call,self.assertRaises(FileNotFoundError):r.main()
        call.assert_not_called()
    def test_ordinals_exact_and_lower_ordinals_rejected(self):
        self.assertEqual(r.CONTRACT['ordinals'],list(range(5,51)))
        for x in [1,2,3,4,0,51,True,5.0,'5',None]:
            with self.subTest(ordinal=x),self.assertRaises(ValueError):r.ordinal(x)
    def test_frozen_mapping_all46(self):
        self.assertEqual([x['ordinal'] for x in r.MAPPING['cases']],list(range(5,51)))
        for n in range(5,51):
            row,paths,data=r.frozen_case(n);self.assertEqual(row['ordinal'],n);self.assertEqual(json.loads(data)['max_output_tokens'],25000)
    def test_frozen_settings_exact(self):self.assertEqual(r.CONTRACT['providerContract'],{'provider':'openai','api':'responses','model':'gpt-6-sol','reasoningEffort':'high','maxOutputTokens':25000,'serviceTier':'flex','store':False})
    def test_future_explicit_matching_approval_gate(self):
        with self.env():self.assertEqual(r.gate(*self.receipts()),Decimal('10.35'))
    def test_gate_rejects_scope_retries_template_contract_drift(self):
        with self.env():
            for key,value in [('authorized',False),('templateOnly',True),('budgetAccounting','old'),('ordinals',list(range(4,51))),('retries',1),('maximumInitialProviderAttempts',47),('ordinals1Through4Authorized',True)]:
                a,x=self.receipts();a[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.gate(a,x)
            for key,value in [('maxOutputTokens',8192),('model','other'),('reasoningEffort','low'),('serviceTier','standard'),('store',True)]:
                a,x=self.receipts();a['providerContract'][key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.gate(a,x)
    def test_rerun_branch_and_dispatch_rejected(self):
        with self.env():
            for key,value in [('GITHUB_RUN_ATTEMPT','2'),('GITHUB_REF','refs/heads/main'),('GITHUB_EVENT_NAME','workflow_dispatch')]:
                with mock.patch.dict(os.environ,{key:value}),self.subTest(key=key),self.assertRaises(ValueError):r.gate(*self.receipts())
    def test_unauthorized_amounts_fail_closed(self):
        for value in [None,0,10.35,True,'NaN','Infinity','-1','bad']:
            with self.subTest(amount=value),self.assertRaises(ValueError):r.decimal_usd(value)
        with self.env():
            a,x=self.receipts();x['estimatedSpendCeilingUsd']='20'
            with self.assertRaises(ValueError):r.gate(a,x)
    def test_budget_exact_boundary_and_next_call_refused(self):
        with self.env():
            ledger=self.ledger();ledger['estimatedSpendCeilingUsd']='0.225'
            self.assertEqual(r.ledger_for_next(ledger,5,Decimal('0.225')),Decimal('0.225'))
            with self.assertRaises(ValueError):r.ledger_for_next(ledger,5,Decimal('0.224999'))
    def test_stale_wrong_run_skipped_and_tampered_ledger_fail(self):
        with self.env():
            for key,value in [('schema','trackcade-stage1-v8-remaining46-ledger-v1'),('budgetAccounting','old'),('runId','999'),('commit','other'),('lastCompletedOrdinal',5),('reconciledEstimatedSpendUsd','0.001'),('reconciledAttempts',[{}]),('resultArtifactId',1)]:
                l=self.ledger();l[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.ledger_for_next(l,5,Decimal('10.35'))
    def valid_attempt(self,out,status,p,validator):
        (out/'normalized-proposal.json').write_bytes(b'{}\n');r.save_json(out/'validation-report.json',{'status':'valid','errors':[]})
        r.save_json(out/'raw-response.json',{'status':'completed','model':'gpt-6-sol','service_tier':'flex','usage':self.usage()})
        status.update({'providerCallAttempted':True,'classification':r.SUCCESS_CLASSIFICATION,'usage':self.usage(),'rawResponseSha256':r.sha(out/'raw-response.json'),'proposalValidated':True,'observedProviderStatus':'completed','observedProviderModel':'gpt-6-sol','observedProviderServiceTier':'flex','validatorExitCode':0,'normalizedProposalSha256':r.sha(out/'normalized-proposal.json')});r.save_json(p,status)
    def frozen_case_result(self,n,budget):
        r.prepare(n,budget)
        lock_id=n+100;result_id=n+200
        metadata={'id':lock_id,'name':r.NAMESPACE+f'-case-{n:02d}-attempt-lock','expired':False,'digest':'sha256:synthetic-lock','workflow_run':{'id':123,'head_sha':'synthetic'}}
        r.save_json(r.lockfile(n).parent/'uploaded.json',metadata)
        with mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':str(lock_id)}),mock.patch.object(r,'one_provider_attempt',side_effect=self.valid_attempt):r.run(n,budget)
        return {'id':result_id,'name':r.NAMESPACE+f'-case-{n:02d}-result','expired':False,'digest':'sha256:synthetic-result','workflow_run':{'id':123,'head_sha':'synthetic'}}
    def reconcile(self,n,budget,metadata):
        with mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':str(n+100),'RESULT_ARTIFACT_ID':str(metadata['id'])}):r.advance(n,budget,metadata)
    def test_all46_reconcile_under_lower_ceiling(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'):
            budget=Decimal('3.25');r.initialize(budget)
            for n in range(5,51):
                m=self.frozen_case_result(n,budget);self.reconcile(n,budget,m)
                self.assertEqual(r.load(r.ledger_path())['reconciledEstimatedSpendUsd'],str(Decimal(n-4)*Decimal('0.0642855')))
            self.assertEqual(r.load(r.ledger_path())['reconciledEstimatedSpendUsd'],'2.9571330')
    def test_reconciliation_releases_only_verified_difference(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'):
            budget=Decimal('0.30');r.initialize(budget);m=self.frozen_case_result(5,budget)
            before=r.load(r.ledger_path());self.assertEqual(before['reconciledEstimatedSpendUsd'],'0')
            with self.assertRaises(ValueError):r.prepare(6,budget)
            self.reconcile(5,budget,m)
            self.assertEqual(r.load(r.ledger_path())['reconciledEstimatedSpendUsd'],'0.0642855')
            self.assertEqual(r.ledger_for_next(r.load(r.ledger_path()),6,budget),Decimal('0.2892855'))
    def test_next_call_stops_when_reconciled_cost_plus_reserve_exceeds_budget(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'):
            budget=Decimal('0.225');r.initialize(budget);m=self.frozen_case_result(5,budget);self.reconcile(5,budget,m)
            with self.assertRaises(ValueError):r.prepare(6,budget)
    def test_missing_corrupt_or_wrong_result_never_reconciles(self):
        for kind in ['expired','wrong-run','wrong-head','no-digest','manifest-missing','raw-missing','usage-drift','cost-drift','lock-drift','ledger-write-failure']:
            with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),self.subTest(kind=kind):
                budget=Decimal('0.30');r.initialize(budget);m=self.frozen_case_result(5,budget);before=r.ledger_path().read_bytes()
                if kind=='expired':m['expired']=True
                elif kind=='wrong-run':m['workflow_run']['id']=99
                elif kind=='wrong-head':m['workflow_run']['head_sha']='other'
                elif kind=='no-digest':m['digest']=None
                elif kind=='manifest-missing':(r.location(5)/'FILES_SHA256.txt').unlink()
                elif kind=='raw-missing':(r.location(5)/'raw-response.json').unlink()
                elif kind in ['usage-drift','cost-drift']:
                    p=r.location(5)/'status.json';status=r.load(p)
                    if kind=='usage-drift':status['usage']['output_tokens_details']['reasoning_tokens']=0
                    else:status['observedEstimatedCostUsd']='0.01'
                    r.save_json(p,status);r.base.finalize_manifest(r.location(5))
                elif kind=='lock-drift':p=r.lockfile(5);lock=r.load(p);lock['ledgerBefore']={};r.save_json(p,lock)
                failure=mock.patch.object(r.Path,'replace',side_effect=OSError('synthetic storage failure')) if kind=='ledger-write-failure' else mock.patch.dict(os.environ,{})
                with failure,self.assertRaises((ValueError,FileNotFoundError,OSError)):self.reconcile(5,budget,m)
                self.assertEqual(r.ledger_path().read_bytes(),before);self.assertTrue(r.lockfile(5).exists())
                with self.assertRaises(ValueError):r.prepare(6,budget)
    def test_previous_frozen_evidence_and_ledger_tampering_stop(self):
        for kind in ['sum','history-cost','history-id','history-hash','previous-evidence']:
            with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),self.subTest(kind=kind):
                budget=Decimal('0.30');r.initialize(budget);m=self.frozen_case_result(5,budget);self.reconcile(5,budget,m);l=r.load(r.ledger_path())
                if kind=='sum':l['reconciledEstimatedSpendUsd']='0'
                elif kind=='history-cost':l['reconciledAttempts'][0]['estimatedCostUsd']='0'
                elif kind=='history-id':l['reconciledAttempts'][0]['resultArtifactId']=None
                elif kind=='history-hash':l['reconciledAttempts'][0]['statusSha256']='other'
                else:(r.location(5)/'raw-response.json').write_bytes(b'{}')
                with self.assertRaises(ValueError):r.ledger_for_next(l,6,budget)
    def test_usage_error_or_over_reservation_keeps_lock_and_stops(self):
        for cost in [None,Decimal('0.226')]:
            with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'11','RESULT_ARTIFACT_ID':'22'}),self.subTest(cost=cost):
                budget=self.setup_prepare(Path(tmp));before=r.ledger_path().read_bytes()
                effect=mock.patch.object(r,'estimate_usage',side_effect=ValueError('unknown usage')) if cost is None else mock.patch.object(r,'estimate_usage',return_value=cost)
                with effect,mock.patch.object(r,'one_provider_attempt',side_effect=self.valid_attempt):r.run(5,budget)
                r.base.verify_files_manifest(r.location(5));self.assertEqual(r.load(r.location(5)/'status.json')['artifactOutcome'],'stopped-frozen-failure')
                m={'id':22,'name':r.NAMESPACE+'-case-05-result','expired':False,'digest':'sha256:synthetic-result','workflow_run':{'id':123,'head_sha':'synthetic'}}
                with self.assertRaises(ValueError):r.advance(5,budget,m)
                self.assertEqual(r.ledger_path().read_bytes(),before);self.assertTrue(r.lockfile(5).exists())

    def test_frozen_pricing_no_double_charge_reasoning_or_cachewrite(self):self.assertEqual(r.estimate_usage(self.usage()),Decimal('0.0642855'))
    def test_unknown_malformed_and_over_envelope_usage_stops(self):
        for u in [None,{},self.usage()]:
            if u:u['input_tokens']=True
            with self.subTest(usage=u),self.assertRaises(ValueError):r.estimate_usage(u)
        for key,value in [('output_tokens',25001),('total_tokens',1),('input_tokens',76429)]:
            u=self.usage();u[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):r.estimate_usage(u)
    def setup_prepare(self,root):
        budget=Decimal('10.35');r.initialize(budget);r.prepare(5,budget)
        metadata={'id':11,'name':r.NAMESPACE+'-case-05-attempt-lock','expired':False,'digest':'sha256:synthetic-lock','workflow_run':{'id':123,'head_sha':'synthetic'}}
        r.save_json(r.lockfile(5).parent/'uploaded.json',metadata)
        return budget
    def test_credential_denied_before_reservation(self):
        with self.env(),mock.patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-not-a-provider-key'}),self.assertRaises(ValueError):r.prepare(5,Decimal('10.35'))
    def test_preparation_no_transport_and_no_duplicate_reservation(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),mock.patch.object(r,'one_provider_attempt') as call:
            self.setup_prepare(Path(tmp))
            with self.assertRaises(FileExistsError):r.prepare(5,Decimal('10.35'))
            call.assert_not_called();self.assertEqual(r.load(r.lockfile(5))['reservationUsd'],'0.225')
    def test_missing_uploaded_lock_refuses_call(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),mock.patch.object(r,'one_provider_attempt') as call:
            r.initialize(Decimal('10.35'));r.prepare(5,Decimal('10.35'))
            with self.assertRaises(FileNotFoundError):r.run(5,Decimal('10.35'))
            call.assert_not_called()
    def test_incomplete_attempt_frozen_and_second_invocation_refused(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'11'}):
            self.setup_prepare(Path(tmp))
            def attempt(out,status,p,validator):status.update({'providerCallAttempted':True,'classification':'provider_incomplete_no_completed_response_no_retry','usage':self.usage()});r.save_json(p,status)
            with mock.patch.object(r,'one_provider_attempt',side_effect=attempt) as call:
                r.run(5,Decimal('10.35'));self.assertEqual(call.call_count,1)
                with self.assertRaises(ValueError):r.run(5,Decimal('10.35'))
                self.assertEqual(call.call_count,1)
            r.base.verify_files_manifest(r.location(5));self.assertEqual(r.load(r.location(5)/'status.json')['artifactOutcome'],'stopped-frozen-failure')
            with self.assertRaises(ValueError):r.prepare(6,Decimal('10.35'))
    def transport(self,response=None,error=None):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp);r.save_json(out/'openai-payload-v8-flex25000.json',{'max_output_tokens':25000,'model':'gpt-6-sol','service_tier':'flex','store':False});s={'errors':[]};p=out/'status.json'
            resp=mock.MagicMock();resp.__enter__.return_value=resp;resp.read.return_value=json.dumps(response).encode();resp.status=200;resp.headers={}
            with mock.patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-not-a-provider-key'}),mock.patch.object(r.urllib.request,'urlopen',side_effect=error,return_value=resp) as call:
                r.one_provider_attempt(out,s,p,r.ROOT/'research/learned-interpretation-v1/validate_learned_proposal_v7.py');self.assertEqual(call.call_count,1)
            return s
    def test_transport_incomplete_never_extracts_or_validates(self):
        with mock.patch.object(r.subprocess,'run',side_effect=AssertionError('must not validate partial')):
            s=self.transport({'status':'incomplete','incomplete_details':{'reason':'max_output_tokens'},'output':[{'type':'message','content':[{'type':'output_text','text':'{'}]}]})
        self.assertEqual(s['classification'],'provider_incomplete_no_completed_response_no_retry');self.assertNotIn('proposalCandidateSha256',s)
    def test_http_failure_one_call_no_fallback(self):
        e=r.urllib.error.HTTPError('https://api.openai.com/v1/responses',429,'synthetic',{},io.BytesIO(b'{"error":{"message":"synthetic"}}'))
        self.assertEqual(self.transport(error=e)['classification'],'flex_http_failure_no_completed_response_no_retry')
    def test_transport_error_one_call_no_retry(self):self.assertEqual(self.transport(error=r.urllib.error.URLError('synthetic'))['classification'],'flex_transport_failure_no_completed_response_no_retry')
    def test_wrong_model_and_tier_stops(self):
        for model,tier,expected in [('other','flex','provider_completed_wrong_model_no_retry'),('gpt-6-sol','standard','provider_completed_wrong_service_tier_no_retry')]:
            self.assertEqual(self.transport({'status':'completed','model':model,'service_tier':tier})['classification'],expected)
    def test_absent_key_never_calls_transport(self):
        with mock.patch.dict(os.environ,{},clear=True),mock.patch.object(r.urllib.request,'urlopen') as call,self.assertRaises(RuntimeError):r.one_provider_attempt(Path('unused'),{},Path('unused'),Path('unused'))
        call.assert_not_called()
    def test_lock_identity_expiration_and_other_ordinal_fail(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'11'}):
            self.setup_prepare(Path(tmp));l=r.load(r.lockfile(5));m=r.load(r.lockfile(5).parent/'uploaded.json')
            for key,value in [('expired',True),('id',12),('name','other'),('digest',None)]:
                changed=dict(m);changed[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.verify_lock(5,l,changed)
            with self.assertRaises(ValueError):r.verify_lock(6,l,m)
    def test_uploaded_success_gate_then_no_duplicate_advance(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'11','RESULT_ARTIFACT_ID':'22'}):
            self.setup_prepare(Path(tmp))
            with mock.patch.object(r,'one_provider_attempt',side_effect=self.valid_attempt):r.run(5,Decimal('10.35'))
            m={'id':22,'name':r.NAMESPACE+'-case-05-result','expired':False,'digest':'sha256:synthetic-result','workflow_run':{'id':123,'head_sha':'synthetic'}}
            bad=dict(m);bad['expired']=True
            with self.assertRaises(ValueError):r.advance(5,Decimal('10.35'),bad)
            r.advance(5,Decimal('10.35'),m);self.assertEqual(r.load(r.ledger_path())['reconciledEstimatedSpendUsd'],'0.0642855')
            with self.assertRaises(ValueError):r.advance(5,Decimal('10.35'),m)
            r.prepare(6,Decimal('10.35'))

    def actual_workflow(self):return r.load(r.ROOT/'.github/workflows/trackcade-semantic-external-stage1-v8-remaining46-v1.yml')
    def test_actual_workflow_all46_lock_result_wiring(self):
        import audit_stage1_v8_remaining46_v1 as audit
        wf=self.actual_workflow();self.assertEqual(audit.workflow_artifact_wiring(wf),46)
        gates=[s for s in wf['jobs']['serial']['steps'] if s.get('id','').startswith('gate')]
        self.assertEqual([s['id'] for s in gates],[f'gate{n:02d}' for n in range(5,51)])
        for n,step in zip(range(5,51),gates):
            outputs={f'lock{n:02d}':{'artifact-id':n+100},f'result{n:02d}':{'artifact-id':n+200}}
            self.assertEqual(audit.reconciliation_step_env(step,outputs),{'LOCK_ARTIFACT_ID':str(n+100),'RESULT_ARTIFACT_ID':str(n+200)})
            self.assertNotIn('OPENAI_API_KEY',step['env'])
    def test_each_missing_or_cross_ordinal_gate_id_fails_audit(self):
        import audit_stage1_v8_remaining46_v1 as audit
        for n in range(5,51):
            for variable,prefix in [('LOCK_ARTIFACT_ID','lock'),('RESULT_ARTIFACT_ID','result')]:
                for mutation in ['missing','other-ordinal']:
                    wf=self.actual_workflow();step=next(s for s in wf['jobs']['serial']['steps'] if s.get('id')==f'gate{n:02d}')
                    if mutation=='missing':step['env'].pop(variable)
                    else:step['env'][variable]='${{ steps.'+prefix+f'{(n+1 if n<50 else 5):02d}'+'.outputs.artifact-id }}'
                    with self.subTest(ordinal=n,variable=variable,mutation=mutation),self.assertRaises(ValueError):audit.workflow_artifact_wiring(wf)
    def test_each_verify_and_live_lock_id_is_required(self):
        import audit_stage1_v8_remaining46_v1 as audit
        for n in range(5,51):
            for prefix in ['verify','live']:
                for mutation in ['missing','other-ordinal']:
                    wf=self.actual_workflow();step=next(s for s in wf['jobs']['serial']['steps'] if s.get('id')==f'{prefix}{n:02d}')
                    if mutation=='missing':step['env'].pop('LOCK_ARTIFACT_ID')
                    else:step['env']['LOCK_ARTIFACT_ID']='${{ steps.lock'+f'{(n+1 if n<50 else 5):02d}'+'.outputs.artifact-id }}'
                    with self.subTest(ordinal=n,prefix=prefix,mutation=mutation),self.assertRaises(ValueError):audit.workflow_artifact_wiring(wf)
    def test_actual_gate05_environment_reconciles_synthetic_result(self):
        import audit_stage1_v8_remaining46_v1 as audit
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'):
            budget=Decimal('3.50');r.initialize(budget);metadata=self.frozen_case_result(5,budget)
            step=next(s for s in self.actual_workflow()['jobs']['serial']['steps'] if s.get('id')=='gate05')
            env=audit.reconciliation_step_env(step,{'lock05':{'artifact-id':105},'result05':{'artifact-id':metadata['id']}})
            self.assertNotIn('OPENAI_API_KEY',os.environ)
            with mock.patch.dict(os.environ,env):r.advance(5,budget,metadata)
            self.assertEqual(r.load(r.ledger_path())['reconciledEstimatedSpendUsd'],'0.0642855')
            self.assertEqual(r.load(r.ledger_path())['lastCompletedOrdinal'],5)
    def test_omitted_actual_gate05_lock_reproduces_runtime_failure(self):
        import audit_stage1_v8_remaining46_v1 as audit
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.object(r,'WORK',Path(tmp)/'w'):
            budget=Decimal('3.50');r.initialize(budget);metadata=self.frozen_case_result(5,budget);before=r.ledger_path().read_bytes()
            step=next(s for s in self.actual_workflow()['jobs']['serial']['steps'] if s.get('id')=='gate05')
            step['env'].pop('LOCK_ARTIFACT_ID')
            with self.assertRaises(ValueError):audit.reconciliation_step_env(step,{'lock05':{'artifact-id':105},'result05':{'artifact-id':metadata['id']}})
            with mock.patch.dict(os.environ,{'RESULT_ARTIFACT_ID':str(metadata['id'])}),self.assertRaisesRegex(KeyError,'LOCK_ARTIFACT_ID'):r.advance(5,budget,metadata)
            self.assertEqual(r.ledger_path().read_bytes(),before)

if __name__=='__main__':unittest.main()
