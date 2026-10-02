#!/usr/bin/env python3
"""Inert V8 ordinals 5-50; one attempt, freeze-before-reconcile budget accounting."""
import argparse,json,os,sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
import run_stage1_v7_remaining49_case_v1 as base

BASE=Path(__file__).resolve().parent
ROOT=BASE.parent.parent
CONTRACT=base.load(BASE/'STAGE1_V8_REMAINING46_CONTRACT_V1.json')
MAPPING=base.load(BASE/'STAGE1_V8_REMAINING46_MAPPING_V1.json')
AUTH=BASE/'STAGE1_V8_REMAINING46_AUTHORIZATION_V1.json'
ACT=BASE/'STAGE1_V8_REMAINING46_ACTIVATE_V1.json'
NAMESPACE='trackcade-stage1-v8-remaining46-v1'
SUCCESS_CLASSIFICATION='provider_completed_validated_v8_flex25000_remaining46_no_retry'
WORK=Path(os.environ.get('V8_CONT_WORK','/tmp/v8-continuation'))
SOURCE=Path(os.environ.get('V8_SOURCE_PREP','/tmp/v8-source-prep'))
FLEX=Path(os.environ.get('V8_FLEX_PREP','/tmp/v8-flex-prep'))
RESERVATION=Decimal('0.225')
ACCOUNTING='reserve-then-reconcile-v2'
sha_bytes,sha,load,now,save_json=base.sha_bytes,base.sha,base.load,base.now,base.save_json
urllib,uuid,subprocess=base.urllib,base.uuid,base.subprocess

def decimal_usd(value):
    if type(value) is not str:raise ValueError('USD amount must be an exact decimal string')
    try:d=Decimal(value)
    except InvalidOperation:raise ValueError('invalid decimal USD')
    if not d.is_finite() or d<0:raise ValueError('invalid or negative USD')
    return d

def ordinal(value):
    if type(value) is not int or value not in range(5,51):raise ValueError('only ordinals 5â€“50 permitted')
    return value

def gate(auth,act):
    expected={'ordinals':list(range(5,51)),'maximumInitialProviderAttempts':46,'retries':0,'ordinals1Through4Authorized':False,'providerContract':CONTRACT['providerContract'],'budgetAccounting':ACCOUNTING}
    base.exact(auth,{'schema':'trackcade-stage1-v8-remaining46-authorization-v1','authorized':True,**expected})
    base.exact(act,{'schema':'trackcade-stage1-v8-remaining46-activation-v1','activate':True,**expected})
    if auth.get('templateOnly') or act.get('templateOnly'):raise ValueError('templates cannot execute')
    budget=decimal_usd(auth.get('estimatedSpendCeilingUsd'))
    if budget<=0 or act.get('estimatedSpendCeilingUsd')!=auth['estimatedSpendCeilingUsd']:raise ValueError('budget approval missing or inconsistent')
    if os.environ.get('GITHUB_REF')!=base.BRANCH or os.environ.get('GITHUB_EVENT_NAME')!='push' or os.environ.get('GITHUB_RUN_ATTEMPT')!='1' or not os.environ.get('GITHUB_RUN_ID') or not os.environ.get('GITHUB_SHA'):
        raise ValueError('only canonical first activation push may execute')
    return budget

def frozen_case(n):
    ordinal(n)
    if base.sha(BASE/'STAGE1_V8_REMAINING46_MAPPING_V1.json')!=CONTRACT['mappingSha256']:raise ValueError('mapping identity changed')
    if CONTRACT['ordinals']!=list(range(5,51)) or [r['ordinal'] for r in MAPPING['cases']]!=list(range(5,51)):raise ValueError('ordinal mapping drift')
    row=MAPPING['cases'][n-5]
    s,f,paths=base.verify_prep(SOURCE,FLEX,n)
    if (s['id'],s['stem'])!=(row['id'],row['stem']):raise ValueError('case identity drift')
    for key,name in [('request','learned-request-v7.json'),('packet','structure-evidence-v2.json'),('sourcePayload','openai-payload-v7.json'),('flexPayload','openai-payload-v7-flex8192.json')]:
        if sha(paths[key])!=row['inputHashes'][name]:raise ValueError('frozen input hash drift')
    old=load(paths['flexPayload']);payload=dict(old);payload['max_output_tokens']=25000
    if {k for k in old if old[k]!=payload[k]}!={'max_output_tokens'}:raise ValueError('payload changed beyond output cap')
    encoded=(json.dumps(payload,indent=2,sort_keys=True)+'\n').encode()
    if sha_bytes(encoded)!=row['v8PayloadSha256']:raise ValueError('V8 payload drift')
    if len(encoded)+4096>76428:raise ValueError('input byte envelope exceeds conservative guard allowance')
    return row,paths,encoded

