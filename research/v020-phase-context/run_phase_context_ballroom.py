#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,json,os,subprocess,tempfile,time
from pathlib import Path


def run(cmd, **kw):
    return subprocess.run(cmd, text=True, capture_output=True, check=False, **kw)

def beats(path: Path):
    out=[]
    for line in path.read_text(errors='ignore').splitlines():
        q=line.split()
        if not q: continue
        try: out.append(float(q[0]))
        except: pass
    return sorted(out)

def greedy(pred, ref, tol=.070):
    i=j=m=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol: m+=1;i+=1;j+=1
        elif d < -tol: i+=1
        else: j+=1
    p=m/len(pred) if pred else 0
    r=m/len(ref) if ref else 0
    return p,r,(2*p*r/(p+r) if p+r else 0)

def ffprobe(path: Path):
    r=run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate,channels','-of','json',str(path)])
    if r.returncode: raise RuntimeError(r.stderr[-1000:])
    s=(json.loads(r.stdout).get('streams') or [{}])[0]
    return int(s.get('sample_rate') or 44100), int(s.get('channels') or 1)

def candidate_times(phase,bpm,start,end):
    interval=60/bpm;t=phase
    while t < start-.001: t+=interval
    while t-interval >= start-.001: t-=interval
    out=[]
    while t <= end+.001: out.append(t);t+=interval
    return out

def strip_debug(x):
    y=dict(x);y.pop('phaseContextDebug',None);return y

def flatten_grid(prefix, grid, row):
    for k in ('beatCount','meanBeatStrength','medianBeatStrength','meanBeatConfidence','beatVsHalfAsymmetry','lowBeatVsHalfAsymmetry','transientBeatVsHalfAsymmetry'):
        row[f'{prefix}_{k}']=grid.get(k)
    groups={int(g['beatsPerBar']):g for g in grid.get('groups',[])}
    for n in (2,3,4):
        g=groups.get(n,{})
        for k in ('bestPhase','contrast','anchorConsistency','periodicity','score','windows','windowMeanContrast','windowStdContrast','windowPositiveFraction','windowMinContrast'):
            row[f'{prefix}_g{n}_{k}']=g.get(k)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--audio-root',type=Path,required=True)
    ap.add_argument('--annotations-root',type=Path,required=True)
    ap.add_argument('--baseline-runner',type=Path,required=True)
    ap.add_argument('--debug-runner',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    audio={p.stem:p for ext in ('*.wav','*.mp3','*.flac','*.ogg','*.m4a') for p in args.audio_root.rglob(ext)}
    anns={p.stem:p for p in args.annotations_root.rglob('*.beats')}
    names=sorted(set(audio)&set(anns))
    rows=[];errors=[];inv=[]
    for n,name in enumerate(names,1):
        a=audio[name];refs=beats(anns[name]);sr,ch=ffprobe(a)
        with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
        try:
            d=run(['ffmpeg','-nostdin','-v','error','-y','-i',str(a),'-map','0:a:0','-f','f32le','-acodec','pcm_f32le','-ar',str(sr),'-ac',str(ch),str(raw)])
            if d.returncode: raise RuntimeError('ffmpeg '+d.stderr[-1000:])
            b=run(['node',str(args.baseline_runner),str(raw),str(sr),str(ch),name],timeout=240)
            if b.returncode: raise RuntimeError('baseline '+(b.stderr or b.stdout)[-1500:])
            env=dict(os.environ);env['TRACKCADE_PHASE_CONTEXT_DEBUG']='1'
            q=run(['node',str(args.debug_runner),str(raw),str(sr),str(ch),name],env=env,timeout=240)
            if q.returncode: raise RuntimeError('debug '+(q.stderr or q.stdout)[-1500:])
            base=json.loads(b.stdout);dev=json.loads(q.stdout)
            if base != strip_debug(dev): inv.append(name)
            dbg=dev.get('phaseContextDebug') or []
            tempo=dev.get('tempoMap') or []
            if len(dbg)!=len(tempo): raise RuntimeError(f'debug segments {len(dbg)} != tempo segments {len(tempo)}')
            for si,(seg,ctx) in enumerate(zip(tempo,dbg)):
                start=float(seg['start']);end=float(seg['end']);bpm=float(seg['bpm']);rseg=[t for t in refs if start-.001<=t<=end+.001]
                sgrid=ctx['selected'];hgrid=ctx['halfCycle']
                sp=candidate_times(float(sgrid['phase']),bpm,start,end);hp=candidate_times(float(hgrid['phase']),bpm,start,end)
                sprec,srec,sf=greedy(sp,rseg,.070);hprec,hrec,hf=greedy(hp,rseg,.070)
                row={'track':name,'segment':si,'tier':(dev.get('timingGuardrail') or {}).get('tier'),'bpm':bpm,'start':start,'end':end,'reference_beats':len(rseg),'selected_precision70':sprec,'selected_recall70':srec,'selected_f1_70':sf,'half_precision70':hprec,'half_recall70':hrec,'half_f1_70':hf,'half_minus_selected_f1':hf-sf}
                flatten_grid('selected',sgrid,row);flatten_grid('half',hgrid,row)
                # Symmetric difference features are descriptors only; no selector is applied here.
                for stem in ('meanBeatStrength','medianBeatStrength','meanBeatConfidence','beatVsHalfAsymmetry','lowBeatVsHalfAsymmetry','transientBeatVsHalfAsymmetry'):
                    a0=row.get(f'half_{stem}');b0=row.get(f'selected_{stem}')
                    row[f'delta_{stem}']=(a0-b0) if a0 is not None and b0 is not None else None
                for g in (2,3,4):
                    for stem in ('contrast','anchorConsistency','periodicity','score','windowMeanContrast','windowStdContrast','windowPositiveFraction','windowMinContrast'):
                        a0=row.get(f'half_g{g}_{stem}');b0=row.get(f'selected_g{g}_{stem}')
                        row[f'delta_g{g}_{stem}']=(a0-b0) if a0 is not None and b0 is not None else None
                rows.append(row)
        except Exception as e:
            errors.append({'track':name,'error':str(e)})
        finally:
            raw.unlink(missing_ok=True)
        if n%50==0: print(json.dumps({'processed':n,'rows':len(rows),'errors':len(errors),'invariance':len(inv)}),flush=True)
    fields=sorted({k for r in rows for k in r})
    with (args.output/'phase_context.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    (args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    (args.output/'invariance_failures.json').write_text(json.dumps(inv,indent=2)+'\n')
    by_track={}
    for r in rows: by_track.setdefault(r['track'],[]).append(r)
    single=[rs[0] for rs in by_track.values() if len(rs)==1]
    helps=[r for r in single if r['half_minus_selected_f1']>=.2]
    hurts=[r for r in single if r['half_minus_selected_f1']<=-.2]
    summary={'corpus':'Ballroom full 698 — v0.20 long-context phase diagnostics','tracks_discovered':len(names),'tracks_analyzed':len(by_track),'segments_analyzed':len(rows),'errors':len(errors),'canonical_invariance_failures':len(inv),'single_segment_tracks':len(single),'large_half_cycle_helps':len(helps),'large_half_cycle_hurts':len(hurts),'large_help_tracks':[r['track'] for r in helps],'large_hurt_count':len(hurts),'selector_applied':False}
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
    if len(names)!=698 or len(by_track)!=698 or errors or inv:
        raise SystemExit(1)

if __name__=='__main__': main()
