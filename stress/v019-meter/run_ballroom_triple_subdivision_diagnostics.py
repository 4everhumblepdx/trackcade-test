#!/usr/bin/env python3
"""Development-only Ballroom study for 3x subbeat-occupancy evidence.

Uses every Waltz/VienneseWaltz track plus an equal deterministic non-waltz
control cohort. Dumps one row per diagnostic 3x tactus candidate. No selector
is implemented here and no candidate can alter canonical output.
"""
import argparse, copy, csv, hashlib, json, statistics, subprocess, tempfile, time
from pathlib import Path

AUDIO_EXTS={'.wav','.mp3','.flac','.ogg','.m4a'}
TOL=0.04

def probe_sr(path):
    q=subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate','-of','default=nw=1:nk=1',str(path)],text=True,capture_output=True,timeout=30)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1000:])
    return int(q.stdout.strip())

def decode(src,dst,sr):
    q=subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-ac','1','-ar',str(sr),'-f','f32le','-acodec','pcm_f32le',str(dst)],text=True,capture_output=True,timeout=180)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1200:])

def run(node,runner,raw,sr,name):
    started=time.perf_counter()
    q=subprocess.run([node,str(runner),str(raw),str(sr),'1',name],text=True,capture_output=True,timeout=180)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1800:])
    return json.loads(q.stdout), time.perf_counter()-started

def canonical(result):
    x=copy.deepcopy(result); x.pop('tactusCandidates',None); return x

def read_beats(path):
    out=[]
    for line in path.read_text(errors='ignore').splitlines():
        try: out.append(float(line.split()[0]))
        except Exception: pass
    return sorted(v for v in out if v>=0)

def ref_bpm(times):
    ints=[b-a for a,b in zip(times,times[1:]) if 0.15<=b-a<=2.0]
    return None if len(ints)<8 else 60.0/statistics.median(ints)

def close(a,b,tol=TOL):
    return bool(a and b and abs(a-b)/max(1.0,b)<=tol)

def genre(path):
    for raw in path.parts:
        norm=raw.lower().replace(' ','').replace('_','')
        if 'viennesewaltz' in norm: return 'VienneseWaltz'
        if norm in ('waltz','slowwaltz') or 'slowwaltz' in norm: return 'Waltz'
    return 'other'

def controls(items,count):
    return sorted(items,key=lambda x:(hashlib.sha256(x[0].encode()).hexdigest(),x[0]))[:count]

def relation(selected,reference):
    if not selected or not reference: return ''
    ratio=reference/selected
    fam=[('one-third',1/3),('half',.5),('two-thirds',2/3),('same',1),('three-halves',1.5),('double',2),('triple',3)]
    name,target=min(fam,key=lambda p:abs(ratio-p[1])/p[1])
    return name if abs(ratio-target)/target<=.06 else 'other'

def layer(sub,name):
    for row in sub.get('layers') or []:
        if row.get('name')==name: return row
    return {}

