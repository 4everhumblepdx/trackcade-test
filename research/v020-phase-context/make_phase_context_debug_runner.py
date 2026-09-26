#!/usr/bin/env python3
from pathlib import Path
import sys

src = Path(sys.argv[1])
out = Path(sys.argv[2])
s = src.read_text()

insert = r'''
function phaseContextStats(values) {
    const clean = values.filter((v) => Number.isFinite(v));
    if (!clean.length) return { mean: 0, median: 0, std: 0 };
    const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
    const sorted = [...clean].sort((a, b) => a - b);
    const medianValue = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : 0.5 * (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]);
    const variance = clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / clean.length;
    return { mean, median: medianValue, std: Math.sqrt(variance) };
}

function phaseContextContrast(anchorValues, otherValues) {
    const a = phaseContextStats(anchorValues).mean;
    const b = phaseContextStats(otherValues).mean;
    return (a - b) / Math.max(0.08, a + b);
}

function phaseContextGroupEvidence(strengths, beatsPerBar) {
    if (strengths.length < beatsPerBar * 4) {
        return { beatsPerBar, bestPhase: null, contrast: 0, anchorConsistency: 0, periodicity: 0, score: 0, windows: 0, windowMeanContrast: 0, windowStdContrast: 0, windowPositiveFraction: 0, windowMinContrast: 0 };
    }
    const periodicity = patternCorrelation(strengths, beatsPerBar);
    let best = null;
    for (let phase = 0; phase < beatsPerBar; phase += 1) {
        const anchors = [], others = [];
        for (let i = 0; i < strengths.length; i += 1) ((i - phase) % beatsPerBar === 0 ? anchors : others).push(strengths[i] ?? 0);
        if (anchors.length < 4 || others.length < 8) continue;
        const ast = phaseContextStats(anchors);
        const contrast = phaseContextContrast(anchors, others);
        const anchorConsistency = Math.max(0, Math.min(1, 1 - ast.std / Math.max(0.12, ast.mean)));
        const score = 0.55 * contrast + 0.30 * periodicity + 0.15 * anchorConsistency;
        if (!best || score > best.score) best = { phase, contrast, anchorConsistency, score };
    }
    if (!best) return { beatsPerBar, bestPhase: null, contrast: 0, anchorConsistency: 0, periodicity, score: 0, windows: 0, windowMeanContrast: 0, windowStdContrast: 0, windowPositiveFraction: 0, windowMinContrast: 0 };

    const windowSize = Math.max(beatsPerBar * 4, 16);
    const stride = Math.max(beatsPerBar * 2, 8);
    const contrasts = [];
    for (let start = 0; start + windowSize <= strengths.length; start += stride) {
        const window = strengths.slice(start, start + windowSize);
        const anchors = [], others = [];
        for (let i = 0; i < window.length; i += 1) (((start + i - best.phase) % beatsPerBar === 0) ? anchors : others).push(window[i] ?? 0);
        if (anchors.length >= 3 && others.length >= 6) contrasts.push(phaseContextContrast(anchors, others));
    }
    if (!contrasts.length && strengths.length >= beatsPerBar * 4) {
        const anchors = [], others = [];
        for (let i = 0; i < strengths.length; i += 1) ((i - best.phase) % beatsPerBar === 0 ? anchors : others).push(strengths[i] ?? 0);
        contrasts.push(phaseContextContrast(anchors, others));
    }
    const wst = phaseContextStats(contrasts);
    return {
        beatsPerBar,
        bestPhase: best.phase,
        contrast: Number(best.contrast.toFixed(6)),
        anchorConsistency: Number(best.anchorConsistency.toFixed(6)),
        periodicity: Number(periodicity.toFixed(6)),
        score: Number(best.score.toFixed(6)),
        windows: contrasts.length,
        windowMeanContrast: Number(wst.mean.toFixed(6)),
        windowStdContrast: Number(wst.std.toFixed(6)),
        windowPositiveFraction: Number((contrasts.filter((x) => x > 0).length / Math.max(1, contrasts.length)).toFixed(6)),
        windowMinContrast: Number(Math.min(...contrasts).toFixed(6)),
    };
}

function phaseContextLayerSequence(values, hopSeconds, frameOffsetSeconds, bpm, start, end, phase) {
    const interval = 60 / bpm;
    const out = [];
    let t = phase;
    while (t < start - 0.001) t += interval;
    while (t - interval >= start - 0.001) t -= interval;
    for (; t <= end + 0.001; t += interval) {
        const loc = locateLayerOnset(values, hopSeconds, frameOffsetSeconds, t, interval);
        out.push(loc.strength >= 0.03 ? Math.sqrt(Math.max(0, loc.strength)) : 0);
    }
    return out;
}

function phaseContextGrid(envelope, segment, phase) {
    const bpm = segment.bpm;
    const start = segment.start;
    const end = segment.end;
    const interval = 60 / bpm;
    const beatStrengths = [];
    const beatConfidences = [];
    let t = phase;
    while (t < start - 0.001) t += interval;
    while (t - interval >= start - 0.001) t -= interval;
    for (; t <= end + 0.001; t += interval) {
        const loc = locateBeatOnset(envelope, t, interval);
        beatStrengths.push(Math.sqrt(Math.max(0, loc.strength)));
        beatConfidences.push(Math.max(0, Math.min(1, 0.5 * Math.sqrt(Math.max(0, loc.strength)) + 0.5 * loc.proximity)));
    }
    const halfPhase = phase + interval * 0.5;
    const halfStrengths = [];
    t = halfPhase;
    while (t < start - 0.001) t += interval;
    while (t - interval >= start - 0.001) t -= interval;
    for (; t <= end + 0.001; t += interval) {
        const loc = locateBeatOnset(envelope, t, interval);
        halfStrengths.push(Math.sqrt(Math.max(0, loc.strength)));
    }
    const low = phaseContextLayerSequence(envelope.lowPulseValues, envelope.hopSeconds, envelope.hopSeconds / 2, bpm, start, end, phase);
    const lowHalf = phaseContextLayerSequence(envelope.lowPulseValues, envelope.hopSeconds, envelope.hopSeconds / 2, bpm, start, end, halfPhase);
    const transient = phaseContextLayerSequence(envelope.transientValues, envelope.hopSeconds, envelope.frameOffsetSeconds, bpm, start, end, phase);
    const transientHalf = phaseContextLayerSequence(envelope.transientValues, envelope.hopSeconds, envelope.frameOffsetSeconds, bpm, start, end, halfPhase);
    const bst = phaseContextStats(beatStrengths);
    const cst = phaseContextStats(beatConfidences);
    return {
        phase: Number(phase.toFixed(6)),
        beatCount: beatStrengths.length,
        meanBeatStrength: Number(bst.mean.toFixed(6)),
        medianBeatStrength: Number(bst.median.toFixed(6)),
        meanBeatConfidence: Number(cst.mean.toFixed(6)),
        beatVsHalfAsymmetry: Number(phaseContextContrast(beatStrengths, halfStrengths).toFixed(6)),
        lowBeatVsHalfAsymmetry: Number(phaseContextContrast(low, lowHalf).toFixed(6)),
        transientBeatVsHalfAsymmetry: Number(phaseContextContrast(transient, transientHalf).toFixed(6)),
        groups: [2, 3, 4].map((g) => phaseContextGroupEvidence(beatStrengths, g)),
    };
}

function debugPhaseContext(envelope, segment) {
    const interval = 60 / segment.bpm;
    const selected = segment.beatOffset;
    const half = selected + interval * 0.5;
    return {
        bpm: Number(segment.bpm.toFixed(6)),
        start: segment.start,
        end: segment.end,
        selected: phaseContextGrid(envelope, segment, selected),
        halfCycle: phaseContextGrid(envelope, segment, half),
    };
}
'''

marker = "const fs = require('fs');"
if marker not in s:
    raise SystemExit('marker not found')
s = s.replace(marker, insert + "\n" + marker, 1)
old = "    const result = analyzeDecodedTrackAudio({ decoded: { channelData, sampleRate }, mimeType: 'audio/raw', filename, sourceFingerprint, decoderContract });\n    const text = JSON.stringify(result, null, 2);"
new = "    const result = analyzeDecodedTrackAudio({ decoded: { channelData, sampleRate }, mimeType: 'audio/raw', filename, sourceFingerprint, decoderContract });\n    if (process.env.TRACKCADE_PHASE_CONTEXT_DEBUG === '1') { const debugEnvelope = onsetEnvelope(channelData, sampleRate); result.phaseContextDebug = result.tempoMap.map((segment) => debugPhaseContext(debugEnvelope, segment)); }\n    const text = JSON.stringify(result, null, 2);"
if old not in s:
    raise SystemExit('main output marker not found')
s = s.replace(old, new, 1)
out.write_text(s)
