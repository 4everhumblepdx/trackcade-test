#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import evaluate_stage1_drop_v1 as frozen
import collect_stage1_v4_results_v1 as collection

REVISION = collection.REVISION
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v3"
REFERENCE_SHA256 = "1b74d185d47ea52db62d4c23cdbd44375b6ba0a05cf3824c4278e88646db9d1c"
SCORER_BLOB_SHA = "3d74996281ec260e170ea10929bd0115a6d4ac70"
V3_PRIMARY = {
    "referenceSupport": 46,
    "candidateSupport": 83,
    "matchedSupport": 19,
    "truePositives": 19,
    "falsePositives": 64,
    "falseNegatives": 27,
    "precision": 19/83,
    "recall": 19/46,
    "f1": 38/129,
}


def fail(msg: str) -> None:
    raise SystemExit("V4 RAW EVAL FAIL-CLOSED: " + msg)


def load(path: Path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def git_blob_sha(path: Path) -> str:
    b=Path(path).read_bytes()
    return hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()


def find_cases(provider_root: Path):
    statuses=list(Path(provider_root).rglob(collection.STATUS_FILE))
    if len(statuses)!=50:
        fail(f"expected 50 V4 statuses, found {len(statuses)}")
    out={}
    for p in statuses:
        d=load(p); o=d.get("ordinal")
        if not isinstance(o,int) or isinstance(o,bool) or not 1<=o<=50 or o in out:
            fail(f"invalid/duplicate ordinal {o!r}")
        out[o]=p.parent
    if set(out)!=set(range(1,51)):
        fail("provider ordinals are not exactly 1..50")
    return out


def resolve_drop_times(packet: dict, proposal: dict):
    anchors=packet.get("anchors")
    if not isinstance(anchors,list):
        fail("packet anchors missing")
    times=[]
    for event in proposal.get("events") or []:
        if not isinstance(event,dict):
            fail("validated proposal event is not object")
        if any(k in event for k in ("t","time","timestamp","seconds")):
            fail("independent semantic timestamp field observed")
        if event.get("kind")!="drop":
            continue
        anchor=event.get("anchor")
        if not isinstance(anchor,dict) or anchor.get("type")!="evidence":
            fail("Drop does not use unified evidence anchor")
        idx=anchor.get("index")
        if not isinstance(idx,int) or isinstance(idx,bool) or not 0<=idx<len(anchors):
            fail("Drop anchor index invalid")
        row=anchors[idx]
        if not isinstance(row,list) or len(row)!=5 or not frozen.finite_number(row[0]) or row[0]<0:
            fail("Drop anchor row invalid")
        times.append(float(row[0]))
    return sorted(times)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--freeze-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--generation-freeze-sha256", required=True)
    ap.add_argument("--generation-freeze-artifact-id", required=True)
    args=ap.parse_args()

    freeze_path=args.freeze_root/"STAGE1_V4_GENERATION_FREEZE_V1.json"
    provider_root=args.freeze_root/"provider"
    if not freeze_path.is_file() or sha(freeze_path)!=args.generation_freeze_sha256:
        fail("generation freeze identity mismatch")
    # Critical barrier: verify all 50 immutable provider cases before reference access.
    generation_cases=collection.verify_freeze(freeze_path, args.prep_root, provider_root)
    if len(generation_cases)!=50:
        fail("generation freeze closure")
    if git_blob_sha(Path(frozen.__file__).resolve())!=SCORER_BLOB_SHA:
        fail("frozen V1 scoring source changed")
    if args.output_dir.exists():
        fail("output already exists; refusing overwrite")

    prep_path=args.prep_root/collection.SOURCE_MANIFEST
    if sha(prep_path)!=collection.SOURCE_MANIFEST_SHA256:
        fail("V4 source prep manifest identity")
    prep=load(prep_path)
    tracks=prep.get("tracks") or []
    if len(tracks)!=50 or prep.get("trackCount")!=50 or prep.get("providerCallsObserved")!=0:
        fail("V4 prep closure")
    if prep.get("terminalTracksProcessed") is not False or prep.get("compilerInvoked") is not False:
        fail("V4 prep research boundary")

    # References are first opened only after the complete frozen provider inventory passes verification.
    if sha(args.references)!=REFERENCE_SHA256:
        fail("reference source differs from frozen V1/V2/V3 evaluation")
    refs_doc=load(args.references)
    if refs_doc.get("schema")!=frozen.REFERENCE_SCHEMA or refs_doc.get("eventKind")!="drop":
        fail("reference schema/event kind mismatch")
    ref_rows=refs_doc.get("stage1")
    if not isinstance(ref_rows,list) or len(ref_rows)!=50:
        fail("reference Stage1 set must contain exactly 50 tracks")
    refs_by_id={x.get("id"):x.get("dropsSeconds") for x in ref_rows if isinstance(x,dict)}
    if len(refs_by_id)!=50:
        fail("reference IDs not unique/exact")

    cases=find_cases(provider_root)
    candidates=[]; provenance=[]
    usage_totals={"input_tokens":0,"output_tokens":0,"reasoning_tokens":0,"total_tokens":0}
    presence_counts={"drop_present":0,"no_drop":0,"insufficient_semantic_evidence":0}

    ids=[]
    for row in sorted(tracks,key=lambda x:x["ordinal"]):
        ordinal=row["ordinal"]; track_id=row["id"]; stem=row["stem"]
        ids.append(track_id)
        if track_id not in refs_by_id:
            fail(f"prep track missing from references: {track_id}")
        prep_case=args.prep_root/"cases"/f"{ordinal:02d}-{stem}"
        provider_case=cases[ordinal]
        packet_path=prep_case/"structure-evidence-v2.json"
        status_path=provider_case/collection.STATUS_FILE
        proposal_path=provider_case/"normalized-proposal.json"
        status=load(status_path); proposal=load(proposal_path); packet=load(packet_path)
        entry=generation_cases[ordinal]
        if status.get("normalizedProposalSha256")!=sha(proposal_path) or entry.get("normalizedProposalSha256")!=sha(proposal_path):
            fail(f"proposal identity ordinal {ordinal}")
        if status.get("packetSha256")!=sha(packet_path) or entry.get("packetSha256")!=sha(packet_path):
            fail(f"packet identity ordinal {ordinal}")
        if proposal.get("schema")!=PROPOSAL_SCHEMA:
            fail(f"proposal schema ordinal {ordinal}")
        src=proposal.get("source") or {}; psrc=packet.get("source") or {}
        if src.get("analyzerRunnerSha256")!=frozen.ANALYZER_RUNNER_SHA256 or src.get("analyzerRunnerSha256")!=psrc.get("analyzerRunnerSha256"):
            fail(f"Analyzer identity ordinal {ordinal}")
        if src.get("analysisJsonSha256")!=psrc.get("analysisJsonSha256"):
            fail(f"analysis identity ordinal {ordinal}")
        decision=proposal.get("trackSemanticDecision") or {}
        presence=decision.get("dropPresence")
        if presence not in presence_counts:
            fail(f"presence ordinal {ordinal}")
        presence_counts[presence]+=1
        drops=resolve_drop_times(packet,proposal)
        if len(drops)!=status.get("dropProposalCount"):
            fail(f"Drop count ordinal {ordinal}")
        usage=status.get("usage") or {}
        for k in ("input_tokens","output_tokens","total_tokens"):
            v=usage.get(k,0)
            if not isinstance(v,int) or isinstance(v,bool) or v<0: fail(f"usage {k} ordinal {ordinal}")
            usage_totals[k]+=v
        reasoning=((usage.get("output_tokens_details") or {}).get("reasoning_tokens",0))
        if not isinstance(reasoning,int) or isinstance(reasoning,bool) or reasoning<0: fail(f"reasoning usage ordinal {ordinal}")
        usage_totals["reasoning_tokens"]+=reasoning
        candidates.append({
            "ordinal":ordinal,"id":track_id,"dropPresence":presence,
            "localizationStatus":decision.get("localizationStatus"),
            "proposalDropsSeconds":drops,
        })
        provenance.append({
            "ordinal":ordinal,"id":track_id,"generationArtifact":entry,
            "providerStatusSha256":sha(status_path),"normalizedProposalSha256":sha(proposal_path),
            "structureEvidenceV2Sha256":sha(packet_path),"usage":usage,
        })
    if set(ids)!=set(refs_by_id) or len(set(ids))!=50:
        fail("prep/reference identity sets differ")

    evaluation={
        "schema":"trackcade-semantic-external-stage1-v4-drop-evaluation-v1",
        "stage":"stage1","developmentRevision":REVISION,
        "transportAmendment":"flex8192",
        "status":"evaluated-raw-only-under-unchanged-frozen-matcher",
        "primaryToleranceSeconds":frozen.PRIMARY_TOLERANCE,
        "sensitivityToleranceSeconds":[1.0,5.0],
        "scoringImplementation":"imported-unchanged-from-evaluate_stage1_drop_v1.py",
        "compilerInvoked":False,"trackCount":50,"proposalDropsSeconds":{},
    }
    per_tol={}
    for tol in frozen.TOLERANCES:
        rows=[]; per_track=[]
        for c in candidates:
            s=frozen.score_track(refs_by_id[c["id"]],c["proposalDropsSeconds"],tol)
            rows.append(s); per_track.append({"ordinal":c["ordinal"],"id":c["id"],"dropPresence":c["dropPresence"],**s})
        agg=frozen.aggregate(rows)
        evaluation["proposalDropsSeconds"][str(tol)]={"toleranceSeconds":tol,"aggregate":agg,"tracks":per_track}
        per_tol[tol]=per_track

    primary=evaluation["proposalDropsSeconds"][str(frozen.PRIMARY_TOLERANCE)]["aggregate"]
    zero=[]; positive=[]
    for c in candidates:
        refs=refs_by_id[c["id"]]
        (zero if len(refs)==0 else positive).append(c)
    zero_fp_tracks=sum(1 for c in zero if c["proposalDropsSeconds"])
    zero_fp_proposals=sum(len(c["proposalDropsSeconds"]) for c in zero)
    predicted_positive=sum(1 for c in candidates if c["proposalDropsSeconds"])
    positive_predicted=sum(1 for c in positive if c["proposalDropsSeconds"])
    diagnostics={
        "presenceCounts":presence_counts,
        "proposalCount":sum(len(c["proposalDropsSeconds"]) for c in candidates),
        "predictedPositiveTracks":predicted_positive,
        "zeroReferenceTracks":len(zero),
        "zeroReferenceDecisionAbstentions":sum(1 for c in zero if c["dropPresence"] in {"no_drop","insufficient_semantic_evidence"}),
        "zeroReferenceProposalAbstentions":sum(1 for c in zero if not c["proposalDropsSeconds"]),
        "zeroReferenceTracksWithFalsePositiveProposals":zero_fp_tracks,
        "zeroReferenceFalsePositiveProposals":zero_fp_proposals,
        "positiveReferenceTracks":len(positive),
        "positiveDecisionAbstentions":sum(1 for c in positive if c["dropPresence"] in {"no_drop","insufficient_semantic_evidence"}),
        "positiveProposalOmissions":sum(1 for c in positive if not c["proposalDropsSeconds"]),
        "positivePredictedTracks":positive_predicted,
        "proposalsPerPredictedPositiveTrack":(sum(len(c["proposalDropsSeconds"]) for c in candidates)/predicted_positive) if predicted_positive else None,
    }
    evaluation["diagnostics"]=diagnostics

    out=args.output_dir; out.mkdir(parents=True,exist_ok=False)
    cand_doc={
        "schema":"trackcade-semantic-external-stage1-v4-drop-candidates-v1","stage":"stage1",
        "developmentRevision":REVISION,"transportAmendment":"flex8192",
        "status":"offline-derived-from-completed-frozen-v4-provider-evidence",
        "timingAuthority":"frozen-analyzer-derived-anchor-only","compilerInvoked":False,
        "trackCount":50,"tracks":candidates,
    }
    cand_path=out/"STAGE1_V4_DROP_CANDIDATES_V1.json"
    eval_path=out/"STAGE1_V4_DROP_EVALUATION_V1.json"
    cand_path.write_text(json.dumps(cand_doc,indent=2,sort_keys=True)+"\n")
    eval_path.write_text(json.dumps(evaluation,indent=2,sort_keys=True)+"\n")

    headline={
        "schema":"trackcade-semantic-external-stage1-v4-raw-headline-v1",
        "primaryToleranceSeconds":2.0,
        "v4Primary":primary,
        "v3FrozenPrimary":V3_PRIMARY,
        "f1AbsoluteDelta":primary["micro"]["f1"]-V3_PRIMARY["f1"],
        "f1PercentagePointDelta":100*(primary["micro"]["f1"]-V3_PRIMARY["f1"]),
        "diagnostics":diagnostics,
    }
    headline_path=out/"STAGE1_V4_RAW_HEADLINE_V1.json"
    headline_path.write_text(json.dumps(headline,indent=2,sort_keys=True)+"\n")

    csv_path=out/"STAGE1_V4_RAW_PER_TRACK_V1.csv"
    with csv_path.open("w",newline="",encoding="utf-8") as f:
        fields=["ordinal","id","dropPresence","referenceCount","candidateCount","tp1","fp1","fn1","tp2","fp2","fn2","tp5","fp5","fn5"]
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
        for i,c in enumerate(candidates):
            r1=per_tol[1.0][i]; r2=per_tol[2.0][i]; r5=per_tol[5.0][i]
            w.writerow({"ordinal":c["ordinal"],"id":c["id"],"dropPresence":c["dropPresence"],
                "referenceCount":r2["referenceCount"],"candidateCount":r2["candidateCount"],
                "tp1":r1["truePositives"],"fp1":r1["falsePositives"],"fn1":r1["falseNegatives"],
                "tp2":r2["truePositives"],"fp2":r2["falsePositives"],"fn2":r2["falseNegatives"],
                "tp5":r5["truePositives"],"fp5":r5["falsePositives"],"fn5":r5["falseNegatives"]})

    provenance_doc={
        "schema":"trackcade-semantic-external-stage1-v4-evaluation-provenance-v1",
        "developmentRevision":REVISION,"transportAmendment":"flex8192",
        "generationFreezeArtifactId":str(args.generation_freeze_artifact_id),
        "generationFreezeSha256":sha(freeze_path),
        "sourcePrepManifestSha256":sha(prep_path),
        "scoringSourceSha256":sha(Path(frozen.__file__).resolve()),
        "scoringSourceGitBlobSha":git_blob_sha(Path(frozen.__file__).resolve()),
        "referencesSha256":sha(args.references),
        "compilerInvoked":False,"providerCallsMadeByEvaluator":0,"terminalTracksProcessed":False,
        "usageTotals":usage_totals,"cases":provenance,
        "candidateSha256":sha(cand_path),"evaluationSha256":sha(eval_path),
        "headlineSha256":sha(headline_path),"perTrackCsvSha256":sha(csv_path),
        "evaluatorSourceSha256":sha(Path(__file__).resolve()),
    }
    prov_path=out/"STAGE1_V4_EVALUATION_PROVENANCE_V1.json"
    prov_path.write_text(json.dumps(provenance_doc,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":evaluation["status"],"primary":primary,"diagnostics":diagnostics,
        "f1PercentagePointDeltaVsV3":headline["f1PercentagePointDelta"],"providerCalls":0,"terminal":False,"compiler":False},indent=2))


if __name__=="__main__":
    main()
