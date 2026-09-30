#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_learned_request_v6 import (
    DERIVED_PRESENCE,
    MAX_ASSESSMENTS,
    MAX_EVENTS,
    ORDINARY_RETURN_STATES,
    PATTERN_STATES,
    PROPOSAL_SCHEMA,
    REPETITION_RELATIONS,
    SEMANTIC_ROLES,
)
from validate_learned_proposal_v3 import (
    finite_number,
    load_json_strict,
    normalized_text,
    scan_forbidden_keys,
    validate_packet,
)

MAX_NAME = 80
MAX_EVENT_RATIONALE = 500
MAX_ASSESSMENT_RATIONALE = 700
MAX_SUMMARY_RATIONALE = 800
TOP_KEYS = {"schema", "source", "candidateAssessments", "trackSummary", "events"}
SOURCE_KEYS = {"analyzerRunnerSha256", "analysisJsonSha256"}
ASSESSMENT_KEYS = {
    "anchor", "semanticRole", "preparation", "decisiveImpact", "sustainedStrongerPassage",
    "ordinaryReturnAlternative", "repetitionRelation", "semanticConfidence", "rationale",
}
SUMMARY_KEYS = {"dropPresence", "dropCount", "ambiguousCandidateCount", "rationale"}
EVENT_KEYS = {"kind", "semanticConfidence", "anchor", "name", "rationale"}
ANCHOR_KEYS = {"type", "index"}
ALLOWED_KINDS = {"section", "energy", "peak", "drop"}


def _validate_anchor(packet, anchor, prefix, errors):
    idx = None
    if not isinstance(anchor, dict):
        errors.append(f"{prefix}_anchor_not_object")
        return None
    if set(anchor) != ANCHOR_KEYS:
        extra = sorted(set(anchor) - ANCHOR_KEYS)
        missing = sorted(ANCHOR_KEYS - set(anchor))
        if extra:
            errors.append(f"{prefix}_anchor_unexpected_keys:{','.join(extra)}")
        if missing:
            errors.append(f"{prefix}_anchor_missing_keys:{','.join(missing)}")
    if anchor.get("type") != "evidence":
        errors.append(f"{prefix}_anchor_type_invalid")
    idx = anchor.get("index")
    if not isinstance(idx, int) or isinstance(idx, bool):
        errors.append(f"{prefix}_anchor_index_invalid")
    elif idx < 0 or idx >= len(packet["anchors"]):
        errors.append(f"{prefix}_anchor_index_out_of_range")
    return idx


def _required_text(value, limit, error_prefix, errors):
    text = normalized_text(value)
    if text is None:
        errors.append(f"{error_prefix}_invalid")
        return None
    if len(text) > limit:
        errors.append(f"{error_prefix}_too_long")
    return text


