#!/usr/bin/env python3
import argparse, copy, csv, json, math, subprocess, tempfile, time
from pathlib import Path

AUDIO_EXTS={'.wav','.mp3','.flac','.ogg','.m4a'}
TOL=0.04
KNOWN_CORRUPT='jazz.00054.wav'
RULE={
    'relation':'triple',
    'confidence_min':0.65,
    'triple_advantage_min':0.05,
    'phase_coherence_min':0.08,
    'meter_ambiguity_max':0.30,
}

def probe_sr(p):
    q=subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate','-of','default=nw=1:nk=1',str(p)],text=True,capture_output=True,timeout=30)
    if q.returncode:
        raise RuntimeError('ffprobe: '+(q.stderr or q.stdout)[-1200:])
    return int(q.stdout.strip())

def decode(src,dst,sr):
    q=subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-ac','1','-ar',str(sr),'-f','f32le','-acodec','pcm_f32le',str(dst)],text=True,capture_output=True,timeout=120)
    if q.returncode:
        raise RuntimeError('ffmpeg: '+(q.stderr or q.stdout)[-1600:])

def run(node,runner,raw,sr,name):
    t=time.perf_counter()
    q=subprocess.run([node,str(runner),str(raw),str(sr),'1',name],text=True,capture_output=True,timeout=120)
    if q.returncode:
        raise RuntimeError('analyzer: '+(q.stderr or q.stdout)[-1600:])
    return json.loads(q.stdout),time.perf_counter()-t

def canonical(x):
    y=copy.deepcopy(x); y.pop('tactusCandidates',None); return y

def num(v,default=None):
    try:
        f=float(v)
        return f if math.isfinite(f) else default
    except Exception:
        return default

def cf(c):
    return c.get('counterfactualMeter') or {}

def best_triple(cands):
    elig=[c for c in cands if c.get('relationToSource')=='triple' and cf(c)]
    if not elig:
        return None
    return max(elig,key=lambda c:(num(cf(c).get('tripleFamilyAdvantage'),-999),num(c.get('confidence'),0)))

def fires(c):
    if not c or c.get('relationToSource')!=RULE['relation']:
        return False
    e=cf(c)
    vals=(num(c.get('confidence')),num(e.get('tripleFamilyAdvantage')),num(e.get('phaseCoherence')),num(e.get('meterAmbiguity')))
    if any(v is None for v in vals):
        return False
    conf,adv,phase,amb=vals
    return conf>=RULE['confidence_min'] and adv>=RULE['triple_advantage_min'] and phase>=RULE['phase_coherence_min'] and amb<=RULE['meter_ambiguity_max']

