"""V3 orchestration only. No provider client; frozen harness remains unchanged.

An atomic, never-deleted Git tag reserves each ordinal before its provider call.
Even an interrupted/failed attempt remains locked pending separate human review.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

REPO = '4everhumblepdx/trackcade-test'
BRANCH = 'trackcade-semantic-external-holdout-v1'
ALLOWED = frozenset([13, 23, 31, 35, 38, 42, 44, 45, 46, 47, 48, 49, 50])
PREFIX = 'trackcade-semantic-external-stage1-v3-sol-v1-case-'
LOCK_PREFIX = 'trackcade-v3-provider-attempt-ordinal-'
VALID = 'provider_completed_validated_v3_proposal_no_retry'
CONTRACT = dict(provider='openai', api='responses', model='gpt-6-sol',
                reasoningEffort='high', maxOutputTokens=4096, store=False)
PREP_SHA = 'df7ceff4c82291552a2d55dd7ddf872269477d0766bf4cb785a90b5730779257'
BASE = 'research/semantic-external-holdout-v1'
LEARNED = 'research/learned-interpretation-v1'


def require(ok, message):
    if not ok:
        raise ValueError('V3 BATCH REFUSED: ' + message)


def parse_ordinals(value):
    require(isinstance(value, str) and re.fullmatch(r'\s*[1-9][0-9]?(\s*,\s*[1-9][0-9]?){0,2}\s*', value),
            'provide one to three comma-separated ordinals')
    values = [int(x.strip()) for x in value.split(',')]
    require(len(set(values)) == len(values), 'duplicate ordinal input')
    require(set(values) <= ALLOWED, 'ordinal outside frozen missing set (all prior completions are closed)')
    return values


def api(path, data=None, paginate=False):
    # GitHub only; subprocess stdin carries structured JSON, never credentials.
    cmd = ['gh', 'api', 'repos/' + REPO + '/' + path]
    if paginate:
        cmd += ['--paginate', '--slurp']
    if data is not None:
        cmd += ['--method', 'POST', '--input', '-']
    result = subprocess.run(cmd, input=json.dumps(data) if data is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def context():
    require(os.environ.get('GITHUB_REPOSITORY') == REPO, 'wrong repository')
    require(os.environ.get('GITHUB_REF') == 'refs/heads/' + BRANCH, 'wrong branch')
    require(os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch', 'manual dispatch only')
    require(os.environ.get('GITHUB_RUN_ATTEMPT') == '1', 'reruns forbidden')
    require(re.fullmatch('[0-9a-f]{40}', os.environ.get('GITHUB_SHA', '')), 'invalid source SHA')
    require(os.environ.get('GITHUB_RUN_ID', '').isdigit(), 'invalid run ID')


def audit_root():
    p = Path(os.environ['RUNNER_TEMP']) / 'batch-audit'
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_json(path, value):
    path.write_text(json.dumps(value, sort_keys=True, indent=2) + '\n', encoding='utf-8')


def check_available(ordinals, pages, refs):
    require(isinstance(pages, list) and pages, 'artifact inventory absent')
    artifacts = [a for p in pages for a in p['artifacts']]
    require(len(artifacts) == pages[0]['total_count'], 'incomplete artifact pagination')
    require(len({a['id'] for a in artifacts}) == len(artifacts), 'duplicate inventory IDs')
    require(all(p['total_count'] == len(artifacts) for p in pages), 'inventory changed during pagination')
    locks = {r['ref'] for page in refs for r in page}
    for n in ordinals:
        require(n in ALLOWED, 'ordinal already closed at baseline')
        require('refs/tags/' + LOCK_PREFIX + str(n) not in locks, 'permanent attempt lock for ordinal ' + str(n))
        matching = [a for a in artifacts if a['name'].startswith(PREFIX + str(n) + '-')]
        require(not any(a['name'] != PREFIX + str(n) + '-retry-eligible' for a in matching),
                'completed, no-retry, or unknown evidence for ordinal ' + str(n))
        # Do not treat missing/deleted history as permission to retry.
        require(any(a['name'] == PREFIX + str(n) + '-retry-eligible'
                    and a['workflow_run']['id'] == 36462381190
                    and a['workflow_run']['head_sha'] == '2451c1f8f99de754331eaac52b6c6b8b3d070226'
                    and not a['expired'] for a in matching), 'prior retry evidence unavailable')
    return artifacts


def live_guard(ordinals, label):
    context()
    branch = api('branches/' + BRANCH)
    require(branch['commit']['sha'] == os.environ['GITHUB_SHA'], 'experiment branch moved')
    pages = api('actions/artifacts?per_page=100', paginate=True)
    refs = api('git/matching-refs/tags/' + LOCK_PREFIX + '?per_page=100', paginate=True)
    root = audit_root()
    write_json(root / (label + '-inventory.json'), dict(branch=branch, artifacts=pages, locks=refs))
    check_available(ordinals, pages, refs)


def output(key, value):
    require('\n' not in str(value), 'invalid workflow output')
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as f:
        f.write(str(key) + '=' + str(value) + '\n')


def plan(value):
    values = parse_ordinals(value)
    live_guard(values, 'plan')
    write_json(audit_root() / 'plan.json', dict(ordinals=values, source=os.environ['GITHUB_SHA'],
               runId=os.environ['GITHUB_RUN_ID'], runAttempt=1, providerContract=CONTRACT))
    output('count', len(values))
    for i, n in enumerate(values, 1):
        output('ordinal' + str(i), n)


def claim(n):
    record = dict(ordinal=n, source=os.environ['GITHUB_SHA'], runId=os.environ['GITHUB_RUN_ID'],
                  runAttempt=1, providerContract=CONTRACT, state='reserved-before-provider-call',
                  permanent=True, automaticUnlockPermitted=False)
    # Atomic create-ref: an existing ref returns an error. Never update/delete a lock.
    tag = api('git/tags', dict(tag=LOCK_PREFIX + str(n), message=json.dumps(record, sort_keys=True),
                             object=os.environ['GITHUB_SHA'], type='commit'))
    ref = api('git/refs', dict(ref='refs/tags/' + LOCK_PREFIX + str(n), sha=tag['sha']))
    require(ref['object']['sha'] == tag['sha'], 'lock creation not confirmed')
    write_json(audit_root() / ('claim-' + str(n) + '.json'), dict(record=record, tag=tag, ref=ref))


def classify(status, raw, n):
    require(status.get('ordinal') == n, 'status ordinal mismatch')
    require(status.get('schema') == 'trackcade-semantic-external-stage1-v3-provider-case-v1', 'status schema')
    require(status.get('providerContract') == CONTRACT, 'provider contract changed')
    require(status.get('harnessSourceCommit') == os.environ['GITHUB_SHA'], 'status source mismatch')
    require(status.get('githubRunId') == os.environ['GITHUB_RUN_ID'], 'status run mismatch')
    require(status.get('githubRunAttempt') == 1, 'status attempt mismatch')
    completed = status.get('providerCompletedSemanticResponse') is True
    raw_completed = isinstance(raw, dict) and raw.get('object') == 'response' and raw.get('status') == 'completed'
    require(completed == raw_completed, 'raw response disagrees with status')
    if completed:
        require(status.get('retryAuthorized') is False, 'completed response retry forbidden')
        require(raw.get('model') == 'gpt-6-sol', 'response model mismatch')
        require(raw.get('id') == status.get('openaiResponseId'), 'response identity mismatch')
        return 'completed', status.get('classification') == VALID and not status.get('errors')
    if status.get('retryAuthorized') is True:
        return 'retry-eligible', False
    return 'no-retry-observed', False


def execute(value, slot):
    values = parse_ordinals(value)
    require(1 <= slot <= len(values), 'invalid batch slot')
    saved = json.loads((audit_root() / 'plan.json').read_text())
    require(saved['ordinals'] == values and saved['source'] == os.environ['GITHUB_SHA']
            and saved['runId'] == os.environ['GITHUB_RUN_ID'], 'plan binding changed')
    n = values[slot - 1]
    if slot > 1:
        previous = json.loads((audit_root() / ('result-' + str(values[slot - 2]) + '.json')).read_text())
        require(previous['continue'] is True, 'prior song did not finish successfully')
    live_guard([n], 'before-' + str(n))
    prep = Path(os.environ['RUNNER_TEMP']) / 'v3-prep'
    require(hashlib.sha256((prep / 'STAGE1_V3_PREP_MANIFEST_V1.json').read_bytes()).hexdigest() == PREP_SHA,
            'frozen prep manifest changed')
    out = Path(os.environ['RUNNER_TEMP']) / ('case-' + str(n))
    out.mkdir(exist_ok=False)
    claim(n)
    category, proceed = 'no-retry-observed', False
    record = dict(ordinal=n, slot=slot, source=os.environ['GITHUB_SHA'],
                  runId=os.environ['GITHUB_RUN_ID'], permanentLock='refs/tags/' + LOCK_PREFIX + str(n))
    try:
        rc = subprocess.run([sys.executable, BASE + '/run_stage1_v3_provider_case_v1.py',
             '--prep-root', str(prep), '--ordinal', str(n), '--output-dir', str(out),
             '--adapter', LEARNED + '/openai_responses_adapter_v3.py',
             '--ingester', LEARNED + '/ingest_provider_response_v3.py',
             '--harness-source-commit', os.environ['GITHUB_SHA'], '--prep-artifact-id', '10986506165'],
             check=False, timeout=660).returncode
        status = json.loads((out / 'stage1-v3-case-status-v1.json').read_bytes())
        raw_path = out / 'raw-response.json'
        raw = json.loads(raw_path.read_bytes()) if raw_path.exists() else None
        category, proceed = classify(status, raw, n)
        if proceed:
            require(hashlib.sha256(raw_path.read_bytes()).hexdigest() == status['rawResponseSha256'], 'raw response hash')
            row = next(r for r in json.loads((prep / 'STAGE1_V3_PREP_MANIFEST_V1.json').read_bytes())['tracks'] if r['ordinal'] == n)
            expected = row['hashes']['openaiPayloadV3Sha256']
            for filename in ('openai-payload-v3.json', 'preflight-openai-payload-v3.json'):
                require(hashlib.sha256((out / filename).read_bytes()).hexdigest() == expected, 'frozen payload hash')
        proceed = proceed and rc == 0
        record.update(returnCode=rc, status=status)
    except Exception as exc:
        proceed = False
        record['error'] = str(exc)
    record['continue'] = proceed
    record['category'] = category
    record['files'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file()}
    write_json(audit_root() / ('result-' + str(n) + '.json'), record)
    output('category', category)
    output('continue', 'true' if proceed else 'false')
    output('artifact_name', PREFIX + str(n) + '-' + category)
    # The workflow uploads evidence BEFORE applying the stop gate.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['plan', 'execute'])
    parser.add_argument('--ordinals', required=True)
    parser.add_argument('--slot', type=int)
    args = parser.parse_args()
    if args.mode == 'plan':
        plan(args.ordinals)
    else:
        execute(args.ordinals, args.slot)


if __name__ == '__main__':
    main()