def validate_and_normalize(packet, proposal):
    errors = validate_packet(packet)
    if errors:
        return None, errors
    if not isinstance(proposal, dict):
        return None, errors + ["proposal_not_object"]

    if set(proposal) != TOP_KEYS:
        extra = sorted(set(proposal) - TOP_KEYS)
        missing = sorted(TOP_KEYS - set(proposal))
        if extra:
            errors.append(f"proposal_unexpected_top_keys:{','.join(extra)}")
        if missing:
            errors.append(f"proposal_missing_top_keys:{','.join(missing)}")

    scan_forbidden_keys(proposal, "proposal", errors)
    if proposal.get("schema") != PROPOSAL_SCHEMA:
        errors.append("proposal_schema_mismatch")

    source = proposal.get("source")
    if not isinstance(source, dict):
        errors.append("proposal_source_not_object")
    else:
        if set(source) != SOURCE_KEYS:
            extra = sorted(set(source) - SOURCE_KEYS)
            missing = sorted(SOURCE_KEYS - set(source))
            if extra:
                errors.append(f"proposal_source_unexpected_keys:{','.join(extra)}")
            if missing:
                errors.append(f"proposal_source_missing_keys:{','.join(missing)}")
        packet_source = packet["source"]
        if source.get("analyzerRunnerSha256") != packet_source.get("analyzerRunnerSha256"):
            errors.append("proposal_analyzer_runner_mismatch")
        if source.get("analysisJsonSha256") != packet_source.get("analysisJsonSha256"):
            errors.append("proposal_analysis_sha_mismatch")

    assessments = proposal.get("candidateAssessments")
    if not isinstance(assessments, list):
        errors.append("proposal_candidate_assessments_not_list")
        assessments = []
    elif len(assessments) > MAX_ASSESSMENTS:
        errors.append("proposal_too_many_candidate_assessments")

    normalized_assessments = []
    seen_assessment_anchors = set()
    drop_assessment_anchors = set()
    ambiguous_assessment_anchors = set()
    for i, raw in enumerate(assessments):
        prefix = f"assessment_{i}"
        if not isinstance(raw, dict):
            errors.append(f"{prefix}_not_object")
            continue
        if set(raw) != ASSESSMENT_KEYS:
            extra = sorted(set(raw) - ASSESSMENT_KEYS)
            missing = sorted(ASSESSMENT_KEYS - set(raw))
            if extra:
                errors.append(f"{prefix}_unexpected_keys:{','.join(extra)}")
            if missing:
                errors.append(f"{prefix}_missing_keys:{','.join(missing)}")
        idx = _validate_anchor(packet, raw.get("anchor"), prefix, errors)
        if isinstance(idx, int) and not isinstance(idx, bool):
            if idx in seen_assessment_anchors:
                errors.append(f"{prefix}_duplicate_anchor")
            seen_assessment_anchors.add(idx)

        role = raw.get("semanticRole")
        if role not in SEMANTIC_ROLES:
            errors.append(f"{prefix}_semantic_role_invalid")
        pattern = {}
        for key in ("preparation", "decisiveImpact", "sustainedStrongerPassage"):
            value = raw.get(key)
            if value not in PATTERN_STATES:
                errors.append(f"{prefix}_{key}_invalid")
            pattern[key] = value
        alternative = raw.get("ordinaryReturnAlternative")
        if alternative not in ORDINARY_RETURN_STATES:
            errors.append(f"{prefix}_ordinary_return_alternative_invalid")
        repetition = raw.get("repetitionRelation")
        if repetition not in REPETITION_RELATIONS:
            errors.append(f"{prefix}_repetition_relation_invalid")
        conf = raw.get("semanticConfidence")
        if not finite_number(conf) or not 0 <= float(conf) <= 1:
            errors.append(f"{prefix}_semantic_confidence_invalid")
        rationale = _required_text(raw.get("rationale"), MAX_ASSESSMENT_RATIONALE, f"{prefix}_rationale", errors)

        if role == "drop":
            for key, value in pattern.items():
                if value != "clear":
                    errors.append(f"{prefix}_drop_requires_clear_{key}")
            if alternative != "ruled_out":
                errors.append(f"{prefix}_drop_requires_ordinary_return_ruled_out")
            if isinstance(idx, int) and not isinstance(idx, bool):
                drop_assessment_anchors.add(idx)
        elif role == "ambiguous" and isinstance(idx, int) and not isinstance(idx, bool):
            ambiguous_assessment_anchors.add(idx)

        normalized_assessments.append({
            "anchor": {"type": "evidence", "index": idx},
            "semanticRole": role,
            "preparation": pattern["preparation"],
            "decisiveImpact": pattern["decisiveImpact"],
            "sustainedStrongerPassage": pattern["sustainedStrongerPassage"],
            "ordinaryReturnAlternative": alternative,
            "repetitionRelation": repetition,
            "semanticConfidence": float(conf) if finite_number(conf) else conf,
            "rationale": rationale,
        })

    events = proposal.get("events")
    if not isinstance(events, list):
        errors.append("proposal_events_not_list")
        events = []
    elif len(events) > MAX_EVENTS:
        errors.append("proposal_too_many_events")

    normalized_events = []
    drop_event_anchors = set()
    for i, raw in enumerate(events):
        prefix = f"event_{i}"
        if not isinstance(raw, dict):
            errors.append(f"{prefix}_not_object")
            continue
        if set(raw) != EVENT_KEYS:
            extra = sorted(set(raw) - EVENT_KEYS)
            missing = sorted(EVENT_KEYS - set(raw))
            if extra:
                errors.append(f"{prefix}_unexpected_keys:{','.join(extra)}")
            if missing:
                errors.append(f"{prefix}_missing_keys:{','.join(missing)}")
        kind = raw.get("kind")
        if kind not in ALLOWED_KINDS:
            errors.append(f"{prefix}_unsupported_kind")
        conf = raw.get("semanticConfidence")
        if not finite_number(conf) or not 0 <= float(conf) <= 1:
            errors.append(f"{prefix}_semantic_confidence_invalid")
        idx = _validate_anchor(packet, raw.get("anchor"), prefix, errors)
        name = _required_text(raw.get("name"), MAX_NAME, f"{prefix}_name", errors)
        rationale = _required_text(raw.get("rationale"), MAX_EVENT_RATIONALE, f"{prefix}_rationale", errors)
        if kind == "drop" and isinstance(idx, int) and not isinstance(idx, bool):
            if idx in drop_event_anchors:
                errors.append(f"{prefix}_duplicate_drop_anchor")
            drop_event_anchors.add(idx)
        normalized_events.append({
            "kind": kind,
            "semanticConfidence": float(conf) if finite_number(conf) else conf,
            "anchor": {"type": "evidence", "index": idx},
            "name": name,
            "rationale": rationale,
        })

    if drop_assessment_anchors != drop_event_anchors:
        missing_event = sorted(drop_assessment_anchors - drop_event_anchors)
        missing_assessment = sorted(drop_event_anchors - drop_assessment_anchors)
        if missing_event:
            errors.append("proposal_drop_assessments_missing_drop_event:" + ",".join(map(str, missing_event)))
        if missing_assessment:
            errors.append("proposal_drop_events_missing_drop_assessment:" + ",".join(map(str, missing_assessment)))

    summary = proposal.get("trackSummary")
    normalized_summary = None
    derived_drop_count = len(drop_assessment_anchors)
    derived_ambiguous_count = len(ambiguous_assessment_anchors)
    if derived_drop_count > 0:
        derived_presence = "drop_present"
    elif derived_ambiguous_count > 0:
        derived_presence = "ambiguous_only"
    else:
        derived_presence = "no_drop"

    if not isinstance(summary, dict):
        errors.append("proposal_track_summary_not_object")
    else:
        if set(summary) != SUMMARY_KEYS:
            extra = sorted(set(summary) - SUMMARY_KEYS)
            missing = sorted(SUMMARY_KEYS - set(summary))
            if extra:
                errors.append(f"proposal_track_summary_unexpected_keys:{','.join(extra)}")
            if missing:
                errors.append(f"proposal_track_summary_missing_keys:{','.join(missing)}")
        presence = summary.get("dropPresence")
        if presence not in DERIVED_PRESENCE:
            errors.append("proposal_track_summary_presence_invalid")
        if presence != derived_presence:
            errors.append("proposal_track_summary_presence_not_derived")
        drop_count = summary.get("dropCount")
        if not isinstance(drop_count, int) or isinstance(drop_count, bool) or drop_count < 0:
            errors.append("proposal_track_summary_drop_count_invalid")
        elif drop_count != derived_drop_count:
            errors.append("proposal_track_summary_drop_count_not_derived")
        ambiguous_count = summary.get("ambiguousCandidateCount")
        if not isinstance(ambiguous_count, int) or isinstance(ambiguous_count, bool) or ambiguous_count < 0:
            errors.append("proposal_track_summary_ambiguous_count_invalid")
        elif ambiguous_count != derived_ambiguous_count:
            errors.append("proposal_track_summary_ambiguous_count_not_derived")
        rationale = _required_text(summary.get("rationale"), MAX_SUMMARY_RATIONALE, "proposal_track_summary_rationale", errors)
        normalized_summary = {
            "dropPresence": presence,
            "dropCount": drop_count,
            "ambiguousCandidateCount": ambiguous_count,
            "rationale": rationale,
        }

    if errors:
        return None, errors
    return {
        "schema": PROPOSAL_SCHEMA,
        "source": {
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
        "candidateAssessments": normalized_assessments,
        "trackSummary": normalized_summary,
        "events": normalized_events,
    }, []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packet", type=Path, required=True)
    ap.add_argument("--proposal", type=Path, required=True)
    ap.add_argument("--output", type=Path)
    ap.add_argument("--report", type=Path, required=True)
    args = ap.parse_args()
    try:
        packet = load_json_strict(args.packet)
        proposal = load_json_strict(args.proposal)
        normalized, errors = validate_and_normalize(packet, proposal)
    except ValueError as exc:
        normalized, errors = None, [str(exc)]
    report = {
        "schema": "trackcade-learned-proposal-validation-v6",
        "status": "valid" if not errors else "rejected",
        "packet": str(args.packet),
        "proposal": str(args.proposal),
        "errors": errors,
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
        "confidenceFieldsDiagnosticOnly": True,
        "analyzerDescriptorsNotSemanticGates": True,
        "trackSummaryDerivedNotGate": True,
        "repeatedSimilarDropsAllowed": True,
        "decisiveImpactRequiredForDrop": True,
        "ordinaryReturnMustBeRuledOutForDrop": True,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if errors:
        raise SystemExit(2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(normalized, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "valid",
        "dropPresence": normalized["trackSummary"]["dropPresence"],
        "dropCount": normalized["trackSummary"]["dropCount"],
        "candidateAssessments": len(normalized["candidateAssessments"]),
        "events": len(normalized["events"]),
    }, indent=2))


if __name__ == "__main__":
    main()
