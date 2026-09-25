#!/usr/bin/env python3
"""Dev-only experiment: add descriptive 1/3x and 3x tactus transforms to exact v0.18.

The new relations are explicitly excluded from v0.18's primary-vs-non-octave
confidence margin, so this patch must not change canonical timing or confidence.
"""
from pathlib import Path
import sys

src=Path(sys.argv[1]); out=Path(sys.argv[2])
s=src.read_text()

old_transforms="""        ['four-fifths', 4 / 5],
        ['five-fourths', 5 / 4],
    ];"""
new_transforms="""        ['four-fifths', 4 / 5],
        ['five-fourths', 5 / 4],
        ['one-third', 1 / 3],
        ['triple', 3],
    ];"""
if s.count(old_transforms) != 1:
    raise SystemExit(f'tactus transform anchor count={s.count(old_transforms)}, expected 1')
s=s.replace(old_transforms,new_transforms,1)

old_margin="""        .filter((candidate) => !['same', 'half', 'double'].includes(candidate.relationToSource))"""
new_margin="""        .filter((candidate) => !['same', 'half', 'double', 'one-third', 'triple'].includes(candidate.relationToSource))"""
if s.count(old_margin) != 1:
    raise SystemExit(f'confidence-margin anchor count={s.count(old_margin)}, expected 1')
s=s.replace(old_margin,new_margin,1)

out.write_text(s)
