#!/usr/bin/env python3
"""Development-only Ballroom study for counterfactual meter evidence.

Cohort = every Ballroom Waltz/VienneseWaltz track plus an equal-sized,
deterministically selected non-waltz control cohort. Compares exact frozen v0.18
against v0.18 + descriptive triple candidates + candidate-only counterfactual
meter diagnostics. This study does NOT select a tactus or change canonical output.
"""
import argparse
import copy
import csv
import hashlib
import json
import statistics
import subprocess
import tempfile
import time
from pathlib import Path

AUDIO_EXTS = {'.wav', '.mp3', '.flac', '.ogg', '.m4a'}
TRIPLE_RELATIONS = {'one-third', 'triple'}


def probe_sr(path: Path) -> int:
    q = subprocess.run([
        'ffprobe', '-v', 'error', '-select_streams', 'a:0',
        '-show_entries', 'stream=sample_rate', '-of', 'default=nw=1:nk=1', str(path)
    ], text=True, capture_output=True, timeout=30)
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-1000:])
    return int(q.stdout.strip())


def decode(src: Path, dst: Path, sr: int) -> None:
    q = subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-i', str(src), '-ac', '1', '-ar', str(sr),
        '-f', 'f32le', '-acodec', 'pcm_f32le', str(dst)
    ], text=True, capture_output=True, timeout=180)
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-1200:])


def run(node: str, runner: Path, raw: Path, sr: int, name: str):
    started = time.perf_counter()
    q = subprocess.run([node, str(runner), str(raw), str(sr), '1', name], text=True,
                       capture_output=True, timeout=180)
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-1600:])
    return json.loads(q.stdout), time.perf_counter() - started


def canonical(result):
    value = copy.deepcopy(result)
    value.pop('tactusCandidates', None)
    return value


def read_beats(path: Path):
    out = []
    for line in path.read_text(errors='ignore').splitlines():
        try:
            out.append(float(line.split()[0]))
        except Exception:
            pass
    return sorted(v for v in out if v >= 0)


def ref_bpm(times):
    intervals = [b - a for a, b in zip(times, times[1:]) if 0.15 <= b - a <= 2.0]
    return None if len(intervals) < 8 else 60.0 / statistics.median(intervals)


def genre_from_path(path: Path):
    for raw in path.parts:
        norm = raw.lower().replace(' ', '').replace('_', '')
        if 'viennesewaltz' in norm:
            return 'VienneseWaltz'
        if norm in ('waltz', 'slowwaltz') or 'slowwaltz' in norm:
            return 'Waltz'
    return next((part for part in path.parts if part not in (path.anchor, path.name)), 'unknown')


def is_waltz(path: Path) -> bool:
    return genre_from_path(path) in {'Waltz', 'VienneseWaltz'}


def deterministic_controls(items, count):
    ranked = sorted(items, key=lambda item: (hashlib.sha256(item[0].encode()).hexdigest(), item[0]))
    return ranked[:count]


def nearest_relation(selected, reference):
    if not selected or not reference:
        return None
    ratio = reference / selected
    family = [
        ('one-third', 1/3), ('half', 1/2), ('two-thirds', 2/3), ('same', 1),
        ('three-halves', 1.5), ('double', 2), ('triple', 3),
    ]
    name, target = min(family, key=lambda pair: abs(ratio - pair[1]) / pair[1])
    return name if abs(ratio - target) / target <= 0.06 else 'other'


def cf(candidate):
    return candidate.get('counterfactualMeter') or {}


def choose_primary(candidates):
    return next((c for c in candidates if c.get('isPrimary')), None)


def choose_best_triple_candidate(candidates):
    eligible = [c for c in candidates if c.get('relationToSource') in TRIPLE_RELATIONS and cf(c)]
    if not eligible:
        return None
    # Diagnostic-only oracle within the already-created triple family. Do not use as a selector rule.
    return max(eligible, key=lambda c: (float(cf(c).get('tripleFamilyAdvantage', -999)), float(c.get('confidence', 0))))


