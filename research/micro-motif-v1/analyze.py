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

def pattern(events):
    ts=np.array([e['time'] for e in events]); gaps=np.diff(ts); rhythm=gaps/gaps.mean()
    attack=np.array([e['strength'] for e in events]); attack=attack/max(float(attack.max()),1e-9)
    acoustic=unit(np.array([e['acoustic'] for e in events])); chroma=unit(np.array([e['chroma'] for e in events]))
    distinct=float(np.clip(max(np.std(rhythm),np.std(attack),np.mean(1-np.sum(acoustic[1:]*acoustic[:-1],axis=1))),0,1))
    return {'rhythm':rhythm,'attack':attack,'acoustic':acoustic,'chroma':chroma,'distinctiveness':distinct,'duration':float(ts[-1]-ts[0])}

def similarities(seed, patterns, use_chroma=True):
    rhythm=np.array([p['rhythm'] for p in patterns]); attack=np.array([p['attack'] for p in patterns]); acoustic=np.array([p['acoustic'] for p in patterns]); chroma=np.array([p['chroma'] for p in patterns])
    rd=np.max(abs(rhythm-seed['rhythm'])/np.maximum(seed['rhythm'],.15),axis=1)
    ad=np.max(abs(attack-seed['attack']),axis=1)
    ac=np.mean(np.sum(acoustic*seed['acoustic'],axis=2),axis=1)
    cc=np.mean(np.sum(chroma*seed['chroma'],axis=2),axis=1)
    matches=(rd<=CFG['rhythmRelativeTolerance'])&(ad<=CFG['strengthContourTolerance'])&(ac>=CFG['acousticCosineMinimum'])
    if use_chroma: matches &= cc>=CFG['chromaCosineMinimum']
    score=np.clip(.4*(1-rd)+.2*(1-ad)+.25*ac+.15*cc,0,1)
    return matches,score,rd,ac,cc

