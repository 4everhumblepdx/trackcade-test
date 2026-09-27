#!/usr/bin/env python3
"""Compatibility-only wrapper around the frozen Structure v1 evidence exporter.

The exact packaged Analyzer v0.19 runner emits timingGuardrail.tier values
strict/standard/loose/unsafe. The closed Structure-v1 exporter validator was
narrower (standard/loose/visual-only), which rejects a valid strict result.

This wrapper changes ONLY input validation vocabulary. It imports the frozen
exporter, preserves its export logic/schema/policy byte-for-byte at runtime,
and does not alter timing, energy, sections, boundaries, landmarks, confidence,
or semantic authorization.
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

BASE = Path(__file__).parents[1] / "structure-v1" / "export_structure_evidence_v1.py"
spec = importlib.util.spec_from_file_location("trackcade_structure_v1_frozen", BASE)
if spec is None or spec.loader is None:
    raise SystemExit("unable to load frozen Structure v1 exporter")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def finite(value):
    return isinstance(value, (int, float)) and math.isfinite(float(value))


def validate_v019_actual_contract(analysis):
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
    if not isinstance(tg, dict) or tg.get("tier") not in {
        "strict", "standard", "loose", "unsafe"
    }:
        raise SystemExit("invalid v0.19 analysis: timingGuardrail missing/unknown exact-runner tier")


mod.validate_analysis = validate_v019_actual_contract
mod.main()
