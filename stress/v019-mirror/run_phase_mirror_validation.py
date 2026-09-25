#!/usr/bin/env python3
import argparse,csv,json,os,struct,subprocess,tempfile,wave
from pathlib import Path

LAYERS=['low','amplitude','mid','hybrid','transient','high']
UPPER=['mid','hybrid','transient','high']

def wav_to_f32(src,dst):
    with wave.open(str(src),'rb') as w:
        assert w.getnchannels()==1 and w.getsampwidth()==2
        sr=w.getframerate(); raw=w.readframes(w.getnframes())
    vals=struct.unpack('<'+'h'*(len(raw)//2),raw)
    with open(dst,'wb') as f:
        for v in vals: f.write(struct.pack('<f',v/32768.0))
    return sr

def run_runner(runner,raw,sr,name):
    env=dict(os.environ); env['TRACKCADE_PHASE_DEBUG']='1'
    q=subprocess.run(['node',str(runner),str(raw),str(sr),'1',name],env=env,text=True,capture_output=True,timeout=90)
    if q.returncode: raise RuntimeError((q.stderr or q.stdout)[-1000:])
    return json.loads(q.stdout)

def truth_times(bpm,phase_s,duration=24.0):
    t=.35+phase_s; step=60.0/bpm; out=[]
    while t < duration-.15:
        out.append(t); t+=step
    return out

def candidate_times(phase,bpm,start,end):
    step=60.0/bpm; t=phase
    while t < start-.001: t+=step
    out=[]
    while t<=end+.001: out.append(t); t+=step
    return out

def f1(pred,ref,tol=.070):
    i=j=m=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol: m+=1;i+=1;j+=1
        elif d < -tol: i+=1
        else:j+=1
    p=m/len(pred) if pred else 0; r=m/len(ref) if ref else 0
    return 2*p*r/(p+r) if p+r else 0

def circular_half_distance(a,b):
    d=((a-b+.5)%1)-.5
    return abs(abs(d)-.5)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--corpus',type=Path,required=True); ap.add_argument('--runner',type=Path,required=True); ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((args.corpus/'manifest.json').read_text())
    rows=[];errors=[]
    for n,item in enumerate(manifest,1):
        with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf: raw=Path(tf.name)
        try:
            sr=wav_to_f32(args.corpus/item['file'],raw); js=run_runner(args.runner,raw,sr,item['file'])
            debug=js.get('phaseDebug') or []
            if len(debug)!=1:
                rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'not-single-segment','segments':len(debug)}); continue
            seg=debug[0]; bpm=float(seg['bpm']); cands=seg.get('candidates') or []
            sel=next((c for c in cands if 'selected' in (c.get('sources') or [])),None)
            if not sel: raise RuntimeError('no selected phase candidate')
            others=[c for c in cands if c is not sel]
            half=min(others,key=lambda c:circular_half_distance(float(c['phaseFraction']),float(sel['phaseFraction']))) if others else None
            if half is None or circular_half_distance(float(half['phaseFraction']),float(sel['phaseFraction']))>.08:
                rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'no-half-candidate','selected_bpm':bpm}); continue
            physical=[('a',float(item['clock_a_bpm']),float(item['phase_a_s'])),('b',float(item['clock_b_bpm']),float(item['phase_b_s']))]
            name,tbpm,tphase=min(physical,key=lambda x:abs(x[1]-bpm)/x[1])
            rel=abs(tbpm-bpm)/tbpm
            if rel>.05:
                rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'selected-bpm-unmatched','selected_bpm':bpm,'nearest_truth_bpm':tbpm,'nearest_rel_error':rel}); continue
            ref=truth_times(tbpm,tphase)
            sf=f1(candidate_times(float(sel['phase']),bpm,float(seg['start']),float(seg['end'])),ref)
            hf=f1(candidate_times(float(half['phase']),bpm,float(seg['start']),float(seg['end'])),ref)
            sl={x['name']:x for x in sel.get('layers',[])}; hl={x['name']:x for x in half.get('layers',[])}
            ds={L:(float(hl[L]['score'])-float(sl[L]['score'])) if L in sl and L in hl else None for L in LAYERS}
            all6=all(ds[L] is not None and ds[L]>0 for L in LAYERS)
            upper4=all(ds[L] is not None and ds[L]>0 for L in UPPER)
            sm=float(sel.get('meterConfidence') or 0); hm=float(half.get('meterConfidence') or 0)
            rule=all6 or (upper4 and hm-sm>=.05)
            rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'ok','selected_bpm':bpm,'truth_clock':name,'truth_bpm':tbpm,'selected_f1_70':sf,'half_f1_70':hf,'delta_if_override':hf-sf,'all6':all6,'upper4':upper4,'meter_delta':hm-sm,'rule_trigger':rule,'rule_help':rule and hf>sf+.02,'rule_hurt':rule and hf<sf-.02,**{f'{L}_delta':ds[L] for L in LAYERS}})
        except Exception as e: errors.append({'file':item['file'],'error':str(e)})
        finally: raw.unlink(missing_ok=True)
        if n%16==0: print(json.dumps({'processed':n,'errors':len(errors)}),flush=True)
    keys=sorted({k for r in rows for k in r})
    with (args.output/'results.csv').open('w',newline='') as f: w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(rows)
    ok=[r for r in rows if r.get('status')=='ok']; trig=[r for r in ok if r.get('rule_trigger')]
    by_kind={k:{'ok':sum(r['kind']==k for r in ok),'triggers':sum(r['kind']==k and r.get('rule_trigger') for r in ok),'helps':sum(r['kind']==k and r.get('rule_help') for r in ok),'hurts':sum(r['kind']==k and r.get('rule_hurt') for r in ok)} for k in sorted({r['kind'] for r in ok})}
    summary={'tracks':len(manifest),'rows':len(rows),'errors':len(errors),'ok':len(ok),'rule_triggers':len(trig),'rule_helps':sum(r.get('rule_help') for r in trig),'rule_hurts':sum(r.get('rule_hurt') for r in trig),'rule_neutral':sum(not r.get('rule_help') and not r.get('rule_hurt') for r in trig),'mean_trigger_delta_f1':sum(r['delta_if_override'] for r in trig)/max(1,len(trig)),'by_kind':by_kind}
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');(args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
if __name__=='__main__': main()
