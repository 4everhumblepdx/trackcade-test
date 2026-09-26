#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,json,math
from pathlib import Path

def load_jsons(root,name):
    return [(p,json.loads(p.read_text())) for p in sorted(root.rglob(name))]
def truth(x): return str(x).strip().lower() in {'true','1','yes'}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--shards-root',type=Path,required=True);ap.add_argument('--holdout-json',type=Path,required=True);ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    expected=json.loads(args.holdout_json.read_text())
    if len(expected)!=100 or len({r['maestro_audio_filename'] for r in expected})!=100: raise SystemExit('FAIL-CLOSED: frozen holdout denominator drift')
    expected_tracks={r['midi_performance'] for r in expected};rows=[]
    for p in sorted(args.shards_root.rglob('results.csv')):
        with p.open(newline='') as f: rows.extend(csv.DictReader(f))
    errors=[]
    for _,x in load_jsons(args.shards_root,'errors.json'): errors.extend(x)
    inv=[]
    for _,x in load_jsons(args.shards_root,'invariance_failures.json'): inv.extend(x)
    shard_summaries=[x for _,x in load_jsons(args.shards_root,'summary.json')]
    seen={r['track'] for r in rows}
    if seen!=expected_tracks or errors or inv: raise SystemExit(f'FAIL-CLOSED: integrity tracks={len(seen)} expected={len(expected_tracks)} errors={len(errors)} invariance={len(inv)}')
    numeric=('selected_f1_70','half_f1_70','half_minus_selected_f1','delta_g2_periodicity','delta_g3_periodicity','selected_beatCount','half_beatCount','selected_g2_windows','half_g2_windows','selected_g3_windows','half_g3_windows')
    for r in rows:
        r['trigger_bool']=truth(r.get('trigger'));r['raw_pair_bool']=truth(r.get('raw_pair_match'))
        for k in numeric:
            try:r[k]=float(r[k])
            except:r[k]=float('nan')
    trig=[r for r in rows if r['trigger_bool']];raw=[r for r in rows if r['raw_pair_bool']]
    deltas=[r['half_minus_selected_f1'] for r in trig if math.isfinite(r['half_minus_selected_f1'])]
    raw_deltas=[r['half_minus_selected_f1'] for r in raw if math.isfinite(r['half_minus_selected_f1'])]
    large_helps=sum(d>=.20 for d in deltas);large_hurts=sum(d<=-.20 for d in deltas);worst=min(deltas) if deltas else None;best=max(deltas) if deltas else None;mean=sum(deltas)/len(deltas) if deltas else None
    if len(trig)<2: status='inconclusive_fewer_than_2_triggers'
    elif large_hurts: status='reject_large_hurt'
    elif worst is not None and worst<-.10: status='reject_substantial_regression'
    elif mean is None or mean<=0: status='reject_nonpositive_trigger_mean'
    elif large_helps<1: status='safe_but_not_useful'
    else: status='holdout_pass'
    terminal='proceed_broad_shadow_regression' if status=='holdout_pass' else 'stop_deterministic_phase_selector_v020_keep_v019'
    outrows=[]
    for r in rows:
        x=dict(r);x.pop('trigger_bool',None);x.pop('raw_pair_bool',None);outrows.append(x)
    fields=sorted({k for r in outrows for k in r})
    with (args.output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(outrows)
    (args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n');(args.output/'invariance_failures.json').write_text(json.dumps(inv,indent=2)+'\n');(args.output/'shard_summaries.json').write_text(json.dumps(shard_summaries,indent=2)+'\n')
    summary={
      'corpus':'ASAP v1.2 / MAESTRO v2.0.0 frozen V1-disjoint selector-v2 terminal holdout','selected_performances':100,'analyzed_performances':len(seen),'segments':len(rows),'errors':len(errors),'canonical_invariance_failures':len(inv),
      'raw_cross_periodicity_matches':len(raw),'raw_pair_worst_delta_f1_70':min(raw_deltas) if raw_deltas else None,
      'triggers':len(trig),'large_helps':large_helps,'large_hurts':large_hurts,'small_negative_triggers':sum(-.20<d<0 for d in deltas),'best_trigger_delta_f1_70':best,'worst_trigger_delta_f1_70':worst,'mean_trigger_delta_f1_70':mean,'sum_trigger_delta_f1_70':sum(deltas) if deltas else 0,
      'status':status,'terminal_decision':terminal,
      'criteria':{'min_triggers_for_conclusion':2,'reject_large_hurt_at_or_below':-.20,'reject_worst_below':-.10,'require_positive_mean':True,'require_large_help_at_or_above':.20},
      'selector_rule':{'delta_g2_periodicity_max':-.18,'delta_g3_periodicity_min':.12,'min_windows_each':4,'min_beats_each':32},
      'trigger_rows':[{'track':r['track'],'segment':int(r['segment']),'delta_f1_70':r['half_minus_selected_f1'],'selected_f1_70':r['selected_f1_70'],'half_f1_70':r['half_f1_70'],'delta_g2_periodicity':r['delta_g2_periodicity'],'delta_g3_periodicity':r['delta_g3_periodicity'],'selected_beatCount':int(r['selected_beatCount']),'half_beatCount':int(r['half_beatCount']),'selected_g2_windows':int(r['selected_g2_windows']),'half_g2_windows':int(r['half_g2_windows']),'selected_g3_windows':int(r['selected_g3_windows']),'half_g3_windows':int(r['half_g3_windows'])} for r in trig]
    }
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
