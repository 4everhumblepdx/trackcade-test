#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from validate_learned_proposal_v1 import load_json_strict, validate_and_normalize, validate_packet


def compact(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def strict_subset_candidate(packet: dict, proposal: dict) -> dict:
    normalized, errors = validate_and_normalize(packet, proposal)
    if errors:
        raise SystemExit("known-good proposal invalid: " + "; ".join(errors))

    events = []
    for i, event in enumerate(normalized["events"]):
        row = {
            "kind": event["kind"],
            "semanticConfidence": event["semanticConfidence"],
            "anchor": event["anchor"],
            "name": event.get("name") or f"{event['kind']}-{i + 1}",
            "rationale": event.get("rationale") or "Offline OpenAI adapter schema-conformance fixture.",
        }
        events.append(row)

    candidate = {
        "schema": normalized["schema"],
        "source": normalized["source"],
        "events": events,
    }
    check, errors = validate_and_normalize(packet, candidate)
    if errors:
        raise SystemExit("strict-subset candidate invalid: " + "; ".join(errors))
    return candidate


def response(candidate_text: str, *, status="completed", object_type="response", response_id="resp_fixture_001",
             model="gpt-fixture-snapshot", contents=None):
    if contents is None:
        contents = [{"type": "output_text", "text": candidate_text, "annotations": []}]
    return {
        "id": response_id,
        "object": object_type,
        "created_at": 0,
        "status": status,
        "model": model,
        "output": [
            {
                "id": "msg_fixture_001",
                "type": "message",
                "role": "assistant",
                "status": "completed" if status == "completed" else status,
                "content": contents,
            }
        ],
        "usage": {"input_tokens": 123, "output_tokens": 45, "total_tokens": 168},
    }


def write_json(path: Path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packet", type=Path, required=True)
    ap.add_argument("--known-good-proposal", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()

    packet = load_json_strict(args.packet)
    packet_errors = validate_packet(packet)
    if packet_errors:
        raise SystemExit("packet invalid: " + "; ".join(packet_errors))
    proposal = load_json_strict(args.known_good_proposal)
    candidate = strict_subset_candidate(packet, proposal)
    candidate_text = compact(candidate)

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / "expected-candidate.json").write_bytes(candidate_text.encode("utf-8"))
    write_json(out / "valid.json", response(candidate_text))
    write_json(out / "incomplete.json", response(candidate_text, status="incomplete"))
    write_json(
        out / "refusal.json",
        response(candidate_text, contents=[{"type": "refusal", "refusal": "fixture refusal"}]),
    )
    write_json(
        out / "two-output-text.json",
        response(
            candidate_text,
            contents=[
                {"type": "output_text", "text": candidate_text, "annotations": []},
                {"type": "output_text", "text": candidate_text, "annotations": []},
            ],
        ),
    )
    write_json(out / "wrong-object.json", response(candidate_text, object_type="not_response"))
    write_json(out / "missing-id.json", response(candidate_text, response_id=""))
    write_json(out / "missing-model.json", response(candidate_text, model=""))

    # The outer response is valid strict JSON, but its one output_text candidate contains
    # duplicate keys. The adapter must reject it without repair.
    duplicate_candidate = (
        '{"schema":"trackcade-musical-interpretation-v1",'
        '"schema":"trackcade-musical-interpretation-v1",'
        f'"source":{compact(candidate["source"])},"events":[]}}'
    )
    write_json(out / "duplicate-candidate-key.json", response(duplicate_candidate))

    print(json.dumps({
        "status": "openai_adapter_fixtures_written",
        "events": len(candidate["events"]),
        "fixtures": 8,
    }, indent=2))


if __name__ == "__main__":
    main()
