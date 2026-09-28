#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

PACKET_SCHEMA = "trackcade-structure-evidence-v2"
PACKET_POLICY = "current-core-accent-table-v2"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v2"
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
ALLOWED_KINDS = {"section", "energy", "peak", "drop"}
FORBIDDEN_KEYS = {
    "t", "time", "timestamp", "bpm", "beatoffset", "beat_offset", "beatgrid", "beat_grid",
    "beats", "songlength", "durationseconds", "timingtier", "timingconfidence", "seconds",
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


def scan_forbidden_keys(value, path="proposal", errors=None):
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
    if packet.get("policy") != PACKET_POLICY:
        errors.append("packet_policy_mismatch")
    if packet.get("encoding") != "table":
        errors.append("packet_encoding_mismatch")
    if packet.get("anchorColumns") != ["time", "priorityCode", "sourceCode", "salience", "confidence"]:
        errors.append("packet_anchor_columns_mismatch")
    if packet.get("priorityCodes") != ["core", "accent", "optional"]:
        errors.append("packet_priority_codes_mismatch")
    if packet.get("sourceCodes") != ["beat", "onset", "downbeat", "transition"]:
        errors.append("packet_source_codes_mismatch")

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
        if not isinstance(source.get("analysisJsonSha256"), str) or not HEX64.fullmatch(source["analysisJsonSha256"]):
            errors.append("packet_analysis_sha_invalid")
        if not isinstance(source.get("interpretationPacketV1Sha256"), str) or not HEX64.fullmatch(source["interpretationPacketV1Sha256"]):
            errors.append("packet_interpretation_v1_sha_invalid")
        if not isinstance(source.get("structureEvidenceV1Sha256"), str) or not HEX64.fullmatch(source["structureEvidenceV1Sha256"]):
            errors.append("packet_structure_v1_sha_invalid")
        for key in ("duration", "bpm", "beatOffset"):
            if not finite_number(source.get(key)):
                errors.append(f"packet_source_{key}_invalid")

    sm = packet.get("sourceMapSha256")
    if not isinstance(sm, str) or not HEX64.fullmatch(sm):
        errors.append("packet_source_map_sha_invalid")

    anchors = packet.get("anchors")
    if not isinstance(anchors, list) or not anchors:
        errors.append("packet_anchors_missing")
    else:
        last_t = -1.0
        for i, row in enumerate(anchors):
            if not isinstance(row, list) or len(row) != 5:
                errors.append(f"packet_anchor_{i}_shape_invalid")
                continue
            t, priority, source_code, salience, confidence = row
            if not finite_number(t) or float(t) < 0:
                errors.append(f"packet_anchor_{i}_time_invalid")
            else:
                if float(t) < last_t:
                    errors.append(f"packet_anchor_{i}_order_invalid")
                last_t = float(t)
            nulls = (priority is None, source_code is None, salience is None, confidence is None)
            if all(nulls):
                pass
            elif any(nulls):
                errors.append(f"packet_anchor_{i}_partial_features")
            else:
                if priority not in (0, 1):
                    errors.append(f"packet_anchor_{i}_priority_invalid")
                if source_code not in (0, 1, 2, 3):
                    errors.append(f"packet_anchor_{i}_source_invalid")
                if not finite_number(salience) or not 0 <= float(salience) <= 1:
                    errors.append(f"packet_anchor_{i}_salience_invalid")
                if not finite_number(confidence) or not 0 <= float(confidence) <= 1:
                    errors.append(f"packet_anchor_{i}_confidence_invalid")

    context = packet.get("context")
    required_context = {"timingTrust", "structureTrust", "energy", "sections", "boundaries", "landmarks", "lowDemandWindows"}
    if not isinstance(context, dict) or set(context) != required_context:
        errors.append("packet_context_shape_invalid")
    else:
        for field in ("boundaries", "landmarks"):
            rows = context.get(field)
            if not isinstance(rows, list):
                errors.append(f"packet_context_{field}_not_list")
                continue
            for i, row in enumerate(rows):
                if not isinstance(row, dict):
                    errors.append(f"packet_context_{field}_{i}_not_object")
                    continue
                if "time" in row:
                    errors.append(f"packet_context_{field}_{i}_time_exposed")
                idx = row.get("anchor")
                if not isinstance(idx, int) or isinstance(idx, bool) or not isinstance(anchors, list) or not 0 <= idx < len(anchors):
                    errors.append(f"packet_context_{field}_{i}_anchor_invalid")

    contract = packet.get("interpretationContract")
    if not isinstance(contract, dict):
        errors.append("packet_contract_missing")
    else:
        if contract.get("timingAuthority") != "frozen-analyzer-derived-anchor-only":
            errors.append("packet_timing_authority_invalid")
        if contract.get("anchorReference") != "zero-based anchors row index":
            errors.append("packet_anchor_reference_invalid")
        if contract.get("independentTimestampsAllowed") is not False:
            errors.append("packet_independent_timestamps_not_forbidden")
        if contract.get("beatOrBpmEditsAllowed") is not False:
            errors.append("packet_beat_bpm_edits_not_forbidden")
        if contract.get("analyzerSemanticHintsExposed") is not False:
            errors.append("packet_semantic_hints_exposed")

    encoded = json.dumps(packet, sort_keys=True).lower()
    for token in ('"diagnostic', '"dropsseconds"', "reference_drops"):
        if token in encoded:
            errors.append(f"packet_forbidden_token:{token}")
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
        if kind not in ALLOWED_KINDS:
            errors.append(f"{prefix}_unsupported_kind")
        conf = raw.get("semanticConfidence")
        if not finite_number(conf) or not 0 <= float(conf) <= 1:
            errors.append(f"{prefix}_semantic_confidence_invalid")

        anchor = raw.get("anchor")
        aidx = None
        if not isinstance(anchor, dict):
            errors.append(f"{prefix}_anchor_not_object")
        else:
            if set(anchor) != ANCHOR_KEYS:
                extra_a = sorted(set(anchor) - ANCHOR_KEYS)
                missing_a = sorted(ANCHOR_KEYS - set(anchor))
                if extra_a:
                    errors.append(f"{prefix}_anchor_unexpected_keys:{','.join(extra_a)}")
                if missing_a:
                    errors.append(f"{prefix}_anchor_missing_keys:{','.join(missing_a)}")
            if anchor.get("type") != "evidence":
                errors.append(f"{prefix}_anchor_type_invalid")
            aidx = anchor.get("index")
            if not isinstance(aidx, int) or isinstance(aidx, bool):
                errors.append(f"{prefix}_anchor_index_invalid")
            elif aidx < 0 or aidx >= len(packet["anchors"]):
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

        norm = {
            "kind": kind,
            "semanticConfidence": float(conf) if finite_number(conf) else conf,
            "anchor": {"type": "evidence", "index": aidx},
        }
        if name is not None:
            norm["name"] = name
        if duration is not None:
            norm["duration"] = duration
        if rationale is not None:
            norm["rationale"] = rationale
        normalized_events.append(norm)

    if errors:
        return None, errors
    return {
        "schema": PROPOSAL_SCHEMA,
        "source": {
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
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
        "schema": "trackcade-learned-proposal-validation-v2",
        "status": "valid" if not errors else "rejected",
        "packet": str(args.packet),
        "proposal": str(args.proposal),
        "errors": errors,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if errors:
        raise SystemExit(2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(normalized, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": "valid", "events": len(normalized["events"])}, indent=2))


if __name__ == "__main__":
    main()
