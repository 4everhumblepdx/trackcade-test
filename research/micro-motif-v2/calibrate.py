"""Known generated onset truth; independent fixed validation seeds, not real labels."""
import json
from pathlib import Path
import numpy as np
from dsp_base import CFG,canonical,detect_events

CLASSES=['isolated','overlapping-tones','noise-attacks','harmonic-bed','simultaneous','near-pulses','soft-over-bed','clustered','variable-envelope','compressed']
def generate(condition,seed):
    sr=CFG['sampleRate'];rng=np.random.default_rng(seed);x=np.zeros(sr*9);truth=[]
    if condition in ['harmonic-bed','soft-over-bed','near-pulses','compressed']:
        t=np.arange(len(x))/sr;fade=np.clip(t/.5,0,1)
        x+=.23*fade*(np.sin(2*np.pi*110*t)+.6*np.sin(2*np.pi*165*t)+.4*np.sin(2*np.pi*220*t))
    times=[1.,1.63,2.41,3.02,3.81,4.46,5.23,6.07,6.84,7.63]
    if condition=='clustered':times=[1,1.12,2,2.10,3,3.14,4,4.12,5,5.13,6,6.11,7,7.15]
    if condition=='near-pulses':times+=list(np.arange(.75,8,.5));times=sorted(set(times))
    for j,onset in enumerate(times):
        a=round(onset*sr);t=np.arange(round(.65*sr))/sr;freq=float(rng.choice([330,440,660,880]));amp=.045 if condition=='soft-over-bed' else .35
        rise=.030 if condition=='variable-envelope' and j%2 else .001
        env=np.minimum(1,t/rise)*np.exp(-t/.13)
        if condition=='noise-attacks':wave=rng.normal(0,1,len(t))
        else:wave=np.sin(2*np.pi*freq*t)+.4*np.sin(2*np.pi*freq*1.5*t)
        if condition=='simultaneous':wave+=.7*np.sin(2*np.pi*freq*2*t)+.2*rng.normal(0,1,len(t))
        if condition=='overlapping-tones':env=np.minimum(1,t/rise)*np.exp(-t/.6)
        b=min(len(x),a+len(t));x[a:b]+=amp*env[:b-a]*wave[:b-a];truth.append(onset)
    if condition=='compressed':x=np.tanh(3*x)/3
    return x.astype(np.float32),truth

def metrics(events,truth):
    available=set(range(len(events)));errors=[]
    for t in truth:
        if not available:break
        i=min(available,key=lambda i:(abs(events[i]['time']-t),i))
        if abs(events[i]['time']-t)<=.05:errors.append(events[i]['time']-t);available.remove(i)
    return {'matched':len(errors),'missed':len(truth)-len(errors),'falsePositives':len(available),'errors':errors}

def run():
    result={'schema':'v2-independent-synthetic-calibration','productionValidatedRealEvents':0,'development':{},'validation':{}}
    for phase,seeds in [('development',CFG['calibrationDevelopmentSeeds']),('validation',CFG['calibrationValidationSeeds'])]:
        for condition in CLASSES:
            records=[]
            for seed in seeds:
                x,truth=generate(condition,seed);records.append(metrics(detect_events(x,[]),truth))
            errors=[e for r in records for e in r['errors']];absolute=np.abs(errors);matched=sum(r['matched'] for r in records);missed=sum(r['missed'] for r in records);fp=sum(r['falsePositives'] for r in records)
            row={'matched':matched,'missed':missed,'falsePositives':fp,'precision':matched/max(1,matched+fp),'recall':matched/max(1,matched+missed),'medianSeconds':float(np.median(absolute)) if errors else None,'p90Seconds':float(np.quantile(absolute,.90)) if errors else None,'p95Seconds':float(np.quantile(absolute,.95)) if errors else None,'maximumSeconds':float(max(absolute)) if errors else None,'signedBiasSeconds':float(np.mean(errors)) if errors else None}
            g=CFG['calibrationGate'];row['passes']=bool(errors and row['precision']>=g['minimumPrecision'] and row['recall']>=g['minimumRecall'] and row['p95Seconds']<=g['maximumP95Seconds'] and abs(row['signedBiasSeconds'])<=g['maximumBiasSeconds']);result[phase][condition]=row
    result['strictGateSupported']=all(r['passes'] for r in result['validation'].values());result['gatePolicy']='All independent validation classes must pass. Internal multiscale agreement alone cannot release strict gate. No transfer to production certainty.'
    return result

if __name__=='__main__':
    r=run();(Path(__file__).parent/'CALIBRATION.json').write_bytes(canonical(r));print(json.dumps(r['validation']));print('strictGateSupported',r['strictGateSupported'])
