#!/usr/bin/env python3
"""Dev-only diagnostics: score existing meter evidence on alternate tactus grids.

Apply after patch_v018_add_descriptive_triples.py. This patch must not alter
canonical tempo, beatGrid, confidence, meter, guardrails, or interaction timing.
It only enriches selected tactusCandidates with a counterfactualMeter object.
"""
from pathlib import Path
import sys

src = Path(sys.argv[1])
out = Path(sys.argv[2])
s = src.read_text()

helper = r'''function deriveCounterfactualMeterEvidence(envelope, energyCurve, candidate, duration, pulseFamilyAmbiguity, detectorAgreement, ensembleConfidence) {
    const bpm = Number(candidate?.bpm ?? 0);
    if (!Number.isFinite(bpm) || bpm < 55 || bpm > 220 || duration <= 0)
        return null;
    const support = metricalGridSupportAtBpm(envelope, bpm, 0, duration);
    const peaks = onsetPeaks(envelope, 0, duration);
    const phase = phaseCoherenceAtBpm(peaks, bpm, 0);
    const diagnosticBeatResult = deriveBeatGrid(envelope, [{ start: 0, end: duration, bpm, beatOffset: support.beatOffset }], [support.score], [phase.score], duration, clamp01(candidate.confidence ?? 0), pulseFamilyAmbiguity, detectorAgreement, ensembleConfidence);
    const diagnosticGuardrail = { strictScoringAllowed: false, recommendedGlobalHalfWindowMs: 160 };
    const annotated = annotateBeatGrid(diagnosticBeatResult.beatGrid, energyCurve, diagnosticBeatResult.timingConfidence, diagnosticBeatResult.diagnostics.p95SnapMs, diagnosticGuardrail);
    const meter = estimateMeter(annotated);
    const scoreFor = (beatsPerBar) => meter.hypotheses
        .filter((hypothesis) => hypothesis.beatsPerBar === beatsPerBar)
        .reduce((best, hypothesis) => Math.max(best, hypothesis.score), 0);
    const score2 = scoreFor(2);
    const score3 = scoreFor(3);
    const score4 = scoreFor(4);
    const score6 = scoreFor(6);
    const tripleFamilyScore = Math.max(score3, Math.max(0, score6 - 0.025));
    const dupleFamilyScore = Math.max(score2, score4);
    return {
        gridSupport: Number(clamp01(support.score).toFixed(4)),
        phaseCoherence: Number(clamp01(phase.score).toFixed(4)),
        beatCoverage: diagnosticBeatResult.diagnostics.beatCoverage,
        beatCount: diagnosticBeatResult.beatGrid.length,
        timingConfidence: diagnosticBeatResult.timingConfidence,
        beatsPerBar: meter.beatsPerBar,
        meterConfidence: meter.confidence,
        meterAmbiguity: meter.ambiguity,
        score2: Number(score2.toFixed(4)),
        score3: Number(score3.toFixed(4)),
        score4: Number(score4.toFixed(4)),
        score6: Number(score6.toFixed(4)),
        tripleFamilyScore: Number(tripleFamilyScore.toFixed(4)),
        dupleFamilyScore: Number(dupleFamilyScore.toFixed(4)),
        tripleFamilyAdvantage: Number((tripleFamilyScore - dupleFamilyScore).toFixed(4)),
    };
}
'''

anchor = 'function analyzeDecodedTrackAudio(input) {'
if s.count(anchor) != 1:
    raise SystemExit(f'helper anchor count={s.count(anchor)}, expected 1')
s = s.replace(anchor, helper + '\n' + anchor, 1)

old = """    const onsetEvents = deriveOnsetEvents(envelope, beatGrid, duration, beatResult.timingConfidence, timingGuardrail);\n    const interactionCandidates = deriveInteractionCandidates(beatGrid, onsetEvents, structure.sections);\n    const summaryBpm = tempoMap.length === 1 ? (tempoMap[0]?.bpm ?? tempo.bpm) : tempo.bpm;\n    const analysis = {\n"""
new = """    const onsetEvents = deriveOnsetEvents(envelope, beatGrid, duration, beatResult.timingConfidence, timingGuardrail);\n    const interactionCandidates = deriveInteractionCandidates(beatGrid, onsetEvents, structure.sections);\n    // Development-only counterfactual meter diagnostics. These never feed canonical tempo, beatGrid,\n    // confidence, guardrails, meter, or interaction timing. Keep them inside tactusCandidates so\n    // canonical output remains identical when descriptive candidates are removed.\n    const diagnosticIndexes = new Set();\n    const primaryIndex = layeredPulse.tactusCandidates.findIndex((candidate) => candidate.isPrimary);\n    if (primaryIndex >= 0)\n        diagnosticIndexes.add(primaryIndex);\n    layeredPulse.tactusCandidates\n        .map((candidate, index) => ({ candidate, index }))\n        .filter(({ candidate }) => ['one-third', 'triple'].includes(candidate.relationToSource))\n        .sort((left, right) => right.candidate.confidence - left.candidate.confidence)\n        .slice(0, 4)\n        .forEach(({ index }) => diagnosticIndexes.add(index));\n    const diagnosticTactusCandidates = layeredPulse.tactusCandidates.map((candidate, index) => {\n        if (!diagnosticIndexes.has(index))\n            return candidate;\n        const counterfactualMeter = deriveCounterfactualMeterEvidence(envelope, energyCurve, candidate, duration, tempo.pulseFamilyAmbiguity, nativeEnsemble.detectorAgreement, nativeEnsemble.ensembleConfidence);\n        return counterfactualMeter ? { ...candidate, counterfactualMeter } : candidate;\n    });\n    const summaryBpm = tempoMap.length === 1 ? (tempoMap[0]?.bpm ?? tempo.bpm) : tempo.bpm;\n    const analysis = {\n"""
if s.count(old) != 1:
    raise SystemExit(f'call anchor count={s.count(old)}, expected 1')
s = s.replace(old, new, 1)

old_output = '        tactusCandidates: layeredPulse.tactusCandidates,'
new_output = '        tactusCandidates: diagnosticTactusCandidates,'
if s.count(old_output) != 1:
    raise SystemExit(f'output anchor count={s.count(old_output)}, expected 1')
s = s.replace(old_output, new_output, 1)

out.write_text(s)
