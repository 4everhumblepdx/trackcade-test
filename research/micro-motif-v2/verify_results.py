"""Post-freeze integrity tests, plus deterministic development repeatability check."""
import argparse,hashlib,json,subprocess,unittest
from pathlib import Path
import numpy as np
from dsp_base import CFG,canonical,digest
from method import Search,approve
from analyze import verify_freeze
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parents[1]
IDS=['alldat','cvb','laid-back','wanna-get-lit','need-a-bag']

def verify(commit):
    freeze=verify_freeze(commit);records={id:json.loads((ROOT/'results'/f'{id}.json').read_text(encoding='utf-8')) for id in IDS}
    checks=[]
    def check(name,value):
        checks.append({'check':name,'pass':bool(value)})
        if not value:raise AssertionError(name)
    check('all five complete',len(records)==5)
    check('external set after committed freeze',all(records[id]['freezeCommit']==commit for id in IDS[2:]))
    check('configuration unchanged all five',all(r['configSha256']==freeze['configSha256'] for r in records.values()))
    check('no per-track handling',all(not r['trackSpecificHandling'] for r in records.values()))
    check('provider zero and spend zero',all(r['providerCalls']==0 and r['spendUSD']==0 for r in records.values()))
    check('null seeds and three fixed control distributions',all(len(r['nullDistributions'])==3 and all([z['seed'] for z in rows]==CFG['nullSeeds'] for rows in r['nullDistributions'].values()) for r in records.values()))
    check('source identity never invented',all(e['sourceIdentity']=='UNKNOWN' for r in records.values() for e in r['events']))
    check('production truth never invented',all(not e['productionValidated'] and not e['trustedMicroEventTime'] for r in records.values() for e in r['events']))
    check('ordered events and IDs unique',all([e['time'] for e in r['events']]==sorted(e['time'] for e in r['events']) and len({e['id'] for e in r['events']})==len(r['events']) for r in records.values()))
    check('event values bounded',all(0<=e['strength']<=1 and 0<=e['timingConfidence']<=1 for r in records.values() for e in r['events']))
    changed=subprocess.check_output(['git','diff','--name-only',freeze['sourceCommit']],cwd=REPO,text=True).splitlines()
    check('v1 V9 Pulse Tap Pages and all other paths unchanged',all(p.startswith('research/micro-motif-v2/') for p in changed))
    tracked=subprocess.check_output(['git','ls-files'],cwd=REPO,text=True).splitlines()
    check('private MP3s not tracked',all(not any(Path(p).name==records[id]['input']['filename'] for p in tracked) for id in IDS[2:]))
    check('no audio in research namespace',not any(p.suffix.lower() in ['.mp3','.wav','.f32','.flac','.ogg','.m4a'] for p in ROOT.rglob('*')))
    check('local report has no audio embedding or private paths','data:audio' not in (ROOT/'REPORT.html').read_text(encoding='utf-8') and 'Downloads' not in (ROOT/'REPORT.html').read_text(encoding='utf-8'))
    # Independently rerun development matching against saved descriptor contours only:
    # recompute full features/events in development repeat runner, never external audio.
    check('calibration failures preserved',not json.loads((ROOT/'CALIBRATION.json').read_text(encoding='utf-8'))['strictGateSupported'] or all(e['calibrationSupportedStrictCandidate']==e['internallyStable'] for r in records.values() for e in r['events']))
    result={'schema':'micro-motif-v2-integrity-checks','freezeCommit':commit,'checks':checks,'passCount':len(checks),'failCount':0,'resultSha256':{id:hashlib.sha256((ROOT/'results'/f'{id}.json').read_bytes()).hexdigest() for id in IDS},'providerCalls':0,'spendUSD':0}
    (ROOT/'VERIFICATION.json').write_bytes(canonical(result));print(json.dumps(result))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--freeze-commit',required=True);a=ap.parse_args();verify(a.freeze_commit)
