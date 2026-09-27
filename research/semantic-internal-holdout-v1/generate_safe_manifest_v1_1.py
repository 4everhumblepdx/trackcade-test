#!/usr/bin/env python3
"""Compatibility-only wrapper around frozen Structure-v1 safe-manifest generation.

The packaged Analyzer v0.19 runner emits timing tiers strict/standard/loose/unsafe.
The closed Structure-v1 generator validator predates that exact vocabulary.

This wrapper changes only accepted input-tier vocabulary:
- strict / standard / loose are accepted;
- unsafe is refused fail-closed.

All beat-grid, section, energy, metadata, and generation logic remains the frozen
Structure-v1 implementation.
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

BASE = Path(__file__).parents[1] / "structure-v1" / "generate_safe_manifest_v1.py"
spec = importlib.util.spec_from_file_location("trackcade_safe_manifest_v1_frozen", BASE)
if spec is None or spec.loader is None:
    raise SystemExit("unable to load frozen Structure v1 safe-manifest generator")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def finite(value):
    return isinstance(value, (int, float)) and math.isfinite(float(value))


def validate_exact_v019_contract(x):
    for key in ("duration", "bpm", "beatOffset"):
        if not finite(x.get(key)):
            raise SystemExit(f"invalid v0.19 analysis: {key} missing/nonfinite")
    if float(x["duration"]) <= 0 or float(x["bpm"]) <= 0:
        raise SystemExit("invalid v0.19 analysis: duration/bpm nonpositive")
    if not isinstance(x.get("beatTimes"), list) or len(x["beatTimes"]) < 2:
        raise SystemExit("invalid v0.19 analysis: beatTimes missing/too short")
    if not isinstance(x.get("energyCurve"), list) or len(x["energyCurve"]) < 2:
        raise SystemExit("invalid v0.19 analysis: energyCurve missing/too short")
    tg = x.get("timingGuardrail")
    if not isinstance(tg, dict):
        raise SystemExit("invalid v0.19 analysis: timingGuardrail missing")
    tier = tg.get("tier")
    if tier == "unsafe":
        raise SystemExit(
            "REFUSE: exact v0.19 timing tier is unsafe; no beat-driven gameplay manifest will be generated"
        )
    if tier not in {"strict", "standard", "loose"}:
        raise SystemExit("invalid v0.19 analysis: timingGuardrail unknown exact-runner tier")


mod.validate_analysis = validate_exact_v019_contract
mod.main()