def motif_families(events, duration, section_times=(), use_chroma=True):
    discovered=[]
    for length in CFG['patternEventLengths']:
        starts=[];patterns=[]
        for i in range(len(events)-length+1):
            p=pattern(events[i:i+length])
            if CFG['patternDurationSeconds'][0]<=p['duration']<=CFG['patternDurationSeconds'][1] and p['distinctiveness']>=CFG['minimumDistinctiveness']:
                starts.append(i);patterns.append(p)
        if not starts: continue
        # Precompute descriptor tensors once; fixed seed order is independent of track.
        tensors={k:np.array([p[k] for p in patterns]) for k in ['rhythm','attack','acoustic','chroma']}
        consumed=set()
        for si,seed in enumerate(patterns):
            if si in consumed: continue
            rd=np.max(abs(tensors['rhythm']-seed['rhythm'])/np.maximum(seed['rhythm'],.15),axis=1);ad=np.max(abs(tensors['attack']-seed['attack']),axis=1)
            ac=np.mean(np.sum(tensors['acoustic']*seed['acoustic'],axis=2),axis=1);cc=np.mean(np.sum(tensors['chroma']*seed['chroma'],axis=2),axis=1)
            mask=(rd<=CFG['rhythmRelativeTolerance'])&(ad<=CFG['strengthContourTolerance'])&(ac>=CFG['acousticCosineMinimum'])
            if use_chroma: mask &= cc>=CFG['chromaCosineMinimum']
            candidates=np.flatnonzero(mask);occ=[];last_end=-float('inf')
            for pi in candidates:
                i=starts[pi];es=events[i:i+length]
                if es[0]['time']<last_end+CFG['minimumOccurrenceSeparationSeconds']: continue
                score=float(np.clip(.4*(1-rd[pi])+.2*(1-ad[pi])+.25*ac[pi]+.15*cc[pi],0,1))
                occ.append({'startTime':es[0]['time'],'endTime':es[-1]['time'],'eventIds':[e['id'] for e in es],'eventTimes':[e['time'] for e in es],'eventStrengths':[e['strength'] for e in es],'eventTimingConfidence':[e['timingConfidence'] for e in es],'beatOffsetsSeconds':[e['beatOffsetSeconds'] for e in es],'matchScore':round(score,6),'normalizedTimingDeviation':round(float(rd[pi]),6),'acousticSimilarity':round(float(ac[pi]),6),'chromaSimilarity':round(float(cc[pi]),6),'allEventsPassDspTimingGate':all(e['strictGameplayCandidate'] for e in es),'sectionIndex':sum(t<=es[0]['time'] for t in section_times)})
                last_end=es[-1]['time']
            if len(occ)<CFG['minimumRecurrences']: continue
            consumed.update(int(v) for v in candidates)
            coverage=(occ[-1]['endTime']-occ[0]['startTime'])/max(duration,1)
            recurrence=float(np.mean([o['matchScore'] for o in occ]));strength=float(np.mean([e for o in occ for e in o['eventStrengths']]))
            prominence=float(np.clip(.25*min(1,len(occ)/12)+.25*recurrence+.20*strength+.15*coverage+.15*seed['distinctiveness'],0,1))
            trusted=sum(o['allEventsPassDspTimingGate'] for o in occ)
            eligible=prominence>=CFG['minimumProminence'] and trusted>=CFG['minimumRecurrences'] and coverage>=.15
            canonical_pattern={'normalizedIntervals':[round(float(v),6) for v in seed['rhythm']],'strengthContour':[round(float(v),6) for v in seed['attack']],'acousticContour':[[round(float(v),6) for v in row] for row in seed['acoustic']],'mixtureChromaContour':[[round(float(v),6) for v in row] for row in seed['chroma']],'notePitchContour':None}
            family={'id':'motif-'+digest({'length':length,'canonical':canonical_pattern})[:12],'eventCount':length,'canonicalPattern':canonical_pattern,'occurrenceCount':len(occ),'recurrenceConfidence':round(recurrence,6),'motifProminence':round(prominence,6),'rhythmicAcousticDistinctiveness':round(seed['distinctiveness'],6),'songCoverage':round(coverage,6),'sectionDistribution':sorted(set(o['sectionIndex'] for o in occ)),'timingGateOccurrenceCount':trusted,'gameplayAnchorCandidate':bool(eligible),'productionTimingValidated':False,'occurrences':occ}
            discovered.append(family)
    # Suppress families describing essentially the same occurrence starts.
    selected=[]
    for f in sorted(discovered,key=lambda f:(-f['motifProminence'],-f['occurrenceCount'],f['id'])):
        times=[o['startTime'] for o in f['occurrences']]
        if any(sum(any(abs(t-o['startTime'])<.15 for o in g['occurrences']) for t in times)/len(times)>.75 for g in selected):continue
        selected.append(f)
        if len(selected)>=CFG['maximumFamilies']:break
    return selected

