#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

EXPECTED_TRACKS = 50
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def resolve_drop_times(proposal: dict, evidence: dict) -> list[float]:
    out = []
    for event in proposal.get("events") or []:
        if event.get("kind") != "drop":
            continue
        anchor = event.get("anchor") or {}
        typ, idx = anchor.get("type"), anchor.get("index")
        if typ not in {"boundary", "landmark"} or not isinstance(idx, int) or isinstance(idx, bool):
            raise ValueError("validated proposal contains invalid drop anchor")
        rows = evidence.get("boundaries" if typ == "boundary" else "landmarks")
        if not isinstance(rows, list) or idx < 0 or idx >= len(rows):
            raise ValueError("validated proposal drop anchor out of range")
        t = rows[idx].get("time")
        if not isinstance(t, (int, float)) or isinstance(t, bool) or not math.isfinite(float(t)) or float(t) < 0:
            raise ValueError("validated proposal drop anchor has invalid time")
        out.append(float(t))
    return sorted(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--generation-root", type=Path, required=True)
    ap.add_argument("--compiler", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    prep = json.loads((args.prep_root / "STAGE1_PREP_MANIFEST_V1.json").read_text(encoding="utf-8"))
    if prep.get("schema") != "trackcade-semantic-external-stage1-prep-v1" or prep.get("trackCount") != EXPECTED_TRACKS:
        raise SystemExit("FAIL-CLOSED: prep manifest mismatch")
    prep_rows = sorted(prep["tracks"], key=lambda x: x["ordinal"])

    status_files = list(args.generation_root.rglob("stage1-case-status-v1.json"))
    statuses = [json.loads(p.read_text(encoding="utf-8")) for p in status_files]
    completed = [s for s in statuses if s.get("providerCompletedSemanticResponse") is True]
    completed_by_ord = {}
    for s in completed:
        o = s.get("ordinal")
        if o in completed_by_ord:
            raise SystemExit(f"FAIL-CLOSED: duplicate completed provider evidence for ordinal {o}")
        completed_by_ord[o] = s
    missing = [o for o in range(1, EXPECTED_TRACKS + 1) if o not in completed_by_ord]
    if missing:
        summary = {
            "schema": "trackcade-semantic-external-stage1-generation-closure-v1",
            "status": "incomplete-provider-closure-no-evaluation",
            "expectedTracks": EXPECTED_TRACKS,
            "completedTracks": len(completed_by_ord),
            "missingCompletedResponseOrdinals": missing,
        }
        write_json(out / "GENERATION_CLOSURE_V1.json", summary)
        raise SystemExit(f"FAIL-CLOSED: only {len(completed_by_ord)}/50 completed provider responses; missing {missing}")

    status_path_by_ord = {}
    for p in status_files:
        s = json.loads(p.read_text(encoding="utf-8"))
        if s.get("providerCompletedSemanticResponse") is True:
            status_path_by_ord[s["ordinal"]] = p

    candidates = {
        "schema": "trackcade-semantic-external-drop-candidates-v1",
        "stage": "stage1",
        "eventKind": "drop",
        "timingAuthority": "deterministic-analyzer-anchors-only",
        "tracks": [],
    }
    audit_tracks = []
    response_ids = []
    total_input = total_cached = total_output = 0

    compile_root = out / "compiled"
    for row in prep_rows:
        o, stem = row["ordinal"], row["stem"]
        s = completed_by_ord[o]
        if s.get("id") != row["id"] or s.get("stem") != stem:
            raise SystemExit(f"FAIL-CLOSED: generation/prep identity mismatch ordinal {o}")
        if s.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256:
            raise SystemExit(f"FAIL-CLOSED: Analyzer identity drift ordinal {o}")
        response_ids.append(s.get("openaiResponseId"))
        case = args.prep_root / "cases" / f"{o:02d}-{stem}"
        evidence = json.loads((case / "structure-evidence-v1.json").read_text(encoding="utf-8"))
        safe = case / "trackcade-safe-v1.json"
        generated_dir = status_path_by_ord[o].parent
        normalized_path = generated_dir / "normalized-proposal.json"
        proposal_drops = []
        accepted_drops = []
        compiler_status = "not_run_no_validated_proposal"
        compile_report_sha = None
        compiled_sha = None
        bpm_invariant = None
        beat_offset_invariant = None
        beat_grid_invariant = None
        if normalized_path.is_file():
            proposal = json.loads(normalized_path.read_text(encoding="utf-8"))
            proposal_drops = resolve_drop_times(proposal, evidence)
            cdir = compile_root / f"{o:02d}-{stem}"
            cdir.mkdir(parents=True, exist_ok=True)
            compiled_path = cdir / "compiled-safe-v1.json"
            report_path = cdir / "semantic-compile-report-v1.json"
            rc = subprocess.run([
                sys.executable, str(args.compiler),
                "--safe-manifest", str(safe),
                "--evidence", str(case / "structure-evidence-v1.json"),
                "--proposal", str(normalized_path),
                "--output", str(compiled_path),
                "--report", str(report_path),
            ], check=False).returncode
            if rc != 0 or not compiled_path.is_file() or not report_path.is_file():
                raise SystemExit(f"FAIL-CLOSED: compiler failure ordinal {o}")
            compiled = json.loads(compiled_path.read_text(encoding="utf-8"))
            accepted_drops = sorted(float(e["t"]) for e in compiled.get("events", []) if isinstance(e, dict) and e.get("kind") == "drop")
            compiler_status = "compiled_frozen_policy"
            compile_report_sha = sha(report_path)
            compiled_sha = sha(compiled_path)
            baseline = json.loads(safe.read_text(encoding="utf-8"))
            bpm_invariant = compiled.get("bpm") == baseline.get("bpm")
            beat_offset_invariant = compiled.get("beatOffset") == baseline.get("beatOffset")
            base_beats = [e for e in baseline.get("events", []) if isinstance(e, dict) and e.get("kind") == "beat"]
            compiled_beats = [e for e in compiled.get("events", []) if isinstance(e, dict) and e.get("kind") == "beat"]
            beat_grid_invariant = compiled_beats == base_beats
            if not (bpm_invariant and beat_offset_invariant and beat_grid_invariant):
                raise SystemExit(f"FAIL-CLOSED: protected timing invariance failure ordinal {o}")

        usage = s.get("usage") if isinstance(s.get("usage"), dict) else {}
        inp = int(usage.get("input_tokens") or 0)
        outp = int(usage.get("output_tokens") or 0)
        details = usage.get("input_tokens_details") if isinstance(usage.get("input_tokens_details"), dict) else {}
        cached = int(details.get("cached_tokens") or 0)
        total_input += inp
        total_cached += cached
        total_output += outp

        candidates["tracks"].append({
            "id": row["id"],
            "timingTier": row["timingTier"],
            "compilerEligible": row["compilerEligible"],
            "proposalDropsSeconds": proposal_drops,
            "acceptedDropsSeconds": accepted_drops,
        })
        audit_tracks.append({
            "ordinal": o,
            "id": row["id"],
            "classification": s.get("classification"),
            "openaiResponseId": s.get("openaiResponseId"),
            "responseModel": s.get("responseModel"),
            "rawResponseSha256": s.get("rawResponseSha256"),
            "normalizedProposalSha256": s.get("normalizedProposalSha256"),
            "proposalDropCount": len(proposal_drops),
            "acceptedDropCount": len(accepted_drops),
            "compilerStatus": compiler_status,
            "compilerReportSha256": compile_report_sha,
            "compiledManifestSha256": compiled_sha,
            "proposalTimingResolvedOnlyFromDeterministicAnchors": normalized_path.is_file(),
            "bpmInvariant": bpm_invariant,
            "beatOffsetInvariant": beat_offset_invariant,
            "beatGridInvariant": beat_grid_invariant,
            "timingTier": row["timingTier"],
            "analyzerRunnerSha256": s.get("analyzerRunnerSha256"),
            "analysisJsonSha256": row["analysisJsonSha256"],
            "usage": usage,
        })

    if len(set(response_ids)) != EXPECTED_TRACKS or any(not isinstance(x, str) or not x for x in response_ids):
        raise SystemExit("FAIL-CLOSED: completed provider response IDs are missing or non-unique")

    write_json(out / "STAGE1_DROP_CANDIDATES_V1.json", candidates)
    summary = {
        "schema": "trackcade-semantic-external-stage1-generation-closure-v1",
        "status": "all-50-completed-provider-responses-candidates-built",
        "trackCount": EXPECTED_TRACKS,
        "uniqueProviderResponseIds": len(set(response_ids)),
        "validatedProposalTracks": sum(1 for x in audit_tracks if x["normalizedProposalSha256"]),
        "proposalDropCount": sum(x["proposalDropCount"] for x in audit_tracks),
        "acceptedDropCount": sum(x["acceptedDropCount"] for x in audit_tracks),
        "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
        "timingAuthority": "Analyzer v0.19 deterministic anchors only; provider supplied no independent timestamps",
        "allCompiledTracksProtectedTimingInvariant": all(
            (x["bpmInvariant"] is True and x["beatOffsetInvariant"] is True and x["beatGridInvariant"] is True)
            for x in audit_tracks if x["compilerStatus"] == "compiled_frozen_policy"
        ),
        "usageTotals": {
            "inputTokens": total_input,
            "cachedInputTokens": total_cached,
            "outputTokens": total_output,
        },
        "standardPricingSnapshotUsdPerMillionTokens": {
            "input": 2.0,
            "cachedInput": 0.2,
            "output": 10.0,
            "verifiedDate": "2026-09-28",
        },
        "estimatedTokenCostUsd": ((total_input - total_cached) * 2.0 + total_cached * 0.2 + total_output * 10.0) / 1_000_000,
        "tracks": audit_tracks,
    }
    write_json(out / "GENERATION_CLOSURE_V1.json", summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
