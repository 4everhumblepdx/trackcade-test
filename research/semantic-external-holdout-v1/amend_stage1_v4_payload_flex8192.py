#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
SOURCE_MAX_OUTPUT_TOKENS = 4096
AMENDED_MAX_OUTPUT_TOKENS = 8192
SERVICE_TIER = "flex"
AMENDMENT_SCHEMA = "trackcade-semantic-external-stage1-v4-flex8192-amendment-v1"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_bytes(obj) -> bytes:
    return (json.dumps(obj, indent=2, sort_keys=True) + "\n").encode("utf-8")


def semantic_projection(payload: dict) -> dict:
    projected = dict(payload)
    projected.pop("max_output_tokens", None)
    projected.pop("service_tier", None)
    return projected


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-payload", type=Path, required=True)
    ap.add_argument("--output-payload", type=Path, required=True)
    ap.add_argument("--report", type=Path, required=True)
    args = ap.parse_args()

    source_bytes = args.source_payload.read_bytes()
    source = json.loads(source_bytes)

    if source.get("model") != MODEL:
        raise SystemExit("source model mismatch")
    if source.get("store") is not False:
        raise SystemExit("source store must be false")
    if source.get("reasoning") != {"effort": REASONING_EFFORT}:
        raise SystemExit("source reasoning mismatch")
    if source.get("max_output_tokens") != SOURCE_MAX_OUTPUT_TOKENS:
        raise SystemExit("source output ceiling mismatch")
    if "service_tier" in source:
        raise SystemExit("source payload unexpectedly already contains service_tier")

    amended = dict(source)
    amended["max_output_tokens"] = AMENDED_MAX_OUTPUT_TOKENS
    amended["service_tier"] = SERVICE_TIER

    if semantic_projection(source) != semantic_projection(amended):
        raise SystemExit("semantic payload changed outside allowed transport amendment")

    amended_bytes = stable_bytes(amended)
    args.output_payload.parent.mkdir(parents=True, exist_ok=True)
    args.output_payload.write_bytes(amended_bytes)

    report = {
        "schema": AMENDMENT_SCHEMA,
        "status": "offline-transport-amendment-no-provider-call",
        "provider": "openai",
        "api": "responses",
        "model": MODEL,
        "reasoningEffort": REASONING_EFFORT,
        "store": False,
        "sourceMaxOutputTokens": SOURCE_MAX_OUTPUT_TOKENS,
        "amendedMaxOutputTokens": AMENDED_MAX_OUTPUT_TOKENS,
        "serviceTier": SERVICE_TIER,
        "allowedChangesOnly": ["max_output_tokens", "service_tier"],
        "semanticPayloadUnchanged": True,
        "providerCalls": 0,
        "sourcePayloadSha256": sha256_bytes(source_bytes),
        "amendedPayloadSha256": sha256_bytes(amended_bytes),
        "semanticProjectionSha256": sha256_bytes(stable_bytes(semantic_projection(source))),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_bytes(stable_bytes(report))


if __name__ == "__main__":
    main()
