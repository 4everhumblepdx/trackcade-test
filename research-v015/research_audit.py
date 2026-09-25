#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,json
from pathlib import Path

RATIOS={
 'direct':1.0,'half':0.5,'double':2.0,'two_thirds':2/3,'three_halves':1.5,
 'three_fourths':0.75,'four_thirds':4/3,'four_fifths':0.8,'five_fourths':1.25,
 'three_fifths':0.6,'five_thirds':5/3,
}

def rel(a,b): return abs(a-b)/b if b else 999

def octave_err(pred,ref):
    return min(rel(pred,ref),rel(pred*2,ref),rel(pred/2,ref))

def fam(pred,ref):
    ratio=pred/ref
    best=min(RATIOS.items(), key=lambda kv:abs(ratio-kv[1]))
    return best[0],ratio,abs(ratio-best[1])

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--manifest',type=Path,required=True); ap.add_argument('--full-dir',type=Path,required=True); ap.add_argument('--out',type=Path,required=True); args=ap.parse_args()
    refs={r['track_id']:float(r['reference_bpm']) for r in csv.DictReader(args.manifest.open())}
    rows=[]
    for p in sorted(args.full_dir.glob('*.json')):
        d=json.loads(p.read_text()); tid=p.name.split('-')[0]; ref=refs.get(tid)
        if ref is None: continue
        pred=float(d['bpm']); research=(d.get('timingDiagnostics') or {}).get('researchMetricalCandidates') or []
        top=research[0] if research else None
        closest=min(research,key=lambda c:rel(float(c['bpm']),ref),default=None)
        visible=closest is not None and rel(float(closest['bpm']),ref)<=.04
        top_ok=top is not None and rel(float(top['bpm']),ref)<=.04
        relation,ratio,ratio_resid=fam(pred,ref)
        rows.append({
            'track_id':tid,'reference_bpm':ref,'baseline_bpm':pred,'baseline_direct_error':rel(pred,ref),'baseline_octave_error':octave_err(pred,ref),
            'baseline_family':relation,'baseline_ratio':ratio,'baseline_ratio_residual':ratio_resid,
            'top_research_bpm':float(top['bpm']) if top else None,'top_research_score':float(top['score']) if top else None,'top_research_direct_ok':top_ok,
            'closest_research_bpm':float(closest['bpm']) if closest else None,'closest_research_score':float(closest['score']) if closest else None,
            'closest_research_rank':(research.index(closest)+1) if closest else None,'reference_visible_in_research':visible,
            'research_count':len(research),
        })
    n=len(rows)
    base_direct=sum(r['baseline_direct_error']<=.04 for r in rows)
    base_oct=sum(r['baseline_octave_error']<=.04 for r in rows)
    miss=[r for r in rows if r['baseline_octave_error']>.04]
    visible=sum(r['reference_visible_in_research'] for r in miss)
    top_direct=sum(r['top_research_direct_ok'] for r in rows)
    famcounts={}
    for r in rows: famcounts[r['baseline_family']]=famcounts.get(r['baseline_family'],0)+1
    summary={
      'tracks':n,
      'baseline_direct_within_4pct':base_direct,
      'baseline_octave_tolerant_within_4pct':base_oct,
      'baseline_true_misses':len(miss),
      'true_miss_reference_visible_in_expanded_candidates':visible,
      'true_miss_candidate_visibility_rate':round(visible/max(1,len(miss)),4),
      'top_research_candidate_direct_within_4pct':top_direct,
      'baseline_family_counts':dict(sorted(famcounts.items())),
      'misses':[r for r in rows if r['baseline_octave_error']>.04],
    }
    args.out.parent.mkdir(parents=True,exist_ok=True); args.out.write_text(json.dumps(summary,indent=2)+'\n')
    csvp=args.out.with_suffix('.csv')
    with csvp.open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else []); w.writeheader(); w.writerows(rows)
    print(json.dumps({k:v for k,v in summary.items() if k!='misses'},indent=2))

if __name__=='__main__': main()
