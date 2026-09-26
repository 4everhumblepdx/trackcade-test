#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

ANALYZER_RELEASE = "v0.19"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"


def finite(x):
    return isinstance(x, (int, float)) and math.isfinite(float(x))


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def energy_points(analysis):
    out = []
    for row in analysis.get("energyCurve") or []:
        if not isinstance(row, dict):
            continue
        t = row.get("time")
        e = row.get("energy")
        if finite(t) and finite(e):
            out.append({"time": float(t), "energy": clamp(float(e), 0.0, 1.0)})
    out.sort(key=lambda r: r["time"])
    return out


def interp(points, t):
    if not points:
        return None
    if t <= points[0]["time"]:
        return points[0]["energy"]
    if t >= points[-1]["time"]:
        return points[-1]["energy"]
    lo, hi = 0, len(points) - 1
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        if points[mid]["time"] <= t:
            lo = mid
        else:
            hi = mid
    a, b = points[lo], points[hi]
    span = b["time"] - a["time"]
    if span <= 1e-12:
        return a["energy"]
    f = (t - a["time"]) / span
    return a["energy"] + f * (b["energy"] - a["energy"])


def local_energy_context(points, t, window_s):
    before_t = max(0.0, t - window_s)
    after_t = t + window_s
    before = interp(points, before_t)
    at = interp(points, t)
    after = interp(points, after_t)
    return {
        "windowSeconds": round(window_s, 6),
        "beforeTime": round(before_t, 6),
        "afterTime": round(after_t, 6),
        "before": None if before is None else round(before, 6),
        "at": None if at is None else round(at, 6),
        "after": None if after is None else round(after, 6),
        "riseInto": None if before is None or at is None else round(at - before, 6),
        "changeAfter": None if at is None or after is None else round(after - at, 6),
        "netChange": None if before is None or after is None else round(after - before, 6),
    }


def validate_analysis(analysis):
    duration = analysis.get("duration")
    bpm = analysis.get("bpm")
    if not finite(duration) or float(duration) <= 0:
        raise SystemExit("invalid v0.19 analysis: duration missing/nonpositive")
    if not finite(bpm) or float(bpm) <= 0:
        raise SystemExit("invalid v0.19 analysis: bpm missing/nonpositive")
    for key in ("energyCurve", "events", "sections"):
        if not isinstance(analysis.get(key), list):
            raise SystemExit(f"invalid v0.19 analysis: {key} missing/not-list")
    tg = analysis.get("timingGuardrail")
    if not isinstance(tg, dict) or tg.get("tier") not in {"standard", "loose", "visual-only"}:
        raise SystemExit("invalid v0.19 analysis: timingGuardrail missing/unknown tier")


