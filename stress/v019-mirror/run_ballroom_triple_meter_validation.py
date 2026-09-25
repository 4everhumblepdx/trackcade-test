#!/usr/bin/env python3
"""Validate descriptive 1/3x + 3x tactus candidates on real Ballroom waltz audio.

Uses only Slow Waltz / Waltz / Viennese Waltz files discovered from the official
Ballroom audio directory structure. Compares frozen exact v0.18 against the
existing descriptive-only triple patch, requires canonical invariance, and
measures candidate recall of human beat-annotation tempo.
"""
import argparse, copy, csv, json, statistics, subprocess, tempfile, time
from pathlib import Path

AUDIO_EXTS={'.wav','.mp3','.flac','.ogg','.m4a'}

def probe_sr(p):
    q=subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate','-of','default=nw=1:nk=1',str(p)],text=True,capture_output=True,timeout=30)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1000:])
    return int(q.stdout.strip())

def decode(src,dst,sr):
    q=subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-ac','1','-ar',str(sr),'-f','f32le','-acodec','pcm_f32le',str(dst)],text=True,capture_output=True,timeout=180)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1200:])

def run(node,runner,raw,sr,name):
    t=time.perf_counter(); q=subprocess.run([node,str(runner),str(raw),str(sr),'1',name],text=True,capture_output=True,timeout=180)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1200:])
    return json.loads(q.stdout),time.perf_counter()-t

def canonical(x):
    y=copy.deepcopy(x); y.pop('tactusCandidates',None); return y

def read_beats(p):
    out=[]
    for line in p.read_text(errors='ignore').splitlines():
        try: out.append(float(line.split()[0]))
        except Exception: pass
    return sorted(v for v in out if v>=0)

def ref_bpm(ts):
    d=[b-a for a,b in zip(ts,ts[1:]) if .15<=b-a<=2.0]
    return None if len(d)<8 else 60.0/statistics.median(d)

def match_rank(cands,bpm,tol=.04):
    if not bpm or bpm<=0:return None
    for i,c in enumerate(cands,1):
        cb=float(c.get('bpm') or 0)
        if cb>0 and abs(cb-bpm)/bpm<=tol:return i
    return None

def relation(selected,reference):
    if not selected or not reference:return None
    ratio=reference/selected
    fam=[('one-third',1/3),('half',1/2),('two-thirds',2/3),('same',1),('three-halves',1.5),('double',2),('triple',3)]
    name,target=min(fam,key=lambda z:abs(ratio-z[1])/z[1])
    return name if abs(ratio-target)/target<=.06 else 'other'

