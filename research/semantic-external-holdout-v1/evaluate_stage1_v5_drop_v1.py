#!/usr/bin/env python3
"""Offline RAW V5 Stage1 evaluation.

The complete 50-response generation freeze is verified before the benchmark
reference file is opened. Scoring imports the unchanged frozen Stage1 matcher.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import evaluate_stage1_drop_v1 as frozen
import collect_stage1_v5_results_v1 as collection

REVISION = collection.REVISION
PROPOSAL_SCHEMA = collection.PROPOSAL_SCHEMA
REFERENCE_SHA256 = "1b74d185d47ea52db62d4c23cdbd44375b6ba0a05cf3824c4278e88646db9d1c"
SCORER_BLOB_SHA = "3d74996281ec260e170ea10929bd0115a6d4ac70"
V3_PRIMARY = {
    "referenceSupport": 46, "candidateSupport": 83, "matchedSupport": 19,
    "truePositives": 19, "falsePositives": 64, "falseNegatives": 27,
    "precision": 19/83, "recall": 19/46, "f1": 38/129,
}
V4_PRIMARY_F1 = 10/65


def fail(msg: str) -> None:
    raise SystemExit("V5 RAW EVAL FAIL-CLOSED: " + msg)


def load(path: Path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def git_blob_sha(path: Path) -> str:
    b = Path(path).read_bytes()
    return hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()


def find_status(case_root: Path) -> Path:
    hits = sorted(case_root.glob("stage1-v5-*-case-status-v1.json"))
    if len(hits) != 1:
        fail(f"expected one V5 status in {case_root}, found {len(hits)}")
    return hits[0]


def resolve_drop_times(packet: dict, proposal: dict):
    anchors = packet.get("anchors")
    if not isinstance(anchors, list):
        fail("packet anchors missing")
    times = []
    for event in proposal.get("events") or []:
        if not isinstance(event, dict):
            fail("validated proposal event is not object")
        if any(k in event for k in ("t", "time", "timestamp", "seconds")):
            fail("independent semantic timestamp field observed")
        if event.get("kind") != "drop":
            continue
        anchor = event.get("anchor")
        if not isinstance(anchor, dict) or anchor.get("type") != "evidence":
            fail("Drop does not use evidence anchor")
        idx = anchor.get("index")
        if not isinstance(idx, int) or isinstance(idx, bool) or not 0 <= idx < len(anchors):
            fail("Drop anchor index invalid")
        row = anchors[idx]
        if not isinstance(row, list) or len(row) != 5 or not frozen.finite_number(row[0]) or row[0] < 0:
            fail("Drop anchor row invalid")
        times.append(float(row[0]))
    return sorted(times)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--freeze-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--generation-freeze-sha256", required=True)
    ap.add_argument("--generation-freeze-artifact-id", required=True)
    args = ap.parse_args()

    freeze_path = args.freeze_root / "STAGE1_V5_GENERATION_FREEZE_V1.json"
    provider_root = args.freeze_root / "provider"
    if not freeze_path.is_file() or sha(freeze_path) != args.generation_freeze_sha256:
        fail("generation freeze identity mismatch")

    # Hard label-access barrier: complete immutable provider closure comes first.
    generation_cases = collection.verify_freeze(freeze_path, args.prep_root, provider_root)
    if len(generation_cases) != 50:
        fail("generation freeze closure")
    if git_blob_sha(Path(frozen.__file__).resolve()) != SCORER_BLOB_SHA:
        fail("frozen V1 scoring source changed")
    if args.output_dir.exists():
        fail("output already exists")

    prep_path = args.prep_root / collection.SOURCE_MANIFEST
    if sha(prep_path) != collection.SOURCE_MANIFEST_SHA256:
        fail("V5 source prep manifest identity")
    prep = load(prep_path)
    tracks = prep.get("tracks") or []
    if len(tracks) != 50 or prep.get("trackCount") != 50 or prep.get("providerCallsObserved") != 0:
        fail("V5 prep closure")
    if prep.get("terminalTracksProcessed") is not False or prep.get("compilerInvoked") is not False:
        fail("V5 prep research boundary")

    # First reference-file read occurs only after all 50 provider cases verify.
    if sha(args.references) != REFERENCE_SHA256:
        fail("reference source differs from frozen V1/V2/V3/V4 evaluation")
    refs_doc = load(args.references)
    if refs_doc.get("schema") != frozen.REFERENCE_SCHEMA or refs_doc.get("eventKind") != "drop":
        fail("reference schema/event kind mismatch")
    ref_rows = refs_doc.get("stage1")
    if not isinstance(ref_rows, list) or len(ref_rows) != 50:
        fail("reference Stage1 set must contain exactly 50 tracks")
    refs_by_id = {x.get("id"): x.get("dropsSeconds") for x in ref_rows if isinstance(x, dict)}
    if len(refs_by_id) != 50:
        fail("reference IDs not unique/exact")

    candidates, provenance = [], []
    usage_totals = {"input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0, "total_tokens": 0}
    presence_counts = {"drop_present": 0, "no_drop": 0, "ambiguous_only": 0}
    repetition = {"dropAssessments": 0, "repeatedSimilarDropAssessments": 0}
    ids = []

    for row in sorted(tracks, key=lambda x: x["ordinal"]):
        ordinal, track_id, stem = row["ordinal"], row["id"], row["stem"]
        ids.append(track_id)
        if track_id not in refs_by_id:
            fail(f"prep track missing from references: {track_id}")
        prep_case = args.prep_root / "cases" / f"{ordinal:02d}-{stem}"
        provider_case = provider_root / f"{ordinal:02d}-{stem}"
        packet_path = prep_case / "structure-evidence-v2.json"
        status_path = find_status(provider_case)
        proposal_path = provider_case / "normalized-proposal.json"
        status, proposal, packet = load(status_path), load(proposal_path), load(packet_path)
        entry = generation_cases[ordinal]
        if status.get("normalizedProposalSha256") != sha(proposal_path) or entry.get("normalizedProposalSha256") != sha(proposal_path):
            fail(f"proposal identity ordinal {ordinal}")
        if status.get("packetSha256") != sha(packet_path) or entry.get("packetSha256") != sha(packet_path):
            fail(f"packet identity ordinal {ordinal}")
        if proposal.get("schema") != PROPOSAL_SCHEMA:
            fail(f"proposal schema ordinal {ordinal}")
        src, psrc = proposal.get("source") or {}, packet.get("source") or {}
        if src.get("analyzerRunnerSha256") != frozen.ANALYZER_RUNNER_SHA256 or src.get("analyzerRunnerSha256") != psrc.get("analyzerRunnerSha256"):
            fail(f"Analyzer identity ordinal {ordinal}")
        if src.get("analysisJsonSha256") != psrc.get("analysisJsonSha256"):
            fail(f"analysis identity ordinal {ordinal}")

        summary = proposal.get("trackSummary") or {}
        presence = summary.get("dropPresence")
        if presence not in presence_counts:
            fail(f"presence ordinal {ordinal}")
        presence_counts[presence] += 1
        drops = resolve_drop_times(packet, proposal)
        if len(drops) != summary.get("dropCount") or len(drops) != status.get("dropProposalCount"):
            fail(f"Drop count ordinal {ordinal}")

        assessments = proposal.get("candidateAssessments") or []
        drop_assess = [a for a in assessments if isinstance(a, dict) and a.get("semanticRole") == "drop"]
        repetition["dropAssessments"] += len(drop_assess)
        repetition["repeatedSimilarDropAssessments"] += sum(
            1 for a in drop_assess if a.get("repetitionRelation") == "repeated_similar")

        usage = status.get("usage") or {}
        for key in ("input_tokens", "output_tokens", "total_tokens"):
            value = usage.get(key, 0)
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                fail(f"usage {key} ordinal {ordinal}")
            usage_totals[key] += value
        reasoning = (usage.get("output_tokens_details") or {}).get("reasoning_tokens", 0)
        if not isinstance(reasoning, int) or isinstance(reasoning, bool) or reasoning < 0:
            fail(f"reasoning usage ordinal {ordinal}")
        usage_totals["reasoning_tokens"] += reasoning

        candidates.append({
            "ordinal": ordinal, "id": track_id, "dropPresence": presence,
            "dropCount": summary.get("dropCount"),
            "ambiguousCandidateCount": summary.get("ambiguousCandidateCount"),
            "transportVariant": entry.get("transportVariant"),
            "proposalDropsSeconds": drops,
        })
        provenance.append({
            "ordinal": ordinal, "id": track_id, "generationArtifact": entry,
            "providerStatusSha256": sha(status_path),
            "normalizedProposalSha256": sha(proposal_path),
            "structureEvidenceV2Sha256": sha(packet_path), "usage": usage,
        })
    if set(ids) != set(refs_by_id) or len(set(ids)) != 50:
        fail("prep/reference identity sets differ")

    evaluation = {
        "schema": "trackcade-semantic-external-stage1-v5-drop-evaluation-v1",
        "stage": "stage1", "developmentRevision": REVISION,
        "status": "evaluated-raw-only-under-unchanged-frozen-matcher",
        "primaryToleranceSeconds": frozen.PRIMARY_TOLERANCE,
        "sensitivityToleranceSeconds": [1.0, 5.0],
        "scoringImplementation": "imported-unchanged-from-evaluate_stage1_drop_v1.py",
        "compilerInvoked": False, "trackCount": 50, "proposalDropsSeconds": {},
    }
    per_tol = {}
    for tol in frozen.TOLERANCES:
        rows, per_track = [], []
        for c in candidates:
            scored = frozen.score_track(refs_by_id[c["id"]], c["proposalDropsSeconds"], tol)
            rows.append(scored)
            per_track.append({"ordinal": c["ordinal"], "id": c["id"],
                              "dropPresence": c["dropPresence"], **scored})
        aggregate = frozen.aggregate(rows)
        evaluation["proposalDropsSeconds"][str(tol)] = {
            "toleranceSeconds": tol, "aggregate": aggregate, "tracks": per_track}
        per_tol[tol] = per_track

    primary = evaluation["proposalDropsSeconds"][str(frozen.PRIMARY_TOLERANCE)]["aggregate"]
    zero = [c for c in candidates if len(refs_by_id[c["id"]]) == 0]
    positive = [c for c in candidates if len(refs_by_id[c["id"]]) > 0]
    predicted_positive = sum(1 for c in candidates if c["proposalDropsSeconds"])
    diagnostics = {
        "presenceCounts": presence_counts,
        "proposalCount": sum(len(c["proposalDropsSeconds"]) for c in candidates),
        "predictedPositiveTracks": predicted_positive,
        "zeroReferenceTracks": len(zero),
        "zeroReferenceTracksWithFalsePositiveProposals": sum(1 for c in zero if c["proposalDropsSeconds"]),
        "zeroReferenceFalsePositiveProposals": sum(len(c["proposalDropsSeconds"]) for c in zero),
        "zeroReferenceProposalAbstentions": sum(1 for c in zero if not c["proposalDropsSeconds"]),
        "positiveReferenceTracks": len(positive),
        "positiveProposalOmissions": sum(1 for c in positive if not c["proposalDropsSeconds"]),
        "positivePredictedTracks": sum(1 for c in positive if c["proposalDropsSeconds"]),
        "proposalsPerPredictedPositiveTrack":
            (sum(len(c["proposalDropsSeconds"]) for c in candidates) / predicted_positive)
            if predicted_positive else None,
        "repetition": repetition, "usageTotals": usage_totals,
        "evidenceBoundRetryOrdinals": [4, 35],
    }
    evaluation["diagnostics"] = diagnostics

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=False)
    candidate_doc = {
        "schema": "trackcade-semantic-external-stage1-v5-drop-candidates-v1",
        "stage": "stage1", "developmentRevision": REVISION,
        "status": "offline-derived-from-completed-frozen-v5-provider-evidence",
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
        "compilerInvoked": False, "trackCount": 50, "tracks": candidates,
    }
    candidate_path = out / "STAGE1_V5_DROP_CANDIDATES_V1.json"
    evaluation_path = out / "STAGE1_V5_DROP_EVALUATION_V1.json"
    candidate_path.write_text(json.dumps(candidate_doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    evaluation_path.write_text(json.dumps(evaluation, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    micro = primary["micro"]
    headline = {
        "schema": "trackcade-semantic-external-stage1-v5-raw-headline-v1",
        "primaryToleranceSeconds": 2.0, "v5Primary": primary,
        "v3FrozenPrimary": V3_PRIMARY, "v4FrozenPrimaryF1": V4_PRIMARY_F1,
        "f1DeltaVsV3": micro["f1"] - V3_PRIMARY["f1"],
        "f1PercentagePointDeltaVsV3": 100 * (micro["f1"] - V3_PRIMARY["f1"]),
        "f1DeltaVsV4": micro["f1"] - V4_PRIMARY_F1,
        "f1PercentagePointDeltaVsV4": 100 * (micro["f1"] - V4_PRIMARY_F1),
        "diagnostics": diagnostics,
    }
    headline_path = out / "STAGE1_V5_RAW_HEADLINE_V1.json"
    headline_path.write_text(json.dumps(headline, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    csv_path = out / "STAGE1_V5_RAW_PER_TRACK_V1.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        fields = ["ordinal", "id", "dropPresence", "transportVariant", "referenceCount", "candidateCount",
                  "tp1", "fp1", "fn1", "tp2", "fp2", "fn2", "tp5", "fp5", "fn5"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for index, candidate in enumerate(candidates):
            r1, r2, r5 = per_tol[1.0][index], per_tol[2.0][index], per_tol[5.0][index]
            writer.writerow({
                "ordinal": candidate["ordinal"], "id": candidate["id"],
                "dropPresence": candidate["dropPresence"],
                "transportVariant": candidate["transportVariant"],
                "referenceCount": r2["referenceCount"], "candidateCount": r2["candidateCount"],
                "tp1": r1["truePositives"], "fp1": r1["falsePositives"], "fn1": r1["falseNegatives"],
                "tp2": r2["truePositives"], "fp2": r2["falsePositives"], "fn2": r2["falseNegatives"],
                "tp5": r5["truePositives"], "fp5": r5["falsePositives"], "fn5": r5["falseNegatives"],
            })

    provenance_doc = {
        "schema": "trackcade-semantic-external-stage1-v5-evaluation-provenance-v1",
        "developmentRevision": REVISION,
        "generationFreezeArtifactId": str(args.generation_freeze_artifact_id),
        "generationFreezeSha256": sha(freeze_path),
        "sourcePrepManifestSha256": sha(prep_path),
        "scoringSourceSha256": sha(Path(frozen.__file__).resolve()),
        "scoringSourceGitBlobSha": git_blob_sha(Path(frozen.__file__).resolve()),
        "referencesSha256": sha(args.references),
        "compilerInvoked": False, "terminalHoldoutProcessed": False,
        "providerCallsByEvaluation": 0, "tracks": provenance,
    }
    provenance_path = out / "STAGE1_V5_EVALUATION_PROVENANCE_V1.json"
    provenance_path.write_text(json.dumps(provenance_doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    freeze_doc = {
        "schema": "trackcade-semantic-external-stage1-v5-evaluation-freeze-v1",
        "status": "frozen-v5-raw-evaluation", "developmentRevision": REVISION,
        "generationFreezeArtifactId": str(args.generation_freeze_artifact_id),
        "generationFreezeSha256": sha(freeze_path),
        "candidateFileSha256": sha(candidate_path),
        "evaluationFileSha256": sha(evaluation_path),
        "headlineFileSha256": sha(headline_path),
        "perTrackCsvSha256": sha(csv_path),
        "provenanceFileSha256": sha(provenance_path),
        "referencesSha256": sha(args.references),
        "scoringSourceGitBlobSha": git_blob_sha(Path(frozen.__file__).resolve()),
        "compilerInvoked": False, "terminalHoldoutProcessed": False,
        "providerCallsByEvaluation": 0,
    }
    freeze_out = out / "STAGE1_V5_EVALUATION_FREEZE_V1.json"
    freeze_out.write_text(json.dumps(freeze_doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "evaluated_frozen_v5_raw", "primaryToleranceSeconds": 2.0,
        "v5Primary": primary, "diagnostics": diagnostics,
        "evaluationFreezeSha256": sha(freeze_out),
    }, indent=2))


if __name__ == "__main__":
    main()
