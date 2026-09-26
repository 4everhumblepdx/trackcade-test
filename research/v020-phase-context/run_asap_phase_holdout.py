#!/usr/bin/env python3
from __future__ import annotations
import argparse,copy,csv,hashlib,importlib.util,json,math,os,subprocess,tempfile,time,wave,zipfile
from pathlib import Path

MEDIAN_GAIN=0.05
PERIODICITY_GAIN=0.05
CONFIDENCE_FLOOR=-0.05

def load_range_reader():
    p=Path(__file__).parents[2]/"stress"/"v019-asap"/"inspect_maestro_remote_zip.py"
    spec=importlib.util.spec_from_file_location("trackcade_remote_zip",p)
    if spec is None or spec.loader is None: raise RuntimeError("unable to load range reader")
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod.HTTPRangeReader
HTTPRangeReader=load_range_reader()

def sha256_file(path: Path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()

def canonical(x):
    y=copy.deepcopy(x);y.pop("phaseContextDebug",None);return y

def run_analyzer(runner: Path,raw: Path,sr: int,name: str,debug=False):
    env=dict(os.environ)
    if debug: env["TRACKCADE_PHASE_CONTEXT_DEBUG"]="1"
    t=time.perf_counter()
    q=subprocess.run(["node",str(runner),str(raw),str(sr),"1",name],text=True,capture_output=True,timeout=900,env=env)
    elapsed=time.perf_counter()-t
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-2000:])
    return json.loads(q.stdout),elapsed

def decode_crop(source: Path,raw: Path,sr: int,start_s,end_s):
    cmd=["ffmpeg","-v","error","-y","-i",str(source)]
    if start_s is not None: cmd += ["-ss",f"{float(start_s):.9f}"]
    if end_s is not None:
        origin=float(start_s) if start_s is not None else 0.0
        duration=float(end_s)-origin
        if duration<=0: raise RuntimeError(f"invalid crop duration start={start_s} end={end_s}")
        cmd += ["-t",f"{duration:.9f}"]
    cmd += ["-ac","1","-ar",str(sr),"-f","f32le","-acodec","pcm_f32le",str(raw)]
    q=subprocess.run(cmd,text=True,capture_output=True,timeout=900)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-2000:])
    if raw.stat().st_size<=0: raise RuntimeError("decoded crop empty")

def greedy(pred,ref,tol=.070):
    i=j=m=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol: m+=1;i+=1;j+=1
        elif d < -tol: i+=1
        else: j+=1
    p=m/len(pred) if pred else 0;r=m/len(ref) if ref else 0
    return p,r,(2*p*r/(p+r) if p+r else 0)

def candidate_times(phase,bpm,start,end):
    interval=60/bpm;t=phase
    while t < start-.001: t+=interval
    while t-interval >= start-.001: t-=interval
    out=[]
    while t <= end+.001: out.append(t);t+=interval
    return out

def group(grid,n):
    for g in grid.get("groups",[]):
        if int(g.get("beatsPerBar") or 0)==n: return g
    return {}

