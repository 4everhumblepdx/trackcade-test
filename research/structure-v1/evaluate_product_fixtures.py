#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def finite_number(x):
    return isinstance(x, (int, float)) and math.isfinite(float(x))


def pearson(a, b):
    pairs = [(float(x), float(y)) for x, y in zip(a, b) if finite_number(x) and finite_number(y)]
    if len(pairs) < 3:
        return None
    xs = [x for x, _ in pairs]
    ys = [y for _, y in pairs]
    mx = sum(xs) / len(xs)
    my = sum(ys) / len(ys)
    dx = [x - mx for x in xs]
    dy = [y - my for y in ys]
    den = math.sqrt(sum(x * x for x in dx) * sum(y * y for y in dy))
    if den <= 1e-12:
        return None
    return sum(x * y for x, y in zip(dx, dy)) / den


def curve_points(curve, duration):
    if not isinstance(curve, list) or not curve:
        return []
    if all(finite_number(v) for v in curve):
        n = len(curve)
        if n == 1:
            return [(0.0, float(curve[0]))]
        return [(duration * i / (n - 1), float(v)) for i, v in enumerate(curve)]
    out = []
    for row in curve:
        if not isinstance(row, dict):
            continue
        t = row.get('t', row.get('time'))
        v = row.get('energy', row.get('value', row.get('v')))
        if finite_number(t) and finite_number(v):
            out.append((float(t), float(v)))
    return sorted(out)


def interpolate(points, t):
    if not points:
        return None
    if t <= points[0][0]:
        return points[0][1]
    if t >= points[-1][0]:
        return points[-1][1]
    lo = 0
    hi = len(points) - 1
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        if points[mid][0] <= t:
            lo = mid
        else:
            hi = mid
    t0, v0 = points[lo]
    t1, v1 = points[hi]
    if t1 <= t0:
        return v0
    f = (t - t0) / (t1 - t0)
    return v0 + f * (v1 - v0)


def unique_greedy_matches(reference_times, predicted_times, tolerance):
    candidates = []
    for ri, r in enumerate(reference_times):
        for pi, p in enumerate(predicted_times):
            d = abs(p - r)
            if d <= tolerance:
                candidates.append((d, ri, pi))
    candidates.sort()
    used_r = set()
    used_p = set()
    matches = []
    for d, ri, pi in candidates:
        if ri in used_r or pi in used_p:
            continue
        used_r.add(ri)
        used_p.add(pi)
        matches.append({'reference': reference_times[ri], 'predicted': predicted_times[pi], 'abs_error_s': d})
    return matches


def prf(matches, ref_count, pred_count):
    m = len(matches)
    p = m / pred_count if pred_count else 0.0
    r = m / ref_count if ref_count else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {'matches': m, 'precision': p, 'recall': r, 'f1': f1}


def timing_metric(reference_times, predicted_times):
    out = {
        'reference_times': reference_times,
        'predicted_times': predicted_times,
        'reference_count': len(reference_times),
        'predicted_count': len(predicted_times),
        'tolerances': {},
    }
    for tol in (1.0, 2.0, 4.0):
        matches = unique_greedy_matches(reference_times, predicted_times, tol)
        stats = prf(matches, len(reference_times), len(predicted_times))
        if matches:
            stats['mean_abs_error_s'] = sum(m['abs_error_s'] for m in matches) / len(matches)
            stats['max_abs_error_s'] = max(m['abs_error_s'] for m in matches)
        else:
            stats['mean_abs_error_s'] = None
            stats['max_abs_error_s'] = None
        stats['pairs'] = matches
        out['tolerances'][str(int(tol))] = stats
    return out


def event_rows(data):
    """Normalize the two real schemas without changing their semantics.

    Trackcade manifests use {kind,t,name}; v0.19 Analyzer events use
    {type,time,intensity}. We normalize field names only. We intentionally do
    not map Analyzer `build` to authored `energy`, or section labels to event
    kinds, because semantic disagreement is exactly what this audit measures.
    """
    out = []
    for e in data.get('events', []):
        if not isinstance(e, dict):
            continue
        t = e.get('t', e.get('time'))
        kind = e.get('kind', e.get('type'))
        if finite_number(t) and isinstance(kind, str):
            out.append({
                't': float(t),
                'kind': kind,
                'name': e.get('name'),
                'intensity': e.get('intensity'),
            })
    return out


