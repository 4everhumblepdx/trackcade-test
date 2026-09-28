#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

EXPECTED_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
EXPECTED_ANALYZER_SOURCE = "e308d867980fb1877c3f2e4ce27950deecac0855"
EXPECTED_STAGE1_TRACKS = 50
MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 4096
DEFAULT_DECODER_CONTRACT = "ffmpeg-mono-source-rate-pcm-f32le-v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(cmd: list[str], *, timeout: int = 2400) -> None:
    q = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
    if q.returncode:
        raise RuntimeError(
            "command failed: " + " ".join(cmd) + "\n" + (q.stderr or q.stdout)[-5000:]
        )


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def ensure_sha(path: Path, expected: str, label: str) -> None:
    actual = sha256_file(path)
    if actual != expected:
        raise RuntimeError(f"{label} SHA-256 mismatch: {actual} != {expected}")


def safe_manifest_status(tier: str) -> str:
    if tier in {"standard", "loose"}:
        return "prepared-compiler-eligible"
    if tier == "strict":
        return "prepared-but-frozen-compiler-refuses-strict-timing-tier"
    return "refused-fail-closed-unsafe-timing-tier"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", type=Path, required=True)
    ap.add_argument("--corpus-root", type=Path, required=True)
    ap.add_argument("--runner", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--decoder-contract", default=DEFAULT_DECODER_CONTRACT)
    args = ap.parse_args()

    repo = Path(__file__).resolve().parents[2]
    ensure_sha(args.runner, EXPECTED_RUNNER_SHA256, "frozen Analyzer runner")

    split = load_json(args.split)
    if split.get("schema") != "trackcade-semantic-external-split-v3":
        raise SystemExit("FAIL-CLOSED: expected frozen external split v3")
    if split.get("status") != "frozen-before-any-model-output-on-corpus":
        raise SystemExit("FAIL-CLOSED: external split status is not pre-model frozen")
    stage1 = split.get("stage1") or []
    if len(stage1) != EXPECTED_STAGE1_TRACKS:
        raise SystemExit(f"FAIL-CLOSED: expected {EXPECTED_STAGE1_TRACKS} Stage 1 tracks, got {len(stage1)}")
    if not isinstance(args.decoder_contract, str) or not args.decoder_contract.strip():
        raise SystemExit("FAIL-CLOSED: decoder contract missing")

    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    cases_dir = out / "cases"
    cases_dir.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    seen_ids: set[str] = set()
    for ordinal, item in enumerate(stage1, 1):
        track_id = item.get("id")
        stem = item.get("stem")
        audio_path = item.get("audioPath")
        expected_audio_sha = item.get("audioSha256")
        sample_rate = item.get("sampleRate")
        if not all(isinstance(x, str) and x for x in (track_id, stem, audio_path, expected_audio_sha)):
            raise SystemExit(f"FAIL-CLOSED: malformed frozen Stage 1 identity at ordinal {ordinal}")
        if track_id in seen_ids:
            raise SystemExit(f"FAIL-CLOSED: duplicate Stage 1 id {track_id}")
        seen_ids.add(track_id)
        if not isinstance(sample_rate, int) or sample_rate < 8000 or sample_rate > 192000:
            raise SystemExit(f"FAIL-CLOSED: invalid frozen sample rate for {track_id}: {sample_rate}")

        audio = args.corpus_root / audio_path
        if not audio.is_file():
            raise SystemExit(f"FAIL-CLOSED: Stage 1 audio missing: {audio_path}")
        ensure_sha(audio, expected_audio_sha, f"Stage 1 audio {track_id}")

        case = cases_dir / f"{ordinal:02d}-{stem}"
        case.mkdir(parents=True, exist_ok=False)
        raw = case / "audio.f32"
        analysis = case / "analysis-v019.json"
        evidence = case / "structure-evidence-v1.json"
        metadata = case / "track-metadata.json"
        safe_manifest = case / "trackcade-safe-v1.json"
        packet = case / "interpretation-packet-v1.json"
        request = case / "learned-request-v1.json"
        payload = case / "openai-payload-v1.json"
        adapter_report = case / "openai-adapter-prepare-report-v1.json"

        run([
            "ffmpeg", "-v", "error", "-nostdin", "-y", "-i", str(audio),
            "-ac", "1", "-ar", str(sample_rate),
            "-f", "f32le", "-acodec", "pcm_f32le", str(raw),
        ], timeout=900)
        if not raw.is_file() or raw.stat().st_size <= 0:
            raise SystemExit(f"FAIL-CLOSED: decoded PCM empty for {track_id}")

        run([
            "node", str(args.runner), str(raw), str(sample_rate), "1", audio.name,
            str(analysis), expected_audio_sha, args.decoder_contract,
        ], timeout=2400)
        raw.unlink(missing_ok=True)

        a = load_json(analysis)
        if a.get("sourceFingerprint") != expected_audio_sha:
            raise SystemExit(f"FAIL-CLOSED: Analyzer source fingerprint mismatch for {track_id}")
        timing_input = a.get("timingInput") or {}
        if timing_input.get("decoderContract") != args.decoder_contract:
            raise SystemExit(f"FAIL-CLOSED: Analyzer decoder contract mismatch for {track_id}")
        tier = (a.get("timingGuardrail") or {}).get("tier")
        if tier not in {"strict", "standard", "loose", "unsafe"}:
            raise SystemExit(f"FAIL-CLOSED: unknown v0.19 timing tier for {track_id}: {tier!r}")
        analysis_sha = sha256_file(analysis)

        run([
            sys.executable,
            str(repo / "research/semantic-internal-holdout-v1/export_structure_evidence_v1_1.py"),
            "--analysis", str(analysis), "--output", str(evidence),
        ], timeout=180)
        ev = load_json(evidence)
        source = ev.get("source") or {}
        if source.get("analyzerRelease") != "v0.19":
            raise SystemExit(f"FAIL-CLOSED: evidence Analyzer release mismatch for {track_id}")
        if source.get("analyzerSourceCommit") != EXPECTED_ANALYZER_SOURCE:
            raise SystemExit(f"FAIL-CLOSED: evidence Analyzer source mismatch for {track_id}")
        if source.get("analyzerRunnerSha256") != EXPECTED_RUNNER_SHA256:
            raise SystemExit(f"FAIL-CLOSED: evidence Analyzer runner mismatch for {track_id}")
        if source.get("analysisJsonSha256") != analysis_sha:
            raise SystemExit(f"FAIL-CLOSED: evidence analysis identity mismatch for {track_id}")

        metadata.write_text(json.dumps({
            "artist": "Socially Significant Music Event dataset",
            "title": str(stem),
            "audioUrl": "osf://eydxk/" + audio_path,
        }, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        safe_manifest_available = tier != "unsafe"
        compiler_eligible = tier in {"standard", "loose"}
        safe_manifest_sha = None
        if safe_manifest_available:
            run([
                sys.executable,
                str(repo / "research/semantic-internal-holdout-v1/generate_safe_manifest_v1_1.py"),
                "--analysis", str(analysis),
                "--track-metadata", str(metadata),
                "--output", str(safe_manifest),
            ], timeout=180)
            safe = load_json(safe_manifest)
            generation = safe.get("generation") or {}
            if generation.get("analysisJsonSha256") != analysis_sha:
                raise SystemExit(f"FAIL-CLOSED: safe manifest analysis mismatch for {track_id}")
            safe_manifest_sha = sha256_file(safe_manifest)

        run([
            sys.executable,
            str(repo / "research/interpretation-v1/build_interpretation_packet_v1.py"),
            "--evidence", str(evidence), "--output", str(packet),
        ], timeout=180)
        run([
            sys.executable,
            str(repo / "research/learned-interpretation-v1/build_learned_request_v1.py"),
            "--packet", str(packet), "--output", str(request),
        ], timeout=180)
        run([
            sys.executable,
            str(repo / "research/learned-interpretation-v1/openai_responses_adapter_v1.py"),
            "--request", str(request),
            "--packet", str(packet),
            "--model", MODEL,
            "--reasoning-effort", REASONING_EFFORT,
            "--max-output-tokens", str(MAX_OUTPUT_TOKENS),
            "--payload-output", str(payload),
            "--adapter-report-output", str(adapter_report),
            "--prepare-only",
        ], timeout=180)

        report = load_json(adapter_report)
        if report.get("status") != "payload_prepared_no_provider_call":
            raise SystemExit(f"FAIL-CLOSED: adapter unexpectedly executed provider for {track_id}")
        integrity = report.get("integrity") or {}
        if integrity.get("analyzerRunnerSha256") != EXPECTED_RUNNER_SHA256:
            raise SystemExit(f"FAIL-CLOSED: prepared payload runner mismatch for {track_id}")
        if integrity.get("analysisJsonSha256") != analysis_sha:
            raise SystemExit(f"FAIL-CLOSED: prepared payload analysis mismatch for {track_id}")

        rows.append({
            "ordinal": ordinal,
            "id": track_id,
            "stem": stem,
            "audioPath": audio_path,
            "audioSha256": expected_audio_sha,
            "sampleRate": sample_rate,
            "decoderContract": args.decoder_contract,
            "analyzerRelease": "v0.19",
            "analyzerSourceCommit": EXPECTED_ANALYZER_SOURCE,
            "analyzerRunnerSha256": EXPECTED_RUNNER_SHA256,
            "analysisJsonSha256": analysis_sha,
            "timingTier": tier,
            "bpm": a.get("bpm"),
            "beatOffset": a.get("beatOffset"),
            "duration": a.get("duration"),
            "safeManifestAvailable": safe_manifest_available,
            "compilerEligible": compiler_eligible,
            "safeManifestStatus": safe_manifest_status(tier),
            "hashes": {
                "structureEvidenceSha256": sha256_file(evidence),
                "safeManifestSha256": safe_manifest_sha,
                "interpretationPacketSha256": sha256_file(packet),
                "learnedRequestSha256": sha256_file(request),
                "openaiPayloadSha256": sha256_file(payload),
                "adapterPrepareReportSha256": sha256_file(adapter_report),
            },
        })
        print(json.dumps({
            "prepared": ordinal,
            "id": track_id,
            "timingTier": tier,
            "safeManifestAvailable": safe_manifest_available,
            "compilerEligible": compiler_eligible,
            "apiPayloadSha256": rows[-1]["hashes"]["openaiPayloadSha256"],
        }, sort_keys=True), flush=True)

    manifest = {
        "schema": "trackcade-semantic-external-stage1-prep-v1",
        "status": "frozen-provider-payloads-prepared-no-provider-call",
        "stage": "external-semantic-holdout-stage1",
        "trackCount": len(rows),
        "modelContract": {
            "provider": "openai",
            "api": "responses",
            "model": MODEL,
            "reasoningEffort": REASONING_EFFORT,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False,
            "completedResponsesPerTrack": 0,
        },
        "timingAuthority": "deterministic-analyzer-v0.19-only",
        "decoderContract": args.decoder_contract,
        "compilerEligibilityPolicy": "frozen compiler accepts standard/loose only; strict/unsafe remain in Stage 1 raw proposal evaluation but are fail-closed for compiler-accepted view",
        "analyzer": {
            "release": "v0.19",
            "sourceCommit": EXPECTED_ANALYZER_SOURCE,
            "runnerSha256": EXPECTED_RUNNER_SHA256,
        },
        "referenceLabelsReadByPreparation": False,
        "terminalTracksProcessed": False,
        "tracks": rows,
    }
    manifest_path = out / "STAGE1_PREP_MANIFEST_V1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (out / "STAGE1_PREP_MANIFEST_V1.json.sha256").write_text(
        f"{sha256_file(manifest_path)}  STAGE1_PREP_MANIFEST_V1.json\n", encoding="utf-8"
    )
    print(json.dumps({
        "status": manifest["status"],
        "trackCount": manifest["trackCount"],
        "compilerEligible": sum(1 for r in rows if r["compilerEligible"]),
        "strictTiming": sum(1 for r in rows if r["timingTier"] == "strict"),
        "unsafeTiming": sum(1 for r in rows if r["timingTier"] == "unsafe"),
        "manifestSha256": sha256_file(manifest_path),
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
