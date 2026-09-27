#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import json
import math
from pathlib import Path

SCHEMA_PROPOSAL = "trackcade-musical-interpretation-v1"
SCHEMA_SAFE = "trackcade-safe-gameplay-baseline-v1"
SCHEMA_EVIDENCE = "trackcade-structure-evidence-v1"
SCHEMA_REPORT = "trackcade-semantic-compile-v1"

CONFIDENCE_MIN = {
    "section": 0.80,
    "energy": 0.85,
    "peak": 0.90,
    "drop": 0.92,
}
COOLDOWN_S = {
    "section": 3.0,
    "energy": 10.0,
    "peak": 8.0,
    "drop": 12.0,
}
HIGH_IMPACT = {"energy", "peak", "drop"}
HIGH_IMPACT_MIN_GAP_S = 4.0
SECTION_MERGE_WINDOW_S = 0.75
DROP_DURATION_DEFAULT_S = 12.0
DROP_DURATION_MIN_S = 6.0
DROP_DURATION_MAX_S = 20.0
EVENT_ORDER = {"section": 0, "energy": 1, "drop": 2, "peak": 3, "beat": 4}


def finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))


def close(a, b, tol=1e-6):
    return finite(a) and finite(b) and abs(float(a) - float(b)) <= tol


def fail(msg):
    raise SystemExit(f"FAIL-CLOSED: {msg}")


def clean_text(value, max_len):
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    value = " ".join(value.strip().split())
    if not value:
        return None
    return value[:max_len]


def require_source_integrity(safe, evidence, proposal):
    generation = safe.get("generation")
    if not isinstance(generation, dict) or generation.get("schema") != SCHEMA_SAFE:
        fail("input manifest is not a validated safe automatic baseline")
    if generation.get("policy", {}).get("dropPeakEnergyCommandsGenerated") is not False:
        fail("safe baseline provenance does not prohibit semantic commands")
    if generation.get("policy", {}).get("semanticEventsGenerated") != []:
        fail("safe baseline already claims semantic event generation")
    if generation.get("timingTier") not in {"standard", "loose"}:
        fail("safe baseline timing tier is not gameplay-eligible")

    if evidence.get("schema") != SCHEMA_EVIDENCE:
        fail("structure evidence schema mismatch")
    if evidence.get("policy", {}).get("semanticGameplayEventsAuthorized") is not False:
        fail("structure evidence unexpectedly authorizes semantic gameplay")

    if proposal.get("schema") != SCHEMA_PROPOSAL:
        fail("interpretation proposal schema mismatch")
    if not isinstance(proposal.get("events"), list):
        fail("interpretation proposal events missing/not-list")
    if len(proposal["events"]) > 64:
        fail("interpretation proposal contains more than 64 events")

    safe_sha = generation.get("analyzerRunnerSha256")
    evidence_sha = (evidence.get("source") or {}).get("analyzerRunnerSha256")
    proposal_sha = (proposal.get("source") or {}).get("analyzerRunnerSha256")
    if not isinstance(safe_sha, str) or safe_sha != evidence_sha or safe_sha != proposal_sha:
        fail("Analyzer runner SHA-256 mismatch across safe/evidence/proposal")

    safe_analysis = generation.get("analysisJsonSha256")
    evidence_analysis = (evidence.get("source") or {}).get("analysisJsonSha256")
    proposal_analysis = (proposal.get("source") or {}).get("analysisJsonSha256")
    if not isinstance(safe_analysis, str) or len(safe_analysis) != 64:
        fail("safe baseline has no exact analysis JSON identity")
    if safe_analysis != evidence_analysis or safe_analysis != proposal_analysis:
        fail("analysis JSON SHA-256 mismatch across safe/evidence/proposal")

    if not close(safe.get("songLength"), (evidence.get("source") or {}).get("duration"), 1e-3):
        fail("song duration mismatch between safe manifest and evidence")
    if generation.get("timingTier") != (evidence.get("timingTrust") or {}).get("tier"):
        fail("timing tier mismatch between safe manifest and evidence")

    safe_kinds = {e.get("kind") for e in safe.get("events", []) if isinstance(e, dict)}
    if not safe_kinds <= {"beat", "section"}:
        fail(f"safe baseline contains unexpected event kinds: {sorted(safe_kinds)}")
    if sum(1 for e in safe.get("events", []) if isinstance(e, dict) and e.get("kind") == "beat") < 2:
        fail("safe baseline has fewer than two authored beat events")

    return {
        "analyzerRunnerSha256": safe_sha,
        "analysisJsonSha256": safe_analysis,
        "timingTier": generation["timingTier"],
    }


