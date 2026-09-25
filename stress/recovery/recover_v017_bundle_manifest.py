#!/usr/bin/env python3
import argparse
import json
import os
import re
import tarfile
from pathlib import Path

KEYWORDS = re.compile(r"mirror|ambigu|ratio|fixture|tactus|triple|third|metrical|3x|3:1|1:3", re.I)
TEXT_SUFFIXES = {'.py','.js','.mjs','.cjs','.ts','.tsx','.json','.jsonl','.csv','.txt','.md','.yml','.yaml','.sh'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--archive', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    listing = []
    hits = []
    text_inventory = []
    with tarfile.open(args.archive, 'r:gz') as tf:
        for member in tf.getmembers():
            listing.append({'name': member.name, 'size': member.size, 'type': 'file' if member.isfile() else 'dir'})
            if not member.isfile():
                continue
            p = Path(member.name)
            if p.suffix.lower() not in TEXT_SUFFIXES or member.size > 2_000_000:
                continue
            text_inventory.append({'name': member.name, 'size': member.size})
            try:
                raw = tf.extractfile(member).read()
                text = raw.decode('utf-8', errors='ignore')
            except Exception:
                continue
            matched = []
            for i, line in enumerate(text.splitlines(), 1):
                if KEYWORDS.search(line):
                    matched.append({'line': i, 'text': line[:800]})
                    if len(matched) >= 100:
                        break
            if matched or KEYWORDS.search(member.name):
                hits.append({'name': member.name, 'size': member.size, 'matches': matched})

    (args.output/'bundle_listing.json').write_text(json.dumps(listing, indent=2) + '\n')
    (args.output/'text_inventory.json').write_text(json.dumps(text_inventory, indent=2) + '\n')
    (args.output/'keyword_hits.json').write_text(json.dumps(hits, indent=2) + '\n')
    summary = {
        'entries': len(listing),
        'text_files_scanned': len(text_inventory),
        'files_with_keyword_hits': len(hits),
        'hit_files': [h['name'] for h in hits],
    }
    (args.output/'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
