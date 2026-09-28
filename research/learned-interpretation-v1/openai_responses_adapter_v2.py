#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import openai_responses_adapter_v1 as adapter_v1

EXPECTED_REVISION = "stage1-drop-semantics-v2"


def fail(msg: str) -> None:
    raise SystemExit(f"V2 ADAPTER FAIL-CLOSED: {msg}")


def arg_path(flag: str) -> Path:
    try:
        i = sys.argv.index(flag)
        value = sys.argv[i + 1]
    except (ValueError, IndexError):
        fail(f"required argument missing before v1 adapter delegation: {flag}")
    return Path(value)


def main() -> None:
    request_path = arg_path("--request")
    try:
        request = json.loads(request_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"request is not readable strict-enough JSON for V2 compatibility gate: {exc}")

    instruction = request.get("instruction")
    integrity = request.get("integrity") or {}
    if not isinstance(instruction, str) or not instruction.strip():
        fail("request instruction missing")
    if integrity.get("developmentRevision") != EXPECTED_REVISION:
        fail("request developmentRevision is not frozen Stage 1 V2")
    instruction_sha = hashlib.sha256(instruction.encode("utf-8")).hexdigest()
    if integrity.get("instructionSha256") != instruction_sha:
        fail("request instructionSha256 does not match exact request instruction bytes")

    # Compatibility-only bridge: v1 transport/extraction/schema behavior remains the
    # execution authority. Its only V1-specific coupling is a module-global INSTRUCTION
    # equality/hash check. Replace that binding with the exact already-frozen V2 request
    # instruction, then delegate the complete CLI unchanged.
    adapter_v1.INSTRUCTION = instruction
    adapter_v1.main()


if __name__ == "__main__":
    main()