def manual_major_boundaries(manifest):
    # Section and drop events are the authored structural state changes.
    return sorted({
        e['t'] for e in event_rows(manifest)
        if e['kind'] in {'section', 'drop'} and e['t'] > 0
    })


def analyzer_boundaries(analysis):
    duration = float(analysis.get('duration') or 0)
    out = []
    for s in analysis.get('sections', []):
        if not isinstance(s, dict):
            continue
        t = s.get('start')
        if finite_number(t) and float(t) > 0.001 and float(t) < duration - 0.001:
            out.append(float(t))
    return sorted(set(out))


def manual_landmarks(manifest):
    duration = float(manifest.get('songLength') or 0)
    out = []
    for e in event_rows(manifest):
        if e['kind'] in {'beat', 'end'}:
            continue
        if e['t'] <= 0:
            continue
        if duration > 0 and e['t'] >= duration - 0.001:
            continue
        out.append(e['t'])
    return sorted(set(out))


def analyzer_landmarks(analysis):
    duration = float(analysis.get('duration') or 0)
    times = []
    for e in event_rows(analysis):
        if e['t'] > 0.001 and (duration <= 0 or e['t'] < duration - 0.001):
            times.append(e['t'])
    times.extend(analyzer_boundaries(analysis))
    return sorted(set(times))


def nearest_event_semantics(manual, predicted, tolerance=2.0):
    refs = [e for e in event_rows(manual) if e['kind'] not in {'beat', 'end'} and e['t'] > 0]
    preds = [e for e in event_rows(predicted) if e['t'] > 0]
    candidates = []
    for ri, r in enumerate(refs):
        for pi, p in enumerate(preds):
            d = abs(p['t'] - r['t'])
            if d <= tolerance:
                candidates.append((d, ri, pi))
    candidates.sort()
    used_r, used_p = set(), set()
    matches = []
    for d, ri, pi in candidates:
        if ri in used_r or pi in used_p:
            continue
        used_r.add(ri)
        used_p.add(pi)
        r, p = refs[ri], preds[pi]
        matches.append({
            'manual_t': r['t'],
            'manual_kind': r['kind'],
            'manual_name': r.get('name'),
            'analyzer_t': p['t'],
            'analyzer_kind': p['kind'],
            'analyzer_intensity': p.get('intensity'),
            'abs_error_s': d,
            'kind_match': r['kind'] == p['kind'],
        })
    exact_kind = sum(bool(x['kind_match']) for x in matches)
    return {
        'tolerance_s': tolerance,
        'manual_events': len(refs),
        'analyzer_events': len(preds),
        'time_matches': len(matches),
        'time_match_recall': len(matches) / len(refs) if refs else 0.0,
        'exact_kind_matches': exact_kind,
        'exact_kind_fraction_of_time_matches': exact_kind / len(matches) if matches else 0.0,
        'matches': matches,
    }


def energy_comparison(manifest, analysis):
    manual = manifest.get('energyCurve') or []
    duration = float(manifest.get('songLength') or analysis.get('duration') or 0)
    if not isinstance(manual, list) or len(manual) < 3 or not all(finite_number(v) for v in manual):
        return {'available': False}
    points = curve_points(analysis.get('energyCurve') or [], float(analysis.get('duration') or duration))
    if len(points) < 3:
        return {'available': False}
    n = len(manual)
    times = [duration * i / (n - 1) for i in range(n)]
    predicted = [interpolate(points, t) for t in times]
    valid = [(float(a), float(b)) for a, b in zip(manual, predicted) if b is not None]
    corr = pearson([a for a, _ in valid], [b for _, b in valid])
    mae = sum(abs(a - b) for a, b in valid) / len(valid) if valid else None
    return {
        'available': bool(valid),
        'manual_samples': n,
        'analyzer_samples': len(points),
        'pearson_r': corr,
        'mean_absolute_error': mae,
        'samples': [{'t': t, 'manual': float(a), 'analyzer': b} for t, a, b in zip(times, manual, predicted)],
    }


def tempo_comparison(manifest, analysis):
    mb = manifest.get('bpm')
    ab = analysis.get('bpm')
    if not finite_number(mb) or not finite_number(ab):
        return None
    mb = float(mb)
    ab = float(ab)
    ratios = [0.25, 1/3, 0.5, 2/3, 0.75, 1.0, 4/3, 1.5, 2.0, 3.0, 4.0]
    best = min(ratios, key=lambda r: abs(ab / mb - r))
    return {
        'manual_bpm': mb,
        'analyzer_bpm': ab,
        'ratio_analyzer_to_manual': ab / mb,
        'nearest_common_ratio': best,
        'ratio_error': abs(ab / mb - best),
        'manual_beatOffset': manifest.get('beatOffset'),
        'analyzer_beatOffset': analysis.get('beatOffset'),
        'timing_tier': (analysis.get('timingGuardrail') or {}).get('tier'),
    }


