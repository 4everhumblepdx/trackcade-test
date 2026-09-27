#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from validate_learned_proposal_v1 import load_json_strict, validate_packet

REQUEST_SCHEMA = "trackcade-learned-interpretation-request-v1"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v1"

INSTRUCTION = """You are the semantic interpretation layer for Trackcade.
Use only the supplied label-blind Trackcade interpretation packet.
Your job is to propose a sparse set of musically meaningful gameplay semantics, not timing.

Rules:
1. Return only one JSON object. Do not use Markdown or prose outside JSON.
2. The JSON schema must be trackcade-musical-interpretation-v1.
3. Copy source.analyzerRunnerSha256 and source.analysisJsonSha256 exactly from the packet.
4. events may contain only section, energy, peak, or drop.
5. Every event must reference an existing packet anchor using only {\"type\":\"boundary|landmark\",\"index\":N}.
6. Never emit t, time, timestamp, BPM, beat offset, beat-grid edits, song-length edits, timing-tier edits, or independent timestamps.
7. semanticConfidence must be a calibrated number from 0 to 1. Prefer omission over unsupported certainty.
8. A section event must have a short useful name. Other event names are optional.
9. A drop may optionally include duration. Do not put duration on other kinds.
10. A short rationale is optional. It must describe evidence from the packet, not an external label or reference timeline.
11. Do not try to reproduce a hidden answer key. There is no reference timeline in your input.
12. Do not infer or repeat Analyzer diagnostic semantic labels; they are outside your authority.

Meaning guidance:
- section: a meaningful structural transition or passage change.
- energy: a persistent upward shift in gameplay energy/intensity.
- peak: a salient high-intensity musical apex suited to a collectible peak moment.
- drop: a strong transition/impact suited to temporary overdrive.

The deterministic compiler will independently decide whether each proposal is safe and sufficiently supported. You should choose meaning and anchors only; the compiler owns final acceptance and final event time."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packet", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    packet_bytes = args.packet.read_bytes()
    packet = load_json_strict(args.packet)
    errors = validate_packet(packet)
    if errors:
        raise SystemExit("invalid packet: " + "; ".join(errors))

    contract = packet["interpretationContract"]
    request = {
        "schema": REQUEST_SCHEMA,
        "instruction": INSTRUCTION,
        "packet": packet,
        "responseContract": {
            "schema": PROPOSAL_SCHEMA,
            "topLevelKeys": ["schema", "source", "events"],
            "sourceKeys": ["analyzerRunnerSha256", "analysisJsonSha256"],
            "allowedKinds": list(contract["allowedProposalKinds"]),
            "allowedAnchorTypes": list(contract["anchorTypes"]),
            "maxEvents": 64,
            "independentTimestampsAllowed": False,
            "beatOrBpmEditsAllowed": False,
            "outputFormat": "json_object_only",
        },
        "integrity": {
            "packetSha256": sha256_bytes(packet_bytes),
            "instructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
    }

    # Provider request must contain no benchmark/reference payload or diagnostic semantic keys.
    serialized = json.dumps(request, sort_keys=True)
    lowered = serialized.lower()
    if '"diagnosticlabelhint"' in lowered or '"diagnostictypehint"' in lowered:
        raise SystemExit("request leaked Analyzer diagnostic semantic hints")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(request, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "schema": REQUEST_SCHEMA,
        "packetSha256": request["integrity"]["packetSha256"],
        "instructionSha256": request["integrity"]["instructionSha256"],
        "boundaries": len(packet["boundaries"]),
        "landmarks": len(packet["landmarks"]),
    }, indent=2))


if __name__ == "__main__":
    main()