def ledger_for_next(ledger,n,budget):
    ordinal(n)
    base.exact(ledger,{'schema':'trackcade-stage1-v8-remaining46-ledger-v2','budgetAccounting':ACCOUNTING,'runId':os.environ['GITHUB_RUN_ID'],'commit':os.environ['GITHUB_SHA'],'lastCompletedOrdinal':n-1,'estimatedSpendCeilingUsd':str(budget)})
    entries=ledger.get('reconciledAttempts')
    if not isinstance(entries,list) or len(entries)!=n-5:raise ValueError('reconciled sequence mismatch')
    total=Decimal('0');ids=set()
    for previous,entry in enumerate(entries,5):
        out=location(previous);status=load(out/'status.json');base.verify_files_manifest(out)
        base.exact(entry,{'ordinal':previous,'statusSha256':sha(out/'status.json'),'manifestSha256':sha(out/'FILES_SHA256.txt')})
        if not entry.get('resultArtifactId') or entry['resultArtifactId'] in ids or not str(entry.get('resultArtifactDigest','')).startswith('sha256:'):raise ValueError('missing or duplicated frozen result identity')
        ids.add(entry['resultArtifactId'])
        base.exact(status['ledgerBefore'],{'schema':ledger['schema'],'budgetAccounting':ACCOUNTING,'runId':ledger['runId'],'commit':ledger['commit'],'lastCompletedOrdinal':previous-1,'estimatedSpendCeilingUsd':str(budget),'reconciledEstimatedSpendUsd':str(total),'reconciledAttempts':entries[:previous-5]})
        cost=frozen_result_cost(previous,status)
        if decimal_usd(entry['estimatedCostUsd'])!=cost:raise ValueError('reconciled cost does not match frozen usage')
        total+=cost
    if decimal_usd(ledger['reconciledEstimatedSpendUsd'])!=total:raise ValueError('reconciled cumulative spend mismatch')
    if entries:base.exact(ledger,{'resultArtifactId':entries[-1]['resultArtifactId'],'resultArtifactDigest':entries[-1]['resultArtifactDigest']})
    elif total or ledger.get('resultArtifactId') is not None or ledger.get('resultArtifactDigest') is not None:raise ValueError('nonempty initial ledger')
    if total+RESERVATION>budget:raise ValueError('next worst-case reservation exceeds authorized estimated ceiling')
    return total+RESERVATION

def frozen_result_cost(n,status):
    out=location(n)
    base.exact(status,{'schema':'trackcade-stage1-v8-remaining46-status-v1','ordinal':n,'runId':os.environ['GITHUB_RUN_ID'],'harnessSourceCommit':os.environ['GITHUB_SHA'],'providerContract':CONTRACT['providerContract'],'classification':SUCCESS_CLASSIFICATION,'artifactOutcome':'completed-valid','proposalValidated':True,'providerCallAttempted':True,'observedProviderStatus':'completed','observedProviderModel':'gpt-6-sol','observedProviderServiceTier':'flex','validatorExitCode':0,'errors':[]})
    if status.get('budgetIntegrityError'):raise ValueError('budget integrity failure; no reconciliation')
    raw=load(out/'raw-response.json')
    if sha(out/'raw-response.json')!=status['rawResponseSha256'] or raw.get('usage')!=status['usage']:raise ValueError('usage does not match frozen provider evidence')
    if sha(out/'normalized-proposal.json')!=status['normalizedProposalSha256']:raise ValueError('proposal identity changed')
    if load(out/'validation-report.json').get('status')!='valid':raise ValueError('validator receipt not valid')
    cost=estimate_usage(status['usage'])
    if cost>RESERVATION or decimal_usd(status['observedEstimatedCostUsd'])!=cost:raise ValueError('invalid frozen estimated cost; reservation retained')
    return cost