def genre_from_path(p):
    parts=[x.lower().replace(' ','').replace('_','') for x in p.parts]
    for raw,norm in zip(p.parts,[x.lower().replace(' ','').replace('_','') for x in p.parts]):
        if 'viennesewaltz' in norm:return 'VienneseWaltz'
        if norm in ('waltz','slowwaltz') or 'slowwaltz' in norm:return 'Waltz'
    return None

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--audio-root',type=Path,required=True); ap.add_argument('--annotations-root',type=Path,required=True); ap.add_argument('--baseline-runner',type=Path,required=True); ap.add_argument('--dev-runner',type=Path,required=True); ap.add_argument('--output',type=Path,required=True); ap.add_argument('--node',default='node'); a=ap.parse_args(); a.output.mkdir(parents=True,exist_ok=True)
    audio={}
    for p in a.audio_root.rglob('*'):
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            g=genre_from_path(p)
            if g: audio[p.stem]=(p,g)
    anns={p.stem:p for p in a.annotations_root.rglob('*.beats')}
    rows=[]; errors=[]; inv=[]
    for n,(stem,(src,genre)) in enumerate(sorted(audio.items()),1):
        bp=anns.get(stem)
        if not bp: errors.append({'track':stem,'error':'annotation-not-found'}); continue
        try:
            rb=ref_bpm(read_beats(bp))
            if rb is None: raise RuntimeError('insufficient-valid-beat-intervals')
            sr=probe_sr(src)
            with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
            try:
                decode(src,raw,sr); base,tb=run(a.node,a.baseline_runner,raw,sr,stem); dev,td=run(a.node,a.dev_runner,raw,sr,stem)
            finally: raw.unlink(missing_ok=True)
            ok=canonical(base)==canonical(dev)
            if not ok: inv.append(stem)
            bc=base.get('tactusCandidates') or []; dc=dev.get('tactusCandidates') or []
            br=match_rank(bc,rb); dr=match_rank(dc,rb)
            sel=float(base.get('bpm') or 0)
            rows.append({'track':stem,'genre':genre,'reference_bpm':round(rb,6),'selected_bpm':sel,'reference_relation_to_selected':relation(sel,rb),'canonical_invariant':ok,'baseline_reference_rank':br or '','dev_reference_rank':dr or '','baseline_reference_recalled':br is not None,'dev_reference_recalled':dr is not None,'baseline_candidate_count':len(bc),'dev_candidate_count':len(dc),'new_triple_relation_count':sum(c.get('relationToSource') in ('one-third','triple') for c in dc),'baseline_runtime_s':round(tb,6),'dev_runtime_s':round(td,6),'runtime_ratio':round(td/max(tb,1e-9),6),'timing_tier_baseline':(base.get('timingGuardrail') or {}).get('tier'),'timing_tier_dev':(dev.get('timingGuardrail') or {}).get('tier')})
        except Exception as e: errors.append({'track':stem,'error':str(e)})
        if n%20==0: print(json.dumps({'processed':n,'rows':len(rows),'errors':len(errors),'invariance_failures':len(inv)}),flush=True)
    fields=list(rows[0].keys()) if rows else []
    with (a.output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
    (a.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n'); (a.output/'invariance_failures.json').write_text(json.dumps(inv,indent=2)+'\n')
    improved=[r for r in rows if not r['baseline_reference_recalled'] and r['dev_reference_recalled']]; regressed=[r for r in rows if r['baseline_reference_recalled'] and not r['dev_reference_recalled']]; triple=[r for r in rows if r['reference_relation_to_selected'] in ('one-third','triple')]; ratios=[r['runtime_ratio'] for r in rows]
    by_genre={}
    for g in ('Waltz','VienneseWaltz'):
        rr=[r for r in rows if r['genre']==g]; by_genre[g]={'tracks':len(rr),'baseline_reference_recall':sum(bool(r['baseline_reference_recalled']) for r in rr),'dev_reference_recall':sum(bool(r['dev_reference_recalled']) for r in rr),'triple_family_tracks':sum(r['reference_relation_to_selected'] in ('one-third','triple') for r in rr)}
    s={'corpus':'Ballroom triple-meter subset','tracks_discovered':len(audio),'tracks_analyzed':len(rows),'errors':len(errors),'canonical_invariance_passed':not inv,'canonical_invariance_failures':len(inv),'baseline_reference_recall':sum(bool(r['baseline_reference_recalled']) for r in rows),'dev_reference_recall':sum(bool(r['dev_reference_recalled']) for r in rows),'reference_recall_improvements':len(improved),'reference_recall_regressions':len(regressed),'triple_family_reference_tracks':len(triple),'triple_family_baseline_recall':sum(bool(r['baseline_reference_recalled']) for r in triple),'triple_family_dev_recall':sum(bool(r['dev_reference_recalled']) for r in triple),'timing_tier_changes':sum(r['timing_tier_baseline']!=r['timing_tier_dev'] for r in rows),'mean_runtime_ratio':sum(ratios)/max(1,len(ratios)),'max_runtime_ratio':max(ratios) if ratios else None,'by_genre':by_genre,'improved_tracks':[r['track'] for r in improved],'regressed_tracks':[r['track'] for r in regressed]}
    (a.output/'summary.json').write_text(json.dumps(s,indent=2)+'\n'); print(json.dumps(s,indent=2))
    if len(rows)<150: raise SystemExit(f'FAIL-CLOSED: only {len(rows)} triple-meter tracks analyzed')
    if inv: raise SystemExit(f'FAIL-CLOSED: {len(inv)} canonical invariance failures')
    if regressed: raise SystemExit(f'FAIL-CLOSED: {len(regressed)} reference-recall regressions')
    if s['timing_tier_changes']: raise SystemExit(f"FAIL-CLOSED: {s['timing_tier_changes']} timing-tier changes")
if __name__=='__main__': main()