def finite(*xs): return all(isinstance(x,(int,float)) and math.isfinite(float(x)) for x in xs)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--holdout-json",type=Path,required=True)
    ap.add_argument("--zip-url",required=True)
    ap.add_argument("--baseline-runner",type=Path,required=True)
    ap.add_argument("--debug-runner",type=Path,required=True)
    ap.add_argument("--output",type=Path,required=True)
    ap.add_argument("--shard-index",type=int,required=True)
    ap.add_argument("--shard-count",type=int,required=True)
    ap.add_argument("--expected-runner-sha",required=True)
    args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    if not 0<=args.shard_index<args.shard_count: raise SystemExit("invalid shard")
    for p in (args.baseline_runner,args.debug_runner):
        if not p.is_file(): raise SystemExit(f"missing runner {p}")
    if sha256_file(args.baseline_runner)!=args.expected_runner_sha:
        raise SystemExit("FAIL-CLOSED: baseline SHA mismatch")

    selected=json.loads(args.holdout_json.read_text())
    if len(selected)!=100 or len({r["maestro_audio_filename"] for r in selected})!=100:
        raise SystemExit("FAIL-CLOSED: holdout denominator/source drift")
    assigned=[r for i,r in enumerate(selected) if i%args.shard_count==args.shard_index]
    remote=HTTPRangeReader(args.zip_url)
    rows=[];errors=[];inv=[];sources=[]

    with zipfile.ZipFile(remote,"r") as zf:
        infos=zf.infolist()
        for num,perf in enumerate(assigned,1):
            track=perf["midi_performance"];source=perf["maestro_audio_filename"]
            matches=[i for i in infos if i.filename==source or i.filename.endswith("/"+source)]
            if len(matches)!=1:
                errors.append({"track":track,"error":f"source mapping {source!r} matches={len(matches)}"});continue
            info=matches[0]
            source_path=raw=None
            try:
                with tempfile.NamedTemporaryFile(suffix=".wav",delete=False) as tf: source_path=Path(tf.name)
                h=hashlib.sha256();written=0
                with zf.open(info,"r") as src,source_path.open("wb") as dst:
                    while True:
                        chunk=src.read(1024*1024)
                        if not chunk: break
                        h.update(chunk);dst.write(chunk);written+=len(chunk)
                if written!=info.file_size: raise RuntimeError(f"source bytes {written}!={info.file_size}")
                with wave.open(str(source_path),"rb") as wf:
                    sr=wf.getframerate()
                sources.append({"track":track,"source":source,"zip_member":info.filename,"bytes":written,"sha256":h.hexdigest(),"sample_rate":sr})
                with tempfile.NamedTemporaryFile(suffix=".f32",delete=False) as rf: raw=Path(rf.name)
                decode_crop(source_path,raw,sr,perf.get("crop_start_s"),perf.get("crop_end_s"))
                base,tb=run_analyzer(args.baseline_runner,raw,sr,track,False)
                dev,td=run_analyzer(args.debug_runner,raw,sr,track,True)
                invariant=(base==canonical(dev))
                if not invariant: inv.append(track)
                tempo=dev.get("tempoMap") or [];dbg=dev.get("phaseContextDebug") or []
                if len(tempo)!=len(dbg): raise RuntimeError(f"tempo/debug segment mismatch {len(tempo)} != {len(dbg)}")
                refs=sorted(float(x) for x in perf["reference_beats_s"])
                for si,(seg,ctx) in enumerate(zip(tempo,dbg)):
                    start=float(seg["start"]);end=float(seg["end"]);bpm=float(seg["bpm"])
                    rseg=[t for t in refs if start-.001<=t<=end+.001]
                    sg=ctx["selected"];hg=ctx["halfCycle"]
                    sp=candidate_times(float(sg["phase"]),bpm,start,end)
                    hp=candidate_times(float(hg["phase"]),bpm,start,end)
                    pp,pr,sf=greedy(sp,rseg);hpv,hr,hf=greedy(hp,rseg)
                    dm=float(hg.get("medianBeatStrength",float("nan")))-float(sg.get("medianBeatStrength",float("nan")))
                    dc=float(hg.get("meanBeatConfidence",float("nan")))-float(sg.get("meanBeatConfidence",float("nan")))
                    pds=[]
                    row={"track":track,"segment":si,"tier":(dev.get("timingGuardrail") or {}).get("tier"),"bpm":bpm,"start":start,"end":end,
                         "reference_beats":len(rseg),"selected_precision70":pp,"selected_recall70":pr,"selected_f1_70":sf,
                         "half_precision70":hpv,"half_recall70":hr,"half_f1_70":hf,"half_minus_selected_f1":hf-sf,
                         "delta_medianBeatStrength":dm,"delta_meanBeatConfidence":dc,"canonical_invariant":invariant,
                         "baseline_runtime_s":tb,"debug_runtime_s":td}
                    for g in (2,3,4):
                        sv=group(sg,g).get("periodicity");hv=group(hg,g).get("periodicity")
                        dv=(float(hv)-float(sv)) if finite(sv,hv) else float("nan")
                        row[f"delta_g{g}_periodicity"]=dv;pds.append(dv)
                    mp=max([x for x in pds if math.isfinite(x)],default=float("nan"))
                    row["max_periodicity_gain"]=mp
                    trig=finite(dm,dc,mp) and dm>=MEDIAN_GAIN and mp>=PERIODICITY_GAIN and dc>=CONFIDENCE_FLOOR
                    row["trigger"]=trig
                    rows.append(row)
            except Exception as e:
                errors.append({"track":track,"error":str(e)})
            finally:
                if raw: raw.unlink(missing_ok=True)
                if source_path: source_path.unlink(missing_ok=True)
            if num%5==0: print(json.dumps({"shard":args.shard_index,"processed":num,"rows":len(rows),"errors":len(errors),"invariance":len(inv)}),flush=True)

    fields=sorted({k for r in rows for k in r})
    with (args.output/"results.csv").open("w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    (args.output/"errors.json").write_text(json.dumps(errors,indent=2)+"\n")
    (args.output/"invariance_failures.json").write_text(json.dumps(inv,indent=2)+"\n")
    (args.output/"sources.json").write_text(json.dumps(sources,indent=2)+"\n")
    analyzed_tracks=len({r["track"] for r in rows})
    summary={"shard_index":args.shard_index,"shard_count":args.shard_count,"assigned_tracks":len(assigned),
             "analyzed_tracks":analyzed_tracks,"segments":len(rows),"triggers":sum(bool(r["trigger"]) for r in rows),
             "errors":len(errors),"canonical_invariance_failures":len(inv),
             "baseline_runner_sha256":sha256_file(args.baseline_runner)}
    (args.output/"summary.json").write_text(json.dumps(summary,indent=2)+"\n");print(json.dumps(summary,indent=2))
    if analyzed_tracks!=len(assigned) or errors or inv: raise SystemExit(1)

if __name__=="__main__": main()
