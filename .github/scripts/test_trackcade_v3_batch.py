"""Offline tests. Network and unmocked subprocess execution are forbidden."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import trackcade_v3_batch as b


def inventory(n=13, suffix='retry-eligible', expired=False):
    return [dict(total_count=1, artifacts=[dict(id=1, name=b.PREFIX+str(n)+'-'+suffix,
        expired=expired, workflow_run=dict(id=36462381190, head_sha='2451c1f8f99de754331eaac52b6c6b8b3d070226'))])]


class BatchTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.env=patch.dict(os.environ, dict(GITHUB_REPOSITORY=b.REPO,GITHUB_REF='refs/heads/'+b.BRANCH,
            GITHUB_EVENT_NAME='workflow_dispatch',GITHUB_RUN_ATTEMPT='1',GITHUB_SHA='a'*40,
            GITHUB_RUN_ID='123',RUNNER_TEMP=self.tmp.name,GITHUB_OUTPUT=str(self.root/'outputs')))
        self.env.start(); self.addCleanup(self.env.stop)
        self.block=patch.object(b.subprocess,'run',side_effect=AssertionError('Unmocked external process forbidden'))
        self.block.start(); self.addCleanup(self.block.stop)

    def test_order_and_maximum(self):
        self.assertEqual(b.parse_ordinals(' 31, 13,23 '),[31,13,23])
        self.assertEqual(b.parse_ordinals('50'),[50]) # Development ordinal, not terminal set.

    def test_reject_invalid_inputs(self):
        for s in ['', '13,23,31,35','13,13','4','1','51','0','013','13,','13;echo x','13\n23','13,$(x)']:
            with self.subTest(s=s), self.assertRaises(ValueError): b.parse_ordinals(s)

    def test_all_37_baseline_completions_rejected(self):
        for n in set(range(1,51))-b.ALLOWED:
            with self.assertRaises(ValueError): b.parse_ordinals(str(n))

    def test_valid_retry_evidence(self):
        b.check_available([13],inventory(),[[]])

    def test_closed_and_unknown_artifacts_block_even_when_expired(self):
        for suffix in ['completed','no-retry-observed','unknown']:
            for expired in [False,True]:
                with self.subTest(suffix=suffix,expired=expired),self.assertRaises(ValueError):
                    b.check_available([13],inventory(suffix=suffix,expired=expired),[[]])

    def test_expired_or_missing_retry_history_blocks(self):
        for pages in [inventory(expired=True),[dict(total_count=0,artifacts=[])]]:
            with self.assertRaises(ValueError): b.check_available([13],pages,[[]])

    def test_permanent_lock_blocks_after_artifacts_disappear(self):
        with self.assertRaises(ValueError):
            b.check_available([13],inventory(),[[dict(ref='refs/tags/'+b.LOCK_PREFIX+'13')]])

    def test_pagination_fail_closed(self):
        pages=inventory(); pages[0]['total_count']=2
        with self.assertRaises(ValueError): b.check_available([13],pages,[[]])
        pages=inventory(); pages.append(pages[0])
        with self.assertRaises(ValueError): b.check_available([13],pages,[[]])

    def test_rerun_wrong_branch_event_and_repository_block(self):
        for k,v in [('GITHUB_RUN_ATTEMPT','2'),('GITHUB_REF','refs/heads/main'),('GITHUB_EVENT_NAME','push'),('GITHUB_REPOSITORY','other/repo')]:
            with patch.dict(os.environ,{k:v}),self.assertRaises(ValueError): b.context()

    def status(self, completed=True):
        return dict(ordinal=13,schema='trackcade-semantic-external-stage1-v3-provider-case-v1',
            providerContract=b.CONTRACT,harnessSourceCommit='a'*40,githubRunId='123',githubRunAttempt=1,
            providerCompletedSemanticResponse=completed,retryAuthorized=not completed,
            openaiResponseId='resp_test',classification=b.VALID,errors=[])

    def test_validated_completion_continues(self):
        self.assertEqual(b.classify(self.status(),dict(object='response',status='completed',model='gpt-6-sol',id='resp_test'),13),('completed',True))

    def test_429_and_incomplete_stop(self):
        for raw in [None,dict(error=dict(code='insufficient_quota')),dict(object='response',status='incomplete')]:
            self.assertEqual(b.classify(self.status(False),raw,13),('retry-eligible',False))

    def test_completed_invalid_is_closed_and_stops(self):
        status=self.status(); status['classification']='provider_completed_v3_proposal_validation_failure_no_retry'
        self.assertEqual(b.classify(status,dict(object='response',status='completed',model='gpt-6-sol',id='resp_test'),13),('completed',False))

    def test_contract_drift_and_raw_mismatch_block(self):
        status=self.status(); status['providerContract']={**b.CONTRACT,'model':'other'}
        with self.assertRaises(ValueError): b.classify(status,None,13)
        with self.assertRaises(ValueError): b.classify(self.status(),None,13)

    def test_atomic_claim_failure_blocks(self):
        with patch.object(b,'api',side_effect=[dict(sha='b'*40),RuntimeError('422 ref exists')]) as api:
            with self.assertRaises(RuntimeError): b.claim(13)
            self.assertEqual(api.call_args_list[-1].args[0],'git/refs')

    def prepare(self,values=[13,23,31]):
        b.write_json(b.audit_root()/'plan.json',dict(ordinals=values,source='a'*40,runId='123'))
        prep=self.root/'v3-prep'; prep.mkdir()
        raw=b'{}'; (prep/'STAGE1_V3_PREP_MANIFEST_V1.json').write_bytes(raw)
        return hashlib.sha256(raw).hexdigest()

    def test_429_only_first_song_called_and_next_refused(self):
        sha=self.prepare()
        def fake_run(cmd,**kwargs):
            self.assertIn('--ordinal',cmd); self.assertEqual(cmd[cmd.index('--ordinal')+1],'13')
            out=Path(cmd[cmd.index('--output-dir')+1])
            b.write_json(out/'stage1-v3-case-status-v1.json',self.status(False))
            return type('Result',(),dict(returncode=75))()
        with patch.object(b,'PREP_SHA',sha),patch.object(b,'live_guard'),patch.object(b,'claim') as claim,patch.object(b.subprocess,'run',side_effect=fake_run) as run:
            b.execute('13,23,31',1)
            with self.assertRaises(ValueError): b.execute('13,23,31',2)
            self.assertEqual(run.call_count,1); claim.assert_called_once_with(13)
        self.assertFalse(json.loads((b.audit_root()/'result-13.json').read_text())['continue'])

    def test_timeout_keeps_lock_and_stops(self):
        sha=self.prepare()
        with patch.object(b,'PREP_SHA',sha),patch.object(b,'live_guard'),patch.object(b,'claim') as claim,patch.object(b.subprocess,'run',side_effect=TimeoutError('timeout')):
            b.execute('13,23,31',1)
            with self.assertRaises(ValueError): b.execute('13,23,31',2)
            claim.assert_called_once_with(13)
        self.assertIn('continue=false',(self.root/'outputs').read_text())

    def test_no_provider_on_claim_collision(self):
        sha=self.prepare()
        with patch.object(b,'PREP_SHA',sha),patch.object(b,'live_guard'),patch.object(b,'claim',side_effect=ValueError('claimed')):
            with self.assertRaises(ValueError): b.execute('13,23,31',1)
            b.subprocess.run.assert_not_called()

    def successful_batch(self, fail_second=False, corrupt_payload=False):
        self.prepare()
        payload=b'frozen-test-payload'
        manifest=dict(tracks=[dict(ordinal=n,hashes=dict(openaiPayloadV3Sha256=hashlib.sha256(payload).hexdigest())) for n in [13,23,31]])
        prep=self.root/'v3-prep'/'STAGE1_V3_PREP_MANIFEST_V1.json'
        b.write_json(prep,manifest)
        sha=hashlib.sha256(prep.read_bytes()).hexdigest()
        called=[]
        def fake_run(cmd,**kwargs):
            n=int(cmd[cmd.index('--ordinal')+1]); called.append(n)
            out=Path(cmd[cmd.index('--output-dir')+1])
            status=self.status(not(fail_second and n==23)); status['ordinal']=n
            if status['providerCompletedSemanticResponse']:
                raw=dict(object='response',status='completed',model='gpt-6-sol',id='resp_test')
                b.write_json(out/'raw-response.json',raw)
                status['rawResponseSha256']=hashlib.sha256((out/'raw-response.json').read_bytes()).hexdigest()
                for f in ['openai-payload-v3.json','preflight-openai-payload-v3.json']:
                    (out/f).write_bytes(b'corrupt' if corrupt_payload else payload)
            b.write_json(out/'stage1-v3-case-status-v1.json',status)
            return type('Result',(),dict(returncode=0 if status['providerCompletedSemanticResponse'] else 75))()
        with patch.object(b,'PREP_SHA',sha),patch.object(b,'live_guard'),patch.object(b,'claim'),patch.object(b.subprocess,'run',side_effect=fake_run):
            b.execute('13,23,31',1)
            if corrupt_payload:
                with self.assertRaises(ValueError): b.execute('13,23,31',2)
            else:
                b.execute('13,23,31',2)
                if fail_second:
                    with self.assertRaises(ValueError): b.execute('13,23,31',3)
                else: b.execute('13,23,31',3)
        return called

    def test_three_successes_run_in_requested_order(self):
        self.assertEqual(self.successful_batch(),[13,23,31])

    def test_second_failure_preserves_first_and_skips_third(self):
        self.assertEqual(self.successful_batch(fail_second=True),[13,23])
        self.assertTrue(json.loads((b.audit_root()/'result-13.json').read_text())['continue'])

    def test_corrupt_payload_closes_completed_song_and_stops(self):
        self.assertEqual(self.successful_batch(corrupt_payload=True),[13])
        result=json.loads((b.audit_root()/'result-13.json').read_text())
        self.assertFalse(result['continue']); self.assertEqual(result['category'],'completed')


if __name__=='__main__': unittest.main()
