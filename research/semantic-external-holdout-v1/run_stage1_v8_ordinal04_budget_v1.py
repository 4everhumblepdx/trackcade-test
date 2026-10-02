#!/usr/bin/env python3
"""One V8 budget diagnostic; V7 semantics/transport reused without recovery."""
import argparse, json, os, sys
from pathlib import Path
import run_stage1_v7_remaining49_case_v1 as base
sha_bytes, sha, load, now, save_json = base.sha_bytes, base.sha, base.load, base.now, base.save_json
urllib, uuid, subprocess = base.urllib, base.uuid, base.subprocess
SUCCESS_CLASSIFICATION = "provider_completed_validated_v8_ordinal04_flex25000_no_retry"
BASE = Path(__file__).resolve().parent
CONTRACT = load(BASE / "STAGE1_V8_ORDINAL04_CONTRACT_V1.json")
INPUT = Path(os.environ.get('V8_FROZEN_INPUT', '/tmp/v8-frozen-input'))
NAMESPACE = "trackcade-stage1-v8-ordinal04-budget-v1"
STATUS = "stage1-v8-ordinal04-status-v1.json"

def verify_inputs():
    for name,h in CONTRACT['inputSha256'].items():
        if sha(INPUT/name) != h: raise ValueError('frozen input changed: '+name)
    original = load(INPUT/'openai-payload-v7-flex8192.json')
    if original['model']!='gpt-6-sol' or original['reasoning']!={'effort':'high'} or original['service_tier']!='flex' or original['store'] is not False or original['max_output_tokens']!=8192:
        raise ValueError('V7 baseline provider drift')
    payload = dict(original); payload['max_output_tokens']=25000
    if {k:v for k,v in payload.items() if k!='max_output_tokens'} != {k:v for k,v in original.items() if k!='max_output_tokens'}:
        raise ValueError('semantic payload changed')
    return payload

def execution_gate(auth,act,commit):
    base.exact(auth, {'schema':'trackcade-stage1-v8-ordinal04-authorization-v1','authorized':True,'ordinal':4,'maximumProviderAttempts':1,'retries':0,'ordinals5Through50Authorized':False,'providerContract':CONTRACT['providerContract']})
    base.exact(act, {'schema':'trackcade-stage1-v8-ordinal04-activation-v1','activate':True,'ordinal':4,'maximumProviderAttempts':1,'retries':0,'ordinals5Through50Authorized':False,'providerContract':CONTRACT['providerContract']})
    if act.get('staticAuditConclusion')!='success' or not act.get('staticAuditRunId'): raise ValueError('missing successful provider-free audit')
    if os.environ.get('GITHUB_REF')!=base.BRANCH or os.environ.get('GITHUB_EVENT_NAME')!='push' or os.environ.get('GITHUB_RUN_ATTEMPT')!='1' or os.environ.get('GITHUB_SHA')!=commit or not os.environ.get('GITHUB_RUN_ID'):
        raise ValueError('canonical first activation push required')