def resolve_anchor(evidence, anchor):
    if not isinstance(anchor, dict):
        return None, "anchor_missing_or_not_object"
    typ = anchor.get("type")
    idx = anchor.get("index")
    if typ not in {"boundary", "landmark"}:
        return None, "anchor_type_invalid"
    if not isinstance(idx, int) or isinstance(idx, bool):
        return None, "anchor_index_invalid"
    rows = evidence.get("boundaries" if typ == "boundary" else "landmarks")
    if not isinstance(rows, list) or idx < 0 or idx >= len(rows):
        return None, "anchor_index_out_of_range"
    row = rows[idx]
    if not isinstance(row, dict) or not finite(row.get("time")):
        return None, "anchor_time_invalid"
    resolved = copy.deepcopy(row)
    resolved["anchorType"] = typ
    resolved["anchorIndex"] = idx
    return resolved, None


def in_low_demand(evidence, t):
    for row in evidence.get("lowDemandWindows") or []:
        if not isinstance(row, dict):
            continue
        start, end = row.get("start"), row.get("end")
        if finite(start) and finite(end) and float(start) <= t <= float(end):
            return True, {"start": float(start), "end": float(end)}
    return False, None


def context_numbers(anchor):
    ctx = anchor.get("localEnergyContext") if isinstance(anchor, dict) else None
    ctx = ctx if isinstance(ctx, dict) else {}
    def num(key):
        value = ctx.get(key)
        return float(value) if finite(value) else None
    intensity = anchor.get("intensity") if isinstance(anchor, dict) else None
    return {
        "at": num("at"),
        "riseInto": num("riseInto"),
        "netChange": num("netChange"),
        "intensity": float(intensity) if finite(intensity) else None,
    }


def objective_gate(kind, anchor):
    x = context_numbers(anchor)
    at, rise, net, intensity = x["at"], x["riseInto"], x["netChange"], x["intensity"]
    typ = anchor.get("anchorType")
    if kind == "section":
        return True, x, []
    if kind == "energy":
        ok = (
            (rise is not None and rise >= 0.08)
            or (net is not None and net >= 0.10)
            or (at is not None and at >= 0.70 and intensity is not None and intensity >= 0.55)
        )
        return ok, x, [] if ok else ["objective_energy_gate_failed"]
    if kind == "peak":
        if typ == "landmark":
            ok = at is not None and at >= 0.68 and intensity is not None and intensity >= 0.60
        else:
            ok = at is not None and at >= 0.78
        return ok, x, [] if ok else ["objective_peak_gate_failed"]
    if kind == "drop":
        ok = (
            (rise is not None and rise >= 0.12)
            or (net is not None and net >= 0.15)
            or (at is not None and at >= 0.78 and intensity is not None and intensity >= 0.70)
        )
        return ok, x, [] if ok else ["objective_drop_gate_failed"]
    return False, x, ["unsupported_kind"]


