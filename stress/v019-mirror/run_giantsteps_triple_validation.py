#!/usr/bin/env python3
"""Full GiantSteps regression validation for descriptive 1/3x + 3x tactus candidates.

Compares exact frozen v0.18 against v0.18 plus the frozen descriptive-only triple
patch on the official 664-track GiantSteps tempo dataset. Canonical Analyzer
output (everything except tactusCandidates) must remain identical. Candidate
reference-tempo recall may improve but may not regress; timing tiers must not
change.
"""
import argparse, copy, csv, json, subprocess, tempfile, time
from pathlib import Path

AUDIO_EXTS={'.mp3','.wav','.flac','.ogg','.m4a'}

def probe_sr(p):
    q=subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate','-of','default=nw=1:nk=1',str(p)],text=True,capture_output=True,timeout=30)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1000:])
    return int(q.stdout.strip())

def decode(src,dst,sr):
    q=subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-ac','1','-ar',str(sr),'-f','f32le','-acodec','pcm_f32le',str(dst)],text=True,capture_output=True,timeout=180)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1200:])

def run(node,runner,raw,sr,name):
    t=time.perf_counter()
    q=subprocess.run([node,str(runner),str(raw),str(sr),'1',name],text=True,capture_output=True,timeout=180)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1200:])
    return json.loads(q.stdout), time.perf_counter()-t

def canonical(x):
    y=copy.deepcopy(x); y.pop('tactusCandidates',None); return y

