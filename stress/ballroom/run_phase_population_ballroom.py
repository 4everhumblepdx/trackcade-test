#!/usr/bin/env python3
import argparse,csv,json,os,subprocess,tempfile
from pathlib import Path

def run(cmd,**kw): return subprocess.run(cmd,text=True,capture_output=True,check=False,**kw)

def beats(path):
    out=[]
    for line in path.read_text(errors='ignore').splitlines():
        q=line.split()
        if not q: continue
        try: out.append(float(q[0]))
        except: pass
    return sorted(out)

def greedy(pred,ref,tol=.070):
    i=j=m=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol: m+=1;i+=1;j+=1
        elif d < -tol: i+=1
        else: j+=1
    p=m/len(pred) if pred else 0;r=m/len(ref) if ref else 0
    return p,r,(2*p*r/(p+r) if p+r else 0)

def ffprobe(path):
    r=run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate,channels','-of','json',str(path)])
    if r.returncode: raise RuntimeError(r.stderr[-600:])
    s=(json.loads(r.stdout).get('streams') or [{}])[0]
    return int(s.get('sample_rate') or 44100),int(s.get('channels') or 1)

def candidate_times(phase,bpm,start,end):
    interval=60/bpm;t=phase
    while t < start-.001: t+=interval
    out=[]
    while t <= end+.001: out.append(t);t+=interval
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--audio-root',type=Path,required=True);ap.add_argument('--annotations-root',type=Path,required=True);ap.add_argument('--runner',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    audio={p.stem:p for ext in ('*.wav','*.mp3','*.flac','*.ogg','*.m4a') for p in args.audio_root.rglob(ext)}
    anns={p.stem:p for p in args.annotations_root.rglob('*.beats')}
    names=sorted(set(audio)&set(anns))
    rows=[];summaries=[];errors=[];args.output.mkdir(parents=True,exist_ok=True)
    for n,name in enumerate(names,1):
        a=audio[name];ann=anns[name];refs=beats(ann);sr,ch=ffprobe(a)
        with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
        try:
            d=run(['ffmpeg','-nostdin','-v','error','-y','-i',str(a),'-map','0:a:0','-f','f32le','-acodec','pcm_f32le','-ar',str(sr),'-ac',str(ch),str(raw)])
            if d.returncode: raise RuntimeError('ffmpeg '+d.stderr[-600:])
            env=dict(os.environ);env['TRACKCADE_PHASE_DEBUG']='1'
            q=run(['node',str(args.runner),str(raw),str(sr),str(ch),name],env=env,timeout=180)
            if q.returncode: raise RuntimeError('node '+(q.stderr or q.stdout)[-900:])
            js=json.loads(q.stdout)
        except Exception as e:
            errors.append({'track':name,'error':str(e)});raw.unlink(missing_ok=True);continue
        raw.unlink(missing_ok=True)
        track_rows=[]
        for si,seg in enumerate(js.get('phaseDebug',[])):
            start=float(seg['start']);end=float(seg['end']);bpm=float(seg['bpm']);rseg=[t for t in refs if start-.001<=t<=end+.001]
            for ci,cand in enumerate(seg.get('candidates',[])):
                pred=candidate_times(float(cand['phase']),bpm,start,end);p,r,f=greedy(pred,rseg,.070);layer={x['name']:x for x in cand.get('layers',[])}
                row={'track':name,'tier':(js.get('timingGuardrail') or {}).get('tier'),'segment':si,'candidate':ci,'bpm':bpm,'phase':cand['phase'],'phase_fraction':cand['phaseFraction'],'sources':'+'.join(cand.get('sources',[])),'metrical_score':cand['metricalScore'],'coverage':cand['coverage'],'jitter_ms':cand['jitterMs'],'meter_bpb':cand.get('meterBeatsPerBar'),'meter_confidence':cand.get('meterConfidence'),'meter_ambiguity':cand.get('meterAmbiguity'),'precision70':p,'recall70':r,'f1_70':f,'is_selected':'selected' in cand.get('sources',[])}
                for ln in ('low','amplitude','mid','hybrid','transient','high'):
                    x=layer.get(ln,{})
                    row[f'{ln}_score']=x.get('score');row[f'{ln}_coverage']=x.get('coverage');row[f'{ln}_center_ms']=x.get('centerMs');row[f'{ln}_corr']=x.get('correlationSupport')
                rows.append(row);track_rows.append(row)
        if track_rows:
            selected=max((x for x in track_rows if x['is_selected']),key=lambda x:x['f1_70'],default=None)
            human=max(track_rows,key=lambda x:(x['f1_70'],x['precision70']))
            metric=max(track_rows,key=lambda x:x['metrical_score'])
            meter=max(track_rows,key=lambda x:(x['meter_confidence'] or 0))
            sorted_metric=sorted(track_rows,key=lambda x:x['metrical_score'],reverse=True)
            summaries.append({'track':name,'tier':(js.get('timingGuardrail') or {}).get('tier'),'analysis_bpm':js.get('bpm'),'selected_f1_70':selected['f1_70'] if selected else None,'human_best_f1_70':human['f1_70'],'human_best_sources':human['sources'],'human_best_phase_fraction':human['phase_fraction'],'human_best_metrical_rank':1+sorted_metric.index(human),'metrical_best_f1_70':metric['f1_70'],'metrical_best_sources':metric['sources'],'meter_best_f1_70':meter['f1_70'],'meter_best_sources':meter['sources'],'candidate_count':len(track_rows)})
        if n%50==0: print(json.dumps({'processed':n,'summaries':len(summaries),'errors':len(errors)}),flush=True)
    keys=sorted({k for r in rows for k in r})
    with (args.output/'phase_candidates.csv').open('w',newline='') as f: w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(rows)
    keys2=sorted({k for r in summaries for k in r})
    with (args.output/'phase_summary.csv').open('w',newline='') as f: w=csv.DictWriter(f,fieldnames=keys2);w.writeheader();w.writerows(summaries)
    (args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    print(json.dumps({'tracks':len(summaries),'errors':len(errors),'selected_mean_f1':sum(x['selected_f1_70'] or 0 for x in summaries)/max(1,len(summaries)),'human_candidate_mean_f1':sum(x['human_best_f1_70'] for x in summaries)/max(1,len(summaries)),'human_candidate_ge_0_8':sum(x['human_best_f1_70']>=.8 for x in summaries)},indent=2))
if __name__=='__main__': main()