def simulate(events, families, v23_times, end, stages, low_windows):
    by_id={e['id']:e for e in events};chosen={};decisions=[]
    def stage_at(t):
        return next((s for s in stages if t<s['endSeconds']),stages[-1])
    def legal(e):return e['strictGameplayCandidate'] and e['time']+.36<=end and e['time']<=end-1.25
    # Stronger families reserve opportunities first. Coverage grows from evidence
    # and capacity, not a universal percentage. Same motif's strength-ranked events
    # recur in reduced/partial/full forms. No synthetic or snapped event times.
    for f in sorted(families,key=lambda f:(-f['motifProminence'],f['id'])):
        for oi,o in enumerate(f['occurrences']):
            es=[by_id[i] for i in o['eventIds']];stage=stage_at(o['startTime']);name=stage['stage'];low=any(w['start']<=o['startTime']<w['end'] for w in low_windows)
            desired=1 if name in ['opening','build'] or low else max(1,len(es)-1) if name in ['developing','relief','final-build'] else len(es)
            transform='reduced' if desired==1 else 'full' if desired==len(es) else 'partial'
            capacity=max(1,round(stage['targetsPerSecond']*max(o['endTime']-o['startTime'],.5)))
            desired=min(desired,capacity)
            wanted=sorted(es,key=lambda e:(-e['strength'],e['time']))[:desired];accepted=[];skipped=[]
            for e in sorted(wanted,key=lambda e:e['time']):
                reason=None
                if not f['gameplayAnchorCandidate']:reason='family not anchor-eligible under recurrence/timing/prominence gate'
                elif name=='landing':reason='protected Landing: research adds no anchor'
                elif not legal(e):reason='timing gate or ending/release safety'
                elif any(abs(e['time']-t)<CFG['simulationMinimumIntervalSeconds'] and e['id']!=v['eventId'] for t,v in chosen.items()):reason='higher-priority anchor collision / minimum interval'
                if reason:skipped.append({'eventId':e['id'],'time':e['time'],'reason':reason})
                else:chosen[e['time']]={'eventId':e['id'],'time':e['time'],'actionClass':'anchor','family':f['id']};accepted.append(e['id'])
            for e in es:
                if e not in wanted:skipped.append({'eventId':e['id'],'time':e['time'],'reason':'difficulty-aware '+transform+' representation'})
            old=[e['id'] for e in es if any(abs(e['time']-t)<=CFG['nearBeatSeconds'] for t in v23_times)]
            decisions.append({'family':f['id'],'occurrenceIndex':oi,'startTime':o['startTime'],'stage':name,'lowDemand':low,'transformation':transform,'capacity':capacity,'proposedHits':accepted,'skipped':skipped,'v23NearbyHits':old,'v23FullRepresentation':len(old)==len(es),'v23PartialRepresentation':0<len(old)<len(es),'proposedRepresentation':bool(accepted),'proposedFullRepresentation':len(accepted)==len(es)})
    # One-off events follow protected anchors; quota-aware beat flow follows both.
    # Anchor-only manifest is deliberately separate from full runtime scheduling.
    coverage=[]
    for f in families:
        ds=[d for d in decisions if d['family']==f['id']];n=len(ds)
        coverage.append({'family':f['id'],'occurrences':n,'v23Represented':sum(bool(d['v23NearbyHits']) for d in ds),'v23Partial':sum(d['v23PartialRepresentation'] for d in ds),'v23Full':sum(d['v23FullRepresentation'] for d in ds),'proposedRepresented':sum(d['proposedRepresentation'] for d in ds),'proposedFull':sum(d['proposedFullRepresentation'] for d in ds),'proposedCoverage':sum(d['proposedRepresentation'] for d in ds)/n if n else 0,'v23EventHits':sum(len(d['v23NearbyHits']) for d in ds),'v23EventMisses':sum(f['eventCount']-len(d['v23NearbyHits']) for d in ds)})
    proposed=list(sorted(chosen.values(),key=lambda e:e['time']))
    return {'schema':'micro-motif-v1-anchor-only-simulation','productionIntegration':False,'nearBeatToleranceSeconds':CFG['nearBeatSeconds'],'comparisonCaveat':'Nearby v2.3 beat hits within 20ms are approximate representation, not identical event times. These are provisional DSP gates, not production-approved timings.','coverage':coverage,'occurrences':decisions,'anchorHits':proposed,'newOffbeatEventCount':sum(not by_id[h['eventId']]['nearExistingBeat'] for h in proposed),'nearExistingBeatCount':sum(by_id[h['eventId']]['nearExistingBeat'] for h in proposed)}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pcm-dir',required=True);ap.add_argument('--output-dir',required=True);args=ap.parse_args()
    pcm_dir=Path(args.pcm_dir);out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True);repo=ROOT.parents[1]
    decoded=json.loads((pcm_dir/'decode.json').read_text(encoding='utf-8'));comparison=json.loads((repo/'pulse-tap/PULSE_TAP_V23_COMPARISON.json').read_text(encoding='utf-8'))
    results=[]
    for name,record in zip(['alldat','cvb'],decoded['records']):
        track=json.loads((repo/f'pulse-tap/{name}-analyzer-test.json').read_text(encoding='utf-8'));evidence=json.loads((repo/f'pulse-tap/{name}-action-evidence-v22.json').read_text(encoding='utf-8'));beats=evidence['beatTimes'];x=np.fromfile(pcm_dir/record['pcmFile'],dtype='<f4')
        assert hashlib.sha256((pcm_dir/record['pcmFile']).read_bytes()).hexdigest()==record['decodedPcmSha256']
        assert hashlib.sha256((repo/record['filename']).read_bytes()).hexdigest()==record['inputAudioSha256']
        events=detect_events(x,beats);families=motif_families(events,record['duration'],[r['time'] for r in evidence['boundaries']]);ablation=motif_families(events,record['duration'],use_chroma=False)
        # Fixed null control: permute descriptors/strengths, preserving event times.
        rng=np.random.default_rng(1729);shuffled=[dict(e) for e in events];order=rng.permutation(len(events))
        for i,j in enumerate(order):
            for k in ['acoustic','chroma','strength']:shuffled[i][k]=events[int(j)][k]
        null=motif_families(shuffled,record['duration'])
        cs=comparison['tracks'][name];old_only=set(cs['v22Only']);new_only=set(cs['v23Only']);
        # Obtain exact frozen v2.3 selection via saved comparison's unchanged count
        # and frozen generic Node selector export generated by export-v23.cjs.
        v23=json.loads((pcm_dir/(name+'-v23.json')).read_text(encoding='utf-8'))
        simulation=simulate(events,families,v23['selectedTimes'],cs['ending']['playableEndTime'],cs['challengeV23'],evidence['lowDemandWindows'])
        summary={'eventCount':len(events),'provisionalTimingGateCount':sum(e['strictGameplayCandidate'] for e in events),'productionValidatedTimingCount':0,'nearBeatCount':sum(e['nearExistingBeat'] for e in events),'offbeatCount':sum(not e['nearExistingBeat'] for e in events),'familyCount':len(families),'anchorEligibleFamilyCount':sum(f['gameplayAnchorCandidate'] for f in families),'threeEventFamilies':[f['id'] for f in families if f['eventCount']==3 and f['motifProminence']>=CFG['minimumProminence']],'pitchAblation':{'withChromaFamilies':len(families),'withoutChromaFamilies':len(ablation),'withChromaOccurrences':sum(f['occurrenceCount'] for f in families),'withoutChromaOccurrences':sum(f['occurrenceCount'] for f in ablation),'noteLevelPitchValidated':False},'descriptorShuffleNull':{'families':len(null),'anchorEligible':sum(f['gameplayAnchorCandidate'] for f in null),'topProminence':null[0]['motifProminence'] if null else None},'proposedOffbeatHits':simulation['newOffbeatEventCount']}
        for label,value in [('events',events),('motifs',{'families':families,'rhythmAcousticOnlyFamilies':ablation,'descriptorShuffleNullFamilies':null}),('anchors',simulation),('summary',summary)]: (out/f'{name}-{label}.json').write_bytes(canonical(value))
        results.append({'track':name,'input':record,'summary':summary})
        print(json.dumps({'track':name,**summary}),flush=True)
    code={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.iterdir() if p.suffix in ['.py','.cjs','.json'] and p.name=='config.json' or p.suffix in ['.py','.cjs']}
    provenance={'schema':'trackcade-micro-motif-research-v1','sourceCommit':'b981d270a098a91619168dfd904f19713c66d4c1','config':CFG,'configSha256':digest(CFG),'analysisCodeSha256':code,'decoder':decoded,'numpyVersion':np.__version__,'inputs':results,'outputsSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.glob('*.json'))},'providerCalls':0,'spendUSD':0,'liveRuntimeChanged':False,'semanticV9Changed':False,'stage1LabelsAccessed':False,'terminalHoldoutAccessed':False,'classification':'D: current DSP recurrence scores do not beat descriptor-shuffle controls; mixture timing is also not independently calibrated. No integration.' if any(r['summary']['descriptorShuffleNull']['topProminence'] is not None and r['summary']['descriptorShuffleNull']['topProminence'] >= .55 for r in results) else 'C: recurrence candidates remain unvalidated and mixture timing is not independently calibrated.'}
    (out/'PROVENANCE.json').write_bytes(canonical(provenance))

if __name__=='__main__':main()
