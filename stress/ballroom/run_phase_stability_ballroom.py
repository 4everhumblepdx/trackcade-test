#!/usr/bin/env python3
import argparse,csv,json,os,subprocess,tempfile
from pathlib import Path
LAYERS=['low','amplitude','mid','hybrid','transient','high']

def run(cmd,**kw): return subprocess.run(cmd,text=True,capture_output=True,check=False,**kw)
def beats(path):
    out=[]
    for line in path.read_text(errors='ignore').splitlines():
        q=line.split()
        if not q: continue
        try: out.append(float(q[0]))
        except: pass
    return sorted(out)
def ffprobe(path):
    q=run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate,channels','-of','json',str(path)])
    if q.returncode: raise RuntimeError(q.stderr[-600:])
    s=(json.loads(q.stdout).get('streams') or [{}])[0];return int(s.get('sample_rate') or 44100),int(s.get('channels') or 1)
def candidate_times(phase,bpm,start,end):
    step=60/bpm;t=phase
    while t<start-.001:t+=step
    out=[]
    while t<=end+.001:out.append(t);t+=step
    return out
def f1(pred,ref,tol=.070):
    i=j=m=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol:m+=1;i+=1;j+=1
        elif d < -tol:i+=1
        else:j+=1
    p=m/len(pred) if pred else 0;r=m/len(ref) if ref else 0
    return 2*p*r/(p+r) if p+r else 0
def halfdist(a,b):
    d=((a-b+.5)%1)-.5;return abs(abs(d)-.5)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--audio-root',type=Path,required=True);ap.add_argument('--annotations-root',type=Path,required=True);ap.add_argument('--runner',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    audio={p.stem:p for ext in ('*.wav','*.mp3','*.flac','*.ogg','*.m4a') for p in args.audio_root.rglob(ext)}
    anns={p.stem:p for p in args.annotations_root.rglob('*.beats')};names=sorted(set(audio)&set(anns));rows=[];errors=[]
    for n,name in enumerate(names,1):
        a=audio[name];refs=beats(anns[name]);sr,ch=ffprobe(a)
        with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf:raw=Path(tf.name)
        try:
            d=run(['ffmpeg','-nostdin','-v','error','-y','-i',str(a),'-map','0:a:0','-f','f32le','-acodec','pcm_f32le','-ar',str(sr),'-ac',str(ch),str(raw)])
            if d.returncode:raise RuntimeError('ffmpeg '+d.stderr[-600:])
            env=dict(os.environ);env['TRACKCADE_PHASE_STABILITY']='1'
            q=run(['node',str(args.runner),str(raw),str(sr),str(ch),name],env=env,timeout=180)
            if q.returncode:raise RuntimeError('node '+(q.stderr or q.stdout)[-900:])
            js=json.loads(q.stdout);dbg=js.get('phaseStabilityDebug') or []
            if len(dbg)!=1:
                rows.append({'track':name,'status':'not-single-segment','segments':len(dbg)});continue
            seg=dbg[0];cands=seg.get('candidates') or [];sel=next((c for c in cands if 'selected' in (c.get('sources') or [])),None)
            if not sel:raise RuntimeError('selected candidate missing')
            others=[c for c in cands if c is not sel];half=min(others,key=lambda c:halfdist(float(c['phaseFraction']),float(sel['phaseFraction']))) if others else None
            if half is None or halfdist(float(half['phaseFraction']),float(sel['phaseFraction']))>.08:
                rows.append({'track':name,'status':'no-half'});continue
            bpm=float(seg['bpm']);start=float(seg['start']);end=float(seg['end']);rseg=[t for t in refs if start-.001<=t<=end+.001]
            sf=f1(candidate_times(float(sel['phase']),bpm,start,end),rseg);hf=f1(candidate_times(float(half['phase']),bpm,start,end),rseg)
            row={'track':name,'status':'ok','tier':(js.get('timingGuardrail') or {}).get('tier'),'bpm':bpm,'selected_f1_70':sf,'half_f1_70':hf,'delta_f1':hf-sf,'selected_window_mean':sel['windowMean'],'half_window_mean':half['windowMean'],'window_mean_delta':half['windowMean']-sel['windowMean'],'selected_window_std':sel['windowStd'],'half_window_std':half['windowStd'],'window_std_delta':half['windowStd']-sel['windowStd'],'selected_window_min':sel['windowMin'],'half_window_min':half['windowMin'],'window_min_delta':half['windowMin']-sel['windowMin']}
            for L in LAYERS:
                ss=(sel.get('layerStats') or {}).get(L) or {};hs=(half.get('layerStats') or {}).get(L) or {}
                for metric in ('mean','std','min','max'):
                    sv=ss.get(metric);hv=hs.get(metric);row[f'{L}_{metric}_delta']=(hv-sv) if sv is not None and hv is not None else None
            # Window-by-window winner pattern: true half-cycle flips should often win repeatedly, not once.
            sw=sel.get('windows') or [];hw=half.get('windows') or []
            row['half_window_wins']=sum(1 for x,y in zip(sw,hw) if float(y['score'])>float(x['score']))
            row['half_window_strong_wins']=sum(1 for x,y in zip(sw,hw) if float(y['score'])>float(x['score'])+.015)
            rows.append(row)
        except Exception as e:errors.append({'track':name,'error':str(e)})
        finally:raw.unlink(missing_ok=True)
        if n%50==0:print(json.dumps({'processed':n,'rows':len(rows),'errors':len(errors)}),flush=True)
    keys=sorted({k for r in rows for k in r})
    with (args.output/'phase_stability.csv').open('w',newline='') as f:w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(rows)
    (args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    ok=[r for r in rows if r.get('status')=='ok'];big=[r for r in ok if r['delta_f1']>=.2];hurt=[r for r in ok if r['delta_f1']<=-.2]
    summary={'tracks':len(names),'rows':len(rows),'errors':len(errors),'ok':len(ok),'big_half_help':len(big),'big_half_hurt':len(hurt),'big_help_half_window_wins_mean':sum(r['half_window_wins'] for r in big)/max(1,len(big)),'big_hurt_half_window_wins_mean':sum(r['half_window_wins'] for r in hurt)/max(1,len(hurt))}
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
