#!/usr/bin/env python3
"""Evaluate the descriptive 1/3x + 3x tactus patch on real beat-annotated audio.

This evaluator is deliberately diagnostic-only. It compares exact-v0.18 against
v0.18 plus the already-frozen descriptive triple patch, requires canonical output
invariance, and measures whether tactus-candidate coverage of annotation-derived
reference tempo changes.
"""
import argparse
import copy
import csv
import json
import statistics
import subprocess
import tempfile
import time
from pathlib import Path

AUDIO_EXTS={'.flac','.wav','.mp3','.ogg','.m4a'}


def probe_sample_rate(path: Path) -> int:
    q=subprocess.run([
        'ffprobe','-v','error','-select_streams','a:0',
        '-show_entries','stream=sample_rate','-of','default=nw=1:nk=1',str(path)
    ],text=True,capture_output=True,timeout=30)
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-1000:])
    return int(q.stdout.strip())


def decode_f32(path: Path, dst: Path, sr: int):
    q=subprocess.run([
        'ffmpeg','-v','error','-y','-i',str(path),'-ac','1','-ar',str(sr),
        '-f','f32le','-acodec','pcm_f32le',str(dst)
    ],text=True,capture_output=True,timeout=180)
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-1200:])


def run_runner(node, runner, raw, sr, name):
    t0=time.perf_counter()
    q=subprocess.run([node,str(runner),str(raw),str(sr),'1',name],text=True,capture_output=True,timeout=180)
    elapsed=time.perf_counter()-t0
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-1200:])
    return json.loads(q.stdout),elapsed


def canonical_without_tactus(js):
    x=copy.deepcopy(js)
    x.pop('tactusCandidates',None)
    return x


def read_beats(path: Path):
    vals=[]
    for line in path.read_text(errors='ignore').splitlines():
        try: vals.append(float(line.strip().split()[0]))
        except Exception: pass
    return sorted(v for v in vals if v>=0)


def ref_bpm_from_beats(times):
    diffs=[b-a for a,b in zip(times,times[1:]) if 0.15 <= b-a <= 2.0]
    if len(diffs)<8: return None
    return 60.0/statistics.median(diffs)


def match_rank(cands,bpm,tol=.04):
    if not bpm or bpm<=0: return None
    for i,c in enumerate(cands,1):
        cb=float(c.get('bpm') or 0)
        if cb>0 and abs(cb-bpm)/bpm <= tol: return i
    return None