def read_bpm(p):
    s=p.read_text(errors='ignore').strip().split()
    if not s: raise RuntimeError('empty-bpm-annotation')
    v=float(s[0])
    if not (20.0 <= v <= 400.0): raise RuntimeError(f'invalid-reference-bpm:{v}')
    return v

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

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--audio-root',type=Path,required=True)
    ap.add_argument('--annotations-root',type=Path,required=True)
    ap.add_argument('--baseline-runner',type=Path,required=True)
    ap.add_argument('--dev-runner',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--node',default='node')
    a=ap.parse_args(); a.output.mkdir(parents=True,exist_ok=True)

    audio={p.stem:p for p in a.audio_root.rglob('*') if p.is_file() and p.suffix.lower() in AUDIO_EXTS}
    anns={p.stem:p for p in a.annotations_root.rglob('*.bpm')}
    rows=[]; errors=[]; inv=[]
    all_ids=sorted(set(audio)|set(anns))
    for n,stem in enumerate(all_ids,1):
        src=audio.get(stem); bp=anns.get(stem)
        if src is None or bp is None:
            errors.append({'track':stem,'error':'audio-not-found' if src is None else 'annotation-not-found'}); continue
        try:
            rb=read_bpm(bp); sr=probe_sr(src)
            with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
            try:
                decode(src,raw,sr)
                base,tb=run(a.node,a.baseline_runner,raw,sr,stem)
                dev,td=run(a.node,a.dev_runner,raw,sr,stem)
            finally: raw.unlink(missing_ok=True)
            ok=canonical(base)==canonical(dev)
            if not ok: inv.append(stem)
            bc=base.get('tactusCandidates') or []; dc=dev.get('tactusCandidates') or []
            br=match_rank(bc,rb); dr=match_rank(dc,rb); sel=float(base.get('bpm') or 0)
            rows.append({
                'track':stem,'reference_bpm':rb,'selected_bpm':sel,
                'reference_relation_to_selected':relation(sel,rb),
                'canonical_invariant':ok,
                'baseline_reference_rank':br or '', 'dev_reference_rank':dr or '',
                'baseline_reference_recalled':br is not None,'dev_reference_recalled':dr is not None,
                'baseline_candidate_count':len(bc),'dev_candidate_count':len(dc),
                'new_triple_relation_count':sum(c.get('relationToSource') in ('one-third','triple') for c in dc),
                'baseline_runtime_s':round(tb,6),'dev_runtime_s':round(td,6),
                'runtime_ratio':round(td/max(tb,1e-9),6),
                'timing_tier_baseline':(base.get('timingGuardrail') or {}).get('tier'),
                'timing_tier_dev':(dev.get('timingGuardrail') or {}).get('tier')
            })
        except Exception as e:
            errors.append({'track':stem,'error':str(e)})
        if n%50==0:
            print(json.dumps({'processed':n,'rows':len(rows),'errors':len(errors),'invariance_failures':len(inv)}),flush=True)

    fields=list(rows[0].keys()) if rows else []
    with (a.output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
    (a.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    (a.output/'invariance_failures.json').write_text(json.dumps(inv,indent=2)+'\n')

    improved=[r for r in rows if not r['baseline_reference_recalled'] and r['dev_reference_recalled']]
    regressed=[r for r in rows if r['baseline_reference_recalled'] and not r['dev_reference_recalled']]
    triple=[r for r in rows if r['reference_relation_to_selected'] in ('one-third','triple')]
    ratios=[r['runtime_ratio'] for r in rows]
    rels={}
    for rel in sorted(set(r['reference_relation_to_selected'] for r in rows)):
        rr=[r for r in rows if r['reference_relation_to_selected']==rel]
        rels[str(rel)]={
            'tracks':len(rr),
            'baseline_reference_recall':sum(bool(r['baseline_reference_recalled']) for r in rr),
            'dev_reference_recall':sum(bool(r['dev_reference_recalled']) for r in rr),
            'improvements':sum((not r['baseline_reference_recalled']) and r['dev_reference_recalled'] for r in rr),
            'regressions':sum(r['baseline_reference_recalled'] and (not r['dev_reference_recalled']) for r in rr)
        }
    s={
        'corpus':'GiantSteps tempo dataset full 664',
        'tracks_discovered':len(audio),'annotations_discovered':len(anns),'tracks_analyzed':len(rows),
        'errors':len(errors),'canonical_invariance_passed':not inv,'canonical_invariance_failures':len(inv),
        'baseline_reference_recall':sum(bool(r['baseline_reference_recalled']) for r in rows),
        'dev_reference_recall':sum(bool(r['dev_reference_recalled']) for r in rows),
        'reference_recall_improvements':len(improved),'reference_recall_regressions':len(regressed),
        'triple_family_reference_tracks':len(triple),
        'triple_family_baseline_recall':sum(bool(r['baseline_reference_recalled']) for r in triple),
        'triple_family_dev_recall':sum(bool(r['dev_reference_recalled']) for r in triple),
        'timing_tier_changes':sum(r['timing_tier_baseline']!=r['timing_tier_dev'] for r in rows),
        'mean_runtime_ratio':sum(ratios)/max(1,len(ratios)),'max_runtime_ratio':max(ratios) if ratios else None,
        'by_reference_relation':rels,
        'improved_tracks':[r['track'] for r in improved], 'regressed_tracks':[r['track'] for r in regressed]
    }
    (a.output/'summary.json').write_text(json.dumps(s,indent=2)+'\n'); print(json.dumps(s,indent=2))
    if len(audio)!=664: raise SystemExit(f'FAIL-CLOSED: expected 664 audio files, got {len(audio)}')
    if len(anns)!=664: raise SystemExit(f'FAIL-CLOSED: expected 664 annotations, got {len(anns)}')
    if len(rows)!=664: raise SystemExit(f'FAIL-CLOSED: expected 664 analyzed tracks, got {len(rows)}')
    if errors: raise SystemExit(f'FAIL-CLOSED: {len(errors)} processing/mapping errors')
    if inv: raise SystemExit(f'FAIL-CLOSED: {len(inv)} canonical invariance failures')
    if regressed: raise SystemExit(f'FAIL-CLOSED: {len(regressed)} reference-recall regressions')
    if s['timing_tier_changes']: raise SystemExit(f"FAIL-CLOSED: {s['timing_tier_changes']} timing-tier changes")

if __name__=='__main__': main()
