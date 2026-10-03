"""Offline staging from two immutable Stage1-only preparation archives.

No recursive repository reads, labels, prior proposals, network or credentials.
Provider-facing bodies remain private local prep; only hashes enter Git.
"""
import argparse
import difflib
import json
import os
from pathlib import Path
import zipfile
import build_stage1_v9_grounded_v1 as b

BASE=Path(__file__).resolve().parent

def encoded(d): return (json.dumps(d,indent=2,sort_keys=True)+'\n').encode()
def save(p,d): p.write_bytes(encoded(d))

def stage(source,flex,output,baseline_manifest):
    if os.environ.get('OPENAI_API_KEY'):
        raise ValueError('Credential forbidden in provider-free staging')
    if output.exists():raise ValueError('New staging directory required; never overwrite')
    manifest=json.loads(baseline_manifest.read_bytes())
    if b.sha(baseline_manifest.read_bytes()) not in {'2486614f9e02be0d01306c6df18119957cba4e29f7fd645b1eae1cad866ac8a0','383f937020bd6433667cce8b309528ae7e6025e191b28ea75c6d1258624ba2c5'}:raise ValueError('Baseline manifest drift')
    with zipfile.ZipFile(source) as sz,zipfile.ZipFile(flex) as fz:
        sb=sz.read('STAGE1_V7_PREP_MANIFEST_V1.json');fb=fz.read('STAGE1_V7_FLEX8192_PREP_MANIFEST_V1.json')
        if b.sha(sb)!='455602ea8c5a721fac9b3381aca46285fe3c14f1fbcc36f0d08b4ffec01be875' or b.sha(fb)!='a41fdd4e4138fdfda18cda20004f609eb089aeb64ed1be486ee2442b1241a713':raise ValueError('Preparation manifest identity drift')
        sm=json.loads(sb);fm=json.loads(fb)
        if [x['ordinal'] for x in sm['tracks']]!=list(range(1,51)) or [x['ordinal'] for x in fm['tracks']]!=list(range(1,51)):raise ValueError('Stage1 mapping mismatch')
        output.mkdir(parents=True);rows=[];diff=None
        for s,f,oldcase in zip(sm['tracks'],fm['tracks'],manifest['cases']):
            n=s['ordinal'];case=f'cases/{n:02d}-{s["stem"]}'
            if (n,s['id'],s['stem'])!=(f['ordinal'],f['id'],f['stem']) or (n,s['id'],s['stem'])!=(oldcase['ordinal'],oldcase['id'],oldcase['stem']):raise ValueError('Ordinal/identity drift')
            pb=sz.read(case+'/structure-evidence-v2.json');rb=sz.read(case+'/learned-request-v7.json');ab=fz.read(case+'/openai-payload-v7-flex8192.json')
            if b.sha(pb)!=oldcase['packetSha256'] or b.sha(pb)!=s['hashes']['structureEvidenceV2Sha256'] or b.sha(rb)!=s['hashes']['learnedRequestV7Sha256']:raise ValueError('Frozen input drift')
            # Flex manifest pins its payload hash under the existing preparation schema.
            if b.sha(ab)!=f['amendedFlex8192PayloadSha256']:raise ValueError('Frozen flex payload drift')
            request=json.loads(rb);payload=json.loads(ab)
            if request['packet']!=json.loads(pb) or json.loads(payload['input'])['packet']!=json.loads(pb) or payload['instructions']!=request['instruction']:raise ValueError('Input path binding drift')
            baseline=dict(payload);baseline['max_output_tokens']=b.cap(n)
            if baseline['max_output_tokens']!=oldcase['providerContract']['maxOutputTokens']:raise ValueError('Mixed caps drift')
            tr=b.treatment_request(request);tp=b.treatment_payload(baseline,n)
            if tr['packet']!=request['packet'] or tr['responseContract']!=request['responseContract'] or tp['text']!=baseline['text']:raise ValueError('Non-treatment schema/packet drift')
            dest=output/case;dest.mkdir(parents=True)
            data={'structure-evidence-v2.json':pb,'baseline-request.json':rb,'baseline-payload.json':encoded(baseline),'learned-request-v9.json':encoded(tr),'openai-payload-v9-grounded.json':encoded(tp)}
            for name,raw in data.items():(dest/name).write_bytes(raw)
            rows.append({'ordinal':n,'id':s['id'],'stem':s['stem'],'analysisJsonSha256':s['analysisJsonSha256'],'maxOutputTokens':b.cap(n),'inputHashes':{k:b.sha(v) for k,v in data.items()},'v9PayloadSha256':b.sha(data['openai-payload-v9-grounded.json']),'v9PayloadBytes':len(data['openai-payload-v9-grounded.json'])})
            current=''.join(difflib.unified_diff(request['instruction'].splitlines(True),tr['instruction'].splitlines(True),fromfile='frozen-V7-V8-instruction',tofile='V9-grounded-instruction'))
            if diff is not None and current!=diff:raise ValueError('Nonuniform treatment')
            diff=current
    mapping={'schema':'trackcade-stage1-v9-grounded-mapping-v1','version':b.VERSION,'sourceManifestSha256':b.sha(sb),'flexManifestSha256':b.sha(fb),'cases':rows,'providerCalls':0,'labelsUsedForGeneration':False}
    save(BASE/'STAGE1_V9_GROUNDED_MAPPING_V1.json',mapping)
    (BASE/'STAGE1_V9_GROUNDED_SEMANTIC_DIFF_V1.patch').write_bytes(diff.encode())
    return mapping

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    for name in ['source','flex','output','baseline-manifest']:ap.add_argument('--'+name,type=Path,required=True)
    a=ap.parse_args();m=stage(a.source,a.flex,a.output,a.baseline_manifest)
    print(json.dumps({'caseCount':len(m['cases']),'providerCalls':0,'maxPayloadBytes':max(r['v9PayloadBytes'] for r in m['cases'])}))