def verify_lock(lock,artifact,commit):
    base.exact(lock, {'schema':'trackcade-stage1-v8-ordinal04-attempt-lock-v1','ordinal':4,'maximumProviderAttempts':1,'retries':0,'commit':commit,'runId':os.environ['GITHUB_RUN_ID'],'providerContract':CONTRACT['providerContract']})
    base.exact(artifact, {'id':int(os.environ['LOCK_ARTIFACT_ID']),'name':NAMESPACE+'-attempt-lock','expired':False})
    base.exact(artifact.get('workflow_run') or {}, {'id':int(lock['runId']),'head_sha':commit})
    if not str(artifact.get('digest','')).startswith('sha256:'): raise ValueError('immutable lock digest missing')

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


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--mode',choices=['prepare','run','check'],required=True)
    ap.add_argument('--ordinal',type=int,choices=[4],required=True);ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--lock',type=Path,required=True);ap.add_argument('--uploaded-lock',type=Path)
    args=ap.parse_args();commit=os.environ['GITHUB_SHA']
    auth=load(BASE/'STAGE1_V8_ORDINAL04_AUTHORIZATION_V1.json');act=load(BASE/'STAGE1_V8_ORDINAL04_ACTIVATE_V1.json')
    execution_gate(auth,act,commit);payload=verify_inputs();out=args.output;status_path=out/STATUS
    if args.mode=='prepare':
        if os.environ.get('OPENAI_API_KEY'): raise ValueError('credential exposed before reservation')
        out.mkdir(parents=True,exist_ok=False)
        for name in CONTRACT['inputSha256']: (out/name).write_bytes((INPUT/name).read_bytes())
        save_json(out/'openai-payload-v8-flex25000.json',payload)
        status={'schema':'trackcade-stage1-v8-ordinal04-status-v1','stage':'stage1-v8','ordinal':4,'providerContract':CONTRACT['providerContract'],'harnessSourceCommit':commit,'providerCallAttempted':False,'providerResponseObserved':False,'providerCompletedSemanticResponse':False,'proposalValidated':False,'retryAuthorized':False,'standardFallbackUsed':False,'referenceLabelsRead':False,'scoringPerformed':False,'analyzerExecuted':False,'analyzerChanged':False,'compilerInvoked':False,'terminalTracksProcessed':False,'stage1ReferencesOpened':False,'semanticPayloadUnchangedExceptOutputCap':True,'classification':'offline_preflight_complete_no_provider_call','errors':[]}
        save_json(status_path,status);args.lock.parent.mkdir(parents=True,exist_ok=False)
        save_json(args.lock,{'schema':'trackcade-stage1-v8-ordinal04-attempt-lock-v1','ordinal':4,'maximumProviderAttempts':1,'retries':0,'commit':commit,'runId':os.environ['GITHUB_RUN_ID'],'providerContract':CONTRACT['providerContract'],'inputSha256':CONTRACT['inputSha256'],'submittedPayloadSha256':sha(out/'openai-payload-v8-flex25000.json')})
        return
    if args.mode=='check':
        status=load(status_path);base.verify_files_manifest(out)
        if status.get('classification')!=SUCCESS_CLASSIFICATION or status.get('proposalValidated') is not True: raise ValueError('diagnostic did not complete-valid; stopped, no retry')
        if sha(out/'normalized-proposal.json')!=status['normalizedProposalSha256']:raise ValueError('proposal freeze mismatch')
        return
    if args.uploaded_lock is None:raise ValueError('immutable uploaded lock required')
    lock=load(args.lock);verify_lock(lock,load(args.uploaded_lock),commit)
    for name,h in CONTRACT['inputSha256'].items():
        if sha(out/name)!=h:raise ValueError('prepared frozen input changed')
    if load(out/'openai-payload-v8-flex25000.json')!=payload or sha(out/'openai-payload-v8-flex25000.json')!=lock['submittedPayloadSha256']:raise ValueError('reserved payload changed')
    status=load(status_path)
    base.exact(status,{'ordinal':4,'harnessSourceCommit':commit,'providerCallAttempted':False,'classification':'offline_preflight_complete_no_provider_call','providerContract':CONTRACT['providerContract']})
    # Exclusive local marker is irreversible for this reservation, even on transport failure.
    with (out/'provider-attempt-consumed-v1.json').open('x',encoding='utf-8') as f:json.dump({'ordinal':4,'maximumProviderAttempts':1,'runId':os.environ['GITHUB_RUN_ID']},f)
    try:
        one_provider_attempt(out,status,status_path,BASE.parent/'learned-interpretation-v1/validate_learned_proposal_v7.py')
        (out/'provider-step-exit-code.txt').write_text('0\n')
    except Exception as exc:
        status['errors'].append(type(exc).__name__+': '+str(exc));status['classification']='runner_exception_after_or_before_single_attempt_no_retry';save_json(status_path,status)
        (out/'provider-step-exit-code.txt').write_text('1\n')
    status=load(status_path)
    status['artifactOutcome']='completed-valid' if status['classification']==SUCCESS_CLASSIFICATION else ('attempted-no-valid-response' if status['providerCallAttempted'] else 'local-no-provider-attempt')
    save_json(status_path,status);base.finalize_manifest(out)
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('artifact_outcome='+status['artifactOutcome']+'\n')
    print(json.dumps({k:status.get(k) for k in ['classification','providerCallAttempted','proposalValidated','usage','artifactOutcome']},indent=2))

if __name__=='__main__':main()
