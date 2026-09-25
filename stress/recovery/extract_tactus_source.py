#!/usr/bin/env python3
import argparse
from pathlib import Path

KEYWORDS = [
    'tactusCandidates',
    'relationToSource',
    'normalizedCorrelationSupport',
    'selectLayeredMetricalTempo',
    'lag',
]

ap=argparse.ArgumentParser()
ap.add_argument('--source',type=Path,required=True)
ap.add_argument('--output',type=Path,required=True)
args=ap.parse_args()
lines=args.source.read_text().splitlines()
windows=[]
for i,line in enumerate(lines):
    if any(k in line for k in KEYWORDS):
        a=max(0,i-25); b=min(len(lines),i+36)
        windows.append((a,b))
# merge overlapping windows
merged=[]
for a,b in windows:
    if merged and a <= merged[-1][1]+3:
        merged[-1]=(merged[-1][0],max(merged[-1][1],b))
    else:
        merged.append((a,b))
out=[]
for a,b in merged:
    out.append(f'===== lines {a+1}-{b} =====')
    out.extend(f'{n+1}: {lines[n]}' for n in range(a,b))
    out.append('')
args.output.write_text('\n'.join(out)+'\n')
print(f'excerpts={len(merged)} lines={sum(b-a for a,b in merged)}')
