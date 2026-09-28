#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import ingest_provider_response_v1 as ingest_v1

EXPECTED_REVISION = "stage1-drop-semantics-v2"


def fail(msg: str) -> None:
    raise SystemExit(f"V2 INGEST FAIL-CLOSED: {msg}")


def arg_path(flag: str) -> Path:
    try:
        i = sys.argv.index(flag)
        value = sys.argv[i + 1]
    except (ValueError, IndexError):
        fail(f"required argument missing before v1 ingestion delegation: {flag}")
    return Path(value)


def main() -> None:
    request_path = arg_path("--request")
    try:
        request = json.loads(request_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"request is not readable JSON for V2 compatibility gate: {exc}")

    instruction = request.get("instruction")
    integrity = request.get("integrity") or {}
    if not isinstance(instruction, str) or not instruction.strip():
        fail("request instruction missing")
    if integrity.get("developmentRevision") != EXPECTED_REVISION:
        fail("request developmentRevision is not frozen Stage 1 V2")
    instruction_sha = hashlib.sha256(instruction.encode("utf-8")).hexdigest()
    if integrity.get("instructionSha256") != instruction_sha:
        fail("request instructionSha256 does not match exact request instruction bytes")

    # Compatibility-only bridge. The v1 ingester's proposal validation, metadata,
    # provenance, trust flags, normalization, and outputs remain unchanged. Its only
    # V1-specific semantic coupling is the module-global INSTRUCTION equality/hash gate.
    ingest_v1.INSTRUCTION = instruction
    ingest_v1.main()


if __name__ == "__main__":
    main()
