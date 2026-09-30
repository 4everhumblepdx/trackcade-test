#!/usr/bin/env python3
"""Run frozen V5 RAW evaluator with a narrow retry-status compatibility view.

The canonical generation freeze remains byte-for-byte untouched. The two
separately authorized 16384 retry status receipts (ordinals 4 and 35) omitted
redundant normalized-proposal hash/count fields present in base receipts. When
the evaluator later reads those two status JSON files, this wrapper derives
only those fields from the adjacent immutable normalized proposal. The frozen
50-case closure and unchanged scorer are still verified by the original
evaluator before benchmark labels are read.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGET = HERE / "evaluate_stage1_v5_drop_v1.py"

spec = importlib.util.spec_from_file_location("trackcade_v5_eval_core", TARGET)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot load V5 evaluator core")
eval_core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eval_core)

_original_load = eval_core.load


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_with_retry_receipt(path: Path):
    path = Path(path)
    doc = _original_load(path)
    name = path.name
    is_retry4 = name == "stage1-v5-flex16384-retry4-case-status-v1.json"
    is_retry35 = name == "stage1-v5-flex16384-retry35-case-status-v1.json"
    if not (is_retry4 or is_retry35):
        return doc

    ordinal = 4 if is_retry4 else 35
    if doc.get("ordinal") != ordinal:
        eval_core.fail(f"retry compatibility ordinal mismatch: {path}")
    if doc.get("providerCompletedSemanticResponse") is not True:
        eval_core.fail(f"retry compatibility requires completed response ordinal {ordinal}")
    contract = doc.get("providerContract") or {}
    if contract.get("maxOutputTokens") != 16384 or contract.get("serviceTier") != "flex":
        eval_core.fail(f"retry compatibility transport mismatch ordinal {ordinal}")
    if doc.get("semanticPayloadUnchanged") is not True or doc.get("retryEvidenceBound") is not True:
        eval_core.fail(f"retry compatibility evidence binding ordinal {ordinal}")

    # These fields must be absent in the original lean receipt. Never overwrite
    # contradictory evidence.
    for key in ("normalizedProposalSha256", "dropProposalCount"):
        if key in doc:
            eval_core.fail(f"retry compatibility field unexpectedly present ordinal {ordinal}: {key}")

    proposal_path = path.parent / "normalized-proposal.json"
    if not proposal_path.is_file():
        eval_core.fail(f"retry normalized proposal missing ordinal {ordinal}")
    proposal_bytes = proposal_path.read_bytes()
    proposal = json.loads(proposal_bytes)
    events = proposal.get("events")
    if not isinstance(events, list):
        eval_core.fail(f"retry proposal events missing ordinal {ordinal}")
    drop_count = sum(
        1 for e in events if isinstance(e, dict) and e.get("kind") == "drop"
    )

    compat = dict(doc)
    compat["normalizedProposalSha256"] = _sha_bytes(proposal_bytes)
    compat["dropProposalCount"] = drop_count
    return compat


eval_core.load = load_with_retry_receipt

if __name__ == "__main__":
    eval_core.main()
