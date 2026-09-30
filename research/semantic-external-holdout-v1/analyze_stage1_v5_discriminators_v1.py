#!/usr/bin/env python3
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import re
import statistics
from pathlib import Path

import evaluate_stage1_drop_v1 as scorer

PRIMARY_TOLERANCE = 2.0
EXPECTED_FREEZE_SHA256 = "33b5463363aec9806744a2735e1c34a2809964dfb2f580cdfeaa466d63e1c816"
EXPECTED_REFERENCE_SHA256 = "1b74d185d47ea52db62d4c23cdbd44375b6ba0a05cf3824c4278e88646db9d1c"
EXPECTED_SCORER_BLOB = "3d74996281ec260e170ea10929bd0115a6d4ac70"

TERM_PATTERNS = {
    "chorus": r"\bchorus\b",
    "verse": r"\bverse\b",
    "return": r"\breturn(?:s|ed|ing)?\b",
    "reentry": r"\bre[- ]?entr(?:y|ies)\b",
    "breakdown": r"\bbreakdown\b",
    "build": r"\bbuild(?:s|up|ing)?\b",
    "tension": r"\btension\b",
    "release": r"\brelease\b",
    "sustained": r"\bsustain(?:ed|s|ing)?\b",
    "stronger": r"\bstronger\b",
    "energy": r"\benerg(?:y|etic)\b",
    "peak": r"\bpeak\b",
    "bass": r"\bbass\b",
    "drums": r"\bdrums?\b",
    "kick": r"\bkick\b",
    "hook": r"\bhook\b",
    "refrain": r"\brefrain\b",
    "quiet": r"\bquiet(?:er)?\b",
    "loud": r"\bloud(?:er)?\b",
    "impact": r"\bimpact\b",
    "drop_word": r"\bdrop\b",
}


def fail(msg: str) -> None:
    raise SystemExit("V5 DISCRIMINATOR FAIL-CLOSED: " + msg)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def mean(xs):
    return None if not xs else statistics.mean(xs)


def median(xs):
    return None if not xs else statistics.median(xs)


def stdev(xs):
    return None if len(xs) < 2 else statistics.stdev(xs)


def quantile(xs, q: float):
    if not xs:
        return None
    ys = sorted(xs)
    if len(ys) == 1:
        return ys[0]
    p = q * (len(ys) - 1)
    lo, hi = math.floor(p), math.ceil(p)
    if lo == hi:
        return ys[lo]
    w = p - lo
    return ys[lo] * (1 - w) + ys[hi] * w


def summary(xs):
    xs = [float(x) for x in xs if isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))]
    return {
        "n": len(xs),
        "mean": mean(xs),
        "median": median(xs),
        "stdev": stdev(xs),
        "q25": quantile(xs, 0.25),
        "q75": quantile(xs, 0.75),
        "min": min(xs) if xs else None,
        "max": max(xs) if xs else None,
    }


def smd(a, b):
    if len(a) < 2 or len(b) < 2:
        return None
    va, vb = statistics.variance(a), statistics.variance(b)
    pooled = math.sqrt(((len(a) - 1) * va + (len(b) - 1) * vb) / (len(a) + len(b) - 2))
    if pooled == 0:
        return 0.0
    return (statistics.mean(a) - statistics.mean(b)) / pooled


def empirical_percentile(values, value):
    vals = [float(x) for x in values if isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))]
    if not vals:
        return None
    less = sum(x < value for x in vals)
    equal = sum(x == value for x in vals)
    return (less + 0.5 * equal) / len(vals)


def auc_rank(records):
    pos = [r["semanticConfidence"] for r in records if r["matchedAt2s"]]
    neg = [r["semanticConfidence"] for r in records if not r["matchedAt2s"]]
    if not pos or not neg:
        return None
    wins = 0.0
    total = len(pos) * len(neg)
    for p in pos:
        for n in neg:
            wins += 1.0 if p > n else 0.5 if p == n else 0.0
    return wins / total


