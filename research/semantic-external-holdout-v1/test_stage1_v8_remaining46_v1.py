import copy,io,json,os,tempfile,unittest
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
import run_stage1_v8_remaining46_v1 as r

class InertContinuationTests(unittest.TestCase):
    def env(self):return mock.patch.dict(os.environ,{'GITHUB_RUN_ID':'123','GITHUB_SHA':'synthetic','GITHUB_REF':r.base.BRANCH,'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ATTEMPT':'1'},clear=True)
    def receipts(self):
        common={'ordinals':list(range(5,51)),'maximumInitialProviderAttempts':46,'retries':0,'ordinals1Through4Authorized':False,'providerContract':copy.deepcopy(r.CONTRACT['providerContract']),'estimatedSpendCeilingUsd':'10.35'}
        return {'schema':'trackcade-stage1-v8-remaining46-authorization-v1','authorized':True,**copy.deepcopy(common)},{'schema':'trackcade-stage1-v8-remaining46-activation-v1','activate':True,**copy.deepcopy(common)}
    def ledger(self,n=5):return {'schema':'trackcade-stage1-v8-remaining46-ledger-v1','runId':'123','commit':'synthetic','lastCompletedOrdinal':n-1,'estimatedSpendCeilingUsd':'10.35','chargedUsd':str(r.RESERVATION*(n-5)),'knownEstimatedSpendUsd':'0','resultArtifactId':77 if n>5 else None,'resultArtifactDigest':'sha256:prior' if n>5 else None}
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
            for key,value in [('authorized',False),('templateOnly',True),('ordinals',list(range(4,51))),('retries',1),('maximumInitialProviderAttempts',47),('ordinals1Through4Authorized',True)]:
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
    def test_all46_conservative_reservations_fit_exact_10_35(self):
        with self.env():
            for n in range(5,51):self.assertEqual(r.ledger_for_next(self.ledger(n),n,Decimal('10.35')),r.RESERVATION*(n-4))
            self.assertEqual(r.RESERVATION*46,Decimal('10.350'))
    def test_stale_wrong_run_skipped_and_tampered_ledger_fail(self):
        with self.env():
            for key,value in [('runId','999'),('commit','other'),('lastCompletedOrdinal',5),('chargedUsd','0.001'),('knownEstimatedSpendUsd','0.01')]:
                l=self.ledger();l[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.ledger_for_next(l,5,Decimal('10.35'))
            l=self.ledger(6);l['resultArtifactId']=None
            with self.assertRaises(ValueError):r.ledger_for_next(l,6,Decimal('10.35'))
    def test_no_refund_from_lower_actual_cost(self):
        with self.env():
            ledger=self.ledger(6);self.assertEqual(r.ledger_for_next(ledger,6,Decimal('10.35')),Decimal('0.450'))
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
            def valid(out,status,p,validator):
                (out/'normalized-proposal.json').write_bytes(b'{}\n');r.save_json(out/'validation-report.json',{'status':'valid','errors':[]})
                status.update({'providerCallAttempted':True,'classification':r.SUCCESS_CLASSIFICATION,'usage':self.usage(),'proposalValidated':True,'observedProviderStatus':'completed','observedProviderModel':'gpt-6-sol','observedProviderServiceTier':'flex','validatorExitCode':0,'normalizedProposalSha256':r.sha(out/'normalized-proposal.json')});r.save_json(p,status)
            with mock.patch.object(r,'one_provider_attempt',side_effect=valid):r.run(5,Decimal('10.35'))
            m={'id':22,'name':r.NAMESPACE+'-case-05-result','expired':False,'digest':'sha256:synthetic-result','workflow_run':{'id':123,'head_sha':'synthetic'}}
            bad=dict(m);bad['expired']=True
            with self.assertRaises(ValueError):r.advance(5,Decimal('10.35'),bad)
            r.advance(5,Decimal('10.35'),m);self.assertEqual(r.load(r.ledger_path())['chargedUsd'],'0.225')
            with self.assertRaises(ValueError):r.advance(5,Decimal('10.35'),m)
            r.prepare(6,Decimal('10.35'))

if __name__=='__main__':unittest.main()
