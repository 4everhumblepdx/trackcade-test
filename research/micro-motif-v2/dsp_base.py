"""Isolated deterministic DSP research. Only explicit PCM and frozen product fixtures.
No provider, label, terminal, old Analyzer, or live game import/execution.
"""
from pathlib import Path
import argparse, hashlib, json, math
import numpy as np

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / 'config.json').read_text(encoding='utf-8'))

def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)+'\n').encode()

def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()

def unit(x):
    return x / np.maximum(np.linalg.norm(x, axis=-1, keepdims=True), 1e-12)

def smooth(x, width):
    width = max(1, int(width))
    return np.convolve(x, np.ones(width)/width, mode='same')

def spectra(x, size, hop):
    # Centered windows: time zero remains the original decoded sample zero.
    padded = np.pad(x, (size//2, size//2))
    frames = np.lib.stride_tricks.sliding_window_view(padded, size)[::hop]
    out = np.empty((len(frames), size//2+1), dtype=np.float32)
    window = np.hanning(size)
    for i in range(0, len(frames), 512):
        out[i:i+512] = np.abs(np.fft.rfft(frames[i:i+512]*window, axis=1))
    return out

def novelty(spectrum, hop, sr):
    log = np.log1p(10*spectrum)
    flux = np.maximum(0, np.diff(log, axis=0, prepend=log[:1])).sum(axis=1)
    local = smooth(flux, round(CFG['noveltyLocalSeconds']*sr/hop))
    return np.maximum(0, flux-local)

def detect_events(x, beats, sr=None):
    sr = sr or CFG['sampleRate']; hop = CFG['hopSamples']; dt = hop/sr
    if sr != CFG['sampleRate'] or not np.isfinite(x).all():
        raise ValueError('Invalid explicit PCM input')
    ss = [spectra(x, size, hop) for size in CFG['fftSizes']]
    curves = [novelty(s, hop, sr) for s in ss]
    curve = curves[0]; med = float(np.median(curve)); mad = float(np.median(np.abs(curve-med)))
    scale = max(float(np.quantile(curve, .99)), 1e-9)
    threshold = max(med+CFG['peakThresholdMad']*mad, scale*CFG['minimumNormalizedStrength'])
    peaks = np.flatnonzero((curve[1:-1]>curve[:-2]) & (curve[1:-1]>=curve[2:]) & (curve[1:-1]>=threshold))+1
    # Largest local peak wins; fixed index tie-break, no tempo-grid snapping.
    kept = []
    min_frames = math.ceil(CFG['minimumEventSeparationSeconds']/dt)
    for i in sorted(peaks, key=lambda i: (-float(curve[i]), int(i))):
        if all(abs(i-j)>=min_frames for j in kept): kept.append(int(i))
    envelope = smooth(x.astype(np.float64)**2, round(.003*sr))
    rises = np.maximum(0, np.diff(envelope, prepend=envelope[:1]))
    rise_smooth = smooth(rises, round(.002*sr))
    frequencies = np.fft.rfftfreq(CFG['fftSizes'][1], 1/sr)
    edges = np.geomspace(60, min(10000, sr/2), 13)
    bands = [(frequencies>=a)&(frequencies<b) for a,b in zip(edges, edges[1:])]
    tonal_bins = np.flatnonzero((frequencies>=90)&(frequencies<=4000))
    classes = np.rint(69+12*np.log2(frequencies[tonal_bins]/440)).astype(int)%12
    events = []
    for peak in sorted(kept):
        j0,j1 = max(0,peak-8), min(len(curves[1]),peak+9)
        other = j0+int(np.argmax(curves[1][j0:j1]))
        agreement = abs(peak-other)*dt
        # Refine with local sample-domain energy-rise onset; keep uncertainty,
        # never move the result to a beat or infer a musical source.
        center = round(peak*hop); a,b = max(0,center-round(.04*sr)), min(len(x),center+round(.04*sr))
        rise_peak = a+int(np.argmax(rise_smooth[a:b])); rise_max = float(rise_smooth[rise_peak])
        onset = rise_peak
        while onset>max(a,rise_peak-round(.025*sr)) and rise_smooth[onset-1]>.20*rise_max: onset-=1
        t = onset/sr
        if not 0<t<len(x)/sr: continue
        width = max(1, rise_peak-onset)/sr
        uncertainty = max(dt, agreement/2+width/2, abs(t-peak*dt)*.35)
        strength = min(1., float(curve[peak])/scale)
        confidence = float(np.clip(.40*strength+.35*max(0,1-agreement/.035)+.25*max(0,1-width/.025),0,1))
        spec = np.mean(ss[1][max(0,peak):min(len(ss[1]),peak+5)], axis=0)
        acoustic = unit(np.array([float(np.sum(spec[m])) for m in bands]))
        chroma = unit(np.bincount(classes, weights=spec[tonal_bins], minlength=12))
        tonal = float(1-(-np.sum((chroma/np.maximum(chroma.sum(),1e-9))*np.log(np.maximum(chroma/np.maximum(chroma.sum(),1e-9),1e-9))))/math.log(12))
        bi = int(np.argmin(abs(np.asarray(beats)-t))) if beats else None
        offset = t-beats[bi] if bi is not None else None
        strict = confidence>=CFG['minimumTimingConfidence'] and uncertainty<=CFG['maximumTimingUncertaintySeconds'] and agreement<=CFG['timingAgreementSeconds'] and rise_max>1e-10
        events.append({'time':round(t,7),'strength':round(strength,6),'timingConfidence':round(confidence,6),'timingUncertaintySeconds':round(uncertainty,7),'multiscaleAgreementSeconds':round(agreement,7),'strictGameplayCandidate':bool(strict),'timingTrustStatus':'provisional DSP gate; mixture accuracy not independently calibrated','sourceIdentity':'UNKNOWN','nearestBeatIndex':bi,'beatOffsetSeconds':round(offset,7) if offset is not None else None,'nearExistingBeat':offset is not None and abs(offset)<=CFG['nearBeatSeconds'],'acoustic':[round(float(v),6) for v in acoustic],'chroma':[round(float(v),6) for v in chroma],'tonalConcentration':round(tonal,6),'releaseDurationSeconds':None})
    # Refinement may collapse nearby peaks. Keep the strongest; preserve event time.
    result=[]
    for e in sorted(events,key=lambda e:(e['time'],-e['strength'])):
        if result and e['time']-result[-1]['time']<CFG['minimumEventSeparationSeconds']:
            if e['strength']>result[-1]['strength']: result[-1]=e
        else: result.append(e)
    for i,e in enumerate(result): e['id']='event-'+str(i).zfill(5)
    return result

