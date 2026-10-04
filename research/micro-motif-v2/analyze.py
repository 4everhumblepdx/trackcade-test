"""Explicit input manifest only; no repository discovery, network or production imports."""
import argparse,hashlib,json,subprocess
from pathlib import Path
import numpy as np
from dsp_base import CFG,canonical,digest,detect_events
from method import features,Search,null_distribution,approve
ROOT=Path(__file__).resolve().parent
SOURCE='6f1555db2a6a7aa2c8cf7e7b59390c17788b39b9'
def hash_file(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def verify_freeze(commit):
    f=json.loads((ROOT/'PREFLIGHT.json').read_text(encoding='utf-8'))
    if f['configSha256']!=digest(CFG):raise ValueError('Frozen configuration mismatch')
    for name,h in f['codeSha256'].items():
        if hash_file(ROOT/name)!=h:raise ValueError('Frozen code mismatch: '+name)
    repo=ROOT.parents[1]
    if subprocess.check_output(['git','show',commit+':research/micro-motif-v2/PREFLIGHT.json'],cwd=repo)!= (ROOT/'PREFLIGHT.json').read_bytes():raise ValueError('Freeze not committed')
    return f

def pulse_proxy(events,duration):
    # Generic autocorrelation pulse annotation only. Not a trusted beat grid.
    dt=.01;curve=np.zeros(int(duration/dt)+1)
    for e in events:curve[min(len(curve)-1,int(e['time']/dt))]+=e['strength']
    power=np.fft.rfft(curve,n=2*len(curve));corr=np.fft.irfft(power*power.conj())[:len(curve)]
    lag=28+int(np.argmax(corr[28:86]));phase=int(np.argmax([curve[i::lag].sum() for i in range(lag)]))
    return np.arange(phase*dt,duration,lag*dt).tolist()

def coverage(families,selected,beats):
    result=[]
    for f in families:
        if not f['gameplayAnchorCandidate']:continue
        full=partial=missed=near=total=0
        for o in f['occurrences']:
            ts=o['eventTimes'];hits=sum(any(abs(t-v)<=.020 for v in selected) for t in ts);full+=hits==len(ts);partial+=0<hits<len(ts);missed+=len(ts)-hits;total+=len(ts);near+=sum(any(abs(t-b)<=.020 for b in beats) for t in ts)
        result.append({'family':f['id'],'occurrences':f['occurrenceCount'],'full':full,'partial':partial,'missedFamilyEvents':missed,'beatRepresentableWithin20ms':near,'microEventRequired':total-near})
    return result

def run_record(record,output,calibration,freeze_commit=None):
    external=record['role']=='blind-external'
    if external:
        if not freeze_commit:raise ValueError('External execution requires committed freeze')
        verify_freeze(freeze_commit)
        # Local scratch once-only latch; failed execution consumes attempt. No recovery.
        lock=Path(record['pcmPath']).with_suffix('.analysis-attempt.json')
        with lock.open('x',encoding='utf-8') as fp:json.dump({'freezeCommit':freeze_commit,'track':record['id'],'retries':0},fp)
    if hash_file(record['pcmPath'])!=record['decodedPcmSha256']:raise ValueError('PCM hash mismatch')
    x=np.fromfile(record['pcmPath'],dtype='<f4');duration=len(x)/CFG['sampleRate']
    beats=record.get('beatTimes',[]);events=detect_events(x,beats);grid_type='frozen v2.3 evidence' if beats else 'exploratory autocorrelation pulse proxy; not trusted beats'
    if not beats:
        beats=pulse_proxy(events,duration)
        for e in events:
            b=min(beats,key=lambda b:abs(e['time']-b));e['beatOffsetSeconds']=round(e['time']-b,7);e['nearExistingBeat']=abs(e['time']-b)<=.020
    for e in events:
        stable=e['strictGameplayCandidate'];strict=stable and calibration['strictGateSupported'];e.update(internallyStable=stable,calibrationSupportedStrictCandidate=strict,productionValidated=False,trustedMicroEventTime=False,timingTrustStatus='calibration-supported strict research candidate' if strict else 'internally stable only' if stable else 'exploratory event')
    print(record['id']+': descriptors/search',flush=True)
    hp=features(x,events,True);search=Search(events,hp,duration);families,real_top=search.run();nulls=null_distribution(search);families=approve(families,nulls,calibration['strictGateSupported'])
    print(record['id']+': fixed ablations',flush=True)
    ablations={}
    for label,descriptor,chroma in [('without-chroma',hp,False),('without-hp',features(x,events,False),True),('v1-texture',np.array([e['acoustic'] for e in events]),True)]:
        ab=Search(events,descriptor,duration);fs,top=ab.run(use_chroma=chroma);controls=null_distribution(ab,use_chroma=chroma);approve(fs,controls,calibration['strictGateSupported'])
        ablations[label]={'realTop':top,'nullMax':max(r['score'] for rows in controls.values() for r in rows),'separatedFamilies':sum(f['empiricalSearchMaxExceedance']<=.05 for f in fs),'families':len(fs),'occurrences':sum(f['occurrenceCount'] for f in fs),'anchorEligible':sum(f['gameplayAnchorCandidate'] for f in fs),'nullDistributions':controls}
    summary={'eventCount':len(events),'internallyStableCount':sum(e['internallyStable'] for e in events),'calibrationSupportedStrictCount':sum(e['calibrationSupportedStrictCandidate'] for e in events),'productionValidatedCount':0,'nearGridCount':sum(e['nearExistingBeat'] for e in events),'outsideGridCount':sum(not e['nearExistingBeat'] for e in events),'gridType':grid_type,'eventDensityPerSecond':len(events)/duration,'retainedFamilyCount':len(families),'lengthDistribution':{str(l):sum(f['eventCount']==l for f in families) for l in range(2,7)},'occurrenceCount':sum(f['occurrenceCount'] for f in families),'gappedAlignmentOccurrences':sum(o['alignment']!='exact' for f in families for o in f['occurrences']),'separatedFamilies':sum(f['empiricalSearchMaxExceedance']<=.05 for f in families),'anchorEligibleFamilyCount':sum(f['gameplayAnchorCandidate'] for f in families),'realTop':real_top,'nullMax':max(r['score'] for rows in nulls.values() for r in rows),'threeEventFamilies':[f['id'] for f in families if f['eventCount']==3],'sourceIdentity':'UNKNOWN','notePitchValidated':False,'coverageV23':None if external else coverage(families,record['v23Times'],beats)}
    inp={k:record[k] for k in ['id','role','filename','inputAudioSha256','decodedPcmSha256','sampleRate']};inp['duration']=duration
    result={'schema':'trackcade-micro-motif-v2-research','input':inp,'freezeCommit':freeze_commit,'configSha256':digest(CFG),'summary':summary,'families':families,'nullDistributions':nulls,'ablations':ablations,'events':events,'providerCalls':0,'spendUSD':0,'trackSpecificHandling':False}
    output.mkdir(parents=True,exist_ok=True);target=output/(record['id']+'.json')
    if target.exists():raise ValueError('Refusing to overwrite frozen result')
    target.write_bytes(canonical(result));print(json.dumps({'track':record['id'],**summary}),flush=True)
    return result

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--manifest',required=True);ap.add_argument('--output',required=True);ap.add_argument('--freeze-commit');args=ap.parse_args()
    manifest=json.loads(Path(args.manifest).read_text(encoding='utf-8'));cal=json.loads((ROOT/'CALIBRATION.json').read_text(encoding='utf-8'))
    for record in manifest['records']:run_record(record,Path(args.output),cal,args.freeze_commit)
