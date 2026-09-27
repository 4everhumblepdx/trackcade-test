#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

PACKET_SCHEMA = "trackcade-interpretation-packet-v1"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v1"
ANALYZER_RELEASE = "v0.19"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
MAX_EVENTS = 64
MAX_NAME = 80
MAX_RATIONALE = 500
TOP_KEYS = {"schema", "source", "events"}
SOURCE_KEYS = {"analyzerRunnerSha256", "analysisJsonSha256"}
EVENT_KEYS = {"kind", "semanticConfidence", "anchor", "name", "duration", "rationale"}
ANCHOR_KEYS = {"type", "index"}
FORBIDDEN_KEYS = {
    "t", "time", "timestamp", "bpm", "beatoffset", "beat_offset", "beatgrid", "beat_grid",
    "beats", "songlength", "durationseconds", "timingtier", "timingconfidence",
}
HEX64 = re.compile(r"^[0-9a-f]{64}$")


class DuplicateKey(ValueError):
    pass


def no_duplicate_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise DuplicateKey(f"duplicate JSON key: {key}")
        out[key] = value
    return out


def load_json_strict(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=no_duplicate_object)
    except (json.JSONDecodeError, UnicodeDecodeError, DuplicateKey) as exc:
        raise ValueError(f"invalid_json: {exc}") from exc


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def normalized_text(value):
    if not isinstance(value, str):
        return None
    text = " ".join(value.strip().split())
    return text or None


def dict_keys_exact(obj, allowed, path, errors):
    if not isinstance(obj, dict):
        errors.append(f"{path}_not_object")
        return False
    extra = sorted(set(obj) - allowed)
    missing = sorted(allowed - set(obj))
    if extra:
        errors.append(f"{path}_unexpected_keys:{','.join(extra)}")
    if missing:
        errors.append(f"{path}_missing_keys:{','.join(missing)}")
    return not extra and not missing


def scan_forbidden_keys(value, path="root", errors=None):
    errors = errors if errors is not None else []
    if isinstance(value, dict):
        for key, child in value.items():
            k = str(key).lower()
            if k in FORBIDDEN_KEYS:
                errors.append(f"forbidden_timing_key:{path}.{key}")
            if "diagnostic" in k:
                errors.append(f"forbidden_diagnostic_key:{path}.{key}")
            scan_forbidden_keys(child, f"{path}.{key}", errors)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            scan_forbidden_keys(child, f"{path}[{i}]", errors)
    return errors


