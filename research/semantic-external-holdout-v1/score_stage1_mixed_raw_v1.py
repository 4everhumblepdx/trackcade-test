"""One-use authorized Stage1-only RAW scoring; unchanged historical event matcher."""
import argparse,hashlib,json,math,subprocess,time
from pathlib import Path
import evaluate_stage1_v6_raw_v1 as frozen
from isolate_stage1_reference_v1 import RangeByteSource,isolate_stage1_value
sha=lambda b:hashlib.sha256(b).hexdigest()
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def candidates(manifest,collection):
    result=[]
    assert [c['ordinal'] for c in manifest['cases']]==list(range(1,51))
    for c in manifest['cases']:
        stem=f"{c['ordinal']:02d}-{c['stem']}.json";p=collection/'proposals'/stem;a=collection/'packets'/stem
        assert sha(p.read_bytes())==c['normalizedProposalSha256'] and sha(a.read_bytes())==c['packetSha256']
        proposal=load(p);anchors=load(a)['anchors'];drops=[]
        for event in proposal['events']:
            if event['kind']!='drop':continue
            anchor=event['anchor'];assert anchor['type']=='evidence' and type(anchor['index']) is int and 0<=anchor['index']<len(anchors)
            value=anchors[anchor['index']][0];assert frozen.finite_number(value) and value>=0
            drops.append(float(value))
        result.append({'ordinal':c['ordinal'],'id':c['id'],'semanticVersion':c['semanticVersion'],'dropTimes':sorted(drops)})
    assert len({x['id'] for x in result})==50
    return result
def evaluate(rows,refs):
    outputs={}
    for tolerance in frozen.TOLERANCES:
        cases=[]
        for c in rows:
            ref=sorted(refs[c['id']]);cand=c['dropTimes'];s=frozen.score_track(ref,cand,tolerance)
            s.update({'ordinal':c['ordinal'],'id':c['id'],'semanticVersion':c['semanticVersion'],'referenceDropsSeconds':ref,'predictedDropsSeconds':cand})
            matched_r={p['referenceIndex'] for p in s['matchedPairs']};matched_c={p['candidateIndex'] for p in s['matchedPairs']}
            s['unmatchedReferenceIndices']=[i for i in range(len(ref)) if i not in matched_r];s['unmatchedCandidateIndices']=[i for i in range(len(cand)) if i not in matched_c];cases.append(s)
        outputs[str(int(tolerance))]={'toleranceSeconds':tolerance,'aggregate':frozen.aggregate(cases),'perTrack':cases,'subgroups':{v:frozen.aggregate([c for c in cases if c['semanticVersion']==v]) for v in ['V7','V8']}}
    return outputs
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--contract',type=Path,required=True);ap.add_argument('--contract-sha256',required=True);ap.add_argument('--contract-commit',required=True);ap.add_argument('--collection',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);a=ap.parse_args()
    base=Path(__file__).parent;repo=base.parent.parent
    assert sha(a.contract.read_bytes())==a.contract_sha256;contract=load(a.contract)
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();assert head==a.contract_commit
    for code in contract['executionSources']:
        assert sha((repo/code['path']).read_bytes())==code['sha256']
    for old in contract['historicalScoringSources']:
        data=subprocess.check_output(['git','show',old['commit']+':'+old['path']],cwd=repo);assert sha(data)==old['sha256']
    manifest_path=repo/contract['predictionManifest']['path'];assert sha(manifest_path.read_bytes())==contract['predictionManifest']['sha256'];manifest=load(manifest_path)
    assert [{'ordinal':c['ordinal'],'sha256':c['normalizedProposalSha256']} for c in manifest['cases']]==contract['proposalHashes']
    rows=candidates(manifest,a.collection);assert frozen.TOLERANCES==(1.0,2.0,5.0) and frozen.PRIMARY_TOLERANCE==2.0
    a.output.mkdir(exist_ok=False,parents=True)
    lock={'status':'single-scoring-attempt-consumed-before-label-access','contractCommit':head,'contractSha256':a.contract_sha256,'predictionManifestSha256':contract['predictionManifest']['sha256'],'createdUnix':time.time(),'providerCalls':0,'terminalAccess':False}
    (a.output/'SCORING_ATTEMPT_LOCK.json').write_text(json.dumps(lock,indent=2)+'\n',encoding='utf-8')
    source=contract['stage1Isolation'];s=RangeByteSource(source['path'],source['sourceSizeBytes'],source['sourceETag'],source['stage1ValueStartOffset'])
    try:raw,labels=isolate_stage1_value(s)
    finally:s.close()
    (a.output/'stage1-reference-value.json').write_bytes(raw)
    refs={}
    for x in labels:
        assert isinstance(x,dict) and set(x)=={'id','dropsSeconds'} and x['id'] not in refs
        values=x['dropsSeconds'];assert isinstance(values,list) and all(frozen.finite_number(v) and v>=0 for v in values);refs[x['id']]=[float(v) for v in values]
    assert set(refs)=={x['id'] for x in rows}
    scores=evaluate(rows,refs)
    output={'schema':'trackcade-stage1-mixed-v7-v8-raw-result-v1','status':'frozen-complete-50-development-raw-drop-score','predictionManifest':contract['predictionManifest'],'scoringContractCommit':head,'scoringContractSha256':a.contract_sha256,'stage1ReferenceSha256':sha(raw),'referenceSource':contract['referenceSource'],'isolationProof':{'method':'one-byte HTTP 206 ranges, pinned immutable commit path, exact Content-Range/Content-Length and ETag; stop on Stage1 closing bracket','startOffset':source['stage1ValueStartOffset'],'endOffsetExclusive':s.offset,'labelValueByteRequests':s.requests,'terminalBytesRequestedOrRead':0,'fullReferenceFileDownloadedOrParsed':False,'completeReferenceSha256IndependentlyComputed':False,'wholeReferenceSha256IsHistoricalCitationOnly':True},'primaryToleranceSeconds':2.0,'headline':scores['2']['aggregate'],'sensitivity':scores,'caseCount':50,'V7Ordinals':[1,2,3],'V8Ordinals':list(range(4,51)),'unsupportedBinaryBaselinesExcluded':[14,15,20],'primaryScoringPasses':1,'qualitativeErrorAnalysisPerformed':False,'providerCalls':0,'providerSpendUsd':'0','terminalHoldoutAccessed':False,'analyzerExecutedOrModified':False,'compilerInvoked':False,'predictionModifiedOrRegenerated':False,'evidence':'Stage1 DEVELOPMENT; not terminal/generalization evidence'}
    path=a.output/'STAGE1_MIXED_V7_V8_RAW_RESULT_V1.json';path.write_text(json.dumps(output,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'resultSha256':sha(path.read_bytes()),'headline':output['headline'],'stage1ReferenceSha256':sha(raw),'bytesRead':s.requests,'terminalBytesRead':0},indent=2))
if __name__=='__main__':main()