def field(prefix, candidate):
    if not candidate:
        return {
            f'{prefix}_relation': '', f'{prefix}_bpm': '', f'{prefix}_candidate_confidence': '',
            f'{prefix}_meter': '', f'{prefix}_meter_confidence': '', f'{prefix}_meter_ambiguity': '',
            f'{prefix}_grid_support': '', f'{prefix}_phase_coherence': '',
            f'{prefix}_triple_score': '', f'{prefix}_duple_score': '', f'{prefix}_triple_advantage': '',
        }
    evidence = cf(candidate)
    return {
        f'{prefix}_relation': candidate.get('relationToSource', ''),
        f'{prefix}_bpm': candidate.get('bpm', ''),
        f'{prefix}_candidate_confidence': candidate.get('confidence', ''),
        f'{prefix}_meter': evidence.get('beatsPerBar', ''),
        f'{prefix}_meter_confidence': evidence.get('meterConfidence', ''),
        f'{prefix}_meter_ambiguity': evidence.get('meterAmbiguity', ''),
        f'{prefix}_grid_support': evidence.get('gridSupport', ''),
        f'{prefix}_phase_coherence': evidence.get('phaseCoherence', ''),
        f'{prefix}_triple_score': evidence.get('tripleFamilyScore', ''),
        f'{prefix}_duple_score': evidence.get('dupleFamilyScore', ''),
        f'{prefix}_triple_advantage': evidence.get('tripleFamilyAdvantage', ''),
    }


def numeric(rows, key):
    vals = []
    for row in rows:
        value = row.get(key, '')
        if value in ('', None):
            continue
        try:
            vals.append(float(value))
        except Exception:
            pass
    return vals


