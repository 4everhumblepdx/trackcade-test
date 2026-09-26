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
    for i, row in enumerate(curve):
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


def manual_major_boundaries(manifest):
    # Section and drop events are the authored structural state changes.
    out = []
    for e in manifest.get('events', []):
        if not isinstance(e, dict):
            continue
        if e.get('kind') not in {'section', 'drop'}:
            continue
        t = e.get('t')
        if finite_number(t) and float(t) > 0:
            out.append(float(t))
    return sorted(set(out))


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


def event_rows(data):
    out = []
    for e in data.get('events', []):
        if not isinstance(e, dict):
            continue
        t = e.get('t')
        kind = e.get('kind')
        if finite_number(t) and isinstance(kind, str):
            out.append({'t': float(t), 'kind': kind, 'name': e.get('name')})
    return out


def nearest_event_semantics(manual, predicted, tolerance=2.0):
    refs = event_rows(manual)
    preds = event_rows(predicted)
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
            'manual_t': r['t'], 'manual_kind': r['kind'], 'manual_name': r.get('name'),
            'analyzer_t': p['t'], 'analyzer_kind': p['kind'],
            'abs_error_s': d,
            'kind_match': r['kind'] == p['kind'],
        })
    exact_kind = sum(bool(x['kind_match']) for x in matches)
    return {
        'tolerance_s': tolerance,
        'manual_events': len(refs),
        'analyzer_events': len(preds),
        'time_matches': len(matches),
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
    corr = pearson([float(v) for v in manual], predicted)
    mae = sum(abs(float(a) - float(b)) for a, b in zip(manual, predicted) if b is not None) / n
    return {
        'available': True,
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
    refs = manual_major_boundaries(manifest)
    preds = analyzer_boundaries(analysis)
    boundary = {
        'manual_major_boundaries': refs,
        'analyzer_section_boundaries': preds,
        'manual_count': len(refs),
        'analyzer_count': len(preds),
        'tolerances': {},
    }
    for tol in (1.0, 2.0, 4.0):
        matches = unique_greedy_matches(refs, preds, tol)
        stats = prf(matches, len(refs), len(preds))
        if matches:
            stats['mean_abs_error_s'] = sum(m['abs_error_s'] for m in matches) / len(matches)
            stats['max_abs_error_s'] = max(m['abs_error_s'] for m in matches)
        else:
            stats['mean_abs_error_s'] = None
            stats['max_abs_error_s'] = None
        stats['pairs'] = matches
        boundary['tolerances'][str(int(tol))] = stats
    return {
        'fixture': name,
        'manifest': str(manifest_path),
        'analysis': str(analysis_path),
        'duration_manual': manifest.get('songLength'),
        'duration_analyzer': analysis.get('duration'),
        'tempo': tempo_comparison(manifest, analysis),
        'structureConfidence': analysis.get('structureConfidence'),
        'structureDiagnostics': analysis.get('structureDiagnostics'),
        'boundary': boundary,
        'energy': energy_comparison(manifest, analysis),
        'semantic_events': nearest_event_semantics(manifest, analysis, 2.0),
        'analyzer_sections': analysis.get('sections', []),
        'analyzer_events': analysis.get('events', []),
    }


def compact_fixture(x):
    b = x['boundary']['tolerances']
    return {
        'fixture': x['fixture'],
        'timing_tier': (x.get('tempo') or {}).get('timing_tier'),
        'structureConfidence': x.get('structureConfidence'),
        'manual_major_boundaries': x['boundary']['manual_count'],
        'analyzer_section_boundaries': x['boundary']['analyzer_count'],
        'boundary_f1_1s': b['1']['f1'],
        'boundary_f1_2s': b['2']['f1'],
        'boundary_f1_4s': b['4']['f1'],
        'boundary_recall_2s': b['2']['recall'],
        'boundary_precision_2s': b['2']['precision'],
        'boundary_mean_abs_error_2s': b['2']['mean_abs_error_s'],
        'energy_pearson_r': x['energy'].get('pearson_r'),
        'energy_mae': x['energy'].get('mean_absolute_error'),
        'semantic_time_matches_2s': x['semantic_events']['time_matches'],
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
        'schema': 'trackcade-structure-v1-product-fixture-audit',
        'interpretation': {
            'boundary_metrics': 'manual section/drop times compared with Analyzer section starts; this evaluates timing only, not semantic names',
            'energy_metrics': 'manual uniformly-spaced energyCurve compared with Analyzer energyCurve interpolated at the same normalized song positions',
            'semantic_metrics': 'nearest authored/analyzer events within 2 seconds; exact event-kind agreement is reported separately from timing agreement',
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
