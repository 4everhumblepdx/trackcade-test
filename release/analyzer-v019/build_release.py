#!/usr/bin/env python3
"""Reproducibly build the Trackcade Analyzer v0.19 release candidate.

v0.19 intentionally keeps the exact frozen v0.18 canonical timing engine and adds
ONLY descriptive one-third/triple tactus candidates. Automatic tactus selectors,
phase experiments, and meter diagnostics are not part of this release.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE_SHA256 = "218067133985608dfdc900a508f6dade652f7f3961f268e670bdf89c05e681d8"
V018_SHA256 = "baf6c3701f9b3ccbe67237b04dcca2e9a158f180ceabb6e1c3e9f0b1a8594c15"
BUNDLE_PARTS = [
    "stress/v017/bundle.part00.fix0",
    "stress/v017/bundle.part00.fix1",
    "stress/v017/bundle.part01",
    "stress/v017/bundle.part02",
    "stress/v017/bundle.part03",
    "stress/v017/bundle.part04",
    "stress/v017/bundle.part05.fix0",
    "stress/v017/bundle.part05.fix1",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(*args: str) -> None:
    subprocess.run(list(args), cwd=ROOT, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--manifest", type=Path)
    args = ap.parse_args()
    args.output = args.output.resolve()
    if args.manifest:
        args.manifest = args.manifest.resolve()

    for rel in BUNDLE_PARTS:
        if not (ROOT / rel).is_file():
            raise SystemExit(f"missing frozen archive part: {rel}")

    encoded = b"".join((ROOT / rel).read_bytes() for rel in BUNDLE_PARTS)
    archive_bytes = base64.b64decode(encoded, validate=False)

    with tempfile.TemporaryDirectory(prefix="trackcade-v019-build-") as td:
        work = Path(td)
        archive = work / "tools-v017.tgz"
        archive.write_bytes(archive_bytes)
        got_archive = sha256(archive)
        if got_archive != ARCHIVE_SHA256:
            raise SystemExit(f"v0.17 archive sha drift: {got_archive} != {ARCHIVE_SHA256}")

        tools = work / "tools"
        tools.mkdir()
        with tarfile.open(archive, "r:gz") as tf:
            tf.extractall(tools)

        v017 = tools / "official-v017-runner.js"
        v018 = tools / "official-v018-runner.js"
        if not v017.is_file():
            raise SystemExit("frozen archive missing official-v017-runner.js")

        run("python", "stress/ballroom/patch_v017_to_v018.py", str(v017), str(v018))
        got_v018 = sha256(v018)
        if got_v018 != V018_SHA256:
            raise SystemExit(f"v0.18 runner sha drift: {got_v018} != {V018_SHA256}")

        args.output.parent.mkdir(parents=True, exist_ok=True)
        run(
            "python",
            "stress/v019-mirror/patch_v018_add_descriptive_triples.py",
            str(v018),
            str(args.output),
        )

    if shutil.which("node"):
        run("node", "--check", str(args.output))

    text = args.output.read_text()
    required = ["['one-third', 1 / 3]", "['triple', 3]"]
    for marker in required:
        if marker not in text:
            raise SystemExit(f"release runner missing required descriptive marker: {marker}")
    forbidden = [
        "triple_selector_v1_FIXED_FROM_BALLROOM_DEV",
        "triple_selector_v2_subdivision_guard_FIXED_FROM_BALLROOM_DEV",
        "wins2_meanpos_stdpos_v1_FIXED_FROM_BALLROOM",
    ]
    for marker in forbidden:
        if marker in text:
            raise SystemExit(f"release runner contains rejected experimental selector: {marker}")

    patch = ROOT / "stress/v019-mirror/patch_v018_add_descriptive_triples.py"
    result = {
        "release": "trackcade-analyzer-v0.19-rc1",
        "output": str(args.output),
        "runner_sha256": sha256(args.output),
        "frozen_v018_sha256": V018_SHA256,
        "frozen_v017_archive_sha256": ARCHIVE_SHA256,
        "descriptive_patch_sha256": sha256(patch),
        "automatic_tactus_switching": False,
        "added_descriptive_relations": ["one-third", "triple"],
    }
    if args.manifest:
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
