#!/usr/bin/env python3
"""Infrastructure-only recovery wrapper for the frozen V2 holdout.

This imports the exact frozen V2 evaluation harness and changes only the
per-Analyzer subprocess timeout from 900 seconds to 2400 seconds. Selector
logic, thresholds, corpus, Analyzer bits, diagnostic patch, and aggregation
semantics remain unchanged.
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import time
from pathlib import Path

BASE = Path(__file__).with_name('run_asap_phase_holdout_v2.py')
spec = importlib.util.spec_from_file_location('trackcade_v2_holdout_base', BASE)
if spec is None or spec.loader is None:
    raise RuntimeError('unable to load frozen V2 holdout harness')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

RECOVERY_TIMEOUT_SECONDS = 2400


def run_analyzer_recovery(runner: Path, raw: Path, sr: int, name: str, debug=False):
    env = dict(os.environ)
    if debug:
        env['TRACKCADE_PHASE_CONTEXT_DEBUG'] = '1'
    t = time.perf_counter()
    q = subprocess.run(
        ['node', str(runner), str(raw), str(sr), '1', name],
        text=True,
        capture_output=True,
        timeout=RECOVERY_TIMEOUT_SECONDS,
        env=env,
    )
    elapsed = time.perf_counter() - t
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-2000:])
    return json.loads(q.stdout), elapsed


mod.run_analyzer = run_analyzer_recovery

if __name__ == '__main__':
    mod.main()
