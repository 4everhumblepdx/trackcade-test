#!/usr/bin/env python3
"""Stage 1 compact-policy audit; consumes prior frozen coverage, never reruns it."""
import argparse
import collections
import json
import math
import statistics
import zipfile
from pathlib import Path

import export_structure_evidence_v2 as exporter
import evaluate_stage1_drop_v1 as frozen
import analyze_stage1_anchor_coverage_v1 as scoring

HASHES = {
 'baseZip':'accfe84fc54feda56f0c99404a1ed7b245beb9ef74a1876b3b185e8d494a131a',
 'v2Zip':'627330db82b6e28060260bb357501d15d339ff790ee097e0739de40d0c9640bd',
 'baseManifest':'350a621cfac110369ab4852a925a96964c01b744168e4991ff90df82b24134ff',
 'v2Manifest':'82c9d82688314a18b676d0f5e8e251b6ebd9cff7306a243210f63a8fa45d3bf9',
 'references':'1b74d185d47ea52db62d4c23cdbd44375b6ba0a05cf3824c4278e88646db9d1c',
 'priorResult':'50e64f25d0d9518500382acf173cc57355c89488a780caf37eb565c27572b853',
}

def checked(path,sha):
    exporter.require(exporter.digest(path.read_bytes())==sha,'input hash: '+str(path))
    return json.loads(path.read_bytes())

def blob(path):
    import hashlib
    b=path.read_bytes()
    return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()

def summary(values):
    return dict(total=sum(values),mean=statistics.mean(values),median=statistics.median(values),minimum=min(values),maximum=max(values))

def save(path,data):
    exporter.require(not path.exists() or path.read_bytes()==data,'refusing to overwrite different output: '+str(path))
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)

