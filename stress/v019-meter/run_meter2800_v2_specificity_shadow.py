#!/usr/bin/env python3
import argparse, copy, csv, json, math, subprocess, tempfile, time
from collections import Counter
from pathlib import Path

AUDIO_EXTS={'.wav','.mp3','.flac','.ogg','.m4a'}
RULE={'relation':'triple','cf_phase_coherence_min':0.12,'low_ratio_max':0.75}
EXPECTED_SOURCE_COUNTS={'FMA':230,'MAG':217,'OWN':32}
EXPECTED_INDEPENDENT=479

def num(v,default=None):
    try:
        f=float(v); return f if math.isfinite(f) else default
    except Exception: return default

def probe_sr(p):
    q=subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate','-of','default=nw=1:nk=1',str(p)],text=True,capture_output=True,timeout=30)
    if q.returncode: raise RuntimeError('ffprobe: '+(q.stderr or q.stdout)[-1200:])
    return int(q.stdout.strip())

def decode(src,dst,sr):
    q=subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-ac','1','-ar',str(sr),'-f','f32le','-acodec','pcm_f32le',str(dst)],text=True,capture_output=True,timeout=120)
    if q.returncode: raise RuntimeError('ffmpeg: '+(q.stderr or q.stdout)[-1600:])

def run(node,runner,raw,sr,name):
    t=time.perf_counter(); q=subprocess.run([node,str(runner),str(raw),str(sr),'1',name],text=True,capture_output=True,timeout=120)
    if q.returncode: raise RuntimeError('analyzer: '+(q.stderr or q.stdout)[-1600:])
    return json.loads(q.stdout),time.perf_counter()-t

def canonical(x):
    y=copy.deepcopy(x); y.pop('tactusCandidates',None); return y

def cf(c): return c.get('counterfactualMeter') or {}

def low_ratio(c):
    sub=cf(c).get('tripleSubdivision') or {}
    for layer in sub.get('layers') or []:
        if layer.get('name')=='low': return num(layer.get('innerToAnchorStrength'))
    return None

def fires(c):
    if not c or c.get('relationToSource')!=RULE['relation']: return False
    phase=num(cf(c).get('phaseCoherence')); low=low_ratio(c)
    return bool(phase is not None and low is not None and phase>=RULE['cf_phase_coherence_min'] and low<=RULE['low_ratio_max'])