def numstats(rows,key):
    vals=[]
    for r in rows:
        try: vals.append(float(r[key]))
        except Exception: pass
    if not vals: return {'n':0,'mean':None,'median':None,'p10':None,'p90':None}
    vals=sorted(vals)
    def pct(p):
        if len(vals)==1:return vals[0]
        i=(len(vals)-1)*p; lo=int(i); hi=min(len(vals)-1,lo+1); f=i-lo
        return vals[lo]*(1-f)+vals[hi]*f
    return {'n':len(vals),'mean':sum(vals)/len(vals),'median':statistics.median(vals),'p10':pct(.1),'p90':pct(.9)}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--audio-root',type=Path,required=True); ap.add_argument('--annotations-root',type=Path,required=True)
    ap.add_argument('--baseline-runner',type=Path,required=True); ap.add_argument('--dev-runner',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True); ap.add_argument('--node',default='node')
    args=ap.parse_args(); args.output.mkdir(parents=True,exist_ok=True)

    audio=[(p.stem,p) for p in args.audio_root.rglob('*') if p.is_file() and p.suffix.lower() in AUDIO_EXTS]
    anns={p.stem:p for p in args.annotations_root.rglob('*.beats')}
    w=sorted([(s,p) for s,p in audio if genre(p) in {'Waltz','VienneseWaltz'}])
    nw=[(s,p) for s,p in audio if genre(p) not in {'Waltz','VienneseWaltz'}]
    if len(w)!=175: raise SystemExit(f'FAIL-CLOSED: expected 175 waltzes, found {len(w)}')
    c=controls(nw,175)
    if len(c)!=175: raise SystemExit(f'FAIL-CLOSED: expected 175 controls, found {len(c)}')
    cohort=[(s,p,'waltz') for s,p in w]+[(s,p,'control') for s,p in c]

    tracks=[]; candidates=[]; errors=[]; invariance=[]
    for idx,(stem,src,cohort_name) in enumerate(cohort,1):
        ann=anns.get(stem)
        if not ann: errors.append({'track':stem,'error':'annotation-not-found'}); continue
        try:
            reference=ref_bpm(read_beats(ann))
            if reference is None: raise RuntimeError('insufficient-valid-beat-intervals')
            sr=probe_sr(src)
            with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
            try:
                decode(src,raw,sr); base,bt=run(args.node,args.baseline_runner,raw,sr,stem); dev,dt=run(args.node,args.dev_runner,raw,sr,stem)
            finally: raw.unlink(missing_ok=True)
            inv=canonical(base)==canonical(dev)
            if not inv: invariance.append(stem)
            sbpm=float(base.get('bpm') or 0); bcorrect=close(sbpm,reference)
            tierb=(base.get('timingGuardrail') or {}).get('tier'); tierd=(dev.get('timingGuardrail') or {}).get('tier')
            triples=[]
            for cand in dev.get('tactusCandidates') or []:
                cf=cand.get('counterfactualMeter') or {}; sub=cf.get('tripleSubdivision') or {}
                if cand.get('relationToSource')!='triple' or not sub: continue
                amp=layer(sub,'amplitude'); low=layer(sub,'low'); mid=layer(sub,'mid'); hybrid=layer(sub,'hybrid')
                cbpm=float(cand.get('bpm') or 0); ccorrect=close(cbpm,reference)
                row={
                    'track':stem,'cohort':cohort_name,'genre':genre(src),'reference_bpm':round(reference,6),'selected_bpm':sbpm,
                    'reference_relation_to_selected':relation(sbpm,reference),'baseline_reference_correct':bcorrect,
                    'candidate_bpm':cbpm,'candidate_reference_correct':ccorrect,'candidate_rescue':(not bcorrect and ccorrect),
                    'candidate_confidence':cand.get('confidence',''),'candidate_correlation_support':cand.get('correlationSupport',''),
                    'candidate_phase_coherence':cand.get('phaseCoherence',''),'candidate_source_bpm':cand.get('sourceBpm',''),
                    'candidate_ratio_to_primary':cand.get('ratioToPrimary',''),'candidate_independent_layer_count':cand.get('independentLayerCount',''),
                    'cf_grid_support':cf.get('gridSupport',''),'cf_phase_coherence':cf.get('phaseCoherence',''),'cf_beat_coverage':cf.get('beatCoverage',''),
                    'cf_timing_confidence':cf.get('timingConfidence',''),'cf_meter':cf.get('beatsPerBar',''),'cf_meter_confidence':cf.get('meterConfidence',''),
                    'cf_meter_ambiguity':cf.get('meterAmbiguity',''),'cf_triple_advantage':cf.get('tripleFamilyAdvantage',''),
                    'sub_source_grid_support':sub.get('sourceGridSupport',''),'sub_interval_count':sub.get('intervalCount',''),
                    'sub_anchor_coverage':sub.get('anchorCoverage',''),'sub_inner_coverage':sub.get('innerCoverage',''),'sub_paired_coverage':sub.get('pairedCoverage',''),
                    'sub_inner_to_anchor_strength':sub.get('innerToAnchorStrength',''),'sub_window_mean_paired':sub.get('windowMeanPairedCoverage',''),
                    'sub_window_min_paired':sub.get('windowMinPairedCoverage',''),'sub_window_std_paired':sub.get('windowStdPairedCoverage',''),
                    'amp_paired':amp.get('pairedCoverage',''),'amp_ratio':amp.get('innerToAnchorStrength',''),'low_paired':low.get('pairedCoverage',''),
                    'low_ratio':low.get('innerToAnchorStrength',''),'mid_paired':mid.get('pairedCoverage',''),'mid_ratio':mid.get('innerToAnchorStrength',''),
                    'hybrid_paired':hybrid.get('pairedCoverage',''),'hybrid_ratio':hybrid.get('innerToAnchorStrength',''),
                }
                candidates.append(row); triples.append(row)
            tracks.append({'track':stem,'cohort':cohort_name,'genre':genre(src),'reference_bpm':round(reference,6),'selected_bpm':sbpm,
                           'reference_relation_to_selected':relation(sbpm,reference),'baseline_reference_correct':bcorrect,'triple_candidate_rows':len(triples),
                           'canonical_invariant':inv,'timing_tier_baseline':tierb,'timing_tier_dev':tierd,'runtime_ratio':dt/max(bt,1e-9)})
        except Exception as exc: errors.append({'track':stem,'error':str(exc)})
        if idx%25==0: print(json.dumps({'processed':idx,'tracks':len(tracks),'candidate_rows':len(candidates),'errors':len(errors),'invariance':len(invariance)}),flush=True)

    for name,rows in [('tracks.csv',tracks),('candidates.csv',candidates)]:
        fields=list(rows[0].keys()) if rows else []
        with (args.output/name).open('w',newline='') as f:
            wr=csv.DictWriter(f,fieldnames=fields); wr.writeheader(); wr.writerows(rows)
    (args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n'); (args.output/'invariance_failures.json').write_text(json.dumps(invariance,indent=2)+'\n')
    pos=[r for r in candidates if r['candidate_reference_correct']]; neg=[r for r in candidates if not r['candidate_reference_correct']]
    rescue=[r for r in candidates if r['candidate_rescue']]
    features=['candidate_confidence','cf_grid_support','cf_phase_coherence','cf_triple_advantage','sub_anchor_coverage','sub_inner_coverage','sub_paired_coverage','sub_inner_to_anchor_strength','sub_window_min_paired','sub_window_std_paired','low_paired','low_ratio','amp_paired','amp_ratio']
    summary={
        'study':'Ballroom 3x subbeat-occupancy diagnostics development cohort','status':'diagnostic-only; no selector; GTZAN not used for tuning',
        'tracks_expected':350,'tracks_analyzed':len(tracks),'errors':len(errors),'canonical_invariance_failures':len(invariance),
        'timing_tier_changes':sum(r['timing_tier_baseline']!=r['timing_tier_dev'] for r in tracks),
        'candidate_rows':len(candidates),'candidate_reference_correct_rows':len(pos),'candidate_reference_wrong_rows':len(neg),
        'candidate_rescue_rows':len(rescue),'candidate_rescue_tracks':len({r['track'] for r in rescue}),
        'reference_triple_tracks':sum(r['reference_relation_to_selected']=='triple' for r in tracks),
        'feature_stats':{f:{'correct':numstats(pos,f),'wrong':numstats(neg,f)} for f in features},
    }
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n'); print(json.dumps(summary,indent=2))
    if len(tracks)!=350: raise SystemExit(f'FAIL-CLOSED: expected 350 analyzed, got {len(tracks)}')
    if errors: raise SystemExit(f'FAIL-CLOSED: {len(errors)} errors')
    if invariance: raise SystemExit(f'FAIL-CLOSED: {len(invariance)} invariance failures')
    if summary['timing_tier_changes']: raise SystemExit(f"FAIL-CLOSED: {summary['timing_tier_changes']} tier changes")

if __name__=='__main__': main()