def evaluate_fixture(name, manifest_path, analysis_path):
    manifest = json.loads(manifest_path.read_text())
    analysis = json.loads(analysis_path.read_text())
    boundaries = timing_metric(manual_major_boundaries(manifest), analyzer_boundaries(analysis))
    landmarks = timing_metric(manual_landmarks(manifest), analyzer_landmarks(analysis))
    return {
        'fixture': name,
        'manifest': str(manifest_path),
        'analysis': str(analysis_path),
        'duration_manual': manifest.get('songLength'),
        'duration_analyzer': analysis.get('duration'),
        'tempo': tempo_comparison(manifest, analysis),
        'structureConfidence': analysis.get('structureConfidence'),
        'structureDiagnostics': analysis.get('structureDiagnostics'),
        'boundary': boundaries,
        'landmarks': landmarks,
        'energy': energy_comparison(manifest, analysis),
        'semantic_events': nearest_event_semantics(manifest, analysis, 2.0),
        'analyzer_sections': analysis.get('sections', []),
        'analyzer_events': analysis.get('events', []),
    }


def compact_fixture(x):
    b = x['boundary']['tolerances']
    l = x['landmarks']['tolerances']
    return {
        'fixture': x['fixture'],
        'timing_tier': (x.get('tempo') or {}).get('timing_tier'),
        'structureConfidence': x.get('structureConfidence'),
        'manual_major_boundaries': x['boundary']['reference_count'],
        'analyzer_section_boundaries': x['boundary']['predicted_count'],
        'boundary_f1_1s': b['1']['f1'],
        'boundary_f1_2s': b['2']['f1'],
        'boundary_f1_4s': b['4']['f1'],
        'boundary_recall_2s': b['2']['recall'],
        'boundary_precision_2s': b['2']['precision'],
        'boundary_mean_abs_error_2s': b['2']['mean_abs_error_s'],
        'manual_landmarks': x['landmarks']['reference_count'],
        'analyzer_landmarks': x['landmarks']['predicted_count'],
        'landmark_f1_1s': l['1']['f1'],
        'landmark_f1_2s': l['2']['f1'],
        'landmark_f1_4s': l['4']['f1'],
        'landmark_recall_2s': l['2']['recall'],
        'landmark_precision_2s': l['2']['precision'],
        'landmark_mean_abs_error_2s': l['2']['mean_abs_error_s'],
        'energy_pearson_r': x['energy'].get('pearson_r'),
        'energy_mae': x['energy'].get('mean_absolute_error'),
        'semantic_time_matches_2s': x['semantic_events']['time_matches'],
        'semantic_time_match_recall_2s': x['semantic_events']['time_match_recall'],
        'semantic_exact_kind_matches_2s': x['semantic_events']['exact_kind_matches'],
        'semantic_exact_kind_fraction': x['semantic_events']['exact_kind_fraction_of_time_matches'],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fixture', action='append', nargs=3, metavar=('NAME', 'MANIFEST', 'ANALYSIS'), required=True)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    results = []
    for name, manifest, analysis in args.fixture:
        results.append(evaluate_fixture(name, Path(manifest), Path(analysis)))
    summary = {
        'schema': 'trackcade-structure-v1-product-fixture-audit-v2',
        'interpretation': {
            'boundary_metrics': 'authored section/drop times compared with Analyzer section starts; timing only',
            'landmark_metrics': 'all authored non-beat/non-end landmarks compared with the union of Analyzer event times and section starts; timing only',
            'energy_metrics': 'authored uniformly-spaced energyCurve compared with Analyzer energyCurve interpolated at the same normalized song positions',
            'semantic_metrics': 'nearest authored and Analyzer events within 2 seconds using the real {kind,t} versus {type,time} schemas; exact kind agreement is reported separately and no semantic aliases are applied',
            'scientific_limit': 'These two hand-authored product fixtures are qualitative product evidence, not an independent scientific benchmark.'
        },
        'fixtures': results,
        'compact': [compact_fixture(x) for x in results],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary['compact'], indent=2))


if __name__ == '__main__':
    main()