def source_and_basename(filename):
    rel=filename.strip().lstrip('/'); parts=rel.split('/',1)
    if len(parts)!=2 or parts[0] not in EXPECTED_SOURCE_COUNTS: raise ValueError(f'bad independent filename {filename}')
    return parts[0],Path(parts[1]).name

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--audio-root',type=Path,required=True); ap.add_argument('--labels-csv',type=Path,required=True); ap.add_argument('--baseline-runner',type=Path,required=True); ap.add_argument('--dev-runner',type=Path,required=True); ap.add_argument('--output',type=Path,required=True); ap.add_argument('--node',default='node'); a=ap.parse_args(); a.output.mkdir(parents=True,exist_ok=True)
    with a.labels_csv.open(newline='',encoding='utf-8-sig',errors='replace') as f: all_rows=list(csv.DictReader(f))
    if len(all_rows)!=700: raise SystemExit(f'FAIL-CLOSED labels rows {len(all_rows)} != 700')
    labels=[]; counts=Counter()
    for r in all_rows:
        fn=(r.get('filename') or '').strip(); src=fn.lstrip('/').split('/',1)[0] if '/' in fn.lstrip('/') else ''
        if src=='GTZAN': continue
        if src not in EXPECTED_SOURCE_COUNTS: raise SystemExit(f'FAIL-CLOSED unexpected source {src!r} for {fn!r}')
        labels.append(r); counts[src]+=1
    if len(labels)!=EXPECTED_INDEPENDENT or dict(counts)!=EXPECTED_SOURCE_COUNTS: raise SystemExit(f'FAIL-CLOSED independent denominator={len(labels)} counts={dict(counts)}')
    keys=[source_and_basename(r['filename']) for r in labels]; keyset=set(keys)
    if len(keyset)!=len(keys): raise SystemExit('FAIL-CLOSED duplicate independent source/basename keys')
    audio={}
    for src in EXPECTED_SOURCE_COUNTS:
        roots=[p for p in [a.audio_root/src,a.audio_root/src.lower()] if p.exists()]
        if not roots: raise SystemExit(f'FAIL-CLOSED missing extracted source directory {src}')
        for root in roots:
            for p in root.rglob('*'):
                if not p.is_file() or p.suffix.lower() not in AUDIO_EXTS: continue
                key=(src,p.name)
                if key in keyset:
                    if key in audio and audio[key]!=p: raise SystemExit(f'FAIL-CLOSED duplicate audio for {key}')
                    audio[key]=p
    missing=sorted(keyset-set(audio))
    if missing: raise SystemExit(f'FAIL-CLOSED missing independent audio count={len(missing)} examples={missing[:20]}')
    rows=[]; errors=[]; inv=[]; tiers=[]
    for idx,meta in enumerate(labels,1):
        src,base=source_and_basename(meta['filename']); p=audio[(src,base)]; name=f'{src}/{base}'
        try:
            sr=probe_sr(p)
            with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
            try: decode(p,raw,sr); base_out,tb=run(a.node,a.baseline_runner,raw,sr,name); dev,td=run(a.node,a.dev_runner,raw,sr,name)
            finally: raw.unlink(missing_ok=True)
            invariant=canonical(base_out)==canonical(dev)
            if not invariant: inv.append(name)
            bt=(base_out.get('timingGuardrail') or {}).get('tier'); dt=(dev.get('timingGuardrail') or {}).get('tier')
            if bt!=dt: tiers.append(name)
            cands=[c for c in (dev.get('tactusCandidates') or []) if c.get('relationToSource')=='triple' and cf(c).get('tripleSubdivision')]
            passing=[c for c in cands if fires(c)]; unique=passing[0] if len(passing)==1 else None; meter=str(meta.get('meter') or '').strip()
            rows.append({'filename':meta['filename'],'source':src,'meter':meter,'passing_candidate_count':len(passing),'shadow_trigger':bool(unique),'ambiguous_suppressed':len(passing)>1,'shadow_candidate_bpm':num(unique.get('bpm')) if unique else '','shadow_candidate_confidence':num(unique.get('confidence')) if unique else '','shadow_phase_coherence':num(cf(unique).get('phaseCoherence')) if unique else '','shadow_low_ratio':low_ratio(unique) if unique else '','nontriple_meter_trigger':bool(unique and meter!='3'),'canonical_invariant':invariant,'timing_tier_baseline':bt,'timing_tier_dev':dt,'runtime_ratio':td/max(tb,1e-9)})
        except Exception as e: errors.append({'filename':meta['filename'],'error':str(e)})
        if idx%50==0: print(json.dumps({'processed':idx,'rows':len(rows),'errors':len(errors),'triggers':sum(bool(r['shadow_trigger']) for r in rows),'non3_triggers':sum(bool(r['nontriple_meter_trigger']) for r in rows),'ambiguous':sum(bool(r['ambiguous_suppressed']) for r in rows)}),flush=True)
    if errors: raise SystemExit(f'FAIL-CLOSED processing errors={len(errors)} examples={errors[:5]}')
    if len(rows)!=EXPECTED_INDEPENDENT: raise SystemExit(f'FAIL-CLOSED analyzed {len(rows)} != {EXPECTED_INDEPENDENT}')
    if inv: raise SystemExit(f'FAIL-CLOSED canonical invariance failures={len(inv)}')
    if tiers: raise SystemExit(f'FAIL-CLOSED timing tier changes={len(tiers)}')
    with (a.output/'results.csv').open('w',newline='') as f: w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    (a.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n'); (a.output/'invariance_failures.json').write_text(json.dumps(inv,indent=2)+'\n')
    trig=[r for r in rows if r['shadow_trigger']]; non3=[r for r in trig if r['meter']!='3']; meter3=[r for r in trig if r['meter']=='3']; amb=[r for r in rows if r['ambiguous_suppressed']]
    by_meter={m:{'tracks':sum(r['meter']==m for r in rows),'shadow_triggers':sum(r['meter']==m and r['shadow_trigger'] for r in rows),'ambiguous_suppressed':sum(r['meter']==m and r['ambiguous_suppressed'] for r in rows)} for m in sorted({r['meter'] for r in rows})}
    gate='fail' if non3 else ('pass' if meter3 else 'inconclusive')
    summary={'study':'Meter2800 non-GTZAN independent v2 meter-specificity shadow gate','scope_limitation':'Meter labels only; this gate tests false-positive meter specificity and does NOT prove candidate tactus correctness.','selector':'triple_selector_v2_subdivision_guard_FIXED_FROM_BALLROOM_DEV','rule':RULE,'decision_semantics':{'0':'no-switch','1':'shadow-switch','>1':'suppress-as-ambiguous'},'labels_rows_total':len(all_rows),'gtzan_excluded':221,'independent_expected':EXPECTED_INDEPENDENT,'independent_source_counts':dict(counts),'tracks_analyzed':len(rows),'processing_errors':len(errors),'canonical_invariance_failures':len(inv),'timing_tier_changes':len(tiers),'shadow_triggers':len(trig),'meter3_shadow_triggers':len(meter3),'non_meter3_shadow_triggers':len(non3),'ambiguous_suppressed':len(amb),'meter_specificity_gate':gate,'by_meter':by_meter,'non_meter3_triggered_tracks':[{'filename':r['filename'],'meter':r['meter'],'candidate_bpm':r['shadow_candidate_bpm']} for r in non3],'meter3_triggered_tracks':[{'filename':r['filename'],'candidate_bpm':r['shadow_candidate_bpm']} for r in meter3]}
    (a.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n'); print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