def preflight_candidates(evidence, proposal, duration):
    candidates = []
    rejected = []
    seen_anchor_kind = set()

    for source_index, raw in enumerate(proposal.get("events") or []):
        reasons = []
        if not isinstance(raw, dict):
            rejected.append({"proposalIndex": source_index, "reasons": ["event_not_object"]})
            continue
        kind = raw.get("kind")
        if kind not in CONFIDENCE_MIN:
            reasons.append("unsupported_kind")
        confidence = raw.get("semanticConfidence")
        if not finite(confidence) or not 0 <= float(confidence) <= 1:
            reasons.append("semantic_confidence_invalid")
            confidence_value = None
        else:
            confidence_value = float(confidence)
            if kind in CONFIDENCE_MIN and confidence_value < CONFIDENCE_MIN[kind]:
                reasons.append("semantic_confidence_below_threshold")

        anchor, anchor_error = resolve_anchor(evidence, raw.get("anchor"))
        if anchor_error:
            reasons.append(anchor_error)
            anchor_time = None
        else:
            anchor_time = float(anchor["time"])
            if anchor_time < 0 or anchor_time > duration + 1e-6:
                reasons.append("anchor_time_out_of_song")
            key = (kind, anchor["anchorType"], anchor["anchorIndex"])
            if key in seen_anchor_kind:
                reasons.append("duplicate_kind_anchor")
            else:
                seen_anchor_kind.add(key)

        name = clean_text(raw.get("name"), 80)
        rationale = clean_text(raw.get("rationale"), 500)
        if kind == "section" and name is None:
            reasons.append("section_name_required")

        duration_s = None
        if kind == "drop":
            duration_s = raw.get("duration", DROP_DURATION_DEFAULT_S)
            if not finite(duration_s) or not DROP_DURATION_MIN_S <= float(duration_s) <= DROP_DURATION_MAX_S:
                reasons.append("drop_duration_out_of_range")
            else:
                duration_s = float(duration_s)

        low_window = None
        objective = None
        if anchor is not None and kind in CONFIDENCE_MIN:
            low, low_window = in_low_demand(evidence, anchor_time)
            if low and kind != "section":
                reasons.append("anchor_inside_low_demand_window")
            objective_ok, objective, objective_reasons = objective_gate(kind, anchor)
            if not objective_ok:
                reasons.extend(objective_reasons)

        record = {
            "proposalIndex": source_index,
            "kind": kind,
            "semanticConfidence": confidence_value,
            "name": name,
            "duration": duration_s,
            "anchor": (
                {
                    "type": anchor.get("anchorType"),
                    "index": anchor.get("anchorIndex"),
                    "time": anchor_time,
                    "diagnosticTypeHint": anchor.get("diagnosticTypeHint"),
                    "diagnosticIncomingLabelHint": anchor.get("diagnosticIncomingLabelHint"),
                }
                if anchor is not None else None
            ),
            "objectiveEvidence": objective,
            "rationale": rationale,
            "lowDemandWindow": low_window,
        }
        if reasons:
            record["reasons"] = list(dict.fromkeys(reasons))
            rejected.append(record)
        else:
            candidates.append(record)

    candidates.sort(key=lambda r: (r["anchor"]["time"], -r["semanticConfidence"], r["proposalIndex"]))
    return candidates, rejected


def apply_cooldowns(candidates):
    accepted = []
    rejected = []
    last_by_kind = {}
    last_high = None
    for item in candidates:
        t = item["anchor"]["time"]
        kind = item["kind"]
        reasons = []
        previous = last_by_kind.get(kind)
        if previous is not None and t - previous < COOLDOWN_S[kind] - 1e-9:
            reasons.append("same_kind_cooldown")
        if kind in HIGH_IMPACT and last_high is not None and t - last_high < HIGH_IMPACT_MIN_GAP_S - 1e-9:
            reasons.append("high_impact_cluster")
        if reasons:
            x = copy.deepcopy(item)
            x["reasons"] = reasons
            rejected.append(x)
            continue
        accepted.append(item)
        last_by_kind[kind] = t
        if kind in HIGH_IMPACT:
            last_high = t
    return accepted, rejected


def event_from_accept(item):
    event = {"t": round(float(item["anchor"]["time"]), 6), "kind": item["kind"]}
    if item.get("name"):
        event["name"] = item["name"]
    if item["kind"] == "drop":
        event["duration"] = round(float(item["duration"]), 6)
    return event


