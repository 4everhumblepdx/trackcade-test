#!/usr/bin/env python3
"""Dev-only diagnostics: measure whether a descriptive 3x tactus has real inner pulses.

Apply after patch_add_counterfactual_meter_diagnostics.py. This patch is descriptive
only. It must not alter canonical tempo, beatGrid, confidence, meter, guardrails, or
interaction timing. For relationToSource='triple' candidates it adds raw
tripleSubdivision evidence inside counterfactualMeter.
"""
from pathlib import Path
import sys

src = Path(sys.argv[1])
out = Path(sys.argv[2])
s = src.read_text()

helper = r'''function deriveTripleSubdivisionEvidence(envelope, candidate, duration) {
    if (candidate?.relationToSource !== 'triple' || duration <= 0)
        return null;
    const sourceBpm = Number(candidate?.sourceBpm ?? 0);
    const candidateBpm = Number(candidate?.bpm ?? 0);
    if (!Number.isFinite(sourceBpm) || !Number.isFinite(candidateBpm) || sourceBpm <= 0 || candidateBpm <= 0)
        return null;
    const ratio = candidateBpm / sourceBpm;
    if (Math.abs(ratio - 3) / 3 > 0.035)
        return null;
    const sourceInterval = 60 / sourceBpm;
    const innerInterval = sourceInterval / 3;
    if (!Number.isFinite(sourceInterval) || sourceInterval <= 0 || innerInterval < 0.09)
        return null;
    const sourceSupport = metricalGridSupportAtBpm(envelope, sourceBpm, 0, duration);
    let firstAnchor = sourceSupport.beatOffset;
    while (firstAnchor < -0.001)
        firstAnchor += sourceInterval;
    while (firstAnchor - sourceInterval >= -0.001)
        firstAnchor -= sourceInterval;
    const layers = [
        { name: 'amplitude', values: envelope.amplitudeValues, frameOffset: envelope.frameOffsetSeconds, weight: 1.1 },
        { name: 'low', values: envelope.lowPulseValues, frameOffset: envelope.hopSeconds / 2, weight: 1.4 },
        { name: 'mid', values: envelope.midPulseValues, frameOffset: envelope.hopSeconds / 2, weight: 0.9 },
        { name: 'hybrid', values: envelope.values, frameOffset: envelope.frameOffsetSeconds, weight: 0.45 },
        { name: 'transient', values: envelope.transientValues, frameOffset: envelope.frameOffsetSeconds, weight: 0.3 },
    ];
    const summarizeLayer = (layer) => {
        let intervals = 0;
        let anchorSupported = 0;
        let innerSupported = 0;
        let pairedSupported = 0;
        let anchorStrengthSum = 0;
        let anchorStrengthCount = 0;
        let innerStrengthSum = 0;
        let innerStrengthCount = 0;
        const windowCounts = Array.from({ length: 4 }, () => ({ expected: 0, paired: 0 }));
        for (let time = firstAnchor; time + sourceInterval <= duration + 0.001; time += sourceInterval) {
            if (time < -0.001)
                continue;
            intervals += 1;
            const windowIndex = Math.max(0, Math.min(3, Math.floor((Math.max(0, time) / Math.max(duration, 0.001)) * 4)));
            windowCounts[windowIndex].expected += 1;
            const anchor = locateLayerOnset(layer.values, envelope.hopSeconds, layer.frameOffset, time, innerInterval);
            const inner1 = locateLayerOnset(layer.values, envelope.hopSeconds, layer.frameOffset, time + innerInterval, innerInterval);
            const inner2 = locateLayerOnset(layer.values, envelope.hopSeconds, layer.frameOffset, time + 2 * innerInterval, innerInterval);
            if (anchor.strength >= 0.03) {
                anchorSupported += 1;
                anchorStrengthSum += Math.sqrt(Math.max(0, anchor.strength));
                anchorStrengthCount += 1;
            }
            let paired = true;
            for (const inner of [inner1, inner2]) {
                if (inner.strength >= 0.03) {
                    innerSupported += 1;
                    innerStrengthSum += Math.sqrt(Math.max(0, inner.strength));
                    innerStrengthCount += 1;
                }
                else {
                    paired = false;
                }
            }
            if (paired) {
                pairedSupported += 1;
                windowCounts[windowIndex].paired += 1;
            }
        }
        if (intervals < 4)
            return null;
        const windowCoverages = windowCounts
            .filter((window) => window.expected >= 2)
            .map((window) => window.paired / window.expected);
        const windowMean = windowCoverages.length > 0
            ? windowCoverages.reduce((sum, value) => sum + value, 0) / windowCoverages.length
            : 0;
        const windowVariance = windowCoverages.length > 0
            ? windowCoverages.reduce((sum, value) => sum + (value - windowMean) ** 2, 0) / windowCoverages.length
            : 1;
        const meanAnchorStrength = anchorStrengthCount > 0 ? anchorStrengthSum / anchorStrengthCount : 0;
        const meanInnerStrength = innerStrengthCount > 0 ? innerStrengthSum / innerStrengthCount : 0;
        return {
            name: layer.name,
            weight: layer.weight,
            intervals,
            anchorCoverage: anchorSupported / intervals,
            innerCoverage: innerSupported / (2 * intervals),
            pairedCoverage: pairedSupported / intervals,
            meanAnchorStrength,
            meanInnerStrength,
            innerToAnchorStrength: meanInnerStrength / Math.max(0.05, meanAnchorStrength),
            windowMeanPairedCoverage: windowMean,
            windowMinPairedCoverage: windowCoverages.length > 0 ? Math.min(...windowCoverages) : 0,
            windowStdPairedCoverage: Math.sqrt(windowVariance),
            windowCount: windowCoverages.length,
        };
    };
    const layerEvidence = layers.map(summarizeLayer).filter((value) => value !== null);
    if (layerEvidence.length === 0)
        return null;
    const aggregate = (field) => {
        let weighted = 0;
        let total = 0;
        for (const layer of layerEvidence) {
            const reliability = 0.35 + 0.65 * clamp01(layer.anchorCoverage);
            const weight = layer.weight * reliability;
            weighted += Number(layer[field] ?? 0) * weight;
            total += weight;
        }
        return total > 0 ? weighted / total : 0;
    };
    return {
        sourceBpm: Number(sourceBpm.toFixed(3)),
        sourceGridSupport: Number(clamp01(sourceSupport.score).toFixed(4)),
        intervalCount: Math.max(...layerEvidence.map((layer) => layer.intervals)),
        anchorCoverage: Number(clamp01(aggregate('anchorCoverage')).toFixed(4)),
        innerCoverage: Number(clamp01(aggregate('innerCoverage')).toFixed(4)),
        pairedCoverage: Number(clamp01(aggregate('pairedCoverage')).toFixed(4)),
        innerToAnchorStrength: Number(Math.max(0, Math.min(3, aggregate('innerToAnchorStrength'))).toFixed(4)),
        windowMeanPairedCoverage: Number(clamp01(aggregate('windowMeanPairedCoverage')).toFixed(4)),
        windowMinPairedCoverage: Number(clamp01(aggregate('windowMinPairedCoverage')).toFixed(4)),
        windowStdPairedCoverage: Number(Math.max(0, Math.min(1, aggregate('windowStdPairedCoverage'))).toFixed(4)),
        layers: layerEvidence.map((layer) => ({
            name: layer.name,
            intervals: layer.intervals,
            anchorCoverage: Number(clamp01(layer.anchorCoverage).toFixed(4)),
            innerCoverage: Number(clamp01(layer.innerCoverage).toFixed(4)),
            pairedCoverage: Number(clamp01(layer.pairedCoverage).toFixed(4)),
            innerToAnchorStrength: Number(Math.max(0, Math.min(3, layer.innerToAnchorStrength)).toFixed(4)),
            windowMinPairedCoverage: Number(clamp01(layer.windowMinPairedCoverage).toFixed(4)),
            windowStdPairedCoverage: Number(Math.max(0, Math.min(1, layer.windowStdPairedCoverage)).toFixed(4)),
        })),
    };
}
'''

