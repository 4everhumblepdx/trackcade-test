#!/usr/bin/env python3
from pathlib import Path
import sys

src = Path(sys.argv[1])
out = Path(sys.argv[2])
s = src.read_text()

repls = [
(
"""    const metricalGridCoherence = diagnostics.metricalGridCoherence ?? diagnostics.phaseCoherence;\n    if (metricalGridCoherence < 0.65)\n        reasons.push('metrical-grid-coherence-below-strict-threshold');\n    let tier;\n""",
"""    const metricalGridCoherence = diagnostics.metricalGridCoherence ?? diagnostics.phaseCoherence;\n    if (metricalGridCoherence < 0.65)\n        reasons.push('metrical-grid-coherence-below-strict-threshold');\n    const ambiguousStandardClock = diagnostics.phaseCoherence <= 0.03 &&\n        metricalGridCoherence <= 0.7 &&\n        diagnostics.tactusPrimaryMargin !== undefined &&\n        diagnostics.tactusPrimaryMargin <= 0.3;\n    if (ambiguousStandardClock)\n        reasons.push('metrical-hierarchy-ambiguity-too-high-for-standard');\n    let tier;\n"""
),
(
"""        diagnostics.detectorAgreement >= 0.55 &&\n        snapUncertaintyMs <= 70 &&\n        diagnostics.beatCoverage >= 0.55 &&\n        standardEvidenceEnough) {\n""",
"""        diagnostics.detectorAgreement >= 0.55 &&\n        snapUncertaintyMs <= 70 &&\n        diagnostics.beatCoverage >= 0.55 &&\n        standardEvidenceEnough &&\n        !ambiguousStandardClock) {\n"""
),
(
"""    const timingGuardrail = deriveTimingGuardrail(beatResult.timingConfidence, beatResult.diagnostics, {\n        beatCount: beatResult.beatGrid.length,\n        evidenceSpanSeconds,\n    });\n""",
"""    const primaryTactusConfidence = layeredPulse.tactusCandidates.find((candidate) => candidate.isPrimary)?.confidence ?? 0;\n    const bestNonOctaveTactusConfidence = layeredPulse.tactusCandidates\n        .filter((candidate) => !['same', 'half', 'double'].includes(candidate.relationToSource))\n        .reduce((best, candidate) => Math.max(best, candidate.confidence), 0);\n    const tactusPrimaryMargin = bestNonOctaveTactusConfidence > 0\n        ? primaryTactusConfidence - bestNonOctaveTactusConfidence\n        : undefined;\n    const timingGuardrail = deriveTimingGuardrail(beatResult.timingConfidence, { ...beatResult.diagnostics, tactusPrimaryMargin }, {\n        beatCount: beatResult.beatGrid.length,\n        evidenceSpanSeconds,\n    });\n"""
),
]

for old, new in repls:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'patch anchor count {count}, expected 1')
    s = s.replace(old, new, 1)

out.write_text(s)