def export(analysis):
    validate_analysis(analysis)
    duration = float(analysis["duration"])
    bpm = float(analysis["bpm"])
    timing_guardrail = analysis["timingGuardrail"]
    curve = energy_points(analysis)

    # Four canonical Analyzer beats supplies local energy context without
    # claiming section semantics. The clamp only bounds extreme descriptive
    # tactus values; it does not change Analyzer timing or structure outputs.
    context_window = clamp(4.0 * 60.0 / bpm, 1.5, 6.0)

    sections = analysis.get("sections") or []
    boundaries = []
    normalized_sections = []
    for i, section in enumerate(sections):
        if not isinstance(section, dict):
            continue
        start, end = section.get("start"), section.get("end")
        if not finite(start) or not finite(end) or float(end) <= float(start):
            continue
        start, end = float(start), float(end)
        normalized_sections.append({
            "index": i,
            "start": start,
            "end": end,
            "duration": round(end - start, 6),
            "energy": section.get("energy"),
            "activity": section.get("activity"),
            "confidence": section.get("confidence"),
            "diagnosticLabelHint": section.get("label"),
            "semanticGameplayAuthorized": False,
        })
        if start > 0.001 and start < duration - 0.001:
            previous = sections[i - 1] if i > 0 and isinstance(sections[i - 1], dict) else {}
            boundaries.append({
                "time": start,
                "incomingSectionConfidence": section.get("confidence"),
                "previousSectionConfidence": previous.get("confidence"),
                "previousSectionEnergy": previous.get("energy"),
                "incomingSectionEnergy": section.get("energy"),
                "energyDelta": (
                    round(float(section["energy"]) - float(previous["energy"]), 6)
                    if finite(section.get("energy")) and finite(previous.get("energy"))
                    else None
                ),
                "diagnosticIncomingLabelHint": section.get("label"),
                "localEnergyContext": local_energy_context(curve, start, context_window),
                "semanticGameplayAuthorized": False,
            })

    landmarks = []
    for i, event in enumerate(analysis.get("events") or []):
        if not isinstance(event, dict):
            continue
        t = event.get("time")
        if not finite(t):
            continue
        t = float(t)
        if t < 0 or t > duration + 0.001:
            continue
        landmarks.append({
            "index": i,
            "time": t,
            "intensity": event.get("intensity"),
            "diagnosticTypeHint": event.get("type"),
            "localEnergyContext": local_energy_context(curve, t, context_window),
            "semanticGameplayAuthorized": False,
        })

    low_demand = []
    for row in analysis.get("lowDemandWindows") or []:
        if not isinstance(row, dict):
            continue
        if finite(row.get("start")) and finite(row.get("end")):
            low_demand.append({
                "start": float(row["start"]),
                "end": float(row["end"]),
                "energy": row.get("energy"),
                "confidence": row.get("confidence"),
            })

    return {
        "schema": "trackcade-structure-evidence-v1",
        "source": {
            "analyzerRelease": ANALYZER_RELEASE,
            "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
            "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
            "sourceFingerprint": analysis.get("sourceFingerprint"),
            "duration": duration,
            "bpm": bpm,
            "beatOffset": analysis.get("beatOffset"),
        },
        "timingTrust": {
            "timingConfidence": analysis.get("timingConfidence"),
            "tier": timing_guardrail.get("tier"),
            "strictScoringAllowed": timing_guardrail.get("strictScoringAllowed"),
            "recommendedGlobalHalfWindowMs": timing_guardrail.get("recommendedGlobalHalfWindowMs"),
            "reasons": timing_guardrail.get("reasons") or [],
        },
        "structureTrust": {
            "structureConfidence": analysis.get("structureConfidence"),
            "structureDiagnostics": analysis.get("structureDiagnostics"),
        },
        "energy": {
            "global": analysis.get("energy"),
            "curve": curve,
        },
        "sections": normalized_sections,
        "boundaries": boundaries,
        "landmarks": landmarks,
        "lowDemandWindows": low_demand,
        "policy": {
            "analyzerSemanticLabels": "diagnostic-hints-only",
            "authorizedGameplayKinds": [],
            "semanticGameplayEventsAuthorized": False,
            "requiresInterpretationLayer": True,
            "note": (
                "This evidence export may inform a later musical-understanding layer. "
                "It must not directly trigger Trackcade drop/peak/energy gameplay effects."
            ),
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    analysis = json.loads(args.analysis.read_text())
    evidence = export(analysis)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps({
        "schema": evidence["schema"],
        "duration": evidence["source"]["duration"],
        "timingTier": evidence["timingTrust"]["tier"],
        "structureConfidence": evidence["structureTrust"]["structureConfidence"],
        "energySamples": len(evidence["energy"]["curve"]),
        "sections": len(evidence["sections"]),
        "boundaries": len(evidence["boundaries"]),
        "landmarks": len(evidence["landmarks"]),
        "semanticGameplayEventsAuthorized": evidence["policy"]["semanticGameplayEventsAuthorized"],
    }, indent=2))


if __name__ == "__main__":
    main()