def aggregate_subset(refs_by_id, track_ids, records, predicate):
    by_o = collections.defaultdict(list)
    for r in records:
        if predicate(r):
            by_o[r["ordinal"]].append(r["time"])
    rows = []
    for ordinal, track_id in track_ids.items():
        rows.append(scorer.score_track(refs_by_id[track_id], by_o[ordinal], PRIMARY_TOLERANCE))
    return scorer.aggregate(rows)


def compact_micro(agg):
    m = agg["micro"]
    return {
        "candidateSupport": agg["candidateSupport"],
        "matchedSupport": agg["matchedSupport"],
        "truePositives": m["truePositives"],
        "falsePositives": m["falsePositives"],
        "falseNegatives": m["falseNegatives"],
        "precision": m["precision"],
        "recall": m["recall"],
        "f1": m["f1"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--freeze-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--v3-candidates", type=Path, required=True)
    ap.add_argument("--v3-eval", type=Path, required=True)
    ap.add_argument("--v5-eval", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()

    freeze_path = args.freeze_root / "STAGE1_V5_GENERATION_FREEZE_V1.json"
    if not freeze_path.is_file() or sha256(freeze_path) != EXPECTED_FREEZE_SHA256:
        fail("generation freeze identity mismatch")
    if sha256(args.references) != EXPECTED_REFERENCE_SHA256:
        fail("reference identity mismatch")
    if git_blob_sha(Path(scorer.__file__).resolve()) != EXPECTED_SCORER_BLOB:
        fail("scorer blob mismatch")
    if args.output_dir.exists():
        fail("output directory already exists")

    prep = load(args.prep_root / "STAGE1_V5_PREP_MANIFEST_V1.json")
    freeze = load(freeze_path)
    refs = load(args.references)
    v3_candidates = load(args.v3_candidates)
    v3_eval = load(args.v3_eval)
    v5_eval = load(args.v5_eval)

    if prep.get("trackCount") != 50 or freeze.get("trackCount") != 50:
        fail("prep/freeze closure mismatch")
    if v3_candidates.get("trackCount") != 50:
        fail("V3 candidate closure mismatch")

    prep_rows = {int(r["ordinal"]): r for r in prep["tracks"]}
    refs_by_id = {r["id"]: sorted(float(x) for x in r["dropsSeconds"]) for r in refs["stage1"]}
    v3_by_o = {int(r["ordinal"]): sorted(float(x) for x in r["proposalDropsSeconds"]) for r in v3_candidates["tracks"]}
    track_ids = {o: prep_rows[o]["id"] for o in range(1, 51)}
    if set(prep_rows) != set(range(1, 51)) or len(refs_by_id) != 50 or set(v3_by_o) != set(range(1, 51)):
        fail("ordinal/reference closure mismatch")

    # Verify frozen headline aggregates before deeper post-hoc diagnostics.
    v3_primary = v3_eval["proposalDropsSeconds"]["2.0"]["aggregate"]
    v5_primary = v5_eval["proposalDropsSeconds"]["2.0"]["aggregate"]
    if v3_primary["micro"]["truePositives"] != 19 or v5_primary["micro"]["truePositives"] != 19:
        fail("unexpected frozen headline TP")
    if v3_primary["micro"]["falsePositives"] != 64 or v5_primary["micro"]["falsePositives"] != 83:
        fail("unexpected frozen headline FP")

    records = []
    source_map_examples = []
    for o in range(1, 51):
        row = prep_rows[o]
        stem = row["stem"]
        tid = row["id"]
        prep_case = args.prep_root / "cases" / f"{o:02d}-{stem}"
        provider_case = args.freeze_root / "provider" / f"{o:02d}-{stem}"
        packet = load(prep_case / "structure-evidence-v2.json")
        proposal = load(provider_case / "normalized-proposal.json")
        source_map_path = prep_case / "structure-evidence-v2-source-map.json"
        if o <= 3 and source_map_path.is_file():
            sm = load(source_map_path)
            source_map_examples.append({"ordinal": o, "topLevelKeys": sorted(sm.keys()), "sourceMap": sm})
        anchors = packet.get("anchors")
        if not isinstance(anchors, list) or not anchors:
            fail(f"anchors missing ordinal {o}")
        for a in anchors:
            if not isinstance(a, list) or len(a) != 5:
                fail(f"anchor shape ordinal {o}")
        assessments = {
            int(a["anchor"]["index"]): a
            for a in proposal.get("candidateAssessments", [])
            if isinstance(a, dict) and a.get("semanticRole") == "drop"
        }
        events = []
        for e in proposal.get("events", []):
            if not isinstance(e, dict) or e.get("kind") != "drop":
                continue
            idx = int(e["anchor"]["index"])
            if idx not in assessments:
                fail(f"drop event without assessment ordinal {o} anchor {idx}")
            events.append((float(anchors[idx][0]), idx, e, assessments[idx]))
        events.sort(key=lambda x: x[0])
        times = [x[0] for x in events]
        pairs, _ = scorer.match_one_to_one(refs_by_id[tid], times, PRIMARY_TOLERANCE)
        matched = {j for _, j in pairs}
        anchor_times = sorted(float(a[0]) for a in anchors)
        feature_columns = [[float(a[k]) for a in anchors] for k in range(1, 5)]
        v3_times = v3_by_o[o]
        for j, (t, idx, event, assessment) in enumerate(events):
            vec = [float(x) for x in anchors[idx]]
            pos = anchor_times.index(t) if t in anchor_times else None
            prev_gap = None if pos is None or pos == 0 else t - anchor_times[pos - 1]
            next_gap = None if pos is None or pos == len(anchor_times) - 1 else anchor_times[pos + 1] - t
            nearest_v3 = min((abs(t - x) for x in v3_times), default=None)
            rationale = " ".join(str(x) for x in (assessment.get("rationale", ""), event.get("name", ""), event.get("rationale", ""))).lower()
            terms = sorted(k for k, pat in TERM_PATTERNS.items() if re.search(pat, rationale, flags=re.I))
            records.append({
                "ordinal": o,
                "id": tid,
                "time": t,
                "referenceCount": len(refs_by_id[tid]),
                "matchedAt2s": j in matched,
                "semanticConfidence": float(assessment["semanticConfidence"]),
                "repetitionRelation": assessment["repetitionRelation"],
                "nearestV3DistanceSeconds": nearest_v3,
                "v3AgreementWithin2s": nearest_v3 is not None and nearest_v3 <= 2.0 + 1e-12,
                "trackDropProposalCount": len(events),
                "anchorIndex": idx,
                "anchorFeature1": vec[1],
                "anchorFeature2": vec[2],
                "anchorFeature3": vec[3],
                "anchorFeature4": vec[4],
                "anchorFeature1Percentile": empirical_percentile(feature_columns[0], vec[1]),
                "anchorFeature2Percentile": empirical_percentile(feature_columns[1], vec[2]),
                "anchorFeature3Percentile": empirical_percentile(feature_columns[2], vec[3]),
                "anchorFeature4Percentile": empirical_percentile(feature_columns[3], vec[4]),
                "previousAnchorGapSeconds": prev_gap,
                "nextAnchorGapSeconds": next_gap,
                "rationaleTerms": terms,
                "assessmentRationale": assessment.get("rationale"),
                "eventName": event.get("name"),
                "eventRationale": event.get("rationale"),
            })

    if len(records) != 102 or sum(r["matchedAt2s"] for r in records) != 19:
        fail("candidate closure does not match frozen V5 headline")

    tp = [r for r in records if r["matchedAt2s"]]
    fp = [r for r in records if not r["matchedAt2s"]]
    zero_fp = [r for r in fp if r["referenceCount"] == 0]
    pos_fp = [r for r in fp if r["referenceCount"] > 0]

    feature_names = [
        "semanticConfidence",
        "anchorFeature1", "anchorFeature2", "anchorFeature3", "anchorFeature4",
        "anchorFeature1Percentile", "anchorFeature2Percentile", "anchorFeature3Percentile", "anchorFeature4Percentile",
        "previousAnchorGapSeconds", "nextAnchorGapSeconds", "trackDropProposalCount",
    ]
    feature_stats = {}
    for name in feature_names:
        a = [r[name] for r in tp if r.get(name) is not None]
        b = [r[name] for r in fp if r.get(name) is not None]
        z = [r[name] for r in zero_fp if r.get(name) is not None]
        p = [r[name] for r in pos_fp if r.get(name) is not None]
        feature_stats[name] = {
            "truePositive": summary(a),
            "falsePositive": summary(b),
            "zeroReferenceFalsePositive": summary(z),
            "positiveReferenceFalsePositive": summary(p),
            "standardizedMeanDifferenceTPMinusFP": smd(a, b),
        }

    relation_stats = {}
    for rel in ("independent", "repeated_similar", "unclear"):
        rows = [r for r in records if r["repetitionRelation"] == rel]
        tps = sum(r["matchedAt2s"] for r in rows)
        relation_stats[rel] = {
            "proposals": len(rows), "truePositives": tps, "falsePositives": len(rows) - tps,
            "precision": None if not rows else tps / len(rows),
            "zeroReferenceFalsePositives": sum((not r["matchedAt2s"]) and r["referenceCount"] == 0 for r in rows),
            "confidenceTP": summary([r["semanticConfidence"] for r in rows if r["matchedAt2s"]]),
            "confidenceFP": summary([r["semanticConfidence"] for r in rows if not r["matchedAt2s"]]),
        }

    confidence_thresholds = {}
    for threshold in (0.70, 0.75, 0.80, 0.82, 0.84, 0.86, 0.88, 0.90, 0.92, 0.94):
        agg = aggregate_subset(refs_by_id, track_ids, records, lambda r, t=threshold: r["semanticConfidence"] >= t)
        confidence_thresholds[f">={threshold:.2f}"] = compact_micro(agg)

    agreement = {}
    for name, pred in {
        "allV5": lambda r: True,
        "v3AgreementWithin2s": lambda r: r["v3AgreementWithin2s"],
        "v5OnlyBeyond2sFromV3": lambda r: not r["v3AgreementWithin2s"],
    }.items():
        rows = [r for r in records if pred(r)]
        agg = aggregate_subset(refs_by_id, track_ids, records, pred)
        agreement[name] = {
            **compact_micro(agg),
            "zeroReferenceProposals": sum(r["referenceCount"] == 0 for r in rows),
            "positiveReferenceProposals": sum(r["referenceCount"] > 0 for r in rows),
        }

    proposal_count_strata = {}
    for label, pred in {
        "1": lambda n: n == 1,
        "2": lambda n: n == 2,
        "3": lambda n: n == 3,
        "4plus": lambda n: n >= 4,
    }.items():
        rows = [r for r in records if pred(r["trackDropProposalCount"])]
        tps = sum(r["matchedAt2s"] for r in rows)
        proposal_count_strata[label] = {
            "proposals": len(rows), "truePositives": tps, "falsePositives": len(rows) - tps,
            "precision": None if not rows else tps / len(rows),
            "zeroReferenceProposals": sum(r["referenceCount"] == 0 for r in rows),
        }

    term_stats = {}
    for term in TERM_PATTERNS:
        rows = [r for r in records if term in r["rationaleTerms"]]
        tps = sum(r["matchedAt2s"] for r in rows)
        term_stats[term] = {
            "proposals": len(rows), "truePositives": tps, "falsePositives": len(rows) - tps,
            "precision": None if not rows else tps / len(rows),
            "zeroReferenceFalsePositives": sum((not r["matchedAt2s"]) and r["referenceCount"] == 0 for r in rows),
        }

    out = {
        "schema": "trackcade-stage1-v5-discriminator-analysis-v1",
        "status": "offline-posthoc-development-diagnostic-not-predeclared-gate",
        "providerCalls": 0,
        "terminalHoldoutUsed": False,
        "compilerInvoked": False,
        "trackCount": 50,
        "proposalCount": len(records),
        "truePositivesAt2s": len(tp),
        "falsePositivesAt2s": len(fp),
        "zeroReferenceFalsePositives": len(zero_fp),
        "positiveReferenceFalsePositives": len(pos_fp),
        "confidenceAucTPvsFP": auc_rank(records),
        "featureDiagnostics": feature_stats,
        "repetitionRelationDiagnostics": relation_stats,
        "confidenceThresholdCounterfactualsPostHocOnly": confidence_thresholds,
        "v3AgreementDiagnosticsPostHocOnly": agreement,
        "trackProposalCountDiagnostics": proposal_count_strata,
        "rationaleTermDiagnostics": term_stats,
        "sourceMapExamples": source_map_examples,
        "candidateRecords": records,
    }

    args.output_dir.mkdir(parents=True)
    (args.output_dir / "STAGE1_V5_DISCRIMINATOR_ANALYSIS_V1.json").write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    def pct(x):
        return "n/a" if x is None else f"{100*x:.2f}%"

    lines = [
        "# Stage1 V5 discriminator analysis (offline, post-hoc development diagnostic)",
        "",
        f"- Frozen V5 proposals: {len(records)}; {len(tp)} TP / {len(fp)} FP at ±2.",
        f"- Confidence rank AUC for TP vs FP: {out['confidenceAucTPvsFP']:.3f} (0.5 = no separation).",
        "",
        "## V3/V5 agreement",
        "",
    ]
    for name, d in agreement.items():
        lines.append(f"- `{name}`: {d['truePositives']} TP / {d['falsePositives']} FP / {d['falseNegatives']} FN; precision {pct(d['precision'])}, F1 {pct(d['f1'])}; zero-reference proposals {d['zeroReferenceProposals']}.")
    lines += ["", "## Confidence counterfactuals (diagnostic only)", ""]
    for name, d in confidence_thresholds.items():
        lines.append(f"- `{name}`: {d['truePositives']} TP / {d['falsePositives']} FP / {d['falseNegatives']} FN; precision {pct(d['precision'])}, recall {pct(d['recall'])}, F1 {pct(d['f1'])}.")
    lines += ["", "## Proposal-count strata", ""]
    for name, d in proposal_count_strata.items():
        lines.append(f"- track emits `{name}` Drop proposal(s): {d['proposals']} proposals, {d['truePositives']} TP / {d['falsePositives']} FP, precision {pct(d['precision'])}, zero-reference proposals {d['zeroReferenceProposals']}.")
    lines += ["", "## Rationale terms", ""]
    useful_terms = sorted(term_stats.items(), key=lambda kv: (-kv[1]["proposals"], kv[0]))
    for term, d in useful_terms:
        if d["proposals"]:
            lines.append(f"- `{term}`: {d['proposals']} proposals, {d['truePositives']} TP / {d['falsePositives']} FP, precision {pct(d['precision'])}, zero-reference FP {d['zeroReferenceFalsePositives']}.")
    lines += ["", "## Strongest numeric feature separations", ""]
    ranked = sorted(
        ((name, stats["standardizedMeanDifferenceTPMinusFP"]) for name, stats in feature_stats.items() if stats["standardizedMeanDifferenceTPMinusFP"] is not None),
        key=lambda x: -abs(x[1]),
    )
    for name, effect in ranked[:8]:
        a, b = feature_stats[name]["truePositive"], feature_stats[name]["falsePositive"]
        lines.append(f"- `{name}`: SMD TP-FP {effect:+.3f}; TP median {a['median']}, FP median {b['median']}.")
    lines += [
        "",
        "These are label-informed, post-hoc Stage1 diagnostics. They are evidence for V6 design hypotheses, not validated production thresholds and not terminal-holdout results.",
    ]
    (args.output_dir / "STAGE1_V5_DISCRIMINATOR_ANALYSIS_V1.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
