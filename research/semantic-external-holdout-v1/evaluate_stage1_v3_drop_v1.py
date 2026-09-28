#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import evaluate_stage1_drop_v1 as frozen

PREP_SCHEMA = "trackcade-semantic-external-stage1-v3-prep-v1"
CASE_SCHEMA = "trackcade-semantic-external-stage1-v3-provider-case-v1"
REVISION = "stage1-drop-semantics-v2-structure-evidence-v2"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v2"
EVALUATION_SCHEMA = "trackcade-semantic-external-stage1-v3-drop-evaluation-v1"
CANDIDATE_SCHEMA = "trackcade-semantic-external-stage1-v3-drop-candidates-v1"


def fail(msg: str) -> None:
    raise SystemExit(f"V3 RAW EVAL FAIL-CLOSED: {msg}")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path):
    return frozen.sha256(path)


def find_cases(provider_root: Path):
    statuses = list(provider_root.rglob("stage1-v3-case-status-v1.json"))
    if len(statuses) != 50:
        fail(f"expected 50 V3 statuses, found {len(statuses)}")
    out = {}
    for p in statuses:
        d = load(p)
        o = d.get("ordinal")
        if not isinstance(o, int) or isinstance(o, bool) or not 1 <= o <= 50 or o in out:
            fail(f"invalid/duplicate ordinal {o!r}")
        out[o] = p.parent
    if set(out) != set(range(1, 51)):
        fail("provider ordinals are not exactly 1..50")
    return out


