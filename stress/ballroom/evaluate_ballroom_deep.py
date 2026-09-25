#!/usr/bin/env python3
"""Deep beat-grid diagnostics for Trackcade Ballroom benchmark.
Measures raw beat.time alignment, attackTime alignment when available, best constant-shift rescue,
and within-track residual spread to distinguish phase offset from drift.
"""
import argparse,csv,json,math,statistics,subprocess,tempfile
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path

TOLS=(.035,.050,.070)

def run(cmd,**kw): return subprocess.run(cmd,check=False,text=True,capture_output=True,**kw)
def percentile(vals,p):
    if not vals:return None
    x=sorted(vals); z=(len(x)-1)*p; lo=int(math.floor(z)); hi=int(math.ceil(z))
    return x[lo] if lo==hi else x[lo]*(hi-z)+x[hi]*(z-lo)
def parse_beats(p):
    out=[]
    for line in p.read_text(errors='ignore').splitlines():
        q=line.split()
        if not q: continue
        try: out.append((float(q[0]),int(float(q[1])) if len(q)>1 else 0))
        except: pass
    return sorted(out)
def greedy(pred,ref,tol):
    i=j=m=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol:m+=1;i+=1;j+=1
        elif d < -tol:i+=1
        else:j+=1
    p=m/len(pred) if pred else 0;r=m/len(ref) if ref else 0
    return 2*p*r/(p+r) if p+r else 0

def nearest_signed(pred,ref):
    if not pred or not ref:return []
    out=[];j=0
    for t in ref:
        while j+1<len(pred) and abs(pred[j+1]-t)<=abs(pred[j]-t):j+=1
        out.append(pred[j]-t)
    return out

def shift_search(pred,ref,tol=.070):
    best=(greedy(pred,ref,tol),0.0)
    for i in range(-200,201):
        sh=i*.002
        f=greedy([t+sh for t in pred],ref,tol)
        if f>best[0]:best=(f,sh)
    return best

def ffprobe(p):
    r=run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate,channels','-of','json',str(p)])
    if r.returncode:raise RuntimeError(r.stderr[-1000:])
    s=(json.loads(r.stdout).get('streams') or [{}])[0]
    return int(s.get('sample_rate') or 44100),int(s.get('channels') or 1)