anchor = 'function deriveCounterfactualMeterEvidence(envelope, energyCurve, candidate, duration, pulseFamilyAmbiguity, detectorAgreement, ensembleConfidence) {'
if s.count(anchor) != 1:
    raise SystemExit(f'helper anchor count={s.count(anchor)}, expected 1')
s = s.replace(anchor, helper + '\n' + anchor, 1)

old = """    const tripleFamilyScore = Math.max(score3, Math.max(0, score6 - 0.025));\n    const dupleFamilyScore = Math.max(score2, score4);\n    return {\n"""
new = """    const tripleFamilyScore = Math.max(score3, Math.max(0, score6 - 0.025));\n    const dupleFamilyScore = Math.max(score2, score4);\n    const tripleSubdivision = deriveTripleSubdivisionEvidence(envelope, candidate, duration);\n    return {\n"""
if s.count(old) != 1:
    raise SystemExit(f'evidence anchor count={s.count(old)}, expected 1')
s = s.replace(old, new, 1)

old_return = """        tripleFamilyAdvantage: Number((tripleFamilyScore - dupleFamilyScore).toFixed(4)),\n    };\n}"""
new_return = """        tripleFamilyAdvantage: Number((tripleFamilyScore - dupleFamilyScore).toFixed(4)),\n        ...(tripleSubdivision ? { tripleSubdivision } : {}),\n    };\n}"""
if s.count(old_return) != 1:
    raise SystemExit(f'return anchor count={s.count(old_return)}, expected 1')
s = s.replace(old_return, new_return, 1)

out.write_text(s)