def validate_packet(packet):
    errors = []
    if not isinstance(packet, dict):
        return ["packet_not_object"]
    if packet.get("schema") != PACKET_SCHEMA:
        errors.append("packet_schema_mismatch")

    source = packet.get("source")
    if not isinstance(source, dict):
        errors.append("packet_source_missing")
    else:
        if source.get("analyzerRelease") != ANALYZER_RELEASE:
            errors.append("packet_analyzer_release_mismatch")
        if source.get("analyzerSourceCommit") != ANALYZER_SOURCE_COMMIT:
            errors.append("packet_analyzer_source_commit_mismatch")
        if source.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256:
            errors.append("packet_analyzer_runner_mismatch")
        analysis = source.get("analysisJsonSha256")
        if not isinstance(analysis, str) or not HEX64.fullmatch(analysis):
            errors.append("packet_analysis_sha_invalid")
        for key in ("duration", "bpm", "beatOffset"):
            if not finite_number(source.get(key)):
                errors.append(f"packet_source_{key}_invalid")

    contract = packet.get("interpretationContract")
    if not isinstance(contract, dict):
        errors.append("packet_interpretation_contract_missing")
    else:
        if contract.get("timingAuthority") != "deterministic-structure-evidence-only":
            errors.append("packet_timing_authority_invalid")
        if contract.get("independentTimestampsAllowed") is not False:
            errors.append("packet_independent_timestamps_not_forbidden")
        if contract.get("beatOrBpmEditsAllowed") is not False:
            errors.append("packet_beat_bpm_edits_not_forbidden")
        if contract.get("analyzerSemanticHintsExposed") is not False:
            errors.append("packet_semantic_hints_exposed")
        kinds = contract.get("allowedProposalKinds")
        if not isinstance(kinds, list) or set(kinds) != {"section", "energy", "peak", "drop"}:
            errors.append("packet_allowed_kinds_invalid")
        anchors = contract.get("anchorTypes")
        if not isinstance(anchors, list) or set(anchors) != {"boundary", "landmark"}:
            errors.append("packet_anchor_types_invalid")

    for key in ("boundaries", "landmarks"):
        rows = packet.get(key)
        if not isinstance(rows, list):
            errors.append(f"packet_{key}_not_list")
            continue
        for i, row in enumerate(rows):
            if not isinstance(row, dict) or not finite_number(row.get("time")):
                errors.append(f"packet_{key}_{i}_invalid_time")

    # Packet builder should have stripped all diagnostic fields before a provider sees it.
    def diagnostic_keys(value, path="packet"):
        if isinstance(value, dict):
            for key, child in value.items():
                if "diagnostic" in str(key).lower():
                    errors.append(f"packet_diagnostic_key_exposed:{path}.{key}")
                diagnostic_keys(child, f"{path}.{key}")
        elif isinstance(value, list):
            for i, child in enumerate(value):
                diagnostic_keys(child, f"{path}[{i}]")
    diagnostic_keys(packet)
    return errors


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

    # Strict shape checks make forbidden independent-timing fields impossible to smuggle in.
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

    events = proposal.get("events")
    if not isinstance(events, list):
        errors.append("proposal_events_not_list")
        events = []
    elif len(events) > MAX_EVENTS:
        errors.append("proposal_too_many_events")

    allowed_kinds = set(packet["interpretationContract"]["allowedProposalKinds"])
    anchor_types = set(packet["interpretationContract"]["anchorTypes"])
    normalized_events = []

    for i, raw in enumerate(events):
        prefix = f"event_{i}"
        if not isinstance(raw, dict):
            errors.append(f"{prefix}_not_object")
            continue
        extra = sorted(set(raw) - EVENT_KEYS)
        if extra:
            errors.append(f"{prefix}_unexpected_keys:{','.join(extra)}")

        kind = raw.get("kind")
        if kind not in allowed_kinds:
            errors.append(f"{prefix}_unsupported_kind")

        confidence = raw.get("semanticConfidence")
        if not finite_number(confidence) or not 0.0 <= float(confidence) <= 1.0:
            errors.append(f"{prefix}_semantic_confidence_invalid")

        anchor = raw.get("anchor")
        if not isinstance(anchor, dict):
            errors.append(f"{prefix}_anchor_not_object")
            anchor_type = None
            anchor_index = None
        else:
            if set(anchor) != ANCHOR_KEYS:
                extra_anchor = sorted(set(anchor) - ANCHOR_KEYS)
                missing_anchor = sorted(ANCHOR_KEYS - set(anchor))
                if extra_anchor:
                    errors.append(f"{prefix}_anchor_unexpected_keys:{','.join(extra_anchor)}")
                if missing_anchor:
                    errors.append(f"{prefix}_anchor_missing_keys:{','.join(missing_anchor)}")
            anchor_type = anchor.get("type")
            anchor_index = anchor.get("index")
            if anchor_type not in anchor_types:
                errors.append(f"{prefix}_anchor_type_invalid")
            if not isinstance(anchor_index, int) or isinstance(anchor_index, bool):
                errors.append(f"{prefix}_anchor_index_invalid")
            elif anchor_type in {"boundary", "landmark"}:
                rows = packet["boundaries" if anchor_type == "boundary" else "landmarks"]
                if anchor_index < 0 or anchor_index >= len(rows):
                    errors.append(f"{prefix}_anchor_index_out_of_range")

        name = None
        if "name" in raw:
            name = normalized_text(raw.get("name"))
            if name is None:
                errors.append(f"{prefix}_name_invalid")
            elif len(name) > MAX_NAME:
                errors.append(f"{prefix}_name_too_long")
        if kind == "section" and name is None:
            errors.append(f"{prefix}_section_name_required")

        rationale = None
        if "rationale" in raw:
            rationale = normalized_text(raw.get("rationale"))
            if rationale is None:
                errors.append(f"{prefix}_rationale_invalid")
            elif len(rationale) > MAX_RATIONALE:
                errors.append(f"{prefix}_rationale_too_long")

        duration = None
        if "duration" in raw:
            if kind != "drop":
                errors.append(f"{prefix}_duration_only_allowed_for_drop")
            if not finite_number(raw.get("duration")):
                errors.append(f"{prefix}_duration_invalid")
            else:
                duration = float(raw["duration"])

        normalized = {
            "kind": kind,
            "semanticConfidence": float(confidence) if finite_number(confidence) else confidence,
            "anchor": {"type": anchor_type, "index": anchor_index},
        }
        if name is not None:
            normalized["name"] = name
        if duration is not None:
            normalized["duration"] = duration
        if rationale is not None:
            normalized["rationale"] = rationale
        normalized_events.append(normalized)

    if errors:
        return None, errors

    normalized = {
        "schema": PROPOSAL_SCHEMA,
        "source": {
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
        "events": normalized_events,
    }
    return normalized, []


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
        normalized = None
        errors = [str(exc)]

    report = {
        "schema": "trackcade-learned-proposal-validation-v1",
        "status": "valid" if not errors else "rejected",
        "packet": str(args.packet),
        "proposal": str(args.proposal),
        "errors": errors,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    if errors:
        print(json.dumps(report, indent=2, sort_keys=True), file=sys.stderr)
        raise SystemExit(2)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(normalized, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": "valid", "events": len(normalized["events"])}, indent=2))


if __name__ == "__main__":
    main()