def relation_to_reference(selected, reference):
    if not selected or not reference: return None
    ratio=reference/selected
    families=[('one-third',1/3),('half',1/2),('two-thirds',2/3),('same',1),('three-halves',1.5),('double',2),('triple',3)]
    name,target=min(families,key=lambda x: abs(ratio-x[1])/x[1])
    err=abs(ratio-target)/target
    return name if err<=.06 else 'other'


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--audio-root',type=Path,required=True)
    ap.add_argument('--beats-root',type=Path,required=True)
    ap.add_argument('--baseline-runner',type=Path,required=True)
    ap.add_argument('--dev-runner',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--node',default='node')
    args=ap.parse_args(); args.output.mkdir(parents=True,exist_ok=True)

    audio={p.stem:p for p in args.audio_root.rglob('*') if p.is_file() and p.suffix.lower() in AUDIO_EXTS}
    beat_files=sorted(args.beats_root.glob('*.beats'))
    rows=[]; errors=[]; invariant_failures=[]
    for n,bp in enumerate(beat_files,1):
        stem=bp.stem; src=audio.get(stem)
        if not src:
            errors.append({'track':stem,'error':'audio-not-found'}); continue
        try:
            beats=read_beats(bp); ref=ref_bpm_from_beats(beats)
            if ref is None: raise RuntimeError('insufficient-valid-beat-intervals')
            sr=probe_sample_rate(src)
            with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
            try:
                decode_f32(src,raw,sr)
                base,tb=run_runner(args.node,args.baseline_runner,raw,sr,stem)
                dev,td=run_runner(args.node,args.dev_runner,raw,sr,stem)
            finally:
                raw.unlink(missing_ok=True)
            invariant=canonical_without_tactus(base)==canonical_without_tactus(dev)
            if not invariant: invariant_failures.append(stem)
            bc=base.get('tactusCandidates') or []; dc=dev.get('tactusCandidates') or []
            br=match_rank(bc,ref); dr=match_rank(dc,ref)
            new_rel=[c for c in dc if c.get('relationToSource') in ('one-third','triple')]
            rows.append({
                'track':stem,'reference_bpm':round(ref,6),
                'selected_bpm':base.get('bpm'),
                'reference_relation_to_selected':relation_to_reference(float(base.get('bpm') or 0),ref),
                'canonical_invariant':invariant,
                'baseline_reference_rank':br or '', 'dev_reference_rank':dr or '',
                'baseline_reference_recalled':br is not None,'dev_reference_recalled':dr is not None,
                'baseline_candidate_count':len(bc),'dev_candidate_count':len(dc),
                'new_triple_relation_count':len(new_rel),
                'baseline_runtime_s':round(tb,6),'dev_runtime_s':round(td,6),
                'runtime_ratio':round(td/max(tb,1e-9),6),
                'timing_tier_baseline':(base.get('timingGuardrail') or {}).get('tier'),
                'timing_tier_dev':(dev.get('timingGuardrail') or {}).get('tier'),
            })
        except Exception as e:
            errors.append({'track':stem,'error':str(e)})
        if n%5==0: print(json.dumps({'processed':n,'rows':len(rows),'errors':len(errors),'invariance_failures':len(invariant_failures)}),flush=True)

    fields=list(rows[0].keys()) if rows else []
    with (args.output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
    (args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    (args.output/'invariance_failures.json').write_text(json.dumps(invariant_failures,indent=2)+'\n')

    improved=[r for r in rows if not r['baseline_reference_recalled'] and r['dev_reference_recalled']]
    regressed=[r for r in rows if r['baseline_reference_recalled'] and not r['dev_reference_recalled']]
    triple_family=[r for r in rows if r['reference_relation_to_selected'] in ('one-third','triple')]
    ratios=[r['runtime_ratio'] for r in rows]
    summary={
        'corpus':'Candombe ISMIR2015 full performances',
        'tracks_discovered':len(beat_files),'tracks_analyzed':len(rows),'errors':len(errors),
        'canonical_invariance_passed':len(invariant_failures)==0,
        'canonical_invariance_failures':len(invariant_failures),
        'baseline_reference_recall':sum(bool(r['baseline_reference_recalled']) for r in rows),
        'dev_reference_recall':sum(bool(r['dev_reference_recalled']) for r in rows),
        'reference_recall_improvements':len(improved),'reference_recall_regressions':len(regressed),
        'triple_family_reference_tracks':len(triple_family),
        'triple_family_baseline_recall':sum(bool(r['baseline_reference_recalled']) for r in triple_family),
        'triple_family_dev_recall':sum(bool(r['dev_reference_recalled']) for r in triple_family),
        'timing_tier_changes':sum(r['timing_tier_baseline']!=r['timing_tier_dev'] for r in rows),
        'mean_runtime_ratio':sum(ratios)/max(1,len(ratios)),
        'max_runtime_ratio':max(ratios) if ratios else None,
        'improved_tracks':[r['track'] for r in improved],
        'regressed_tracks':[r['track'] for r in regressed],
    }
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
    if len(rows)<30: raise SystemExit(f'FAIL-CLOSED: only {len(rows)} tracks analyzed')
    if invariant_failures: raise SystemExit(f'FAIL-CLOSED: {len(invariant_failures)} canonical invariance failures')
    if regressed: raise SystemExit(f'FAIL-CLOSED: {len(regressed)} reference-recall regressions')
    if summary['timing_tier_changes']:
        raise SystemExit(f"FAIL-CLOSED: {summary['timing_tier_changes']} timing-tier changes")

if __name__=='__main__': main()
