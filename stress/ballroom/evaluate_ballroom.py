#!/usr/bin/env python3
import argparse, csv, json, math, os, statistics, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

TOLS=(0.035,0.050,0.070)

def run(cmd, **kwargs):
    return subprocess.run(cmd, check=False, text=True, capture_output=True, **kwargs)

def parse_beats(path: Path):
    out=[]
    for line in path.read_text(errors='ignore').splitlines():
        line=line.strip()
        if not line: continue
        parts=line.split()
        try:
            t=float(parts[0]); beat_id=int(float(parts[1])) if len(parts)>1 else 0
        except Exception:
            continue
        out.append((t,beat_id))
    out.sort()
    return out

def greedy_match(pred, ref, tol):
    i=j=matches=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol:
            matches+=1; i+=1; j+=1
        elif d < -tol:
            i+=1
        else:
            j+=1
    precision=matches/len(pred) if pred else 0.0
    recall=matches/len(ref) if ref else 0.0
    f1=2*precision*recall/(precision+recall) if precision+recall else 0.0
    return matches,precision,recall,f1

def nearest_errors(pred, ref):
    if not pred or not ref: return []
    errs=[]; j=0
    for t in ref:
        while j+1<len(pred) and abs(pred[j+1]-t)<=abs(pred[j]-t): j+=1
        errs.append(abs(pred[j]-t))
    return errs

def percentile(vals,p):
    if not vals: return None
    vals=sorted(vals); x=(len(vals)-1)*p; lo=int(math.floor(x)); hi=int(math.ceil(x))
    if lo==hi:return vals[lo]
    return vals[lo]*(hi-x)+vals[hi]*(x-lo)

def ffprobe(path):
    r=run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate,channels','-of','json',str(path)])
    if r.returncode: raise RuntimeError('ffprobe: '+r.stderr[-1000:])
    data=json.loads(r.stdout); s=(data.get('streams') or [{}])[0]
    return int(s.get('sample_rate') or 44100), int(s.get('channels') or 1)

def analyze_one(audio: Path, ann: Path, runner: Path, timeout: int):
    refs=parse_beats(ann)
    if len(refs)<4: return {'track':audio.stem,'status':'skip','error':'too_few_reference_beats'}
    sample_rate,channels=ffprobe(audio)
    with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tmp: raw=Path(tmp.name)
    try:
        dec=run(['ffmpeg','-nostdin','-v','error','-y','-i',str(audio),'-map','0:a:0','-f','f32le','-acodec','pcm_f32le','-ar',str(sample_rate),'-ac',str(channels),str(raw)],timeout=timeout)
        if dec.returncode: raise RuntimeError('ffmpeg: '+dec.stderr[-1000:])
        ar=run(['node',str(runner),str(raw),str(sample_rate),str(channels),audio.name],timeout=timeout)
        if ar.returncode: raise RuntimeError('analyzer: '+(ar.stderr or ar.stdout)[-1500:])
        analysis=json.loads(ar.stdout)
    finally:
        raw.unlink(missing_ok=True)
    ref_times=[x[0] for x in refs]
    start,end=ref_times[0],ref_times[-1]
    pred=[float(b['time']) for b in analysis.get('beatGrid',[]) if start-0.10 <= float(b.get('time',-99)) <= end+0.10]
    scored_pred=[t for t in pred if start <= t <= end]
    errs=nearest_errors(scored_pred,ref_times)
    row={
      'track':audio.stem,'genre':audio.parent.name,'status':'ok','audio':str(audio),'annotation':str(ann),
      'reference_beats':len(ref_times),'predicted_beats':len(scored_pred),'beat_count_ratio':round(len(scored_pred)/len(ref_times),6) if ref_times else None,
      'bpm':analysis.get('bpm'),'tier':(analysis.get('timingGuardrail') or {}).get('tier'),
      'timing_confidence':analysis.get('timingConfidence'),
      'phase_coherence':(analysis.get('diagnostics') or {}).get('phaseCoherence'),
      'metrical_grid_coherence':(analysis.get('diagnostics') or {}).get('metricalGridCoherence'),
      'pulse_family_ambiguity':(analysis.get('diagnostics') or {}).get('pulseFamilyAmbiguity'),
      'nearest_median_ms':round(1000*(statistics.median(errs) if errs else 999),3),
      'nearest_p95_ms':round(1000*(percentile(errs,.95) if errs else 999),3),
    }
    for tol in TOLS:
        m,p,r,f=greedy_match(scored_pred,ref_times,tol)
        ms=int(round(tol*1000))
        row.update({f'match_{ms}ms':m,f'precision_{ms}ms':round(p,6),f'recall_{ms}ms':round(r,6),f'f1_{ms}ms':round(f,6)})
    return row

