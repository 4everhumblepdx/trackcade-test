#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import json
import math
from pathlib import Path

ANALYZER_RELEASE = "v0.19"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"


def finite(x):
    return isinstance(x, (int, float)) and math.isfinite(float(x))


def validate_analysis(x):
    for key in ("duration", "bpm", "beatOffset"):
        if not finite(x.get(key)):
            raise SystemExit(f"invalid v0.19 analysis: {key} missing/nonfinite")
    if float(x["duration"]) <= 0 or float(x["bpm"]) <= 0:
        raise SystemExit("invalid v0.19 analysis: duration/bpm nonpositive")
    if not isinstance(x.get("sourceFingerprint"), str) or not x["sourceFingerprint"].strip():
        raise SystemExit("invalid v0.19 analysis: sourceFingerprint missing/blank")
    if not isinstance(x.get("beatTimes"), list) or len(x["beatTimes"]) < 2:
        raise SystemExit("invalid v0.19 analysis: beatTimes missing/too short")
    if not isinstance(x.get("energyCurve"), list) or len(x["energyCurve"]) < 2:
        raise SystemExit("invalid v0.19 analysis: energyCurve missing/too short")
    tg = x.get("timingGuardrail")
    if not isinstance(tg, dict) or tg.get("tier") not in {"standard", "loose", "visual-only"}:
        raise SystemExit("invalid v0.19 analysis: timingGuardrail missing/unknown tier")


def clean_beat_times(x):
    duration = float(x["duration"])
    out = []
    last = None
    for raw in x["beatTimes"]:
        if not finite(raw):
            continue
        t = float(raw)
        if t < 0 or t > duration + 1e-6:
            continue
        if last is not None and t <= last + 1e-9:
            continue
        out.append(round(t, 6))
        last = t
    if len(out) < 2:
        raise SystemExit("invalid v0.19 analysis: insufficient monotonic beatTimes after validation")
    return out


def clean_energy_curve(x):
    rows = []
    for row in x["energyCurve"]:
        if not isinstance(row, dict):
            continue
        t = row.get("time")
        e = row.get("energy")
        if finite(t) and finite(e):
            rows.append((float(t), max(0.0, min(1.0, float(e)))))
    rows.sort()
    if len(rows) < 2:
        raise SystemExit("invalid v0.19 analysis: insufficient energyCurve samples")
    # Trackcade's current manifest format stores uniformly indexed samples.
    # v0.19 already emits a fixed-size evenly sampled curve; preserve the
    # values and retain exact sample times in generation provenance.
    return rows, [round(e, 6) for _, e in rows]


def generic_section_events(x):
    duration = float(x["duration"])
    events = []
    seen = set()
    for section in x.get("sections") or []:
        if not isinstance(section, dict) or not finite(section.get("start")):
            continue
        t = float(section["start"])
        if t < 0 or t > duration + 1e-6:
            continue
        key = round(t, 6)
        if key in seen:
            continue
        seen.add(key)
        # Deliberately omit v0.19's semantic section label. This is a generic
        # visual world-change cue only; no musical meaning is asserted.
        events.append({"t": key, "kind": "section"})
    return events


def build_manifest(template, analysis):
    validate_analysis(analysis)
    tier = analysis["timingGuardrail"]["tier"]
    if tier == "visual-only":
        raise SystemExit(
            "REFUSE: v0.19 timing tier is visual-only; this generator will not create "
            "a beat-driven gameplay manifest that pretends reliable interaction timing exists"
        )

    out = copy.deepcopy(template)
    for required in ("artist", "title", "audioUrl"):
        if not isinstance(out.get(required), str) or not out[required].strip():
            raise SystemExit(f"template manifest missing required string {required!r}")

    duration = float(analysis["duration"])
    beat_times = clean_beat_times(analysis)
    energy_rows, energy_values = clean_energy_curve(analysis)

    beat_events = [{"t": t, "kind": "beat"} for t in beat_times]
    section_events = generic_section_events(analysis)
    events = sorted(
        section_events + beat_events,
        key=lambda e: (e["t"], 0 if e["kind"] == "section" else 1),
    )

    out["bpm"] = round(float(analysis["bpm"]), 6)
    out["beatOffset"] = round(float(analysis["beatOffset"]), 6)
    out["songLength"] = round(duration, 6)
    out["events"] = events
    out["energyCurve"] = energy_values

    # Unknown manifest fields are ignored by the current loader, so provenance
    # travels with generated files without changing runtime behavior.
    out["generation"] = {
        "schema": "trackcade-safe-gameplay-baseline-v1",
        "analyzerRelease": ANALYZER_RELEASE,
        "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
        "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
        "sourceFingerprint": analysis["sourceFingerprint"],
        "timingTier": tier,
        "timingConfidence": analysis.get("timingConfidence"),
        "structureConfidence": analysis.get("structureConfidence"),
        "policy": {
            "authoredBeatGridSource": "v0.19 beatTimes",
            "energyCurveSource": "v0.19 energyCurve",
            "sectionEvents": "generic visual-only section changes from v0.19 section starts",
            "semanticEventsGenerated": [],
            "dropPeakEnergyCommandsGenerated": False,
            "requiresInterpretationForSemanticGameplay": True,
        },
        "counts": {
            "beatEvents": len(beat_events),
            "sectionEvents": len(section_events),
            "energySamples": len(energy_values),
        },
        "energySampleTimes": [round(t, 6) for t, _ in energy_rows],
    }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", type=Path, required=True)
    ap.add_argument("--template-manifest", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    analysis = json.loads(args.analysis.read_text())
    template = json.loads(args.template_manifest.read_text())
    manifest = build_manifest(template, analysis)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n")

    generated = manifest["generation"]
    print(json.dumps({
        "schema": generated["schema"],
        "artist": manifest["artist"],
        "title": manifest["title"],
        "timingTier": generated["timingTier"],
        "sourceFingerprint": generated["sourceFingerprint"],
        "bpm": manifest["bpm"],
        "songLength": manifest["songLength"],
        "beatEvents": generated["counts"]["beatEvents"],
        "sectionEvents": generated["counts"]["sectionEvents"],
        "energySamples": generated["counts"]["energySamples"],
        "dropPeakEnergyCommandsGenerated": generated["policy"]["dropPeakEnergyCommandsGenerated"],
    }, indent=2))


if __name__ == "__main__":
    main()