def resolve_drop_times(packet: dict, proposal: dict):
    anchors = packet.get("anchors")
    if not isinstance(anchors, list):
        fail("packet anchors missing")
    out = []
    for event in proposal.get("events") or []:
        if not isinstance(event, dict):
            fail("validated proposal event is not object")
        if any(k in event for k in ("t", "time", "timestamp", "seconds")):
            fail("independent semantic timestamp field observed")
        if event.get("kind") != "drop":
            continue
        anchor = event.get("anchor")
        if not isinstance(anchor, dict) or anchor.get("type") != "evidence":
            fail("Drop does not use unified evidence anchor")
        idx = anchor.get("index")
        if not isinstance(idx, int) or isinstance(idx, bool) or not 0 <= idx < len(anchors):
            fail("Drop anchor index invalid")
        row = anchors[idx]
        if not isinstance(row, list) or len(row) != 5 or not isinstance(row[0], (int, float)):
            fail("Drop anchor row invalid")
        out.append(float(row[0]))
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--provider-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--generation-run-id", required=True)
    ap.add_argument("--generation-head-sha", required=True)
    ap.add_argument("--prep-artifact-id", required=True)
    args = ap.parse_args()

    prep_path = args.prep_root / "STAGE1_V3_PREP_MANIFEST_V1.json"
    prep = load(prep_path)
    if prep.get("schema") != PREP_SCHEMA or prep.get("status") != "frozen-v3-provider-payloads-prepared-no-provider-call":
        fail("prep manifest schema/status mismatch")
    if prep.get("developmentRevision") != REVISION:
        fail("prep revision mismatch")
    if prep.get("trackCount") != 50 or len(prep.get("tracks") or []) != 50:
        fail("prep track count mismatch")
    if prep.get("referenceLabelsReadByPreparation") is not False or prep.get("terminalTracksProcessed") is not False:
        fail("prep research boundary mismatch")
    if prep.get("compilerInvoked") is not False or prep.get("providerCallsObserved") != 0:
        fail("prep compiler/provider boundary mismatch")

    refs_doc = load(args.references)
    if refs_doc.get("schema") != frozen.REFERENCE_SCHEMA or refs_doc.get("eventKind") != "drop":
        fail("reference schema/event kind mismatch")
    ref_rows = refs_doc.get("stage1")
    if not isinstance(ref_rows, list) or len(ref_rows) != 50:
        fail("reference Stage 1 set must contain exactly 50 tracks")
    refs_by_id = {x.get("id"): x.get("dropsSeconds") for x in ref_rows if isinstance(x, dict)}
    if len(refs_by_id) != 50:
        fail("reference Stage 1 IDs not unique/exact")

    cases = find_cases(args.provider_root)
    candidates = []
    provenance_cases = []
    usage_totals = {"input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0, "total_tokens": 0}

    ids = []
    for row in sorted(prep["tracks"], key=lambda x: x["ordinal"]):
        ordinal = row["ordinal"]
        track_id = row["id"]
        ids.append(track_id)
        if track_id not in refs_by_id:
            fail(f"prep track missing from reference Stage 1 set: {track_id}")
        prep_case = args.prep_root / "cases" / f"{ordinal:02d}-{row['stem']}"
        provider_case = cases[ordinal]
        status_path = provider_case / "stage1-v3-case-status-v1.json"
        proposal_path = provider_case / "normalized-proposal.json"
        packet_path = prep_case / "structure-evidence-v2.json"
        status = load(status_path)
        if status.get("schema") != CASE_SCHEMA or status.get("stage") != "stage1-v3" or status.get("developmentRevision") != REVISION:
            fail(f"provider status schema/stage/revision mismatch ordinal {ordinal}")
        expected_status = {
            "id": track_id,
            "ordinal": ordinal,
            "providerCompletedSemanticResponse": True,
            "providerResponseObserved": True,
            "retryAuthorized": False,
            "semanticRetryCount": 0,
            "compilerInvoked": False,
            "harnessSourceCommit": args.generation_head_sha,
            "githubRunId": str(args.generation_run_id),
            "prepArtifactId": str(args.prep_artifact_id),
            "analyzerRunnerSha256": frozen.ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": frozen.ANALYZER_SOURCE_COMMIT,
            "analysisJsonSha256": row["analysisJsonSha256"],
            "frozenPayloadSha256": row["hashes"]["openaiPayloadV3Sha256"],
            "livePayloadSha256": row["hashes"]["openaiPayloadV3Sha256"],
            "preflightPayloadSha256": row["hashes"]["openaiPayloadV3Sha256"],
        }
        for k, want in expected_status.items():
            if status.get(k) != want:
                fail(f"provider status mismatch ordinal {ordinal}: {k}")
        if status.get("classification") != "provider_completed_validated_v3_proposal_no_retry":
            fail(f"provider completion classification mismatch ordinal {ordinal}")
        if status.get("responseModel") != "gpt-6-sol":
            fail(f"response model mismatch ordinal {ordinal}")
        if not proposal_path.exists() or sha(proposal_path) != status.get("normalizedProposalSha256"):
            fail(f"normalized proposal identity mismatch ordinal {ordinal}")
        if not packet_path.exists() or sha(packet_path) != row["hashes"]["structureEvidenceV2Sha256"]:
            fail(f"packet identity mismatch ordinal {ordinal}")

        packet = load(packet_path)
        proposal = load(proposal_path)
        if proposal.get("schema") != PROPOSAL_SCHEMA:
            fail(f"proposal schema mismatch ordinal {ordinal}")
        src = proposal.get("source") or {}
        if src.get("analyzerRunnerSha256") != frozen.ANALYZER_RUNNER_SHA256 or src.get("analysisJsonSha256") != row["analysisJsonSha256"]:
            fail(f"proposal source mismatch ordinal {ordinal}")
        proposal_drops = resolve_drop_times(packet, proposal)

        usage = status.get("usage") or {}
        for key in ("input_tokens", "output_tokens", "total_tokens"):
            value = usage.get(key, 0)
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                fail(f"invalid usage {key} ordinal {ordinal}")
            usage_totals[key] += value
        reasoning = ((usage.get("output_tokens_details") or {}).get("reasoning_tokens", 0))
        if not isinstance(reasoning, int) or isinstance(reasoning, bool) or reasoning < 0:
            fail(f"invalid reasoning token count ordinal {ordinal}")
        usage_totals["reasoning_tokens"] += reasoning

        candidates.append({
            "ordinal": ordinal,
            "id": track_id,
            "timingTier": row["timingTier"],
            "proposalDropsSeconds": proposal_drops,
        })
        provenance_cases.append({
            "ordinal": ordinal,
            "id": track_id,
            "providerStatusSha256": sha(status_path),
            "normalizedProposalSha256": sha(proposal_path),
            "structureEvidenceV2Sha256": sha(packet_path),
            "openaiResponseId": status.get("openaiResponseId"),
            "usage": usage,
        })

    if set(ids) != set(refs_by_id) or len(set(ids)) != 50:
        fail("prep/reference identity sets differ")

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    cand_doc = {
        "schema": CANDIDATE_SCHEMA,
        "stage": "stage1",
        "developmentRevision": REVISION,
        "status": "offline-derived-from-completed-v3-provider-evidence",
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
        "compilerInvoked": False,
        "trackCount": 50,
        "tracks": candidates,
    }
    cand_path = out / "STAGE1_V3_DROP_CANDIDATES_V1.json"
    cand_path.write_text(json.dumps(cand_doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    evaluation = {
        "schema": EVALUATION_SCHEMA,
        "stage": "stage1",
        "developmentRevision": REVISION,
        "status": "evaluated-raw-only-under-unchanged-frozen-matcher",
        "primaryToleranceSeconds": frozen.PRIMARY_TOLERANCE,
        "sensitivityToleranceSeconds": [1.0, 5.0],
        "scoringImplementation": "imported-unchanged-from-evaluate_stage1_drop_v1.py",
        "compilerInvoked": False,
        "trackCount": 50,
        "proposalDropsSeconds": {},
    }
    for tol in frozen.TOLERANCES:
        rows = []
        per_track = []
        for c in candidates:
            scored = frozen.score_track(refs_by_id[c["id"]], c["proposalDropsSeconds"], tol)
            rows.append(scored)
            per_track.append({"ordinal": c["ordinal"], "id": c["id"], **scored})
        evaluation["proposalDropsSeconds"][str(tol)] = {
            "toleranceSeconds": tol,
            "aggregate": frozen.aggregate(rows),
            "tracks": per_track,
        }
    eval_path = out / "STAGE1_V3_DROP_EVALUATION_V1.json"
    eval_path.write_text(json.dumps(evaluation, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    prov = {
        "schema": "trackcade-semantic-external-stage1-v3-evaluation-provenance-v1",
        "developmentRevision": REVISION,
        "generationRunId": str(args.generation_run_id),
        "generationHeadSha": args.generation_head_sha,
        "prepArtifactId": str(args.prep_artifact_id),
        "prepManifestSha256": sha(prep_path),
        "scoringSourceSha256": sha(Path(frozen.__file__).resolve()),
        "referencesSha256": sha(args.references),
        "compilerInvoked": False,
        "usageTotals": usage_totals,
        "cases": provenance_cases,
    }
    prov_path = out / "STAGE1_V3_EVALUATION_PROVENANCE_V1.json"
    prov_path.write_text(json.dumps(prov, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": evaluation["status"],
        "primary": evaluation["proposalDropsSeconds"][str(frozen.PRIMARY_TOLERANCE)]["aggregate"],
        "compilerInvoked": False,
        "usageTotals": usage_totals,
    }, indent=2))


if __name__ == "__main__":
    main()