def estimate_usage(usage):
    if not isinstance(usage,dict):raise ValueError('unknown usage; stop with reservation retained')
    details=usage.get('input_tokens_details');output_details=usage.get('output_tokens_details')
    if not isinstance(details,dict) or not isinstance(output_details,dict):raise ValueError('missing usage detail')
    values=[usage.get('input_tokens'),usage.get('output_tokens'),usage.get('total_tokens'),details.get('cache_write_tokens',0),details.get('cached_tokens',0),output_details.get('reasoning_tokens')]
    if any(type(x) is not int or x<0 for x in values):raise ValueError('invalid token usage; stop')
    i,o,total,cw,cached,reason=values
    if total!=i+o or cw+cached>i or reason>o or o>25000 or i>76428:raise ValueError('usage or budget input/output envelope drift; stop')
    return (Decimal(i-cw-cached)+Decimal(cw)*Decimal('1.25')+Decimal(cached)*Decimal('0.1')+Decimal(o)*5)/1000000

def location(n):return WORK/f'{ordinal(n):02d}'
def lockfile(n):return WORK/f'{ordinal(n):02d}-lock'/'attempt-lock.json'
def ledger_path():return WORK/'ledger.json'

def verify_lock(n,lock,artifact):
    base.exact(lock,{'schema':'trackcade-stage1-v8-remaining46-attempt-lock-v1','budgetAccounting':ACCOUNTING,'ordinal':ordinal(n),'runId':os.environ['GITHUB_RUN_ID'],'commit':os.environ['GITHUB_SHA'],'attempts':1,'retryAuthorized':False,'reservationUsd':str(RESERVATION),'providerContract':CONTRACT['providerContract']})
    base.exact(artifact,{'id':int(os.environ['LOCK_ARTIFACT_ID']),'name':f'{NAMESPACE}-case-{n:02d}-attempt-lock','expired':False})
    base.exact(artifact.get('workflow_run') or {},{'id':int(os.environ['GITHUB_RUN_ID']),'head_sha':os.environ['GITHUB_SHA']})
    if not str(artifact.get('digest','')).startswith('sha256:'):raise ValueError('lock has no immutable digest')

def initialize(budget):
    if os.environ.get('OPENAI_API_KEY'):raise ValueError('credential present before reservation')
    WORK.mkdir(parents=True,exist_ok=False)
    save_json(ledger_path(),{'schema':'trackcade-stage1-v8-remaining46-ledger-v2','budgetAccounting':ACCOUNTING,'runId':os.environ['GITHUB_RUN_ID'],'commit':os.environ['GITHUB_SHA'],'lastCompletedOrdinal':4,'reconciledEstimatedSpendUsd':'0','reconciledAttempts':[],'estimatedSpendCeilingUsd':str(budget),'resultArtifactId':None,'resultArtifactDigest':None})

def prepare(n,budget):
    if os.environ.get('OPENAI_API_KEY'):raise ValueError('credential exposed before lock creation')
    ledger=load(ledger_path());charge=ledger_for_next(ledger,n,budget);row,paths,payload=frozen_case(n)
    out=location(n);out.mkdir(exist_ok=False)
    for key,name in [('request','learned-request-v7.json'),('packet','structure-evidence-v2.json'),('flexPayload','openai-payload-v7-flex8192.json')]:
        (out/name).write_bytes(paths[key].read_bytes())
    (out/'openai-payload-v8-flex25000.json').write_bytes(payload)
    save_json(out/'status.json',{'schema':'trackcade-stage1-v8-remaining46-status-v1','ordinal':n,'runId':os.environ['GITHUB_RUN_ID'],'harnessSourceCommit':os.environ['GITHUB_SHA'],'providerContract':CONTRACT['providerContract'],'classification':'offline_reserved_no_provider_call','providerCallAttempted':False,'providerResponseObserved':False,'providerCompletedSemanticResponse':False,'proposalValidated':False,'errors':[],'retryAuthorized':False,'standardFallbackUsed':False,'referenceLabelsRead':False,'scoringPerformed':False,'terminalTracksProcessed':False,'stage1ReferencesOpened':False,'analyzerExecuted':False,'analyzerChanged':False,'compilerInvoked':False,'ledgerBefore':ledger,'reservedCeilingUsdDuringAttempt':str(charge),'budgetAccounting':ACCOUNTING,'reservationUsd':str(RESERVATION),'onlyMaxOutputTokensChanged':True})
    lockfile(n).parent.mkdir(exist_ok=False)
    save_json(lockfile(n),{'schema':'trackcade-stage1-v8-remaining46-attempt-lock-v1','ordinal':n,'runId':os.environ['GITHUB_RUN_ID'],'commit':os.environ['GITHUB_SHA'],'attempts':1,'retryAuthorized':False,'reservationUsd':str(RESERVATION),'providerContract':CONTRACT['providerContract'],'budgetAccounting':ACCOUNTING,'ledgerBefore':ledger,'submittedPayloadSha256':row['v8PayloadSha256']})