def run(args):
    here=Path(__file__).parent
    exporter.require(blob(here/'evaluate_stage1_drop_v1.py')=='3d74996281ec260e170ea10929bd0115a6d4ac70','matcher changed')
    exporter.require(blob(here/'analyze_stage1_anchor_coverage_v1.py')=='dd9594b6dde70e00025c9bfc74f2430d2b0356c6','scoring helpers changed')
    for path,key in ((args.base_zip,'baseZip'),(args.v2_zip,'v2Zip')):
        exporter.require(exporter.digest(path.read_bytes())==HASHES[key],key)
    base=checked(args.base_root/'STAGE1_PREP_MANIFEST_V1.json',HASHES['baseManifest'])
    prep=checked(args.v2_root/'STAGE1_V2_PREP_MANIFEST_V1.json',HASHES['v2Manifest'])
    prior=checked(args.prior_result,HASHES['priorResult'])
    refs_doc=checked(args.references,HASHES['references'])
    refs={r['id']:r['dropsSeconds'] for r in refs_doc['stage1']}
    exporter.require(len(refs)==50 and sum(map(len,refs.values()))==46,'Stage 1 references')
    for doc in (base,prep):
        exporter.require(doc['trackCount']==len(doc['tracks'])==50,'prep count')
        exporter.require({r['id'] for r in doc['tracks']}==set(refs),'prep identities')
        exporter.require({r['ordinal'] for r in doc['tracks']}==set(range(1,51)),'ordinals')
        exporter.require(doc['terminalTracksProcessed'] is False and doc['referenceLabelsReadByPreparation'] is False,'research boundary')
    base_by_id={r['id']:r for r in base['tracks']}
    policies={k:[] for k in exporter.POLICIES}
    bundle={}
    inputs=[]
    for row in sorted(prep['tracks'],key=lambda r:r['ordinal']):
        old=base_by_id[row['id']]
        exporter.require(all(old[k]==row[k] for k in ('ordinal','id','stem','analysisJsonSha256','analyzerRunnerSha256','analyzerSourceCommit')),'prep linkage')
        case=f"cases/{row['ordinal']:02d}-{row['stem']}"
        ap=args.base_root/case/'analysis-v019.json'
        pp=args.v2_root/case/'interpretation-packet-v1.json'
        analysis=checked(ap,row['analysisJsonSha256'])
        packet=checked(pp,row['hashes']['interpretationPacketSha256'])
        evidence_sha=row['hashes']['structureEvidenceSha256']
        checked(args.v2_root/case/'structure-evidence-v1.json',evidence_sha)
        checked(args.base_root/case/'structure-evidence-v1.json',evidence_sha)
        checked(args.base_root/case/'interpretation-packet-v1.json',row['hashes']['interpretationPacketSha256'])
        inputs.append(dict(ordinal=row['ordinal'],id=row['id'],analysisSha256=row['analysisJsonSha256'],packetV1Sha256=row['hashes']['interpretationPacketSha256'],evidenceV1Sha256=evidence_sha))
        for policy in policies:
            ev,source_map=exporter.build(ap.read_bytes(),pp.read_bytes(),evidence_sha,policy)
            integrity=exporter.validate(ev,source_map,ap.read_bytes(),pp.read_bytes(),evidence_sha)
            data=exporter.canonical(ev)
            map_data=exporter.canonical(source_map)
            anchor_rows=exporter.rows(ev)
            selected=[c for c in analysis['interactionCandidates'] if c['priority'] in exporter.POLICIES[policy][0]]
            raw=len(packet['boundaries'])+len(packet['landmarks'])+len(selected)
            ctimes={r['time'] for r in packet['boundaries']+packet['landmarks']}
            itimes={c['time'] for c in selected}
            # Baseline helper's rounding is applied only to scorer input, never exported times.
            t=scoring.unique_times(r[0] for r in anchor_rows)
            exporter.require(len(t)==len(anchor_rows),'scoring normalization would merge distinct export times')
            expected_times=scoring.unique_times(list(ctimes)+list(itimes))
            exporter.require(t==expected_times,'selected coverage changed')
            source_counts=collections.Counter(c['source'] for c in selected)
            source_counts.update({'boundary':len(packet['boundaries']),'landmark':len(packet['landmarks'])})
            priority_counts=collections.Counter(c['priority'] for c in selected)
            priority_counts['current']=len(packet['boundaries'])+len(packet['landmarks'])
            row_types=collections.Counter('current-only' if r[2] is None else exporter.SOURCES[r[2]] for r in anchor_rows)
            row_priorities=collections.Counter('current-only' if r[1] is None else exporter.PRIORITIES[r[1]] for r in anchor_rows)
            stats=dict(rawRecords=raw,anchors=len(t),duplicateRecordsRemoved=raw-len(t),
                currentDuplicateRecordsRemoved=len(packet['boundaries'])+len(packet['landmarks'])-len(ctimes),
                interactionDuplicateRecordsRemoved=len(selected)-len(itimes),interactionUniqueOverlapsCurrent=len(itimes&ctimes),
                compactEvidenceBytes=len(data),estimatedEvidenceTokens=math.ceil(len(data)/4),sourceMapBytes=len(map_data),
                totalStoredBytes=len(data)+len(map_data),baselinePacketBytes=len(exporter.canonical(packet)))
            record=dict(ordinal=row['ordinal'],id=row['id'],stats=stats,sourceRecordTypeDistribution=dict(source_counts),
                sourceRecordPriorityDistribution=dict(priority_counts),anchorTypeDistribution=dict(row_types),anchorPriorityDistribution=dict(row_priorities),
                integrity=integrity,evidenceSha256=exporter.digest(data),sourceMapSha256=exporter.digest(map_data),
                byTolerance={str(tol):scoring.score_refs(refs[row['id']],t,tol) for tol in scoring.TOLERANCES})
            policies[policy].append(record)
            if policy==exporter.SELECTED:
                bundle[case+'/structure-evidence-v2.json']=data
                bundle[case+'/structure-evidence-v2-source-map.json']=map_data
    results={}
    for policy,records in policies.items():
        results[policy]=dict(tracks=records,aggregates={str(t):scoring.aggregate([r['byTolerance'][str(t)] for r in records]) for t in scoring.TOLERANCES},
            stats={k:summary([r['stats'][k] for r in records]) for k in records[0]['stats']},
            distributions={key:dict(sum((collections.Counter(r[key]) for r in records),collections.Counter())) for key in ('sourceRecordTypeDistribution','sourceRecordPriorityDistribution','anchorTypeDistribution','anchorPriorityDistribution')},
            integrity=dict(allPassed=True,anchorsChecked=sum(r['integrity']['anchorsChecked'] for r in records),sourceReferencesChecked=sum(r['integrity']['sourceReferencesChecked'] for r in records)))
    chosen=results[exporter.SELECTED]
    frozen_union=prior['views']['current+core+accent']
    for tol in ('1.0','2.0','5.0'):
        exporter.require(chosen['aggregates'][tol]==frozen_union['aggregates'][tol],'selected policy differs from prior frozen union')
    naive_bytes=frozen_union['footprint']['hypotheticalCompactPacketBytes']['total']
    exporter.require(chosen['stats']['compactEvidenceBytes']['total']<naive_bytes,'no footprint reduction')
    result=dict(schema='trackcade-stage1-structure-evidence-v2-policy-evaluation',startingCommit='ca438c1ca0e223d7c3933cf3f65203d92c000435',
        selectedPolicy=exporter.SELECTED,selectionRationale='Predeclared current+core+accent exact union. Retain current context and both intended interaction priorities without label-based pruning; table versus objects is lossless encoding. Optional candidates are not added solely for the last Stage 1 match.',
        trackCount=50,referenceSupport=46,tolerancesSeconds=[1.0,2.0,5.0],primaryToleranceSeconds=2.0,
        sourceHashes=HASHES,inputTracks=inputs,
        scripts={n:exporter.digest((here/n).read_bytes()) for n in ('export_structure_evidence_v2.py','evaluate_structure_evidence_v2.py')},
        boundaries=dict(providerCalls=0,audioDecoded=False,analyzerExecuted=False,terminalTracksProcessed=False,compilerSemanticsChanged=False,v3RunCreated=False),
        priorAudit='Read-only saved result; interaction coverage script not executed',
        footprintMethod='Exact canonical UTF-8 JSON bytes, no whitespace/newline; includes legends, source hashes, context and contract. Token estimate=ceil(bytes/4), not model tokenizer or billing. Source map is stored separately and excluded from prospective model input; its bytes and combined storage are separately reported.',
        comparison=dict(naiveFullRecordUnionBytes=naive_bytes,chosenBytes=chosen['stats']['compactEvidenceBytes']['total'],
            reductionFraction=1-chosen['stats']['compactEvidenceBytes']['total']/naive_bytes,
            baselineCurrent=prior['views']['current']['aggregates']),policies=results)
    manifest=dict(schema='trackcade-stage1-structure-evidence-v2-bundle',policy=exporter.SELECTED,
        files={n:dict(sha256=exporter.digest(b),bytes=len(b)) for n,b in sorted(bundle.items())})
    bundle['MANIFEST.json']=exporter.canonical(manifest)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    save(args.output_dir/'STAGE1_STRUCTURE_EVIDENCE_V2_RESULTS.json',exporter.canonical(result)+b'\n')
    # A deterministic archive on the same Python/zlib version; individual content hashes are portable.
    import io
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,data in sorted(bundle.items()):
            info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.create_system=3
            info.external_attr=0o100644 << 16
            z.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    save(args.output_dir/'STAGE1_STRUCTURE_EVIDENCE_V2_PACKETS.zip',buffer.getvalue())
    print(json.dumps({k:dict(matches=[v['aggregates'][str(t)]['matchedReferenceSupport'] for t in scoring.TOLERANCES],anchors=v['stats']['anchors']['mean'],bytes=v['stats']['compactEvidenceBytes']['mean'],tokens=v['stats']['estimatedEvidenceTokens']['mean']) for k,v in results.items()},indent=2))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    for n in ('base-root','v2-root','base-zip','v2-zip','references','prior-result','output-dir'):
        ap.add_argument('--'+n,type=Path,required=True)
    run(ap.parse_args())

if __name__=='__main__':
    main()
