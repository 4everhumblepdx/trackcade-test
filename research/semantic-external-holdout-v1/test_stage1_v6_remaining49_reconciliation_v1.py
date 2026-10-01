"""Synthetic, label-blind checks. No provider, compiler, Analyzer or scorer runs."""
import ast
from copy import deepcopy
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

import run_stage1_v6_remaining49_case_v1 as runner
import collect_stage1_v6_results_v1 as collector
import test_stage1_v6_contract as fixtures

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WORKFLOW = ROOT / '.github/workflows/trackcade-semantic-external-stage1-v6-remaining49-v1.yml'
FREEZE_WORKFLOW = ROOT / '.github/workflows/trackcade-semantic-external-stage1-v6-generation-freeze-v1.yml'
AUTH = HERE / 'STAGE1_V6_REMAINING49_PROVIDER_AUTHORIZATION_V1.json'
ACT = HERE / 'STAGE1_V6_REMAINING49_PROVIDER_ACTIVATION_TEMPLATE_V1.json'


def encoded(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode()


def manifest(files):
    files['FILES_SHA256.txt'] = ('\n'.join(f'{collector.digest(v)}  {k}' for k, v in sorted(files.items()) if k != 'FILES_SHA256.txt') + '\n').encode()


def case_fixture(root, ordinal=2, response_id='synthetic-response'):
    source, flex = root / 'source', root / 'flex'
    srow = {'ordinal': ordinal, 'id': f'id-{ordinal}', 'stem': f'fixture-{ordinal}'}
    sc = source / 'cases' / f'{ordinal:02d}-{srow["stem"]}'
    fc = flex / 'cases' / f'{ordinal:02d}-{srow["stem"]}'
    sc.mkdir(parents=True); fc.mkdir(parents=True)
    packet = fixtures.packet()
    source_payload = {'model': 'gpt-6-sol', 'reasoning': {'effort': 'high'}, 'max_output_tokens': 8192, 'store': False}
    paths = {'request': sc / 'learned-request-v6.json', 'packet': sc / 'structure-evidence-v2.json',
             'sourcePayload': sc / 'openai-payload-v6.json', 'flexPayload': fc / 'openai-payload-v6-flex8192.json'}
    for key, value in {'request': {}, 'packet': packet, 'sourcePayload': source_payload,
                       'flexPayload': {**source_payload, 'service_tier': 'flex'}}.items():
        paths[key].write_bytes(encoded(value))
    frow = {'semanticProjectionSha256': 'a' * 64}
    out = root / f'out-{ordinal}'
    status, _ = runner.prepare_output(out, ordinal, srow, frow, paths, 'b' * 40)
    norm, errors = fixtures.validator.validate_and_normalize(packet, fixtures.proposal(events=[fixtures.event(), fixtures.event(index=2, kind='energy')]))
    assert not errors, errors
    usage = {'input_tokens': 10, 'output_tokens': 5, 'total_tokens': 15}
    raw = {'object': 'response', 'status': 'completed', 'model': 'gpt-6-sol', 'service_tier': 'flex', 'id': response_id, 'usage': usage}
    spec = collector.CANARY if ordinal == 1 else collector.REMAINING
    status.update(schema=spec['statusSchema'], classification=spec['classification'],
        providerCallAttempted=True, providerResponseObserved=True, providerCompletedSemanticResponse=True,
        proposalValidated=True, observedProviderStatus='completed', observedProviderServiceTier='flex',
        observedProviderModel='gpt-6-sol', observedProviderResponseId=response_id, usage=usage, validatorExitCode=0)
    files = {p.name: p.read_bytes() for p in out.iterdir()}
    files.pop('stage1-v6-remaining49-case-status-v1.json')
    files.update({'raw-response.json': encoded(raw), 'proposal-candidate.json': encoded(fixtures.proposal()),
        'normalized-proposal.json': encoded(norm), 'validator-stdout.txt': b'', 'validator-stderr.txt': b'',
        'provider-step-exit-code.txt': b'0\n', 'validation-report.json': encoded({
            'schema': 'trackcade-learned-proposal-validation-v6', 'status': 'valid', 'errors': [],
            'confidenceFieldsDiagnosticOnly': True, 'trackSummaryDerivedNotGate': True,
            'repeatedSimilarDropsAllowed': True, 'decisiveImpactRequiredForDrop': True,
            'ordinaryReturnMustBeRuledOutForDrop': True, 'analyzerDescriptorsNotSemanticGates': True,
            'timingAuthority': 'frozen-analyzer-derived-anchor-only'})})
    for filename, field in [('raw-response.json', 'rawResponseSha256'), ('proposal-candidate.json', 'proposalCandidateSha256'), ('normalized-proposal.json', 'normalizedProposalSha256')]:
        status[field] = collector.digest(files[filename])
    files[spec['statusFile']] = encoded(status)
    manifest(files)
    run = {'id': 36758887107 if ordinal == 1 else 1, 'head_sha': 'b' * 40, 'head_branch': collector.BRANCH, 'run_attempt': 1, 'status': 'completed', 'conclusion': 'success'}
    return source, flex, srow, frow, files, run


class ExecutionTests(unittest.TestCase):
    def receipts(self):
        auth, act = runner.load(AUTH), runner.load(ACT)
        auth.update(authorized=True, status='authorized-explicit-paid-remaining49')
        act.update(activatePaidRemaining49=True, templateOnly=False)
        return auth, act

    def environment(self):
        return {'GITHUB_REF': runner.BRANCH, 'GITHUB_EVENT_NAME': 'push', 'GITHUB_RUN_ATTEMPT': '1',
                'GITHUB_RUN_ID': '1', 'GITHUB_SHA': 'b' * 40}

    def test_inactive_receipts_and_templates_refuse(self):
        auth, act = self.receipts()
        with patch.dict(os.environ, self.environment(), clear=True):
            with self.assertRaises(ValueError): runner.execution_gate(runner.load(AUTH), act, 2, 'b' * 40)
            with self.assertRaises(ValueError): runner.execution_gate(auth, runner.load(ACT), 2, 'b' * 40)
            auth['templateOnly'] = True
            with self.assertRaises(ValueError): runner.execution_gate(auth, act, 2, 'b' * 40)

    def test_authorized_exact_receipts_and_boundaries(self):
        auth, act = self.receipts()
        with patch.dict(os.environ, self.environment(), clear=True):
            runner.execution_gate(auth, act, 2, 'b' * 40)
            for ordinal in (1, 51, True):
                with self.assertRaises(ValueError): runner.execution_gate(auth, act, ordinal, 'b' * 40)
            for key in auth['researchBoundary']:
                if auth['researchBoundary'][key] is False:
                    changed = deepcopy(auth); changed['researchBoundary'][key] = True
                    with self.assertRaises(ValueError): runner.execution_gate(changed, act, 2, 'b' * 40)
            for key in ('GITHUB_RUN_ATTEMPT', 'GITHUB_REF', 'GITHUB_SHA', 'GITHUB_EVENT_NAME'):
                with patch.dict(os.environ, {key: 'wrong'}):
                    with self.assertRaises(ValueError): runner.execution_gate(auth, act, 2, 'b' * 40)

    def test_uploaded_lock_binding(self):
        lock = {'schema': runner.LOCK_SCHEMA, 'ordinal': 2, 'harnessSourceCommit': 'b'*40,
                'runId': '1', 'runAttempt': 1, 'reservationIsSpendAuthorization': False}
        art = {'id': 9, 'name': 'trackcade-semantic-external-stage1-v6-remaining49-v1-case-02-attempt-lock',
               'expired': False, 'digest': 'sha256:'+'a'*64, 'workflow_run': {'id': 1, 'head_sha': 'b'*40}}
        with patch.dict(os.environ, {**self.environment(), 'LOCK_ARTIFACT_ID': '9'}, clear=True):
            runner.verify_uploaded_lock(lock, art, 2, 'b'*40)
            for key, value in [('id', 10), ('expired', True), ('name', 'wrong'), ('digest', None)]:
                changed = deepcopy(art); changed[key] = value
                with self.assertRaises(ValueError): runner.verify_uploaded_lock(lock, changed, 2, 'b'*40)
            changed = deepcopy(art); changed['workflow_run']['id'] = 2
            with self.assertRaises(ValueError): runner.verify_uploaded_lock(lock, changed, 2, 'b'*40)

    def test_http_and_transport_failures_make_one_mock_attempt_without_validator(self):
        for exc in (urllib.error.URLError('synthetic failure'), urllib.error.HTTPError('synthetic', 429, 'synthetic', {}, io.BytesIO(b'{}'))):
            with tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp); (out/'openai-payload-v6-flex8192.json').write_bytes(b'{}')
                status = {'errors': []}; path = out/'status.json'
                with patch.dict(os.environ, {'OPENAI_API_KEY': 'synthetic-never-transmitted'}, clear=True), patch.object(runner.urllib.request, 'urlopen', side_effect=exc) as network, patch.object(runner.subprocess, 'run', side_effect=AssertionError('validator must not run')):
                    runner.one_provider_attempt(out, status, path, Path('unused'))
                self.assertEqual(network.call_count, 1)
                self.assertTrue(status['providerCallAttempted'])
                self.assertIn('failure', status['classification'])

    def test_incomplete_and_wrong_model_stop_without_validator(self):
        for response in ({'status': 'incomplete'}, {'status': 'completed', 'service_tier': 'standard'}, {'status': 'completed', 'service_tier': 'flex', 'model': 'wrong'}):
            class Reply:
                status = 200
                headers = {}
                def __enter__(self): return self
                def __exit__(self, *args): pass
                def read(self): return encoded(response)
            with tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp); (out/'openai-payload-v6-flex8192.json').write_bytes(b'{}')
                status = {'errors': []}
                with patch.dict(os.environ, {'OPENAI_API_KEY': 'synthetic-never-transmitted'}, clear=True), patch.object(runner.urllib.request, 'urlopen', return_value=Reply()) as network, patch.object(runner.subprocess, 'run', side_effect=AssertionError('validator must not run')):
                    runner.one_provider_attempt(out, status, out/'status.json', Path('unused'))
                self.assertEqual(network.call_count, 1)
                self.assertNotEqual(status['classification'], runner.SUCCESS_CLASSIFICATION)