def run(n,budget):
    out=location(n);lock=load(lockfile(n));verify_lock(n,lock,load(lockfile(n).parent/'uploaded.json'))
    ledger=load(ledger_path());ledger_for_next(ledger,n,budget)
    if ledger!=lock['ledgerBefore']:raise ValueError('stale or changed budget ledger')
    row,paths,payload=frozen_case(n)
    for name in ['learned-request-v7.json','structure-evidence-v2.json','openai-payload-v7-flex8192.json']:
        if sha(out/name)!=row['inputHashes'][name]:raise ValueError('reserved input changed')
    if (out/'openai-payload-v8-flex25000.json').read_bytes()!=payload:raise ValueError('reserved payload changed')
    status_path=out/'status.json';status=load(status_path)
    base.exact(status,{'ordinal':n,'providerCallAttempted':False,'classification':'offline_reserved_no_provider_call','providerContract':CONTRACT['providerContract'],'harnessSourceCommit':os.environ['GITHUB_SHA']})
    with (out/'attempt-consumed.json').open('x',encoding='utf-8') as f:json.dump({'ordinal':n,'oneAttemptOnly':True},f)
    try:
        one_provider_attempt(out,status,status_path,ROOT/'research/learned-interpretation-v1/validate_learned_proposal_v7.py')
        (out/'provider-step-exit-code.txt').write_text('0\n')
    except Exception as exc:
        status['errors'].append(type(exc).__name__+': '+str(exc));status['classification']='runner_exception_no_retry';save_json(status_path,status)
        (out/'provider-step-exit-code.txt').write_text('1\n')
    status=load(status_path)
    try:
        cost=estimate_usage(status.get('usage'));status['observedEstimatedCostUsd']=str(cost)
        if cost>RESERVATION:raise ValueError('observed estimated cost exceeds reservation; stop')
    except ValueError as exc:
        status['budgetIntegrityError']=str(exc)
    status['artifactOutcome']='completed-valid' if status['classification']==SUCCESS_CLASSIFICATION and not status.get('budgetIntegrityError') else 'stopped-frozen-failure'
    save_json(status_path,status);base.finalize_manifest(out)
    print(json.dumps({'ordinal':n,'classification':status['classification'],'artifactOutcome':status['artifactOutcome']},indent=2))

def advance(n,budget,artifact):
    out=location(n);status=load(out/'status.json');base.verify_files_manifest(out)
    base.exact(artifact,{'id':int(os.environ['RESULT_ARTIFACT_ID']),'name':f'{NAMESPACE}-case-{n:02d}-result','expired':False})
    base.exact(artifact.get('workflow_run') or {},{'id':int(os.environ['GITHUB_RUN_ID']),'head_sha':os.environ['GITHUB_SHA']})
    if not str(artifact.get('digest','')).startswith('sha256:'):raise ValueError('immutable result digest missing')
    cost=frozen_result_cost(n,status)
    ledger=load(ledger_path());charge=ledger_for_next(ledger,n,budget)
    if status['ledgerBefore']!=ledger:raise ValueError('result does not bind current predecessor ledger')
    base.exact(status,{'budgetAccounting':ACCOUNTING,'reservedCeilingUsdDuringAttempt':str(charge),'reservationUsd':str(RESERVATION)})
    if cost>RESERVATION or charge>budget:raise ValueError('budget exceeded; stop')
    verify_lock(n,load(lockfile(n)),load(lockfile(n).parent/'uploaded.json'))
    if load(lockfile(n))['ledgerBefore']!=ledger:raise ValueError('lock ledger mismatch; reservation retained')
    entry={'ordinal':n,'estimatedCostUsd':str(cost),'resultArtifactId':artifact['id'],'resultArtifactDigest':artifact['digest'],'statusSha256':sha(out/'status.json'),'manifestSha256':sha(out/'FILES_SHA256.txt')}
    next_ledger={**ledger,'lastCompletedOrdinal':n,'reconciledEstimatedSpendUsd':str(decimal_usd(ledger['reconciledEstimatedSpendUsd'])+cost),'reconciledAttempts':ledger['reconciledAttempts']+[entry],'resultArtifactId':artifact['id'],'resultArtifactDigest':artifact['digest']}
    temp=WORK/'ledger-next.json';save_json(temp,next_ledger);temp.replace(ledger_path())

