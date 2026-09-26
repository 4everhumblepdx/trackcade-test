#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,hashlib,json,math
from pathlib import Path

ASAP_COMMIT='afc815c75c42e83a79c03feb6da8a35e77d4c6b8'
TARGET=100
MIN_BEATS=32
EDGE_TOL=0.250
V1_SELECTED_SHA256='c5d0da75f6fecb97e9fd7eb45ea3cc4db3b900c68737d5f4eab3ea97e3b47bff'


def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def load_csv(path: Path):
    with path.open(newline='',encoding='utf-8-sig') as f: return list(csv.DictReader(f))
def present(x): return x is not None and str(x).strip() not in {'','nan','NaN','None'}
def maybe_float(x):
    if not present(x): return None
    try:
        y=float(x); return y if math.isfinite(y) else None
    except: return None

def resolve_maestro_key(raw: str) -> str:
    x=raw.replace('\\','/').strip();prefix='{maestro}/'
    if x.startswith(prefix): x=x[len(prefix):]
    return x.lstrip('/')

def meter_segments(ann: dict):
    out=[]
    for raw_time,value in (ann.get('perf_time_signatures') or {}).items():
        try: when=float(raw_time)
        except: continue
        if not isinstance(value,(list,tuple)) or len(value)<2: continue
        try: bpmeter=int(value[1])
        except: continue
        out.append({'time':when,'signature':str(value[0]),'beats_per_measure':bpmeter})
    return sorted(out,key=lambda x:x['time'])

def clean_beats(xs,duration):
    out=[]
    for x in xs or []:
        try: t=float(x)
        except: continue
        if not math.isfinite(t) or t < -EDGE_TOL: continue
        if duration is not None and t > duration + EDGE_TOL: continue
        out.append(t)
    return sorted(out)

