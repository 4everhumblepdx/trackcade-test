#!/usr/bin/env python3
"""Inspect/extract MIREX 2006 beat-training archive and map audio to beat refs conservatively.

Writes prepared/audio + prepared/beats only when a unique mapping is supportable.
Unresolved structure is reported as data, not treated as an Analyzer failure.
"""
import argparse, json, re, shutil
from pathlib import Path

AUDIO_EXT={'.wav','.mp3','.flac','.ogg','.m4a','.aif','.aiff','.au'}
TEXT_EXT={'.txt','.beats','.beat','.lab','.csv','.ann','.annotation'}

def numeric_times(path):
    vals=[]
    try: lines=path.read_text(errors='ignore').splitlines()
    except: return None
    for line in lines:
        line=line.strip()
        if not line or line.startswith('#'): continue
        parts=re.split(r'[\s,;]+',line)
        try: vals.append(float(parts[0]))
        except: return None
    if len(vals)<3: return None
    if any(b<=a for a,b in zip(vals,vals[1:])): return None
    return vals

def normstem(p):
    s=p.stem.lower()
    for tok in ('_beats','-beats','.beats','_beat','-beat','_annotation','-annotation','_gt','-gt','_groundtruth','-groundtruth'):
        s=s.replace(tok,'')
    return re.sub(r'[^a-z0-9]+','',s)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    root=args.root;out=args.output;pa=out/'audio';pb=out/'beats';pa.mkdir(parents=True,exist_ok=True);pb.mkdir(parents=True,exist_ok=True)
    audio=[p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in AUDIO_EXT]
    text=[p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in TEXT_EXT]
    refs=[]
    for p in text:
        vals=numeric_times(p)
        if vals is not None: refs.append((p,vals))
    # exact normalized-stem match only; no fuzzy guesses.
    bystem={}
    for p,vals in refs:bystem.setdefault(normstem(p),[]).append((p,vals))
    mapped=[];unresolved=[]
    for a in audio:
        hits=bystem.get(normstem(a),[])
        if len(hits)==1:
            r,vals=hits[0];name=a.stem
            shutil.copy2(a,pa/(name+a.suffix.lower()))
            (pb/(name+'.beats')).write_text('\n'.join(f'{x:.9f}' for x in vals)+'\n')
            mapped.append({'audio':str(a.relative_to(root)),'reference':str(r.relative_to(root)),'beats':len(vals)})
        else:
            unresolved.append({'audio':str(a.relative_to(root)),'normalized_stem':normstem(a),'candidate_refs':[str(x[0].relative_to(root)) for x in hits]})
    inv={
      'audio_files':len(audio),'text_files':len(text),'numeric_monotonic_reference_files':len(refs),
      'mapped':len(mapped),'unresolved':len(unresolved),
      'ready_for_evaluation':len(mapped)>0 and len(unresolved)==0,
      'audio_examples':[str(p.relative_to(root)) for p in audio[:30]],
      'reference_examples':[str(p.relative_to(root)) for p,_ in refs[:30]],
      'mapped_pairs':mapped,'unresolved_audio':unresolved,
    }
    out.mkdir(parents=True,exist_ok=True);(out/'mapping.json').write_text(json.dumps(inv,indent=2)+'\n');print(json.dumps(inv,indent=2))
if __name__=='__main__':main()