class CollectorTests(unittest.TestCase):
    def test_drop_anchor_objects_and_non_drop_events_are_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, flex, srow, frow, files, run = case_fixture(Path(tmp))
            entry, proposal = collector.inspect_case(files, {}, run, srow, frow, source, flex)
            self.assertEqual(entry['dropCount'], 1)
            self.assertEqual(entry['eventCount'], 2)
            self.assertEqual(json.loads(proposal)['events'][1]['kind'], 'energy')
            out = Path(tmp)/'out-2'
            for name, value in files.items(): (out/name).write_bytes(value)
            runner.check_completed(out, 2, 'b'*40)

    def test_changed_embedded_evidence_rejected_even_with_consistent_internal_hashes(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, flex, srow, frow, files, run = case_fixture(Path(tmp))
            files['learned-request-v6.json'] = b'{} changed'; manifest(files)
            with self.assertRaisesRegex(ValueError, 'embedded frozen request'):
                collector.inspect_case(files, {}, run, srow, frow, source, flex)

    def test_failed_case_and_mismatched_drop_anchor_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, flex, srow, frow, files, run = case_fixture(Path(tmp))
            changed = deepcopy(files)
            status = json.loads(changed[collector.REMAINING['statusFile']]); status['proposalValidated'] = False
            changed[collector.REMAINING['statusFile']] = encoded(status); manifest(changed)
            with self.assertRaisesRegex(ValueError, 'proposalValidated'):
                collector.inspect_case(changed, {}, run, srow, frow, source, flex)
            proposal = json.loads(files['normalized-proposal.json']); proposal['events'][0]['anchor']['index'] = 3
            files['normalized-proposal.json'] = encoded(proposal)
            status = json.loads(files[collector.REMAINING['statusFile']]); status['normalizedProposalSha256'] = collector.digest(files['normalized-proposal.json'])
            files[collector.REMAINING['statusFile']] = encoded(status); manifest(files)
            with self.assertRaisesRegex(ValueError, 'anchor equality'):
                collector.inspect_case(files, {}, run, srow, frow, source, flex)

    def test_partial_inventory_never_writes_freeze(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with patch.object(collector, 'prep_rows', return_value=({}, {})), self.assertRaisesRegex(ValueError, 'case count'):
                collector.collect(root, root, root, {'schema': collector.INVENTORY_SCHEMA, 'cases': []}, root/'freeze')
            self.assertFalse((root/'freeze').exists())

    def test_complete_synthetic_50_freeze_and_missing_lock_or_duplicate_response_refusal(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); srows = {}; frows = {}; rows = []; canary_files = None
            for ordinal in range(1, 51):
                source, flex, srow, frow, files, run = case_fixture(root, ordinal, f'synthetic-{ordinal}')
                srows[ordinal] = srow; frows[ordinal] = frow
                aid = 11116764479 if ordinal == 1 else 1000+ordinal
                archive = root / f'{aid}.zip'
                with zipfile.ZipFile(archive, 'w') as z:
                    for name, value in files.items(): z.writestr(name, value)
                artifact = {'id': aid, 'name': f'trackcade-semantic-external-stage1-v6-remaining49-v1-case-{ordinal:02d}-completed-valid',
                    'digest': 'sha256:'+collector.sha(archive), 'size_in_bytes': archive.stat().st_size,
                    'expired': False, 'workflow_run': {'id': run['id'], 'head_sha': run['head_sha']}}
                row = {'ordinal': ordinal, 'run': run, 'artifact': artifact}
                if ordinal == 1:
                    canary_files = files
                    artifact.update(name='trackcade-semantic-external-stage1-v6-canary-v1-case-01-completed-valid',
                        digest='sha256:18a1200c9f77f3cc74a7844680168e8f86c7cfdd6b13cc5c9da3a014fcffaf41')
                else:
                    row['attemptLock'] = {'id': 2000+ordinal, 'name': f'trackcade-semantic-external-stage1-v6-remaining49-v1-case-{ordinal:02d}-attempt-lock',
                        'expired': False, 'digest': 'sha256:'+'a'*64, 'workflow_run': artifact['workflow_run']}
                rows.append(row)
            original_read_archive = collector.read_archive
            # Only the real canary ZIP identity is replaced by synthetic bytes.
            # All other ZIP hashes and all 50 internal/status/semantic checks run.
            def synthetic_canary_archive(path, artifact):
                return canary_files if artifact['id'] == 11116764479 else original_read_archive(path, artifact)
            inventory = {'schema': collector.INVENTORY_SCHEMA, 'cases': rows}
            with patch.object(collector, 'prep_rows', return_value=(srows, frows)), patch.object(collector, 'read_archive', side_effect=synthetic_canary_archive):
                collector.collect(source, flex, root, inventory, root/'freeze')
                frozen = runner.load(root/'freeze/STAGE1_V6_GENERATION_FREEZE_V1.json')
                self.assertEqual(frozen['trackCount'], 50)
                self.assertFalse(frozen['referenceLabelsReadByFreeze'])
                self.assertEqual(len(list((root/'freeze/proposals').glob('*.json'))), 50)
                bad = deepcopy(inventory); bad['cases'][1].pop('attemptLock')
                with self.assertRaisesRegex(ValueError, 'reservation'):
                    collector.collect(source, flex, root, bad, root/'bad-lock')
                self.assertFalse((root/'bad-lock').exists())
                bad = deepcopy(inventory); bad['cases'][2]['artifact']['id'] = bad['cases'][1]['artifact']['id']
                with self.assertRaisesRegex(ValueError, 'artifact identity'):
                    collector.collect(source, flex, root, bad, root/'bad-duplicate')
                self.assertFalse((root/'bad-duplicate').exists())
                aid = inventory['cases'][1]['artifact']['id']
                archive = root/f'{aid}.zip'
                with zipfile.ZipFile(archive) as z: changed = {n: z.read(n) for n in z.namelist()}
                raw = json.loads(changed['raw-response.json']); raw['id'] = 'synthetic-1'
                changed['raw-response.json'] = encoded(raw)
                status = json.loads(changed[collector.REMAINING['statusFile']])
                status.update(observedProviderResponseId='synthetic-1', rawResponseSha256=collector.digest(changed['raw-response.json']))
                changed[collector.REMAINING['statusFile']] = encoded(status); manifest(changed)
                with zipfile.ZipFile(archive, 'w') as z:
                    for name, value in changed.items(): z.writestr(name, value)
                bad = deepcopy(inventory)
                bad['cases'][1]['artifact'].update(digest='sha256:'+collector.sha(archive), size_in_bytes=archive.stat().st_size)
                with self.assertRaisesRegex(ValueError, 'duplicate response id'):
                    collector.collect(source, flex, root, bad, root/'bad-response')
                self.assertFalse((root/'bad-response').exists())


class WorkflowTests(unittest.TestCase):
    def test_exact_serial_order_and_single_call_implementation(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        self.assertFalse(any(line.strip() == 'matrix:' for line in text.splitlines()))
        self.assertNotIn('urlopen', text)
        self.assertNotIn('py_compile', text)
        self.assertEqual(text.count('--mode run '), 49)
        self.assertEqual(text.count('--mode prepare '), 49)
        self.assertEqual(text.count('--mode check '), 49)
        cursor = 0
        for ordinal in range(2, 51):
            pad = f'{ordinal:02d}'
            for needle in (f'Reserve ordinal {ordinal} offline', f'id: lock_{pad}', f'id: run_{pad}', f'id: result_{pad}', f'Fail closed unless ordinal {ordinal} completed'):
                cursor = text.index(needle, cursor) + len(needle)
        self.assertIn('--jq \'.total_count\'', text)
        self.assertIn('Refuse any earlier remaining49 workflow execution', text)
        self.assertIn('RESULT_UPLOAD_OUTCOME', text)
        self.assertFalse((HERE/'STAGE1_V6_REMAINING49_PROVIDER_ACTIVATE_V1.json').exists())
        self.assertFalse(runner.load(AUTH)['authorized'])

    def test_inline_python_parses_without_execution(self):
        for path in (WORKFLOW, FREEZE_WORKFLOW):
            text = path.read_text(encoding='utf-8'); lines = text.splitlines(); blocks = []
            for index, line in enumerate(lines):
                if "python - <<'PY'" in line:
                    end = next(i for i in range(index+1, len(lines)) if lines[i] == '          PY')
                    blocks.append('\n'.join(row[10:] for row in lines[index+1:end]))
            self.assertTrue(blocks)
            for block in blocks: ast.parse(block)

    def test_templates_match_consumed_receipt_fields(self):
        auth_template = runner.load(HERE/'STAGE1_V6_REMAINING49_PROVIDER_AUTHORIZATION_TEMPLATE_V1.json')
        self.assertEqual(set(runner.load(AUTH)) - set(auth_template), set())
        self.assertEqual(auth_template['schema'], runner.load(AUTH)['schema'])
        act = runner.load(ACT)
        for key in ('attemptsPerOrdinal', 'partialScoringAuthorized', 'authorizationCommit', 'executionSourceCommit', 'executionWorkflowSha256', 'runnerSha256'):
            self.assertIn(key, act)
        self.assertFalse(act['activatePaidRemaining49'])

    def test_canonical_receipt_hashes_collector_pin_and_artifact_contract_agree(self):
        receipt = runner.load(HERE/'STAGE1_V6_REMAINING49_RECONCILIATION_RECEIPT_V1.json')
        for identity in receipt['canonicalPath'].values():
            data = (ROOT/identity['path']).read_bytes().replace(b'\r\n', b'\n')
            self.assertEqual(collector.digest(data), identity['sha256OfCanonicalLfBytes'])
        self.assertIn('COLLECTOR_BLOB: '+receipt['canonicalPath']['collector']['gitBlob'], FREEZE_WORKFLOW.read_text(encoding='utf-8'))
        contract = runner.load(HERE/'STAGE1_V6_REMAINING49_ARTIFACT_CONTRACT_V1.json')
        self.assertEqual(set(contract['completedArtifactFiles']), collector.COMMON_FILES | {collector.REMAINING['statusFile']})
        self.assertNotIn('continue-on-error', WORKFLOW.read_text(encoding='utf-8'))


if __name__ == '__main__': unittest.main()
