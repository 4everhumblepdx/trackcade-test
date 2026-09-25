#!/usr/bin/env python3
import argparse
import copy
import csv
import json
import struct
import subprocess
import tempfile
import time
import wave
from pathlib import Path


def wav_to_f32(src: Path, dst: Path):
    with wave.open(str(src),'rb') as w:
        assert w.getnchannels()==1 and w.getsampwidth()==2
        sr=w.getframerate(); raw=w.readframes(w.getnframes())
    vals=struct.unpack('<'+'h'*(len(raw)//2),raw)
    with dst.open('wb') as f:
        for v in vals: f.write(struct.pack('<f',v/32768.0))
    return sr


def run_runner(node, runner, raw, sr, name):
    t0=time.perf_counter()
    q=subprocess.run([node,str(runner),str(raw),str(sr),'1',name],text=True,capture_output=True,timeout=90)
    elapsed=time.perf_counter()-t0
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-1200:])
    return json.loads(q.stdout),elapsed


def canonical_without_tactus(js):
    x=copy.deepcopy(js)
    x.pop('tactusCandidates',None)
    return x


def match_rank(cands, bpm, tol=.04):
    for i,c in enumerate(cands,1):
        cb=float(c.get('bpm') or 0)
        if cb>0 and abs(cb-bpm)/bpm <= tol:
            return i
    return None


def strong_count(cands, threshold=.60):
    return sum(float(c.get('confidence') or 0)>=threshold for c in cands)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--corpus',type=Path,required=True)
    ap.add_argument('--baseline-runner',type=Path,required=True)
    ap.add_argument('--dev-runner',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--node',default='node')
    args=ap.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((args.corpus/'manifest.json').read_text())
    rows=[]; errors=[]; invariant_failures=[]
    for n,item in enumerate(manifest,1):
        wav=args.corpus/item['file']
        with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
        try:
            sr=wav_to_f32(wav,raw)
            base,tb=run_runner(args.node,args.baseline_runner,raw,sr,item['file'])
            dev,td=run_runner(args.node,args.dev_runner,raw,sr,item['file'])
            invariant=canonical_without_tactus(base)==canonical_without_tactus(dev)
            if not invariant:
                invariant_failures.append(item['file'])
            bc=base.get('tactusCandidates') or []
            dc=dev.get('tactusCandidates') or []
            expected=item['expected_clocks_bpm']
            br=[match_rank(bc,b) for b in expected]
            dr=[match_rank(dc,b) for b in expected]
            new_rel=[c for c in dc if c.get('relationToSource') in ('one-third','triple')]
            rows.append({
                'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],
                'clock_a_bpm':expected[0],'clock_b_bpm':expected[1],
                'baseline_selected_bpm':base.get('bpm'),'dev_selected_bpm':dev.get('bpm'),
                'canonical_invariant':invariant,
                'baseline_rank_a':br[0] or '','baseline_rank_b':br[1] or '',
                'dev_rank_a':dr[0] or '','dev_rank_b':dr[1] or '',
                'baseline_recall_both':all(x is not None for x in br),
                'dev_recall_both':all(x is not None for x in dr),
                'baseline_candidate_count':len(bc),'dev_candidate_count':len(dc),
                'baseline_strong_count':strong_count(bc),'dev_strong_count':strong_count(dc),
                'new_triple_relation_count':len(new_rel),
                'baseline_runtime_s':round(tb,6),'dev_runtime_s':round(td,6),
                'runtime_ratio':round(td/max(tb,1e-9),6),
                'timing_tier_baseline':(base.get('timingGuardrail') or {}).get('tier'),
                'timing_tier_dev':(dev.get('timingGuardrail') or {}).get('tier'),
            })
        except Exception as e:
            errors.append({'file':item['file'],'error':str(e)})
        finally:
            raw.unlink(missing_ok=True)
        if n%16==0: print(json.dumps({'processed':n,'errors':len(errors),'invariance_failures':len(invariant_failures)}),flush=True)

    fields=list(rows[0].keys()) if rows else []
    with (args.output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
    (args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    (args.output/'invariance_failures.json').write_text(json.dumps(invariant_failures,indent=2)+'\n')

    triple_rows=[r for r in rows if r['ratio_name'] in ('one-third','triple')]
    nontriple=[r for r in rows if r['ratio_name'] not in ('one-third','triple')]
    ratios=[r['runtime_ratio'] for r in rows]
    summary={
        'corpus':'trackcade-v019-metrical-mirror-v1',
        'tracks_expected':len(manifest),'tracks_analyzed':len(rows),'errors':len(errors),
        'canonical_invariance_passed':len(invariant_failures)==0,
        'canonical_invariance_failures':len(invariant_failures),
        'baseline_recall_both_all':sum(bool(r['baseline_recall_both']) for r in rows),
        'dev_recall_both_all':sum(bool(r['dev_recall_both']) for r in rows),
        'baseline_recall_both_triple_families':sum(bool(r['baseline_recall_both']) for r in triple_rows),
        'dev_recall_both_triple_families':sum(bool(r['dev_recall_both']) for r in triple_rows),
        'triple_family_tracks':len(triple_rows),
        'baseline_recall_both_nontriple':sum(bool(r['baseline_recall_both']) for r in nontriple),
        'dev_recall_both_nontriple':sum(bool(r['dev_recall_both']) for r in nontriple),
        'mean_baseline_candidates':sum(r['baseline_candidate_count'] for r in rows)/max(1,len(rows)),
        'mean_dev_candidates':sum(r['dev_candidate_count'] for r in rows)/max(1,len(rows)),
        'mean_baseline_strong_candidates':sum(r['baseline_strong_count'] for r in rows)/max(1,len(rows)),
        'mean_dev_strong_candidates':sum(r['dev_strong_count'] for r in rows)/max(1,len(rows)),
        'mean_runtime_ratio':sum(ratios)/max(1,len(ratios)),
        'max_runtime_ratio':max(ratios) if ratios else None,
        'timing_tier_changes':sum(r['timing_tier_baseline']!=r['timing_tier_dev'] for r in rows),
    }
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
