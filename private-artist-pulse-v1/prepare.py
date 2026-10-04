"""Minimal local pulse/energy playtest proposals. No motifs, lyrics or source naming."""
from pathlib import Path
import argparse,hashlib,json
import numpy as np
ROOT=Path(__file__).resolve().parent
def canonical(v):return (json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode()
def analyze_pcm(path,duration):
    sr=22050;x=np.fromfile(path,dtype='<f4');hop=256;size=1024
    if not np.isfinite(x).all():raise ValueError('Invalid PCM')
    frames=np.lib.stride_tricks.sliding_window_view(np.pad(x,(size//2,size//2)),size)[::hop]
    log=np.empty((len(frames),size//2+1),np.float32)
    for a in range(0,len(frames),512):log[a:a+512]=np.log1p(10*abs(np.fft.rfft(frames[a:a+512]*np.hanning(size),axis=1)))
    flux=np.maximum(np.diff(log,axis=0,prepend=log[:1]),0).mean(axis=1);dt=hop/sr
    flux=np.maximum(flux-np.convolve(flux,np.ones(43)/43,'same'),0);flux=flux[:int(duration/dt)+1]
    ac=np.fft.irfft(abs(np.fft.rfft(flux-flux.mean(),n=2*len(flux)))**2)[:len(flux)]
    lo,hi=round(.30/dt),round(.85/dt);lags=np.arange(lo,hi+1);lag=int(lags[np.argmax(ac[lags])]);period=lag*dt
    # Fixed-period phase maximizing aggregate novelty support; no ear corrections.
    support=np.array([flux[p::lag].sum() for p in range(lag)]);phase=int(np.argmax(support))*dt
    beats=np.arange(phase,duration,period);near=[float(flux[max(0,round(t/dt)-1):min(len(flux),round(t/dt)+2)].max()) for t in beats]
    supported=float(np.mean(np.array(near)>=max(1e-9,np.quantile(flux,.75))))
    windows=[]
    for a in range(0,len(flux),round(20/dt)):
        f=flux[a:a+round(20/dt)]
        if len(f)<round(10/dt):continue
        c=np.fft.irfft(abs(np.fft.rfft(f-f.mean(),n=2*len(f)))**2)[:len(f)];windows.append(float(lags[np.argmax(c[lags])]*dt))
    agreement=float(np.mean(np.abs(np.array(windows)-period)<=.04))
    sample_times=np.r_[np.arange(0,duration,.5),duration];energy=[];rms=[]
    for t in sample_times:
        a=min(len(x)-1,int(t*sr));b=min(len(x),a+round(.5*sr));rms.append(float(np.sqrt(np.mean(x[a:b].astype(float)**2))))
    ref=max(float(np.quantile(rms,.95)),1e-9);energy=np.clip(np.array(rms)/ref,0,1)
    centers=[];change=[]
    for t in np.arange(10,duration-10,.5):
        before=energy[(sample_times>=t-8)&(sample_times<t)].mean();after=energy[(sample_times>=t)&(sample_times<t+8)].mean();centers.append(float(t));change.append(float(abs(after-before)))
    chosen=[]
    for i in sorted(range(len(change)),key=lambda i:(-change[i],centers[i])):
        if change[i]<.14:break
        if all(abs(centers[i]-v)>=20 for v in chosen):chosen.append(centers[i])
    peaks=(flux[1:-1]>flux[:-2])&(flux[1:-1]>=flux[2:])&(flux[1:-1]>=np.quantile(flux,.92));rate=float(peaks.sum()/duration)
    return {'bpm':60/period,'beatOffset':phase,'events':[{'kind':'section','t':0}]+[{'kind':'section','t':t} for t in sorted(chosen)]+[{'kind':'beat','t':round(float(t),7)} for t in beats],'energyCurve':energy.round(6).tolist(),'generation':{'energySampleTimes':sample_times.round(7).tolist(),'source':'local minimal spectral-novelty pulse proposal; not production validated'},'measurements':{'meanRms':float(np.mean(rms)),'rmsCoefficientOfVariation':float(np.std(rms)/max(np.mean(rms),1e-9)),'dynamicContrastRatio':float(np.quantile(rms,.9)/max(np.quantile(rms,.1),1e-9)),'broadAttackDensityPerSecond':rate,'coarseContrastBoundaries':sorted(chosen),'estimatedPulseIntervalSeconds':period,'pulseWindowAgreementWithin40ms':agreement,'gridNoveltySupportFraction':supported,'sourceIdentity':'UNKNOWN','productionValidated':False}}

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--inputs',required=True);args=ap.parse_args();meta=json.loads(Path(args.inputs).read_text(encoding='utf-8'))
    # Explicit PCM/decoder provenance only. No candidate motif data are read.
    for r in meta['records']:
        p=Path(r['pcmPath']);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['decodedPcmSha256'];assert hashlib.sha256(Path(r['audioPath']).read_bytes()).hexdigest()==r['inputAudioSha256'];duration=min(r['duration'],r['mediaDuration']);a=analyze_pcm(p,duration);title=r['filename'].split(' (REST100)')[0]
        track={'artist':'Private artist playtest','title':title,'audioUrl':'/audio/'+r['id'],'highScoreKey':'trackcade.private.artist-first-pass.'+r['id'],'songLength':duration,'finishBonus':500,**a,'provenance':{k:r[k] for k in ['filename','inputAudioSha256','decodedPcmSha256']},'timingLimitations':'Exploratory constant pulse grid; tempo/phase, half/double-time ambiguity, source-to-media mapping and physical latency unvalidated. PERFECT centers refer to the proposal grid, not proven musical-event truth. No motif attacks or subjective timestamps.'}
        (ROOT/'tracks').mkdir(exist_ok=True);(ROOT/'tracks'/(r['id']+'.json')).write_bytes(canonical(track));print(json.dumps({'track':r['id'],'duration':duration,**a['measurements']}))