def one(audio,ann,runner,timeout):
    refs=[t for t,_ in parse_beats(ann)]
    sr,ch=ffprobe(audio)
    with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf:raw=Path(tf.name)
    try:
        d=run(['ffmpeg','-nostdin','-v','error','-y','-i',str(audio),'-map','0:a:0','-f','f32le','-acodec','pcm_f32le','-ar',str(sr),'-ac',str(ch),str(raw)],timeout=timeout)
        if d.returncode:raise RuntimeError('ffmpeg '+d.stderr[-800:])
        a=run(['node',str(runner),str(raw),str(sr),str(ch),audio.name],timeout=timeout)
        if a.returncode:raise RuntimeError('analyzer '+(a.stderr or a.stdout)[-1200:])
        js=json.loads(a.stdout)
    finally:raw.unlink(missing_ok=True)
    start,end=refs[0],refs[-1]
    grid=[b for b in js.get('beatGrid',[]) if start<=float(b.get('time',-99))<=end]
    pred=[float(b['time']) for b in grid]
    attack=[float(b.get('attackTime',b['time'])) for b in grid]
    attack_real=sum(1 for b in grid if isinstance(b.get('attackTime'),(int,float)))
    signed=nearest_signed(pred,refs); med=statistics.median(signed) if signed else 0
    residual=[abs(x-med) for x in signed]
    shifted_f70,shift=shift_search(pred,refs,.070)
    diag=js.get('timingDiagnostics') or js.get('diagnostics') or {}
    guard=js.get('timingGuardrail') or {}
    tactus=js.get('tactusCandidates') or []
    primary=max((float(c.get('confidence',0)) for c in tactus if c.get('isPrimary')),default=0.0)
    non_oct=max((float(c.get('confidence',0)) for c in tactus if c.get('relationToSource') not in ('same','half','double')),default=0.0)
    tactus_margin=(primary-non_oct) if non_oct>0 else None
    meter=js.get('meter') or {}
    row={'track':audio.stem,'genre':audio.parent.name,'tier':guard.get('tier'),
         'strict_scoring_allowed':guard.get('strictScoringAllowed'),'guard_reasons':'|'.join(guard.get('reasons') or []),
         'bpm':js.get('bpm'),'reference_beats':len(refs),'predicted_beats':len(pred),
         'beat_count_ratio':len(pred)/len(refs) if refs else None,
         'phase_coherence':diag.get('phaseCoherence'),
         'metrical_grid_coherence':diag.get('metricalGridCoherence'),
         'pulse_family_ambiguity':diag.get('pulseFamilyAmbiguity'),
         'detector_agreement':diag.get('detectorAgreement'),
         'timing_confidence':js.get('timingConfidence'),
         'tactus_primary_margin':tactus_margin,
         'tactus_candidate_count':len(tactus),
         'meter_numerator':meter.get('numerator') if isinstance(meter,dict) else None,
         'meter_denominator':meter.get('denominator') if isinstance(meter,dict) else None,
         'median_signed_offset_ms':med*1000,
         'residual_p95_after_median_shift_ms':(percentile(residual,.95) or 0)*1000,
         'best_shift_70ms_ms':shift*1000,'best_shift_f1_70ms':shifted_f70,
         'attack_time_coverage':attack_real/len(grid) if grid else 0}
    for ms,tol in ((35,.035),(50,.05),(70,.07)):
        row[f'grid_f1_{ms}ms']=greedy(pred,refs,tol)
        row[f'attack_f1_{ms}ms']=greedy(attack,refs,tol)
    return row

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--audio-root',type=Path,required=True);ap.add_argument('--annotations-root',type=Path,required=True);ap.add_argument('--runner',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);ap.add_argument('--jobs',type=int,default=6);ap.add_argument('--timeout',type=int,default=180);args=ap.parse_args()
    anns={p.stem:p for p in args.annotations_root.rglob('*.beats')}; audio=[]
    for ext in ('*.wav','*.mp3','*.flac','*.ogg','*.m4a'):audio+=list(args.audio_root.rglob(ext))
    pairs=[(a,anns[a.stem]) for a in sorted(set(audio)) if a.stem in anns]
    rows=[]
    with ThreadPoolExecutor(max_workers=args.jobs) as ex:
        fut={ex.submit(one,a,n,args.runner,args.timeout):a for a,n in pairs}
        for f in as_completed(fut):
            try:rows.append(f.result())
            except Exception as e:rows.append({'track':fut[f].stem,'error':str(e)[:1000]})
    args.output.mkdir(parents=True,exist_ok=True);keys=sorted({k for r in rows for k in r});
    with (args.output/'deep_results.csv').open('w',newline='') as fh:
        w=csv.DictWriter(fh,fieldnames=keys);w.writeheader();w.writerows(sorted(rows,key=lambda r:r.get('track','')))
    ok=[r for r in rows if 'error' not in r]
    summary={'tracks':len(ok),'errors':len(rows)-len(ok)}
    for ms in (35,50,70):
        summary[f'grid_macro_f1_{ms}ms']=statistics.mean(r[f'grid_f1_{ms}ms'] for r in ok) if ok else None
        summary[f'attack_macro_f1_{ms}ms']=statistics.mean(r[f'attack_f1_{ms}ms'] for r in ok) if ok else None
    summary['tracks_grid_f1_70_ge_0_8']=sum(r['grid_f1_70ms']>=.8 for r in ok)
    summary['tracks_shift_rescued_to_f1_70_ge_0_8']=sum(r['grid_f1_70ms']<.8 and r['best_shift_f1_70ms']>=.8 for r in ok)
    summary['median_abs_global_offset_ms']=statistics.median(abs(r['median_signed_offset_ms']) for r in ok) if ok else None
    summary['median_residual_p95_ms']=statistics.median(r['residual_p95_after_median_shift_ms'] for r in ok) if ok else None
    (args.output/'deep_summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
