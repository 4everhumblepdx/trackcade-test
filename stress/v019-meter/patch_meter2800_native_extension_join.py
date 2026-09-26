#!/usr/bin/env python3
"""Harness-only patch: Meter2800 labels use .wav names while original source archives preserve native extensions.

Patch the specificity evaluator to join by (source, filename stem). This does not alter Analyzer code,
selector thresholds, candidate diagnostics, labels, or scientific pass/fail semantics.
"""
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()
repls = {
    "return parts[0],Path(parts[1]).name": "return parts[0],Path(parts[1]).stem",
    "key=(src,p.name)": "key=(src,p.stem)",
}
for old, new in repls.items():
    if s.count(old) != 1:
        raise SystemExit(f'expected exactly one harness join anchor: {old!r}, got {s.count(old)}')
    s = s.replace(old, new, 1)
p.write_text(s)