def find_annotations(root):
    return {p.stem:p for p in root.rglob('*.beats')}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--audio-root',type=Path,required=True)
    ap.add_argument('--annotations-root',type=Path,required=True)
    ap.add_argument('--runner',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--jobs',type=int,default=6)
    ap.add_argument('--timeout',type=int,default=180)
    args=ap.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    anns=find_annotations(args.annotations_root)
    audio=[]
    for ext in ('*.wav','*.mp3','*.flac','*.ogg','*.m4a'):
        audio.extend(args.audio_root.rglob(ext))
    pairs=[]; missing=[]
    for a in sorted(set(audio)):
        ann=anns.get(a.stem)
        if ann:pairs.append((a,ann))
        else:missing.append(str(a))
    rows=[]
    with ThreadPoolExecutor(max_workers=max(1,args.jobs)) as ex:
        futs={ex.submit(analyze_one,a,ann,args.runner,args.timeout):(a,ann) for a,ann in pairs}
        for fut in as_completed(futs):
            a,_=futs[fut]
            try: rows.append(fut.result())
            except Exception as e: rows.append({'track':a.stem,'status':'error','error':str(e)[:2000]})
    rows.sort(key=lambda r:r.get('track',''))
    keys=sorted({k for r in rows for k in r})
    with (args.output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=keys); w.writeheader(); w.writerows(rows)
    ok=[r for r in rows if r.get('status')=='ok']
    summary={'audio_files':len(audio),'matched_annotations':len(pairs),'missing_annotations':len(missing),'completed':len(ok),'errors':len([r for r in rows if r.get('status')=='error'])}
    for ms in (35,50,70):
        fs=[r[f'f1_{ms}ms'] for r in ok]
        summary[f'macro_f1_{ms}ms']=round(statistics.mean(fs),6) if fs else None
        summary[f'tracks_f1_ge_0_8_{ms}ms']=sum(x>=.8 for x in fs)
        summary[f'tracks_f1_ge_0_9_{ms}ms']=sum(x>=.9 for x in fs)
    if ok:
        p95s=[r['nearest_p95_ms'] for r in ok]
        summary['median_track_p95_nearest_ms']=round(statistics.median(p95s),3)
        summary['p90_track_p95_nearest_ms']=round(percentile(p95s,.9),3)
        summary['tier_counts']=dict(__import__('collections').Counter(r.get('tier') for r in ok))
        by_genre={}
        for genre in sorted(set(r.get('genre','') for r in ok)):
            gr=[r for r in ok if r.get('genre','')==genre]
            by_genre[genre]={'tracks':len(gr)}
            for ms in (35,50,70):
                by_genre[genre][f'macro_f1_{ms}ms']=round(statistics.mean(r[f'f1_{ms}ms'] for r in gr),6)
        summary['by_genre']=by_genre
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (args.output/'missing_annotations.txt').write_text('\n'.join(missing)+'\n')
    with (args.output/'worst_70ms.csv').open('w',newline='') as f:
        worst=sorted(ok,key=lambda r:r['f1_70ms'])[:100]
        w=csv.DictWriter(f,fieldnames=keys); w.writeheader(); w.writerows(worst)
    print(json.dumps(summary,indent=2))
if __name__=='__main__': main()