def cohort_summary(rows):
    primary_adv = numeric(rows, 'primary_triple_advantage')
    alt_adv = numeric(rows, 'best_triple_triple_advantage')

    def stats(values):
        if not values:
            return {'n': 0, 'mean': None, 'median': None, 'gt_0': 0, 'gt_005': 0, 'gt_010': 0}
        return {
            'n': len(values),
            'mean': sum(values) / len(values),
            'median': statistics.median(values),
            'gt_0': sum(v > 0 for v in values),
            'gt_005': sum(v > 0.05 for v in values),
            'gt_010': sum(v > 0.10 for v in values),
        }

    return {
        'tracks': len(rows),
        'primary_counterfactual_coverage': len(primary_adv),
        'triple_candidate_counterfactual_coverage': len(alt_adv),
        'primary_triple_advantage': stats(primary_adv),
        'best_triple_candidate_triple_advantage': stats(alt_adv),
        'best_triple_candidate_classified_3_or_6': sum(str(r.get('best_triple_meter')) in {'3', '6', '3.0', '6.0'} for r in rows),
        'reference_triple_family_tracks': sum(r.get('reference_relation_to_selected') in TRIPLE_RELATIONS for r in rows),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio-root', type=Path, required=True)
    ap.add_argument('--annotations-root', type=Path, required=True)
    ap.add_argument('--baseline-runner', type=Path, required=True)
    ap.add_argument('--dev-runner', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--node', default='node')
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    audio = []
    for path in args.audio_root.rglob('*'):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTS:
            audio.append((path.stem, path))
    annotations = {p.stem: p for p in args.annotations_root.rglob('*.beats')}

    waltzes = sorted([(stem, path) for stem, path in audio if is_waltz(path)])
    non_waltzes = [(stem, path) for stem, path in audio if not is_waltz(path)]
    if len(waltzes) != 175:
        raise SystemExit(f'FAIL-CLOSED: expected 175 Ballroom waltzes, found {len(waltzes)}')
    controls = deterministic_controls(non_waltzes, len(waltzes))
    if len(controls) != len(waltzes):
        raise SystemExit(f'FAIL-CLOSED: expected {len(waltzes)} controls, found {len(controls)}')

    cohort = [(stem, path, 'waltz') for stem, path in waltzes] + [(stem, path, 'control') for stem, path in controls]
    rows = []
    errors = []
    invariance_failures = []

    for index, (stem, src, cohort_name) in enumerate(cohort, 1):
        annotation = annotations.get(stem)
        if not annotation:
            errors.append({'track': stem, 'error': 'annotation-not-found'})
            continue
        try:
            reference = ref_bpm(read_beats(annotation))
            if reference is None:
                raise RuntimeError('insufficient-valid-beat-intervals')
            sr = probe_sr(src)
            with tempfile.NamedTemporaryFile(suffix='.f32', delete=False) as tf:
                raw = Path(tf.name)
            try:
                decode(src, raw, sr)
                baseline, baseline_runtime = run(args.node, args.baseline_runner, raw, sr, stem)
                dev, dev_runtime = run(args.node, args.dev_runner, raw, sr, stem)
            finally:
                raw.unlink(missing_ok=True)

            invariant = canonical(baseline) == canonical(dev)
            if not invariant:
                invariance_failures.append(stem)

            candidates = dev.get('tactusCandidates') or []
            primary = choose_primary(candidates)
            best_triple = choose_best_triple_candidate(candidates)
            selected_bpm = float(baseline.get('bpm') or 0)
            row = {
                'track': stem,
                'cohort': cohort_name,
                'genre': genre_from_path(src),
                'reference_bpm': round(reference, 6),
                'selected_bpm': selected_bpm,
                'reference_relation_to_selected': nearest_relation(selected_bpm, reference),
                'canonical_invariant': invariant,
                'timing_tier_baseline': (baseline.get('timingGuardrail') or {}).get('tier'),
                'timing_tier_dev': (dev.get('timingGuardrail') or {}).get('tier'),
                'baseline_runtime_s': round(baseline_runtime, 6),
                'dev_runtime_s': round(dev_runtime, 6),
                'runtime_ratio': round(dev_runtime / max(baseline_runtime, 1e-9), 6),
                'triple_candidate_count': sum(c.get('relationToSource') in TRIPLE_RELATIONS for c in candidates),
                'triple_candidate_diagnostic_count': sum(c.get('relationToSource') in TRIPLE_RELATIONS and bool(cf(c)) for c in candidates),
            }
            row.update(field('primary', primary))
            row.update(field('best_triple', best_triple))
            rows.append(row)
        except Exception as exc:
            errors.append({'track': stem, 'error': str(exc)})
        if index % 25 == 0:
            print(json.dumps({
                'processed': index, 'rows': len(rows), 'errors': len(errors),
                'invariance_failures': len(invariance_failures)
            }), flush=True)

    fields = list(rows[0].keys()) if rows else []
    with (args.output / 'results.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    (args.output / 'errors.json').write_text(json.dumps(errors, indent=2) + '\n')
    (args.output / 'invariance_failures.json').write_text(json.dumps(invariance_failures, indent=2) + '\n')

    waltz_rows = [r for r in rows if r['cohort'] == 'waltz']
    control_rows = [r for r in rows if r['cohort'] == 'control']
    runtime_ratios = numeric(rows, 'runtime_ratio')
    summary = {
        'study': 'Ballroom counterfactual meter diagnostics development cohort',
        'status': 'diagnostic-only; not a tactus selector and not promotion evidence',
        'tracks_expected': 350,
        'waltzes_expected': 175,
        'controls_expected': 175,
        'tracks_analyzed': len(rows),
        'waltzes_analyzed': len(waltz_rows),
        'controls_analyzed': len(control_rows),
        'errors': len(errors),
        'canonical_invariance_passed': not invariance_failures,
        'canonical_invariance_failures': len(invariance_failures),
        'timing_tier_changes': sum(r['timing_tier_baseline'] != r['timing_tier_dev'] for r in rows),
        'mean_runtime_ratio': sum(runtime_ratios) / len(runtime_ratios) if runtime_ratios else None,
        'max_runtime_ratio': max(runtime_ratios) if runtime_ratios else None,
        'waltz': cohort_summary(waltz_rows),
        'control': cohort_summary(control_rows),
    }
    (args.output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))

    if len(rows) != 350:
        raise SystemExit(f'FAIL-CLOSED: expected 350 analyzed tracks, got {len(rows)}')
    if errors:
        raise SystemExit(f'FAIL-CLOSED: {len(errors)} processing errors')
    if invariance_failures:
        raise SystemExit(f'FAIL-CLOSED: {len(invariance_failures)} canonical invariance failures')
    if summary['timing_tier_changes']:
        raise SystemExit(f"FAIL-CLOSED: {summary['timing_tier_changes']} timing-tier changes")


if __name__ == '__main__':
    main()