def compile_manifest(safe, evidence, proposal):
    source = require_source_integrity(safe, evidence, proposal)
    duration = float(safe["songLength"])
    candidates, rejected_preflight = preflight_candidates(evidence, proposal, duration)
    accepted, rejected_cooldown = apply_cooldowns(candidates)
    rejected = rejected_preflight + rejected_cooldown

    out = copy.deepcopy(safe)
    baseline_beats = [copy.deepcopy(e) for e in safe["events"] if e.get("kind") == "beat"]
    baseline_energy = copy.deepcopy(safe.get("energyCurve"))
    baseline_scalar = {k: copy.deepcopy(safe.get(k)) for k in ("bpm", "beatOffset", "songLength", "artist", "title", "audioUrl")}

    compiled_records = []
    for item in accepted:
        event = event_from_accept(item)
        if item["kind"] == "section":
            existing = [
                (abs(float(e.get("t", -1)) - event["t"]), i, e)
                for i, e in enumerate(out.get("events") or [])
                if isinstance(e, dict) and e.get("kind") == "section" and finite(e.get("t"))
                and abs(float(e["t"]) - event["t"]) <= SECTION_MERGE_WINDOW_S
            ]
            if existing:
                _, idx, _ = min(existing, key=lambda x: (x[0], x[1]))
                final_t = float(out["events"][idx]["t"])
                out["events"][idx]["name"] = event["name"]
                compiled_records.append({**item, "action": "named_existing_section", "compiledTime": final_t})
                continue
        out.setdefault("events", []).append(event)
        compiled_records.append({**item, "action": "appended_event", "compiledTime": event["t"]})

    out["events"] = sorted(
        out.get("events") or [],
        key=lambda e: (float(e.get("t", 0)), EVENT_ORDER.get(e.get("kind"), 99), str(e.get("name", ""))),
    )

    after_beats = [e for e in out["events"] if e.get("kind") == "beat"]
    if after_beats != baseline_beats:
        fail("compiler mutated the safe authored beat grid")
    if out.get("energyCurve") != baseline_energy:
        fail("compiler mutated the safe energy curve")
    for key, value in baseline_scalar.items():
        if out.get(key) != value:
            fail(f"compiler mutated protected manifest field {key}")

    out["interpretation"] = {
        "schema": SCHEMA_REPORT,
        "analyzerRunnerSha256": source["analyzerRunnerSha256"],
        "analysisJsonSha256": source["analysisJsonSha256"],
        "timingTier": source["timingTier"],
        "proposalEventCount": len(proposal.get("events") or []),
        "acceptedEventCount": len(compiled_records),
        "rejectedEventCount": len(rejected),
        "fallbackSafeBaselinePreserved": True,
        "policy": {
            "timingAuthority": "deterministic-structure-evidence-anchor",
            "beatGridMutable": False,
            "energyCurveMutable": False,
            "semanticCompiler": "deterministic-qc-v1",
        },
    }

    report = {
        "schema": SCHEMA_REPORT,
        "source": source,
        "policy": {
            "confidenceMinimums": CONFIDENCE_MIN,
            "cooldownsSeconds": COOLDOWN_S,
            "highImpactMinimumGapSeconds": HIGH_IMPACT_MIN_GAP_S,
            "sectionMergeWindowSeconds": SECTION_MERGE_WINDOW_S,
        },
        "proposalEventCount": len(proposal.get("events") or []),
        "acceptedEventCount": len(compiled_records),
        "rejectedEventCount": len(rejected),
        "accepted": compiled_records,
        "rejected": sorted(rejected, key=lambda r: r.get("proposalIndex", -1)),
        "fallbackSafeBaselinePreserved": True,
    }
    return out, report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--safe-manifest", type=Path, required=True)
    ap.add_argument("--evidence", type=Path, required=True)
    ap.add_argument("--proposal", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--report", type=Path, required=True)
    args = ap.parse_args()

    safe = json.loads(args.safe_manifest.read_text())
    evidence = json.loads(args.evidence.read_text())
    proposal = json.loads(args.proposal.read_text())
    manifest, report = compile_manifest(safe, evidence, proposal)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n")
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({
        "schema": report["schema"],
        "proposalEvents": report["proposalEventCount"],
        "accepted": report["acceptedEventCount"],
        "rejected": report["rejectedEventCount"],
        "timingTier": report["source"]["timingTier"],
        "fallbackSafeBaselinePreserved": report["fallbackSafeBaselinePreserved"],
    }, indent=2))


if __name__ == "__main__":
    main()
