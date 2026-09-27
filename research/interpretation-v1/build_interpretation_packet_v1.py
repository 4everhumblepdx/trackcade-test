#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

SCHEMA_IN = "trackcade-structure-evidence-v1"
SCHEMA_OUT = "trackcade-interpretation-packet-v1"
DROP_KEYS = {
    "diagnosticLabelHint",
    "diagnosticIncomingLabelHint",
    "diagnosticTypeHint",
    "semanticGameplayAuthorized",
}


def clean(value):
    if isinstance(value, dict):
        return {
            key: clean(child)
            for key, child in value.items()
            if key not in DROP_KEYS and "diagnostic" not in key.lower()
        }
    if isinstance(value, list):
        return [clean(child) for child in value]
    return value


def build(evidence):
    if evidence.get("schema") != SCHEMA_IN:
        raise SystemExit(f"expected {SCHEMA_IN}")

    source = evidence.get("source") or {}
    required_source = [
        "analyzerRelease",
        "analyzerSourceCommit",
        "analyzerRunnerSha256",
        "analysisJsonSha256",
        "duration",
        "bpm",
        "beatOffset",
    ]
    for key in required_source:
        if key not in source:
            raise SystemExit(f"missing source.{key}")

    packet = {
        "schema": SCHEMA_OUT,
        "source": {key: source[key] for key in required_source},
        "timingTrust": clean(evidence.get("timingTrust") or {}),
        "structureTrust": clean(evidence.get("structureTrust") or {}),
        "energy": clean(evidence.get("energy") or {}),
        "sections": clean(evidence.get("sections") or []),
        "boundaries": clean(evidence.get("boundaries") or []),
        "landmarks": clean(evidence.get("landmarks") or []),
        "lowDemandWindows": clean(evidence.get("lowDemandWindows") or []),
        "interpretationContract": {
            "timingAuthority": "deterministic-structure-evidence-only",
            "allowedProposalKinds": ["section", "energy", "peak", "drop"],
            "anchorTypes": ["boundary", "landmark"],
            "independentTimestampsAllowed": False,
            "beatOrBpmEditsAllowed": False,
            "analyzerSemanticHintsExposed": False,
            "instruction": (
                "Propose semantic meaning only. Reference an existing anchor by type and index. "
                "Do not infer or emit independent event times, beat edits, BPM edits, or Analyzer semantic labels."
            ),
        },
    }

    serialized = json.dumps(packet, sort_keys=True)
    if "diagnostic" in serialized.lower():
        raise SystemExit("packet contains forbidden diagnostic key/text")
    return packet


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    packet = build(json.loads(args.evidence.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(packet, indent=2, sort_keys=True) + "\n")
    print(
        json.dumps(
            {
                "schema": packet["schema"],
                "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
                "boundaries": len(packet["boundaries"]),
                "landmarks": len(packet["landmarks"]),
                "sections": len(packet["sections"]),
                "semanticHintsExposed": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
