#!/usr/bin/env python3
import argparse,csv,json,os,struct,subprocess,tempfile,wave
from pathlib import Path

RULE_NAME='wins2_meanpos_stdpos_v1'

def wav_to_f32(src,dst):
    with wave.open(str(src),'rb') as w:
        assert w.getnchannels()==1 and w.getsampwidth()==2
        sr=w.getframerate(); raw=w.readframes(w.getnframes())
    vals=struct.unpack('<'+'h'*(len(raw)//2),raw)
    with open(dst,'wb') as f:
        for v in vals:f.write(struct.pack('<f',v/32768.0))
    return sr

def run_runner(runner,raw,sr,name):
    env=dict(os.environ);env['TRACKCADE_PHASE_STABILITY']='1'
    q=subprocess.run(['node',str(runner),str(raw),str(sr),'1',name],env=env,text=True,capture_output=True,timeout=90)
    if q.returncode:raise RuntimeError((q.stderr or q.stdout)[-1000:])
    return json.loads(q.stdout)

def truth_times(bpm,phase_s,duration=24.0):
    t=.35+phase_s;step=60/bpm;out=[]
    while t<duration-.15:out.append(t);t+=step
    return out

def cand_times(phase,bpm,start,end):
    step=60/bpm;t=phase
    while t<start-.001:t+=step
    out=[]
    while t<=end+.001:out.append(t);t+=step
    return out

def f1(pred,ref,tol=.070):
    i=j=m=0
    while i<len(pred) and j<len(ref):
        d=pred[i]-ref[j]
        if abs(d)<=tol:m+=1;i+=1;j+=1
        elif d < -tol:i+=1
        else:j+=1
    p=m/len(pred) if pred else 0;r=m/len(ref) if ref else 0
    return 2*p*r/(p+r) if p+r else 0

def halfdist(a,b):
    d=((a-b+.5)%1)-.5;return abs(abs(d)-.5)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--corpus',type=Path,required=True);ap.add_argument('--runner',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((args.corpus/'manifest.json').read_text());rows=[];errors=[]
    for n,item in enumerate(manifest,1):
        with tempfile.NamedTemporaryFile(suffix='.f32',delete=False) as tf:raw=Path(tf.name)
        try:
            sr=wav_to_f32(args.corpus/item['file'],raw);js=run_runner(args.runner,raw,sr,item['file']);dbg=js.get('phaseStabilityDebug') or []
            if len(dbg)!=1:
                rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'not-single-segment','segments':len(dbg)});continue
            seg=dbg[0];bpm=float(seg['bpm']);cands=seg.get('candidates') or [];sel=next((c for c in cands if 'selected' in (c.get('sources') or [])),None)
            if not sel:raise RuntimeError('selected missing')
            others=[c for c in cands if c is not sel];half=min(others,key=lambda c:halfdist(float(c['phaseFraction']),float(sel['phaseFraction']))) if others else None
            if half is None or halfdist(float(half['phaseFraction']),float(sel['phaseFraction']))>.08:
                rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'no-half'});continue
            physical=[('a',float(item['clock_a_bpm']),float(item['phase_a_s'])),('b',float(item['clock_b_bpm']),float(item['phase_b_s']))]
            truth_name,tbpm,tphase=min(physical,key=lambda x:abs(x[1]-bpm)/x[1]);rel=abs(tbpm-bpm)/tbpm
            if rel>.05:
                rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'selected-bpm-unmatched','selected_bpm':bpm});continue
            start=float(seg['start']);end=float(seg['end']);ref=truth_times(tbpm,tphase)
            sf=f1(cand_times(float(sel['phase']),bpm,start,end),ref);hf=f1(cand_times(float(half['phase']),bpm,start,end),ref)
            sw=sel.get('windows') or [];hw=half.get('windows') or []
            wins=sum(1 for x,y in zip(sw,hw) if float(y['score'])>float(x['score']))
            mean_delta=float(half['windowMean'])-float(sel['windowMean']);std_delta=float(half['windowStd'])-float(sel['windowStd'])
            trigger=wins>=2 and mean_delta>0 and std_delta>0
            delta=hf-sf
            rows.append({'file':item['file'],'kind':item['kind'],'ratio_name':item['ratio_name'],'status':'ok','selected_bpm':bpm,'truth_clock':truth_name,'truth_bpm':tbpm,'selected_f1_70':sf,'half_f1_70':hf,'delta_if_override':delta,'half_window_wins':wins,'window_mean_delta':mean_delta,'window_std_delta':std_delta,'rule':RULE_NAME,'rule_trigger':trigger,'rule_big_help':trigger and delta>=.2,'rule_big_hurt':trigger and delta<=-.2,'rule_neutral':trigger and -.2<delta<.2})
        except Exception as e:errors.append({'file':item['file'],'error':str(e)})
        finally:raw.unlink(missing_ok=True)
        if n%16==0:print(json.dumps({'processed':n,'errors':len(errors)}),flush=True)
    keys=sorted({k for r in rows for k in r})
    with (args.output/'results.csv').open('w',newline='') as f:w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(rows)
    ok=[r for r in rows if r.get('status')=='ok'];trig=[r for r in ok if r.get('rule_trigger')]
    summary={'rule':RULE_NAME,'tracks':len(manifest),'rows':len(rows),'errors':len(errors),'ok':len(ok),'triggers':len(trig),'big_helps':sum(r.get('rule_big_help') for r in trig),'big_hurts':sum(r.get('rule_big_hurt') for r in trig),'neutral':sum(r.get('rule_neutral') for r in trig),'mean_delta_if_trigger':sum(r['delta_if_override'] for r in trig)/max(1,len(trig)),'by_kind':{k:{'ok':sum(r['kind']==k for r in ok),'triggers':sum(r['kind']==k and r.get('rule_trigger') for r in ok),'big_helps':sum(r['kind']==k and r.get('rule_big_help') for r in ok),'big_hurts':sum(r['kind']==k and r.get('rule_big_hurt') for r in ok)} for k in sorted({r['kind'] for r in ok})}}
    (args.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');(args.output/'errors.json').write_text(json.dumps(errors,indent=2)+'\n');print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
