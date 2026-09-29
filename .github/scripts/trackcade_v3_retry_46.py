"""One evidence-bound V3 retry. No provider client and no automatic retry loop."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile

import trackcade_v3_batch as b

ORDINAL = 46
TICKET = 'ordinal-46-evidence-11030495842-v1'
EVIDENCE_ID = 11030495842
EVIDENCE_SHA = '0c5275d74e0be07504cab7781a6daa0c0fafc1243967cb12b254842cd9d09da7'
PRIOR_RUN = 36561301273
PRIOR_SOURCE = '5a78e69fc6a69346bc699ab233d666f2c1d658b3'
ORIGINAL_TAG_SHA = '37af0c79f341c6272c0cb458041579801a1ac431'
ORIGINAL_REF = 'refs/tags/' + b.LOCK_PREFIX + str(ORDINAL)
RETRY_PREFIX = 'trackcade-v3-retry-ordinal-46-'
RETRY_TAG = 'trackcade-v3-retry-' + TICKET
RETRY_REF = 'refs/tags/' + RETRY_TAG
STATUS_FILE = 'stage1-v3-case-status-v1.json'
ANALYZER_SHA = 'e308d867980fb1877c3f2e4ce27950deecac0855'
RUNNER_SHA = '9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432'


def require(ok, message):
    if not ok:
        raise ValueError('V3 RETRY REFUSED: ' + message)


def root():
    p = Path(os.environ['RUNNER_TEMP']) / 'retry-46-audit'
    p.mkdir(parents=True, exist_ok=True)
    return p


def inputs(ordinal, ticket):
    require(ordinal == str(ORDINAL) and ticket == TICKET, 'no authorization for these inputs')
    b.context()


def check_inventory(pages, refs, original, run):
    require(isinstance(pages, list) and pages, 'artifact inventory absent')
    artifacts = [a for page in pages for a in page['artifacts']]
    require(all(p['total_count'] == len(artifacts) for p in pages), 'incomplete or changing inventory')
    require(len({a['id'] for a in artifacts}) == len(artifacts), 'duplicate inventory IDs')
    matches = [a for a in artifacts if a['name'].startswith(b.PREFIX + '46-')]
    require(all(a['name'] == b.PREFIX + '46-retry-eligible' for a in matches),
            'completed, no-retry or unknown evidence exists (including expired artifacts)')
    selected = [a for a in matches if a['id'] == EVIDENCE_ID]
    require(len(selected) == 1, 'authorized evidence missing')
    evidence = selected[0]
    require(evidence['expired'] is False and evidence['digest'] == 'sha256:' + EVIDENCE_SHA,
            'authorized evidence expired or changed')
    require(evidence['workflow_run']['id'] == PRIOR_RUN and
            evidence['workflow_run']['head_sha'] == PRIOR_SOURCE, 'evidence origin changed')
    require(all(a['created_at'] <= evidence['created_at'] and a['id'] <= EVIDENCE_ID for a in matches),
            'newer evidence exists; authorization is stale')
    flat_refs = [r for page in refs for r in page]
    locks = [r for r in flat_refs if r['ref'] == ORIGINAL_REF]
    require(len(locks) == 1 and locks[0]['object']['type'] == 'tag' and
            locks[0]['object']['sha'] == ORIGINAL_TAG_SHA, 'original permanent lock missing or changed')
    require(not any(r['ref'].startswith('refs/tags/' + RETRY_PREFIX) for r in flat_refs),
            'a retry reservation already exists; never reuse a consumed authorization')
    require(original['sha'] == ORIGINAL_TAG_SHA and original['object']['sha'] == PRIOR_SOURCE and
            original['object']['type'] == 'commit', 'original tag target mismatch')
    record = json.loads(original['message'])
    require(record == dict(ordinal=ORDINAL, source=PRIOR_SOURCE, runId=str(PRIOR_RUN), runAttempt=1,
                           providerContract=b.CONTRACT, state='reserved-before-provider-call',
                           permanent=True, automaticUnlockPermitted=False), 'original lock provenance mismatch')
    require(run['id'] == PRIOR_RUN and run['head_sha'] == PRIOR_SOURCE and
            run['head_branch'] == b.BRANCH and run['event'] == 'workflow_dispatch' and
            run['run_attempt'] == 1 and run['status'] == 'completed' and run['conclusion'] == 'failure',
            'prior run identity or outcome mismatch')
    return evidence


def live_guard(label):
    b.context()
    branch = b.api('branches/' + b.BRANCH)
    require(branch['commit']['sha'] == os.environ['GITHUB_SHA'], 'branch moved')
    pages = b.api('actions/artifacts?per_page=100', paginate=True)
    refs = b.api('git/matching-refs/tags/trackcade-v3?per_page=100', paginate=True)
    original = b.api('git/tags/' + ORIGINAL_TAG_SHA)
    run = b.api('actions/runs/' + str(PRIOR_RUN))
    b.write_json(root() / (label + '-inventory.json'),
                 dict(branch=branch, artifacts=pages, refs=refs, original=original, priorRun=run))
    return check_inventory(pages, refs, original, run)


def verify_evidence(data, prep):
    require(hashlib.sha256(data).hexdigest() == EVIDENCE_SHA, 'evidence ZIP digest mismatch')
    manifest_bytes = (prep / 'STAGE1_V3_PREP_MANIFEST_V1.json').read_bytes()
    require(hashlib.sha256(manifest_bytes).hexdigest() == b.PREP_SHA, 'prep manifest changed')
    rows = [r for r in json.loads(manifest_bytes)['tracks'] if r['ordinal'] == ORDINAL]
    require(len(rows) == 1, 'prep ordinal not unique')
    row = rows[0]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        require(len(names) == len(set(names)), 'duplicate ZIP members')
        require(not any(Path(n).name in ('normalized-proposal.json', 'proposal-candidate.json',
                    'provider-run-manifest.json') for n in names), 'semantic proposal already exists')
        # Read only named members; never extract or execute archive contents.
        status = json.loads(z.read(STATUS_FILE))
        raw_bytes = z.read('raw-response.json')
        raw = json.loads(raw_bytes)
        require(status.get('schema') == 'trackcade-semantic-external-stage1-v3-provider-case-v1' and
                status.get('ordinal') == ORDINAL and status.get('githubRunId') == str(PRIOR_RUN) and
                status.get('githubRunAttempt') == 1 and status.get('harnessSourceCommit') == PRIOR_SOURCE and
                status.get('prepArtifactId') == '10986506165', 'status provenance mismatch')
        require(status.get('classification') == 'provider_infrastructure_no_completed_response' and
                status.get('retryAuthorized') is True and status.get('providerCompletedSemanticResponse') is False and
                status.get('providerCallAttempted') is True and status.get('providerResponseObserved') is True,
                'preserved status does not authorize this retry')
        require(status.get('providerContract') == b.CONTRACT and status.get('compilerInvoked') is False and
                status.get('analyzerSourceCommit') == ANALYZER_SHA and status.get('analyzerRunnerSha256') == RUNNER_SHA,
                'frozen contract or Analyzer mismatch')
        require(raw.get('object') == 'response' and raw.get('status') == 'incomplete' and
                raw.get('model') == 'gpt-6-sol' and bool(raw.get('id')) and
                status.get('observedProviderStatus') == 'incomplete' and
                status.get('observedProviderResponseId') == raw['id'], 'raw response is not the authorized incomplete response')
        require(hashlib.sha256(raw_bytes).hexdigest() == status.get('rawResponseSha256'), 'raw hash mismatch')
        expected = row['hashes']['openaiPayloadV3Sha256']
        for name in ('openai-payload-v3.json', 'preflight-openai-payload-v3.json'):
            require(hashlib.sha256(z.read(name)).hexdigest() == expected, 'prior payload differs from frozen prep')
        require(all(status.get(k) == expected for k in ('frozenPayloadSha256', 'preflightPayloadSha256', 'livePayloadSha256')),
                'status payload hashes mismatch')
        return dict(status=status, files={n: hashlib.sha256(z.read(n)).hexdigest() for n in names if not n.endswith('/')})


def prepare():
    evidence = live_guard('prepare')
    dest = root() / 'prior-evidence.zip'
    with dest.open('xb') as f:
        subprocess.run(['gh', 'api', 'repos/' + b.REPO + '/actions/artifacts/' + str(EVIDENCE_ID) + '/zip'],
                       stdout=f, check=True)
    checked = verify_evidence(dest.read_bytes(), Path(os.environ['RUNNER_TEMP']) / 'v3-prep')
    b.write_json(root() / 'authorization.json', dict(ticket=TICKET, ordinal=ORDINAL,
        evidence=evidence, verified=checked, originalLock=ORIGINAL_REF, originalTagSha=ORIGINAL_TAG_SHA,
        retryLock=RETRY_REF, source=os.environ['GITHUB_SHA'], runId=os.environ['GITHUB_RUN_ID'], runAttempt=1,
        providerContract=b.CONTRACT))


def claim():
    record = dict(ticket=TICKET, ordinal=ORDINAL, priorArtifactId=EVIDENCE_ID, priorArtifactSha256=EVIDENCE_SHA,
                  originalLock=ORIGINAL_REF, originalTagSha=ORIGINAL_TAG_SHA,
                  source=os.environ['GITHUB_SHA'], runId=os.environ['GITHUB_RUN_ID'], runAttempt=1,
                  providerContract=b.CONTRACT, state='reserved-before-provider-call',
                  permanent=True, automaticUnlockPermitted=False)
    tag = b.api('git/tags', dict(tag=RETRY_TAG, message=json.dumps(record, sort_keys=True),
                               object=os.environ['GITHUB_SHA'], type='commit'))
    # Create only. A duplicate dispatch fails atomically here; never update/delete either lock.
    ref = b.api('git/refs', dict(ref=RETRY_REF, sha=tag['sha']))
    require(ref['ref'] == RETRY_REF and ref['object']['sha'] == tag['sha'], 'retry lock creation not confirmed')
    b.write_json(root() / 'retry-claim.json', dict(record=record, tag=tag, ref=ref))


def execute():
    saved = json.loads((root() / 'authorization.json').read_bytes())
    require(saved['ticket'] == TICKET and saved['source'] == os.environ['GITHUB_SHA'] and
            saved['runId'] == os.environ['GITHUB_RUN_ID'], 'prepared authorization changed')
    prep = Path(os.environ['RUNNER_TEMP']) / 'v3-prep'
    verify_evidence((root() / 'prior-evidence.zip').read_bytes(), prep)
    live_guard('before-call')
    require(bool(os.environ.get('OPENAI_API_KEY')), 'provider key unavailable')
    out = Path(os.environ['RUNNER_TEMP']) / 'retry-case-46'
    out.mkdir(exist_ok=False)
    claim()
    category, success = 'no-retry-observed', False
    record = dict(ticket=TICKET, ordinal=ORDINAL, originalLock=ORIGINAL_REF, retryLock=RETRY_REF,
                  priorArtifactId=EVIDENCE_ID, source=os.environ['GITHUB_SHA'], runId=os.environ['GITHUB_RUN_ID'])
    # Establish an artifact destination before starting the frozen single-call harness.
    b.write_json(out / 'retry-provenance.json', record)
    b.output('artifact_name', b.PREFIX + '46-no-retry-observed')
    try:
        rc = subprocess.run([sys.executable, b.BASE + '/run_stage1_v3_provider_case_v1.py',
            '--prep-root', str(prep), '--ordinal', '46', '--output-dir', str(out),
            '--adapter', b.LEARNED + '/openai_responses_adapter_v3.py',
            '--ingester', b.LEARNED + '/ingest_provider_response_v3.py',
            '--harness-source-commit', os.environ['GITHUB_SHA'], '--prep-artifact-id', '10986506165'],
            check=False, timeout=660).returncode
        status = json.loads((out / STATUS_FILE).read_bytes())
        raw_path = out / 'raw-response.json'
        raw = json.loads(raw_path.read_bytes()) if raw_path.exists() else None
        category, success = b.classify(status, raw, ORDINAL)
        if raw_path.exists():
            require(hashlib.sha256(raw_path.read_bytes()).hexdigest() == status['rawResponseSha256'], 'new raw hash mismatch')
        success = success and rc == 0
        record.update(returnCode=rc, status=status)
    except Exception as exc:
        # Unknown outcomes stay closed by both locks, including timeout or parse failure.
        success = False
        record['error'] = str(exc)
    record.update(category=category, success=success,
                  files={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file()})
    b.write_json(root() / 'retry-result.json', record)
    b.output('artifact_name', b.PREFIX + '46-' + category)
    b.output('success', 'true' if success else 'false')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('mode', choices=['prepare', 'execute'])
    p.add_argument('--ordinal', required=True)
    p.add_argument('--authorization', required=True)
    args = p.parse_args()
    inputs(args.ordinal, args.authorization)
    (prepare if args.mode == 'prepare' else execute)()


if __name__ == '__main__':
    main()
