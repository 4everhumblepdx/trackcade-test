from pathlib import Path
import argparse, json, hashlib
import analyze as A

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repeat-dir',required=True);ap.add_argument('--repeat-pcm-dir',required=True);ap.add_argument('--first-pcm-dir',required=True);args=ap.parse_args()
    out=A.ROOT/'results';repeat=Path(args.repeat_dir);checks=[]
    for name in ['alldat','cvb']:
        for kind in ['events','motifs','anchors','summary']:
            filename=f'{name}-{kind}.json';assert (out/filename).read_bytes()==(repeat/filename).read_bytes(),filename
            checks.append({'file':filename,'identicalRepeat':True,'sha256':hashlib.sha256((out/filename).read_bytes()).hexdigest()})
        events=json.loads((out/f'{name}-events.json').read_bytes());families=json.loads((out/f'{name}-motifs.json').read_bytes())['families'];anchors=json.loads((out/f'{name}-anchors.json').read_bytes())
        assert len(events)>0 and len(families)>0 and len(families)<=12
        assert len({e['id'] for e in events})==len(events)
        assert all(b['time']>a['time'] for a,b in zip(events,events[1:]))
        assert all(0<=e['timingConfidence']<=1 and e['sourceIdentity']=='UNKNOWN' for e in events)
        assert all(not f['gameplayAnchorCandidate'] for f in families)
        assert anchors['anchorHits']==[]
        assert all(len(f['occurrences'])==f['occurrenceCount'] for f in families)
    first=json.loads((Path(args.first_pcm_dir)/'decode.json').read_bytes());second=json.loads((Path(args.repeat_pcm_dir)/'decode.json').read_bytes());assert first['records']==second['records']
    synthetic=__import__('test_research');x,truth=synthetic.synth();events=A.detect_events(x,truth);errors=[min(abs(t-e['time']) for e in events) for t in truth]
    result={'schema':'micro-motif-v1-repeat-verification','passed':True,'fixtureSongsCompleted':2,'repeatOutputChecks':checks,'decodedPcmHashesIdentical':True,'syntheticAttacks':len(truth),'syntheticTimingErrorSeconds':{'maximum':max(errors),'mean':sum(errors)/len(errors)},'caveat':'Synthetic tone attacks do not calibrate timing error for compressed polyphonic mixtures. These errors are not a human-annotated song evaluation.'}
    (A.ROOT/'VERIFICATION.json').write_bytes(A.canonical(result));print(json.dumps(result))

if __name__=='__main__':main()
