"""Offline safety tests. All subprocess/network access is blocked or explicitly faked."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import trackcade_v3_retry as r


class RetryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.env = dict(RUNNER_TEMP=self.temp.name, GITHUB_REPOSITORY=r.b.REPO,
            GITHUB_REF='refs/heads/'+r.b.BRANCH, GITHUB_EVENT_NAME='workflow_dispatch',
            GITHUB_SHA='a'*40, GITHUB_RUN_ID='999', GITHUB_RUN_ATTEMPT='1',
            GITHUB_OUTPUT=str(Path(self.temp.name)/'outputs'), OPENAI_API_KEY='offline-placeholder')
        self.addCleanup(patch.stopall)
        patch.dict(os.environ,self.env).start()
        self.process = patch.object(r.subprocess,'run',side_effect=AssertionError('unmocked subprocess forbidden')).start()
        patch.object(socket,'socket',side_effect=AssertionError('network forbidden')).start()
        self.artifact = dict(id=r.EVIDENCE_ID,name=r.b.PREFIX+'42-retry-eligible',expired=False,
            digest='sha256:'+r.EVIDENCE_SHA,created_at='2026-09-29T10:36:10Z',
            workflow_run=dict(id=r.PRIOR_RUN,head_sha=r.PRIOR_SOURCE))
        self.pages = [dict(total_count=1,artifacts=[self.artifact])]
        self.refs = [[dict(ref=r.ORIGINAL_REF,object=dict(type='tag',sha=r.ORIGINAL_TAG_SHA))]]
        self.original = dict(sha=r.ORIGINAL_TAG_SHA,object=dict(sha=r.PRIOR_SOURCE,type='commit'),
            message=json.dumps(dict(ordinal=42,source=r.PRIOR_SOURCE,runId=str(r.PRIOR_RUN),runAttempt=1,
                providerContract=r.b.CONTRACT,state='reserved-before-provider-call',permanent=True,automaticUnlockPermitted=False)))
        self.run = dict(id=r.PRIOR_RUN,head_sha=r.PRIOR_SOURCE,head_branch=r.b.BRANCH,
                        event='workflow_dispatch',run_attempt=1,status='completed',conclusion='failure')

    def guard(self):
        return r.check_inventory(self.pages,self.refs,self.original,self.run)

    def test_exact_authorization_passes(self):
        r.inputs('42',r.TICKET)
        self.assertEqual(self.guard()['id'],r.EVIDENCE_ID)

    def test_other_ordinals_or_tickets_refused(self):
        for n,t in [('4',r.TICKET),('42,44',r.TICKET),('42','new'),('042',r.TICKET)]:
            with self.subTest(n=n,t=t),self.assertRaises(ValueError): r.inputs(n,t)

    def test_context_refuses_reruns_wrong_repo_branch_event(self):
        for k,v in [('GITHUB_RUN_ATTEMPT','2'),('GITHUB_REPOSITORY','x/y'),
                    ('GITHUB_REF','refs/heads/main'),('GITHUB_EVENT_NAME','push')]:
            with self.subTest(k=k),patch.dict(os.environ,{k:v}),self.assertRaises(ValueError): r.inputs('42',r.TICKET)

    def test_completed_no_retry_unknown_even_expired_refused(self):
        for suffix in ('completed','no-retry-observed','unknown'):
            a=dict(self.artifact,id=100,name=r.b.PREFIX+'42-'+suffix,expired=True)
            self.pages=[dict(total_count=2,artifacts=[self.artifact,a])]
            with self.subTest(suffix=suffix),self.assertRaises(ValueError): self.guard()

    def test_missing_expired_changed_evidence_refused(self):
        for key,value in [('expired',True),('digest','sha256:bad'),('id',10)]:
            old=self.artifact[key]; self.artifact[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError): self.guard()
            self.artifact[key]=old

    def test_incomplete_inventory_refused(self):
        self.pages[0]['total_count']=2
        with self.assertRaises(ValueError): self.guard()

    def test_newer_retry_evidence_refused(self):
        self.pages[0]['artifacts'].append(dict(self.artifact,id=r.EVIDENCE_ID+1))
        self.pages[0]['total_count']=2
        with self.assertRaises(ValueError): self.guard()

    def test_original_lock_missing_or_changed_refused(self):
        self.refs=[[]]
        with self.assertRaises(ValueError): self.guard()
        self.refs=[[dict(ref=r.ORIGINAL_REF,object=dict(type='tag',sha='b'*40))]]
        with self.assertRaises(ValueError): self.guard()

    def test_prior_retry_lock_refused(self):
        self.refs[0].append(dict(ref=r.RETRY_REF,object=dict(sha='b'*40)))
        with self.assertRaises(ValueError): self.guard()

    def test_prior_run_rerun_refused(self):
        self.run['run_attempt']=2
        with self.assertRaises(ValueError): self.guard()

    def fixture(self,change=None):
        prep=Path(self.temp.name)/'v3-prep'; prep.mkdir(exist_ok=True)
        payload=b'frozen synthetic payload'
        h=hashlib.sha256(payload).hexdigest()
        manifest=json.dumps(dict(tracks=[dict(ordinal=42,hashes=dict(openaiPayloadV3Sha256=h))])).encode()
        (prep/'STAGE1_V3_PREP_MANIFEST_V1.json').write_bytes(manifest)
        raw=dict(object='response',status='incomplete',model='gpt-6-sol',id='resp_offline')
        status=dict(schema='trackcade-semantic-external-stage1-v3-provider-case-v1',ordinal=42,
            githubRunId=str(r.PRIOR_RUN),githubRunAttempt=1,harnessSourceCommit=r.PRIOR_SOURCE,prepArtifactId='10986506165',
            classification='provider_infrastructure_no_completed_response',retryAuthorized=True,
            providerCompletedSemanticResponse=False,providerCallAttempted=True,providerResponseObserved=True,
            providerContract=r.b.CONTRACT,compilerInvoked=False,analyzerSourceCommit=r.ANALYZER_SHA,analyzerRunnerSha256=r.RUNNER_SHA,
            observedProviderStatus='incomplete',observedProviderResponseId='resp_offline',
            frozenPayloadSha256=h,preflightPayloadSha256=h,livePayloadSha256=h)
        extra={}
        if change: change(status,raw,extra)
        raw_bytes=json.dumps(raw).encode()
        status['rawResponseSha256']=hashlib.sha256(raw_bytes).hexdigest()
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w') as z:
            for n,v in {r.STATUS_FILE:json.dumps(status).encode(),'raw-response.json':raw_bytes,
                        'openai-payload-v3.json':payload,'preflight-openai-payload-v3.json':payload,**extra}.items(): z.writestr(n,v)
        data=buf.getvalue()
        patch.object(r,'EVIDENCE_SHA',hashlib.sha256(data).hexdigest()).start()
        patch.object(r.b,'PREP_SHA',hashlib.sha256(manifest).hexdigest()).start()
        return data,prep

    def test_preserved_incomplete_content_passes(self):
        data,prep=self.fixture()
        self.assertEqual(r.verify_evidence(data,prep)['status']['ordinal'],42)

    def test_corrupt_zip_digest_refused(self):
        data,prep=self.fixture()
        with self.assertRaises(ValueError): r.verify_evidence(data+b'x',prep)

    def test_completed_raw_refused(self):
        data,prep=self.fixture(lambda s,raw,e:raw.update(status='completed'))
        with self.assertRaises(ValueError): r.verify_evidence(data,prep)

    def test_no_retry_status_refused(self):
        data,prep=self.fixture(lambda s,raw,e:s.update(retryAuthorized=False))
        with self.assertRaises(ValueError): r.verify_evidence(data,prep)

    def test_existing_proposal_refused(self):
        data,prep=self.fixture(lambda s,raw,e:e.update({'normalized-proposal.json':b'{}'}))
        with self.assertRaises(ValueError): r.verify_evidence(data,prep)

    def test_contract_change_refused(self):
        data,prep=self.fixture(lambda s,raw,e:s.update(providerContract=dict(r.b.CONTRACT,maxOutputTokens=8192)))
        with self.assertRaises(ValueError): r.verify_evidence(data,prep)

    def test_prep_change_refused(self):
        data,prep=self.fixture()
        (prep/'STAGE1_V3_PREP_MANIFEST_V1.json').write_bytes(b'{}')
        with self.assertRaises(ValueError): r.verify_evidence(data,prep)

    def test_claim_only_creates_separate_tag(self):
        with patch.object(r.b,'api',side_effect=[dict(sha='c'*40),dict(ref=r.RETRY_REF,object=dict(sha='c'*40))]) as api:
            r.claim()
            self.assertEqual([x.args[0] for x in api.call_args_list],['git/tags','git/refs'])
            self.assertEqual(api.call_args_list[1].args[1]['ref'],r.RETRY_REF)
            self.assertNotEqual(r.RETRY_REF,r.ORIGINAL_REF)

    def execute_fixture(self):
        data,prep=self.fixture()
        (r.root()/'prior-evidence.zip').write_bytes(data)
        r.b.write_json(r.root()/'authorization.json',dict(ticket=r.TICKET,source='a'*40,runId='999'))

    def test_duplicate_claim_causes_zero_harness_calls(self):
        self.execute_fixture()
        with patch.object(r,'live_guard'),patch.object(r,'claim',side_effect=ValueError('already exists')):
            with self.assertRaises(ValueError): r.execute()
        self.process.assert_not_called()

    def test_timeout_calls_harness_once_and_stops(self):
        self.execute_fixture()
        self.process.side_effect=__import__('subprocess').TimeoutExpired('offline',660)
        with patch.object(r,'live_guard'),patch.object(r,'claim') as claim:
            r.execute()
        claim.assert_called_once(); self.process.assert_called_once()
        result=json.loads((r.root()/'retry-result.json').read_bytes())
        self.assertFalse(result['success']); self.assertEqual(result['category'],'no-retry-observed')

    def test_incomplete_calls_harness_once_and_preserves_retry_evidence(self):
        self.execute_fixture()
        def fake(cmd,**kwargs):
            out=Path(cmd[cmd.index('--output-dir')+1])
            raw=dict(object='response',status='incomplete',model='gpt-6-sol',id='new')
            r.b.write_json(out/'raw-response.json',raw)
            status=dict(schema='trackcade-semantic-external-stage1-v3-provider-case-v1',ordinal=42,
                providerContract=r.b.CONTRACT,harnessSourceCommit='a'*40,githubRunId='999',githubRunAttempt=1,
                providerCompletedSemanticResponse=False,retryAuthorized=True,
                rawResponseSha256=hashlib.sha256((out/'raw-response.json').read_bytes()).hexdigest())
            r.b.write_json(out/r.STATUS_FILE,status)
            return type('Result',(),{'returncode':75})()
        self.process.side_effect=fake
        with patch.object(r,'live_guard'),patch.object(r,'claim'): r.execute()
        self.process.assert_called_once()
        result=json.loads((r.root()/'retry-result.json').read_bytes())
        self.assertFalse(result['success']); self.assertEqual(result['category'],'retry-eligible')

    def test_branch_drift_causes_zero_harness_calls(self):
        with patch.object(r.b,'api',return_value={'commit':{'sha':'b'*40}}):
            with self.assertRaises(ValueError): r.live_guard('test')
        self.process.assert_not_called()

    def test_wrong_prior_payload_refused(self):
        data,prep=self.fixture(lambda s,raw,e:e.update({'openai-payload-v3.json':b'changed'}))
        with self.assertRaises(ValueError): r.verify_evidence(data,prep)

    def test_429_calls_once_and_stops_without_raw(self):
        self.execute_fixture()
        def fake(cmd,**kwargs):
            out=Path(cmd[cmd.index('--output-dir')+1])
            r.b.write_json(out/r.STATUS_FILE,dict(schema='trackcade-semantic-external-stage1-v3-provider-case-v1',
                ordinal=42,providerContract=r.b.CONTRACT,harnessSourceCommit='a'*40,githubRunId='999',githubRunAttempt=1,
                providerCompletedSemanticResponse=False,retryAuthorized=True,observedProviderStatus=429))
            return type('Result',(),{'returncode':75})()
        self.process.side_effect=fake
        with patch.object(r,'live_guard'),patch.object(r,'claim'): r.execute()
        self.process.assert_called_once()
        result=json.loads((r.root()/'retry-result.json').read_bytes())
        self.assertFalse(result['success']); self.assertEqual(result['category'],'retry-eligible')

    def test_success_calls_once_and_marks_completed(self):
        self.execute_fixture()
        def fake(cmd,**kwargs):
            out=Path(cmd[cmd.index('--output-dir')+1])
            raw=dict(object='response',status='completed',model='gpt-6-sol',id='new')
            r.b.write_json(out/'raw-response.json',raw)
            r.b.write_json(out/r.STATUS_FILE,dict(schema='trackcade-semantic-external-stage1-v3-provider-case-v1',
                ordinal=42,providerContract=r.b.CONTRACT,harnessSourceCommit='a'*40,githubRunId='999',githubRunAttempt=1,
                providerCompletedSemanticResponse=True,retryAuthorized=False,openaiResponseId='new',
                classification=r.b.VALID,errors=[],
                rawResponseSha256=hashlib.sha256((out/'raw-response.json').read_bytes()).hexdigest()))
            return type('Result',(),{'returncode':0})()
        self.process.side_effect=fake
        with patch.object(r,'live_guard'),patch.object(r,'claim'): r.execute()
        self.process.assert_called_once()
        result=json.loads((r.root()/'retry-result.json').read_bytes())
        self.assertTrue(result['success']); self.assertEqual(result['category'],'completed')


if __name__=='__main__': unittest.main()
