#!/usr/bin/env python3
from pathlib import Path
import sys
src=Path(sys.argv[1]); out=Path(sys.argv[2])
s=src.read_text()
insert=r'''
function debugPhaseAlternatives(envelope, segment) {
    const bpm = segment.bpm;
    const start = segment.start;
    const end = segment.end;
    const interval = 60 / bpm;
    const layerSpecs = [
        { name: 'amplitude', values: envelope.amplitudeValues, frameOffset: envelope.frameOffsetSeconds, baseWeight: 1.1 },
        { name: 'low', values: envelope.lowPulseValues, frameOffset: envelope.hopSeconds / 2, baseWeight: 1.4 },
        { name: 'mid', values: envelope.midPulseValues, frameOffset: envelope.hopSeconds / 2, baseWeight: 0.9 },
        { name: 'hybrid', values: envelope.values, frameOffset: envelope.frameOffsetSeconds, baseWeight: 0.35 },
        { name: 'transient', values: envelope.transientValues, frameOffset: envelope.frameOffsetSeconds, baseWeight: 0.25 },
        { name: 'high', values: envelope.highPulseValues, frameOffset: envelope.hopSeconds / 2, baseWeight: 0.2 },
    ];
    const layerEvidence = layerSpecs.map((layer) => ({
        ...layer,
        correlationSupport: normalizedCorrelationSupport(layer.values, envelope.hopSeconds, bpm),
        phase: phaseAtBpmValues(layer.values, envelope.hopSeconds, layer.frameOffset, bpm, start, end),
    }));
    const candidates = [];
    const add = (phase, source) => {
        while (phase - interval >= start - 0.001) phase -= interval;
        while (phase < start - 0.001) phase += interval;
        const existing = candidates.find((c) => {
            const raw = Math.abs(c.phase - phase);
            return Math.min(raw, Math.abs(interval - raw)) <= 0.006;
        });
        if (existing) { if (!existing.sources.includes(source)) existing.sources.push(source); return; }
        candidates.push({ phase, sources: [source] });
    };
    add(segment.beatOffset, 'selected');
    for (const layer of layerEvidence) add(layer.phase, layer.name);
    for (const [label, frac] of [['plus-half',0.5],['plus-third',1/3],['plus-two-thirds',2/3]]) add(segment.beatOffset + interval * frac, label);
    const rows = [];
    for (const candidate of candidates) {
        let weightedScore = 0, weightedCoverage = 0, weightedJitter = 0, weightTotal = 0;
        const layers = [];
        for (const layer of layerEvidence) {
            if (layer.correlationSupport < 0.5) continue;
            const ew = layer.baseWeight * layer.correlationSupport * layer.correlationSupport;
            const support = gridSupportForLayerAtOffset(layer.values, envelope.hopSeconds, layer.frameOffset, bpm, start, end, candidate.phase);
            weightedScore += ew * support.score;
            weightedCoverage += ew * support.coverage;
            weightedJitter += ew * Math.min(160, support.jitterMs);
            weightTotal += ew;
            layers.push({name:layer.name, correlationSupport:Number(layer.correlationSupport.toFixed(4)), score:Number(support.score.toFixed(4)), coverage:Number(support.coverage.toFixed(4)), jitterMs:Number((Number.isFinite(support.jitterMs)?support.jitterMs:999).toFixed(2)), centerMs:Number(support.centerMs.toFixed(2))});
        }
        const beatProbe = [];
        let t = candidate.phase;
        while (t < start - .001) t += interval;
        for (; t <= end + .001; t += interval) {
            const loc = locateBeatOnset(envelope, t, interval);
            beatProbe.push({time:Number(t.toFixed(3)), strength:Number(loc.strength.toFixed(4)), confidence:Number(clamp01(0.5*Math.sqrt(Math.max(0,loc.strength))+0.5*loc.proximity).toFixed(4))});
        }
        const meter = estimateMeter(beatProbe);
        rows.push({
            phase:Number(candidate.phase.toFixed(6)), phaseFraction:Number((((candidate.phase-start)%interval+interval)%interval/interval).toFixed(6)), sources:candidate.sources,
            metricalScore:Number((weightTotal?weightedScore/weightTotal:0).toFixed(4)), coverage:Number((weightTotal?weightedCoverage/weightTotal:0).toFixed(4)), jitterMs:Number((weightTotal?weightedJitter/weightTotal:999).toFixed(2)),
            meterBeatsPerBar:meter.beatsPerBar, meterConfidence:meter.confidence, meterAmbiguity:meter.ambiguity, layers,
        });
    }
    rows.sort((a,b)=>b.metricalScore-a.metricalScore);
    return {bpm:Number(bpm.toFixed(3)),start,end,currentBeatOffset:segment.beatOffset,candidates:rows};
}
'''
marker="const fs = require('fs');"
assert marker in s
s=s.replace(marker,insert+'\n'+marker,1)
old="    const result = analyzeDecodedTrackAudio({ decoded: { channelData, sampleRate }, mimeType: 'audio/raw', filename, sourceFingerprint, decoderContract });\n    const text = JSON.stringify(result, null, 2);"
new="    const result = analyzeDecodedTrackAudio({ decoded: { channelData, sampleRate }, mimeType: 'audio/raw', filename, sourceFingerprint, decoderContract });\n    if (process.env.TRACKCADE_PHASE_DEBUG === '1') { const debugEnvelope = onsetEnvelope(channelData, sampleRate); result.phaseDebug = result.tempoMap.map((segment) => debugPhaseAlternatives(debugEnvelope, segment)); }\n    const text = JSON.stringify(result, null, 2);"
assert old in s
s=s.replace(old,new,1)
out.write_text(s)