def main():
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['initialize','prepare','run']);ap.add_argument('ordinal',type=int,nargs='?',choices=range(5,51));args=ap.parse_args()
    budget=gate(load(AUTH),load(ACT))
    if args.mode=='initialize':initialize(budget)
    elif args.ordinal is None:raise ValueError('ordinal required')
    elif args.mode=='prepare':prepare(args.ordinal,budget)
    else:run(args.ordinal,budget)

# Frozen V8 single-attempt transport implementation is inserted below, unchanged.

def one_provider_attempt(out: Path, status: dict, status_path: Path, validator: Path) -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing at authorized live-call step")
    payload_path = out / "openai-payload-v8-flex25000.json"
    payload_bytes = payload_path.read_bytes()
    client_request_id = str(uuid.uuid4())
    status["providerCallAttempted"] = True
    status["providerCallStartedAt"] = now()
    status["clientRequestId"] = client_request_id
    status["classification"] = "provider_attempt_started_no_retry"
    save_json(status_path, status)
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=payload_bytes,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "trackcade-stage1-v7-remaining49-v1",
            "X-Client-Request-Id": client_request_id,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as resp:
            raw = resp.read()
            http_status = int(resp.status)
            http_request_id = resp.headers.get("x-request-id")
            http_error = False
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        http_status = int(exc.code)
        http_request_id = exc.headers.get("x-request-id") if exc.headers else None
        http_error = True
    except urllib.error.URLError as exc:
        status.update({
            "providerCallFinishedAt": now(),
            "httpStatus": None,
            "httpRequestId": None,
            "transportError": str(exc.reason),
            "classification": "flex_transport_failure_no_completed_response_no_retry",
        })
        save_json(status_path, status)
        return
    status.update({
        "providerCallFinishedAt": now(),
        "httpStatus": http_status,
        "httpRequestId": http_request_id,
        "providerResponseObserved": True,
    })
    (out / "raw-response.json").write_bytes(raw)
    status["rawResponseSha256"] = sha_bytes(raw)
    if http_error:
        try:
            status["providerHttpError"] = json.loads(raw.decode("utf-8")).get("error")
        except Exception:
            status["providerHttpError"] = None
        status["classification"] = "flex_http_failure_no_completed_response_no_retry"
        save_json(status_path, status)
        return
    response = json.loads(raw.decode("utf-8"))
    status["observedProviderStatus"] = response.get("status")
    status["observedProviderResponseId"] = response.get("id")
    status["observedProviderModel"] = response.get("model")
    status["observedProviderServiceTier"] = response.get("service_tier")
    if isinstance(response.get("usage"), dict):
        status["usage"] = response["usage"]
    if response.get("status") != "completed":
        status["incompleteDetails"] = response.get("incomplete_details")
        status["classification"] = "provider_incomplete_no_completed_response_no_retry"
        save_json(status_path, status)
        return
    status["providerCompletedSemanticResponse"] = True
    if response.get("service_tier") != "flex":
        status["errors"].append(f"completed response service_tier was {response.get('service_tier')!r}, expected 'flex'")
        status["classification"] = "provider_completed_wrong_service_tier_no_retry"
        save_json(status_path, status)
        return
    if response.get("model") != "gpt-6-sol":
        status["errors"].append(f"completed response model was {response.get('model')!r}, expected 'gpt-6-sol'")
        status["classification"] = "provider_completed_wrong_model_no_retry"
        save_json(status_path, status)
        return
    learned = validator.parent.resolve()
    sys.path.insert(0, str(learned))
    import openai_responses_adapter_v1 as transport
    _, candidate_bytes = transport.extract_candidate(raw)
    candidate = out / "proposal-candidate.json"
    candidate.write_bytes(candidate_bytes)
    status["proposalCandidateSha256"] = sha_bytes(candidate_bytes)
    normalized = out / "normalized-proposal.json"
    report = out / "validation-report.json"
    proc = subprocess.run(
        [sys.executable, str(validator), "--packet", str(out / "structure-evidence-v2.json"),
         "--proposal", str(candidate), "--output", str(normalized), "--report", str(report)],
        capture_output=True, text=True, check=False,
    )
    (out / "validator-stdout.txt").write_text(proc.stdout, encoding="utf-8")
    (out / "validator-stderr.txt").write_text(proc.stderr, encoding="utf-8")
    status["validatorExitCode"] = proc.returncode
    if proc.returncode == 0:
        status["proposalValidated"] = True
        status["normalizedProposalSha256"] = sha(normalized)
        status["classification"] = SUCCESS_CLASSIFICATION
    else:
        status["classification"] = "provider_completed_v7_validation_failure_no_retry"
    save_json(status_path, status)


if __name__=="__main__":main()
