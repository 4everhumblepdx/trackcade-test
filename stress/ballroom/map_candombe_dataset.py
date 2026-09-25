#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path

AUDIO_EXTS = {'.flac', '.wav', '.mp3', '.ogg', '.m4a'}


def parse_times(path: Path):
    times = []
    with path.open('r', encoding='utf-8', errors='ignore', newline='') as f:
        for row in csv.reader(f):
            if not row:
                continue
            cell = row[0].strip()
            try:
                t = float(cell)
            except ValueError:
                continue
            if t >= 0:
                times.append(t)
    return sorted(set(times))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dataset-root', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    audio = {p.stem: p for p in args.dataset_root.rglob('*') if p.is_file() and p.suffix.lower() in AUDIO_EXTS}
    csvs = {p.stem: p for p in args.dataset_root.rglob('*.csv') if p.is_file()}
    common = sorted(set(audio) & set(csvs))

    mapped = []
    empty = []
    for stem in common:
        ts = parse_times(csvs[stem])
        if not ts:
            empty.append(stem)
            continue
        out = args.output / f'{stem}.beats'
        out.write_text(''.join(f'{t:.9f}\n' for t in ts), encoding='utf-8')
        mapped.append({'stem': stem, 'audio': str(audio[stem]), 'annotation': str(csvs[stem]), 'beats': len(ts)})

    summary = {
        'audio_files': len(audio),
        'csv_files': len(csvs),
        'matched_stems': len(common),
        'mapped': len(mapped),
        'empty_annotations': empty,
        'mapped_tracks': mapped,
    }
    (args.output / 'mapping_summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({k: v for k, v in summary.items() if k != 'mapped_tracks'}, indent=2))

    if len(mapped) < 30:
        raise SystemExit(f'FAIL-CLOSED: only {len(mapped)} mapped Candombe tracks; expected at least 30')


if __name__ == '__main__':
    main()