def within(bpm,ref):
    bpm=num(bpm); ref=num(ref)
    return bool(bpm and ref and ref>0 and abs(bpm-ref)/ref<=TOL)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--audio-root',type=Path,required=True)
    ap.add_argument('--stats-csv',type=Path,required=True)
    ap.add_argument('--baseline-runner',type=Path,required=True)
    ap.add_argument('--dev-runner',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--node',default='node')
    a=ap.parse_args(); a.output.mkdir(parents=True,exist_ok=True)

    with a.stats_csv.open(newline='',encoding='utf-8-sig',errors='replace') as f:
        stats=list(csv.DictReader(f))
    if len(stats)!=1000:
        raise SystemExit(f'FAIL-CLOSED stats rows {len(stats)} != 1000')
    statmap={r['filename'].strip():r for r in stats}
    if len(statmap)!=1000:
        raise SystemExit('FAIL-CLOSED duplicate stats filename')

    audio={}
    for p in a.audio_root.rglob('*'):
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS and p.name in statmap:
            if p.name in audio:
                raise SystemExit(f'FAIL-CLOSED duplicate audio basename {p.name}')
            audio[p.name]=p
    missing=sorted(set(statmap)-set(audio))
    if missing:
        raise SystemExit(f'FAIL-CLOSED missing annotated audio files: {missing[:20]} count={len(missing)}')

    rows=[]; errors=[]; inv=[]; tier_changes=[]
    for idx,name in enumerate(sorted(statmap),1):
        src=audio[name]; meta=statmap[name]
        try:
            ref=num(meta.get('tempo mean'))
            if not ref or ref<=0:
                raise RuntimeError('invalid-reference-tempo')
            sr=probe_sr(src)
            with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf:
                raw=Path(tf.name)
            try:
                decode(src,raw,sr)
                base,tb=run(a.node,a.baseline_runner,raw,sr,name)
                dev,td=run(a.node,a.dev_runner,raw,sr,name)
            finally:
                raw.unlink(missing_ok=True)
            invariant=canonical(base)==canonical(dev)
            if not invariant:
                inv.append(name)
            bt=(base.get('timingGuardrail') or {}).get('tier'); dt=(dev.get('timingGuardrail') or {}).get('tier')
            if bt!=dt:
                tier_changes.append(name)
            c=best_triple(dev.get('tactusCandidates') or [])
            trig=fires(c)
            base_bpm=num(base.get('bpm'))
            cand_bpm=num(c.get('bpm')) if c else None
            base_ok=within(base_bpm,ref); cand_ok=within(cand_bpm,ref) if c else False
            ev=cf(c) if c else {}
            rows.append({
                'filename':name,'meter':(meta.get('meter') or '').strip(),'reference_bpm':ref,
                'selected_bpm':base_bpm,'baseline_reference_correct':base_ok,
                'shadow_trigger':trig,'shadow_candidate_bpm':cand_bpm or '',
                'shadow_candidate_reference_correct':cand_ok if c else '',
                'shadow_rescue':bool(trig and cand_ok and not base_ok),
                'shadow_wrong_trigger':bool(trig and not cand_ok),
                'candidate_confidence':num(c.get('confidence')) if c else '',
                'triple_advantage':num(ev.get('tripleFamilyAdvantage')) if c else '',
                'phase_coherence':num(ev.get('phaseCoherence')) if c else '',
                'meter_ambiguity':num(ev.get('meterAmbiguity')) if c else '',
                'counterfactual_meter':ev.get('beatsPerBar','') if c else '',
                'canonical_invariant':invariant,'timing_tier_baseline':bt,'timing_tier_dev':dt,
                'runtime_ratio':td/max(tb,1e-9),
            })
        except Exception as e:
            errors.append({'filename':name,'error':str(e)})
        if idx%50==0:
            print(json.dumps({'processed':idx,'rows':len(rows),'errors':len(errors),'triggers':sum(bool(r['shadow_trigger']) for r in rows),'wrong_triggers':sum(bool(r['shadow_wrong_trigger']) for r in rows)}),flush=True)

    allowed_errors=[e for e in errors if e['filename']==KNOWN_CORRUPT]
    unexpected_errors=[e for e in errors if e['filename']!=KNOWN_CORRUPT]
    if unexpected_errors:
        raise SystemExit(f'FAIL-CLOSED unexpected processing errors: {unexpected_errors[:5]}')
    if len(allowed_errors)>1:
        raise SystemExit('FAIL-CLOSED duplicate known-corrupt error')
    if len(rows) not in (999,1000):
        raise SystemExit(f'FAIL-CLOSED analyzed {len(rows)}, expected 999 or 1000')
    if len(rows)==999 and len(allowed_errors)!=1:
        raise SystemExit('FAIL-CLOSED 999 rows without sole jazz.00054 exclusion')
    if len(rows)==1000 and errors:
        raise SystemExit('FAIL-CLOSED 1000 rows with processing error')
    if inv:
        raise SystemExit(f'FAIL-CLOSED canonical invariance failures={len(inv)}')
    if tier_changes:
        raise SystemExit(f'FAIL-CLOSED timing tier changes={len(tier_changes)}')

    fields=list(rows[0].keys()) if rows else []
    with (a.output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
    (a.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    (a.output/'invariance_failures.json').write_text(json.dumps(inv,indent=2)+'\n')

    def group(rr):
        return {
            'tracks':len(rr),
            'baseline_reference_correct':sum(bool(x['baseline_reference_correct']) for x in rr),
            'shadow_triggers':sum(bool(x['shadow_trigger']) for x in rr),
            'shadow_correct_triggers':sum(bool(x['shadow_trigger']) and bool(x['shadow_candidate_reference_correct']) for x in rr),
            'shadow_wrong_triggers':sum(bool(x['shadow_wrong_trigger']) for x in rr),
            'shadow_rescues':sum(bool(x['shadow_rescue']) for x in rr),
        }
    meter_groups={m:group([r for r in rows if r['meter']==m]) for m in sorted({r['meter'] for r in rows})}
    triggers=[r for r in rows if r['shadow_trigger']]
    correct=sum(bool(r['shadow_candidate_reference_correct']) for r in triggers)
    wrong=sum(bool(r['shadow_wrong_trigger']) for r in triggers)
    rescues=sum(bool(r['shadow_rescue']) for r in triggers)
    gate='fail' if wrong>0 else ('pass' if correct>0 else 'inconclusive')
    summary={
        'study':'GTZAN independent frozen triple-selector shadow validation',
        'selector':'triple_selector_v1_FIXED_FROM_BALLROOM_DEV',
        'rule':RULE,
        'reference_tempo_tolerance':TOL,
        'stats_rows':len(stats),'audio_matches':len(audio),'tracks_analyzed':len(rows),
        'known_corrupt_excluded':bool(allowed_errors),
        'processing_errors':len(errors),'unexpected_processing_errors':len(unexpected_errors),
        'canonical_invariance_failures':len(inv),'timing_tier_changes':len(tier_changes),
        'shadow_triggers':len(triggers),'shadow_correct_triggers':correct,'shadow_wrong_triggers':wrong,'shadow_rescues':rescues,
        'selector_gate':gate,
        'meter_groups':meter_groups,
        'triggered_tracks':[{'filename':r['filename'],'meter':r['meter'],'reference_bpm':r['reference_bpm'],'selected_bpm':r['selected_bpm'],'candidate_bpm':r['shadow_candidate_bpm'],'correct':bool(r['shadow_candidate_reference_correct']),'rescue':bool(r['shadow_rescue'])} for r in triggers],
    }
    (a.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    main()
