#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from validate_learned_proposal_v3 import (
    finite_number,
    load_json_strict,
    normalized_text,
    scan_forbidden_keys,
    validate_packet,
)

PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v3"
MAX_EVENTS = 64
MAX_COMPARISONS = 64
MAX_NAME = 80
MAX_EVENT_RATIONALE = 500
MAX_DECISION_RATIONALE = 800
MAX_COMPARISON_RATIONALE = 500
TOP_KEYS = {"schema", "source", "trackSemanticDecision", "candidateComparisons", "events"}
SOURCE_KEYS = {"analyzerRunnerSha256", "analysisJsonSha256"}
DECISION_KEYS = {"dropPresence", "presenceConfidence", "localizationStatus", "rationale"}
COMPARISON_KEYS = {"anchor", "role", "distinctiveness", "rationale"}
EVENT_KEYS = {"kind", "semanticConfidence", "anchor", "name", "rationale"}
ANCHOR_KEYS = {"type", "index"}
ALLOWED_KINDS = {"section", "energy", "peak", "drop"}
ALLOWED_PRESENCE = {"drop_present", "no_drop", "insufficient_semantic_evidence"}
ALLOWED_LOCALIZATION = {"localized", "no_selectable_anchor", "not_applicable"}
ALLOWED_COMPARISON_ROLES = {"selected_drop", "ordinary_transition", "ambiguous"}


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

    decision = proposal.get("trackSemanticDecision")
    normalized_decision = None
    drop_presence = None
    localization = None
    if not isinstance(decision, dict):
        errors.append("proposal_track_decision_not_object")
    else:
        if set(decision) != DECISION_KEYS:
            extra = sorted(set(decision) - DECISION_KEYS)
            missing = sorted(DECISION_KEYS - set(decision))
            if extra:
                errors.append(f"proposal_track_decision_unexpected_keys:{','.join(extra)}")
            if missing:
                errors.append(f"proposal_track_decision_missing_keys:{','.join(missing)}")
        drop_presence = decision.get("dropPresence")
        if drop_presence not in ALLOWED_PRESENCE:
            errors.append("proposal_drop_presence_invalid")
        presence_confidence = decision.get("presenceConfidence")
        if not finite_number(presence_confidence) or not 0 <= float(presence_confidence) <= 1:
            errors.append("proposal_presence_confidence_invalid")
        localization = decision.get("localizationStatus")
        if localization not in ALLOWED_LOCALIZATION:
            errors.append("proposal_localization_status_invalid")
        rationale = _required_text(
            decision.get("rationale"), MAX_DECISION_RATIONALE, "proposal_track_decision_rationale", errors
        )
        normalized_decision = {
            "dropPresence": drop_presence,
            "presenceConfidence": float(presence_confidence) if finite_number(presence_confidence) else presence_confidence,
            "localizationStatus": localization,
            "rationale": rationale,
        }

    comparisons = proposal.get("candidateComparisons")
    if not isinstance(comparisons, list):
        errors.append("proposal_candidate_comparisons_not_list")
        comparisons = []
    elif len(comparisons) > MAX_COMPARISONS:
        errors.append("proposal_too_many_candidate_comparisons")

    normalized_comparisons = []
    seen_comparison_anchors = set()
    selected_drop_anchors = set()
    for i, raw in enumerate(comparisons):
        prefix = f"comparison_{i}"
        if not isinstance(raw, dict):
            errors.append(f"{prefix}_not_object")
            continue
        if set(raw) != COMPARISON_KEYS:
            extra = sorted(set(raw) - COMPARISON_KEYS)
            missing = sorted(COMPARISON_KEYS - set(raw))
            if extra:
                errors.append(f"{prefix}_unexpected_keys:{','.join(extra)}")
            if missing:
                errors.append(f"{prefix}_missing_keys:{','.join(missing)}")
        idx = _validate_anchor(packet, raw.get("anchor"), prefix, errors)
        if isinstance(idx, int) and not isinstance(idx, bool):
            if idx in seen_comparison_anchors:
                errors.append(f"{prefix}_duplicate_anchor")
            seen_comparison_anchors.add(idx)
        role = raw.get("role")
        if role not in ALLOWED_COMPARISON_ROLES:
            errors.append(f"{prefix}_role_invalid")
        distinctiveness = raw.get("distinctiveness")
        if not finite_number(distinctiveness) or not 0 <= float(distinctiveness) <= 1:
            errors.append(f"{prefix}_distinctiveness_invalid")
        rationale = _required_text(
            raw.get("rationale"), MAX_COMPARISON_RATIONALE, f"{prefix}_rationale", errors
        )
        if role == "selected_drop" and isinstance(idx, int) and not isinstance(idx, bool):
            selected_drop_anchors.add(idx)
        normalized_comparisons.append({
            "anchor": {"type": "evidence", "index": idx},
            "role": role,
            "distinctiveness": float(distinctiveness) if finite_number(distinctiveness) else distinctiveness,
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

    if drop_presence in {"no_drop", "insufficient_semantic_evidence"}:
        if localization != "not_applicable":
            errors.append("proposal_abstention_requires_not_applicable_localization")
        if drop_event_anchors:
            errors.append("proposal_abstention_forbids_drop_events")
        if selected_drop_anchors:
            errors.append("proposal_abstention_forbids_selected_drop_comparisons")
    elif drop_presence == "drop_present":
        if localization == "localized":
            if not drop_event_anchors:
                errors.append("proposal_localized_requires_drop_event")
        elif localization == "no_selectable_anchor":
            if drop_event_anchors:
                errors.append("proposal_no_selectable_anchor_forbids_drop_events")
            if selected_drop_anchors:
                errors.append("proposal_no_selectable_anchor_forbids_selected_drop_comparisons")
        elif localization == "not_applicable":
            errors.append("proposal_drop_present_forbids_not_applicable_localization")

    if selected_drop_anchors != drop_event_anchors:
        missing_comparison = sorted(drop_event_anchors - selected_drop_anchors)
        missing_event = sorted(selected_drop_anchors - drop_event_anchors)
        if missing_comparison:
            errors.append("proposal_drop_events_missing_selected_comparison:" + ",".join(map(str, missing_comparison)))
        if missing_event:
            errors.append("proposal_selected_comparisons_missing_drop_event:" + ",".join(map(str, missing_event)))

    if errors:
        return None, errors
    return {
        "schema": PROPOSAL_SCHEMA,
        "source": {
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
        "trackSemanticDecision": normalized_decision,
        "candidateComparisons": normalized_comparisons,
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
        "schema": "trackcade-learned-proposal-validation-v3",
        "status": "valid" if not errors else "rejected",
        "packet": str(args.packet),
        "proposal": str(args.proposal),
        "errors": errors,
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
        "confidenceFieldsDiagnosticOnly": True,
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
        "dropPresence": normalized["trackSemanticDecision"]["dropPresence"],
        "candidateComparisons": len(normalized["candidateComparisons"]),
        "events": len(normalized["events"]),
    }, indent=2))


if __name__ == "__main__":
    main()
