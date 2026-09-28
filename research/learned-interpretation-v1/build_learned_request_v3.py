#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from build_learned_request_v2 import INSTRUCTION as V2_INSTRUCTION
from validate_learned_proposal_v3 import load_json_strict, validate_packet

REQUEST_SCHEMA = "trackcade-learned-interpretation-request-v2"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v2"
DEVELOPMENT_REVISION = "stage1-drop-semantics-v2-structure-evidence-v2"


def _mechanical_v3_instruction() -> str:
    text = V2_INSTRUCTION
    replacements = (
        (
            "2. The JSON schema must be trackcade-musical-interpretation-v1.",
            "2. The JSON schema must be trackcade-musical-interpretation-v2.",
        ),
        (
            '5. Every event must reference an existing packet anchor using only {"type":"boundary|landmark","index":N}.',
            '5. Every event must reference an existing packet anchor using only {"type":"evidence","index":N}, where index is the zero-based row in packet.anchors.',
        ),
        (
            "- Landmark anchors should be used for drop only when the surrounding packet evidence supports the same preparation/release transition, not for an isolated transient accent.",
            "- Evidence anchors should be used for drop only when the surrounding packet evidence supports the same preparation/release transition, not for an isolated transient accent.",
        ),
    )
    for old, new in replacements:
        if text.count(old) != 1:
            raise RuntimeError(f"V2 instruction mechanical source mismatch: {old}")
        text = text.replace(old, new)
    marker = "12. Do not infer or repeat Analyzer diagnostic semantic labels; they are outside your authority."
    addition = (
        marker
        + "\n13. Anchor priority, salience, and confidence are Analyzer descriptors only; "
          "they are not Drop probability, semanticConfidence, or gameplay authorization."
    )
    if text.count(marker) != 1:
        raise RuntimeError("V2 instruction rule-12 source mismatch")
    text = text.replace(marker, addition)
    return text


INSTRUCTION = _mechanical_v3_instruction()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def instruction_diff_record() -> dict:
    return {
        "sourceInstructionSha256": sha256_bytes(V2_INSTRUCTION.encode("utf-8")),
        "v3InstructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
        "adaptations": [
            "proposal schema identifier v1 -> v2",
            "anchor output boundary|landmark -> unified evidence row index",
            "landmark-specific Drop sentence -> generic evidence-anchor sentence",
            "added frozen Structure Evidence v2 descriptor clarification",
        ],
        "semanticRetuningPerformed": False,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packet", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--instruction-diff-output", type=Path)
    args = ap.parse_args()

    packet_bytes = args.packet.read_bytes()
    packet = load_json_strict(args.packet)
    errors = validate_packet(packet)
    if errors:
        raise SystemExit("invalid Structure Evidence v2 packet: " + "; ".join(errors))

    request = {
        "schema": REQUEST_SCHEMA,
        "instruction": INSTRUCTION,
        "packet": packet,
        "responseContract": {
            "schema": PROPOSAL_SCHEMA,
            "topLevelKeys": ["schema", "source", "events"],
            "sourceKeys": ["analyzerRunnerSha256", "analysisJsonSha256"],
            "allowedKinds": ["section", "energy", "peak", "drop"],
            "allowedAnchorTypes": ["evidence"],
            "maxEvents": 64,
            "independentTimestampsAllowed": False,
            "beatOrBpmEditsAllowed": False,
            "outputFormat": "json_object_only",
        },
        "integrity": {
            "packetSha256": sha256_bytes(packet_bytes),
            "sourceMapSha256": packet["sourceMapSha256"],
            "instructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
            "v2SourceInstructionSha256": sha256_bytes(V2_INSTRUCTION.encode("utf-8")),
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
            "developmentRevision": DEVELOPMENT_REVISION,
        },
    }

    serialized = json.dumps(request, sort_keys=True).lower()
    forbidden = ('"diagnosticlabelhint"', '"diagnostictypehint"', '"dropsseconds"', "reference_drops", '"aliases"', '"aliascolumns"')
    if any(token in serialized for token in forbidden):
        raise SystemExit("request leaked diagnostic, benchmark, or source-map content")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(request, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if args.instruction_diff_output:
        args.instruction_diff_output.parent.mkdir(parents=True, exist_ok=True)
        args.instruction_diff_output.write_text(json.dumps(instruction_diff_record(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "schema": REQUEST_SCHEMA,
        "developmentRevision": DEVELOPMENT_REVISION,
        "packetSha256": request["integrity"]["packetSha256"],
        "sourceMapSha256": request["integrity"]["sourceMapSha256"],
        "instructionSha256": request["integrity"]["instructionSha256"],
        "anchors": len(packet["anchors"]),
    }, indent=2))


if __name__ == "__main__":
    main()