def select_unique(rows, target, excluded_midi=None, excluded_sources=None):
    excluded_midi=excluded_midi or set();excluded_sources=excluded_sources or set()
    selected=[];sources=set()
    for r in rows:
        if r['midi_performance'] in excluded_midi: continue
        src=r['maestro_audio_filename']
        if src in excluded_sources or src in sources: continue
        selected.append(r);sources.add(src)
        if len(selected)==target: break
    return selected,sources

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--asap-root',type=Path,required=True)
    ap.add_argument('--maestro-metadata',type=Path,required=True)
    ap.add_argument('--prior-triple-json',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)

    meta_path=args.asap_root/'metadata.csv';ann_path=args.asap_root/'asap_annotations.json'
    rows=load_csv(meta_path);anns=json.loads(ann_path.read_text(encoding='utf-8'));maestro_rows=load_csv(args.maestro_metadata)
    maestro_by_audio={(r.get('audio_filename') or '').replace('\\','/').lstrip('/'):r for r in maestro_rows if (r.get('audio_filename') or '').strip()}
    prior=json.loads(args.prior_triple_json.read_text());prior_ids={str(r.get('midi_performance') or '') for r in prior}

    eligible=[];reject={};mapped=0
    for row in rows:
        reason=None;midi=(row.get('midi_performance') or '').replace('\\','/')
        if not present(row.get('maestro_audio_performance')): reason='no_maestro_audio'
        else:
            mapped+=1;ann=anns.get(midi)
            if ann is None: reason='annotation_missing'
            else:
                meters=meter_segments(ann)
                if not meters: reason='meter_missing'
                elif all(m['beats_per_measure']==3 for m in meters): reason='pure_three_meter_excluded'
                elif midi in prior_ids: reason='prior_triple_holdout_identity_excluded'
                else:
                    source=resolve_maestro_key(str(row['maestro_audio_performance']));mm=maestro_by_audio.get(source)
                    if mm is None: reason='maestro_metadata_unmapped'
                    else:
                        start=maybe_float(row.get('start'));end=maybe_float(row.get('end'));source_duration=maybe_float(mm.get('duration'))
                        crop_start=start if start is not None else 0.0
                        duration=(end-crop_start) if end is not None else ((source_duration-crop_start) if source_duration is not None else None)
                        if duration is None or duration<=0: reason='invalid_or_missing_crop_duration'
                        else:
                            b=clean_beats(ann.get('performance_beats'),duration)
                            if len(b)<MIN_BEATS: reason='insufficient_reference_beats'
                            else:
                                eligible.append({
                                    'selection_sha256':hashlib.sha256(midi.encode('utf-8')).hexdigest(),
                                    'midi_performance':midi,'composer':row.get('composer') or '','title':row.get('title') or '',
                                    'maestro_audio_filename':source,'crop_start_s':start,'crop_end_s':end,'crop_duration_s':duration,
                                    'maestro_source_duration_s':source_duration,'reference_beats_s':b,'annotated_beats':len(b),
                                    'meter_segments':meters,'time_signatures':sorted({m['signature'] for m in meters}),
                                    'beats_per_measure_values':sorted({m['beats_per_measure'] for m in meters}),
                                    'maestro_split':mm.get('split') or '','maestro_year':mm.get('year') or ''
                                })
        if reason: reject[reason]=reject.get(reason,0)+1

    eligible.sort(key=lambda r:(r['selection_sha256'],r['midi_performance']))
    v1,v1_sources=select_unique(eligible,TARGET)
    if len(v1)!=TARGET: raise SystemExit('FAIL-CLOSED: cannot reproduce 100 V1 selections')
    v1_bytes=(json.dumps(v1,indent=2)+'\n').encode()
    v1_hash=sha256_bytes(v1_bytes)
    if v1_hash!=V1_SELECTED_SHA256: raise SystemExit(f'FAIL-CLOSED: V1 selected manifest hash drift {v1_hash}')
    v1_midi={r['midi_performance'] for r in v1}

    selected,sources=select_unique(eligible,TARGET,v1_midi,v1_sources)
    if len(selected)!=TARGET: raise SystemExit(f'FAIL-CLOSED: only {len(selected)} V1-disjoint unique-source performances')
    midi_overlap=sorted({r['midi_performance'] for r in selected}&v1_midi)
    source_overlap=sorted(sources&v1_sources)
    prior_overlap=sorted({r['midi_performance'] for r in selected}&prior_ids)
    if midi_overlap or source_overlap or prior_overlap: raise SystemExit('FAIL-CLOSED: holdout overlap detected')

    summary={
      'corpus':'ASAP v1.2 / MAESTRO v2.0.0 terminal disjoint selector-v2 holdout',
      'protocol':'research/v020-phase-context/ASAP_PHASE_HOLDOUT_V2_PROTOCOL.md',
      'selector':'research/v020-phase-context/FROZEN_SELECTOR_V2.json',
      'selection_frozen_before_analyzer_output':True,'asap_commit':ASAP_COMMIT,
      'asap_metadata_sha256':sha256_file(meta_path),'asap_annotations_sha256':sha256_file(ann_path),
      'maestro_metadata_sha256':sha256_file(args.maestro_metadata),'prior_triple_manifest_sha256':sha256_file(args.prior_triple_json),
      'v1_selected_manifest_reproduced_sha256':v1_hash,
      'asap_metadata_rows':len(rows),'asap_annotation_entries':len(anns),'maestro_metadata_rows':len(maestro_rows),
      'rows_with_maestro_audio_mapping':mapped,'eligible_population':len(eligible),'eligible_unique_sources':len({r['maestro_audio_filename'] for r in eligible}),
      'v1_reproduced_performances':len(v1),'v1_reproduced_unique_sources':len(v1_sources),
      'selected_performances':len(selected),'selected_unique_sources':len(sources),
      'v1_midi_overlap':len(midi_overlap),'v1_source_overlap':len(source_overlap),'prior_triple_overlap':len(prior_overlap),
      'selection_method':'same frozen eligible ordering as V1; reproduce/verify V1 first 100 unique sources, then take next 100 unique sources disjoint by MIDI identity and MAESTRO source',
      'min_reference_beats':MIN_BEATS,'edge_tolerance_s':EDGE_TOL,'rejections':dict(sorted(reject.items()))
    }
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (args.output/'selected_performances.json').write_text(json.dumps(selected,indent=2)+'\n')
    (args.output/'eligible_population.json').write_text(json.dumps(eligible,indent=2)+'\n')
    (args.output/'unique_maestro_sources.txt').write_text('\n'.join(sorted(sources))+'\n')
    with (args.output/'selected_performances.csv').open('w',newline='',encoding='utf-8') as f:
        fields=['selection_sha256','midi_performance','composer','title','maestro_audio_filename','crop_start_s','crop_end_s','crop_duration_s','annotated_beats','time_signatures','beats_per_measure_values','maestro_split','maestro_year']
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for r in selected:
            x={k:r.get(k) for k in fields};x['time_signatures']=';'.join(r['time_signatures']);x['beats_per_measure_values']=';'.join(map(str,r['beats_per_measure_values']));w.writerow(x)
    print(json.dumps(summary,indent=2))
    if len(rows)!=1067 or len(anns)!=1067 or len(maestro_rows)!=1282: raise SystemExit('FAIL-CLOSED: pinned corpus denominator drift')
    if len(selected)!=100 or len(sources)!=100 or midi_overlap or source_overlap or prior_overlap: raise SystemExit('FAIL-CLOSED: V2 selection integrity failure')

if __name__=='__main__': main()
