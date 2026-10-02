import copy,json,os,tempfile,unittest
from pathlib import Path
from unittest import mock
import run_stage1_v8_ordinal04_budget_v1 as r

class BudgetTests(unittest.TestCase):
    def test_only_maximum_changes(self):
        old=r.load(r.INPUT/'openai-payload-v7-flex8192.json');new=r.verify_inputs()
        self.assertEqual([k for k in old if old[k]!=new[k]],['max_output_tokens']);self.assertEqual(new['max_output_tokens'],25000)
    def receipts(self):
        a=r.load(r.BASE/'STAGE1_V8_ORDINAL04_AUTHORIZATION_V1.json')
        x={'schema':'trackcade-stage1-v8-ordinal04-activation-v1','activate':True,'ordinal':4,'maximumProviderAttempts':1,'retries':0,'ordinals5Through50Authorized':False,'providerContract':r.CONTRACT['providerContract'],'staticAuditConclusion':'success','staticAuditRunId':123}
        return a,x
    def env(self):return mock.patch.dict(os.environ,{'GITHUB_REF':r.base.BRANCH,'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ATTEMPT':'1','GITHUB_SHA':'test','GITHUB_RUN_ID':'123'},clear=True)
    def test_valid_gate(self):
        with self.env():r.execution_gate(*self.receipts(),'test')
    def test_unauthorized_and_ordinal_and_retry_mutations_fail(self):
        with self.env():
            for key,value in [('authorized',False),('ordinal',5),('maximumProviderAttempts',2),('retries',1),('ordinals5Through50Authorized',True)]:
                a,x=self.receipts();a[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.execution_gate(a,x,'test')
    def test_activation_mutations_fail(self):
        with self.env():
            for key,value in [('activate',False),('ordinal',5),('maximumProviderAttempts',2),('retries',1),('staticAuditConclusion','failure'),('staticAuditRunId',None),('ordinals5Through50Authorized',True)]:
                a,x=self.receipts();x[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.execution_gate(a,x,'test')
    def test_rerun_wrong_branch_commit_and_event_fail(self):
        with self.env():
            for key,value in [('GITHUB_RUN_ATTEMPT','2'),('GITHUB_REF','refs/heads/main'),('GITHUB_SHA','other'),('GITHUB_EVENT_NAME','workflow_dispatch')]:
                with mock.patch.dict(os.environ,{key:value}),self.subTest(key=key),self.assertRaises(ValueError):r.execution_gate(*self.receipts(),'test')
    def test_contract_mutations_fail(self):
        with self.env():
            for key,value in [('maxOutputTokens',8192),('model','other'),('reasoningEffort','low'),('serviceTier','default'),('store',True)]:
                a,x=copy.deepcopy(self.receipts());a['providerContract'][key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.execution_gate(a,x,'test')
    def lock(self):
        l={'schema':'trackcade-stage1-v8-ordinal04-attempt-lock-v1','ordinal':4,'maximumProviderAttempts':1,'retries':0,'commit':'test','runId':'123','providerContract':r.CONTRACT['providerContract']}
        a={'id':77,'name':r.NAMESPACE+'-attempt-lock','expired':False,'digest':'sha256:test','workflow_run':{'id':123,'head_sha':'test'}}
        return l,a
    def test_uploaded_lock_valid(self):
        with self.env(),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'77'}):r.verify_lock(*self.lock(),'test')
    def test_wrong_or_expired_lock_fails(self):
        with self.env(),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'77'}):
            for key,value in [('id',78),('expired',True),('name','other'),('digest',None),('workflow_run',{'id':124,'head_sha':'test'})]:
                l,a=self.lock();a[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.verify_lock(l,a,'test')
    def test_lock_cannot_authorize_other_ordinal_or_repeat(self):
        with self.env(),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'77'}):
            for key,value in [('ordinal',5),('retries',1),('maximumProviderAttempts',2),('commit','other'),('runId','999')]:
                l,a=self.lock();l[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):r.verify_lock(l,a,'test')
    def transport(self,response):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp);r.save_json(out/'openai-payload-v8-flex25000.json',r.verify_inputs());status={'errors':[]};p=out/r.STATUS
            raw=json.dumps(response).encode();resp=mock.MagicMock();resp.__enter__.return_value=resp;resp.read.return_value=raw;resp.status=200;resp.headers={}
            with mock.patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-not-a-key'}),mock.patch.object(r.urllib.request,'urlopen',return_value=resp) as call:
                r.one_provider_attempt(out,status,p,r.BASE.parent/'learned-interpretation-v1/validate_learned_proposal_v7.py')
                self.assertEqual(call.call_count,1);self.assertEqual(json.loads(call.call_args.args[0].data)['max_output_tokens'],25000);self.assertEqual((out/'raw-response.json').read_bytes(),raw)
            return status
    def test_incomplete_never_extracts_validates_or_recovers(self):
        with mock.patch.object(r.subprocess,'run',side_effect=AssertionError('validator must not execute')):
            s=self.transport({'status':'incomplete','incomplete_details':{'reason':'max_output_tokens'},'usage':{'output_tokens':25000},'output':[{'type':'message','content':[{'type':'output_text','text':'{'}]}]})
        self.assertEqual(s['classification'],'provider_incomplete_no_completed_response_no_retry');self.assertNotIn('proposalCandidateSha256',s)
    def test_wrong_model_stops_before_validator(self):
        s=self.transport({'status':'completed','service_tier':'flex','model':'other'});self.assertEqual(s['classification'],'provider_completed_wrong_model_no_retry')
    def test_wrong_tier_stops_before_validator(self):
        s=self.transport({'status':'completed','service_tier':'default','model':'gpt-6-sol'});self.assertEqual(s['classification'],'provider_completed_wrong_service_tier_no_retry')
    def test_no_key_no_provider_call(self):
        with mock.patch.dict(os.environ,{},clear=True),mock.patch.object(r.urllib.request,'urlopen') as call,self.assertRaises(RuntimeError):r.one_provider_attempt(Path('unused'),{},Path('unused'),Path('unused'))
        call.assert_not_called()
    def test_exclusive_consumption_marker_refuses_reentry(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'provider-attempt-consumed-v1.json';p.open('x').close()
            with self.assertRaises(FileExistsError):p.open('x')
    def test_main_run_once_then_refuses_second_attempt(self):
        with tempfile.TemporaryDirectory() as tmp,self.env():
            root=Path(tmp);out=root/'output';lock=root/'lock/attempt-lock.json';uploaded=root/'uploaded.json'
            a,x=self.receipts();r.save_json(root/'STAGE1_V8_ORDINAL04_AUTHORIZATION_V1.json',a);r.save_json(root/'STAGE1_V8_ORDINAL04_ACTIVATE_V1.json',x)
            argv=['runner','--mode','prepare','--ordinal','4','--output',str(out),'--lock',str(lock)]
            with mock.patch.object(r,'BASE',root),mock.patch.object(r.sys,'argv',argv):r.main()
            _,artifact=self.lock();r.save_json(uploaded,artifact)
            argv[2]='run';argv+=['--uploaded-lock',str(uploaded)]
            def attempt(o,s,p,v):
                s['providerCallAttempted']=True;s['classification']='provider_incomplete_no_completed_response_no_retry';r.save_json(p,s)
            with mock.patch.object(r,'BASE',root),mock.patch.object(r.sys,'argv',argv),mock.patch.dict(os.environ,{'LOCK_ARTIFACT_ID':'77'}),mock.patch.object(r,'one_provider_attempt',side_effect=attempt) as call:
                r.main();self.assertEqual(call.call_count,1)
                with self.assertRaises(ValueError):r.main()
                self.assertEqual(call.call_count,1)
            self.assertEqual(r.load(out/r.STATUS)['artifactOutcome'],'attempted-no-valid-response')
    def test_prepare_refuses_credential_before_lock(self):
        with tempfile.TemporaryDirectory() as tmp,self.env(),mock.patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-not-a-key'}):
            root=Path(tmp);a,x=self.receipts();r.save_json(root/'STAGE1_V8_ORDINAL04_AUTHORIZATION_V1.json',a);r.save_json(root/'STAGE1_V8_ORDINAL04_ACTIVATE_V1.json',x)
            argv=['runner','--mode','prepare','--ordinal','4','--output',str(root/'out'),'--lock',str(root/'lock/file')]
            with mock.patch.object(r,'BASE',root),mock.patch.object(r.sys,'argv',argv),self.assertRaises(ValueError):r.main()
            self.assertFalse((root/'lock').exists())
