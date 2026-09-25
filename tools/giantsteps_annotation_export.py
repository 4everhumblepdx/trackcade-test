#!/usr/bin/env python3
import concurrent.futures, json, urllib.request

BASE='https://raw.githubusercontent.com/GiantSteps/giantsteps-tempo-dataset/master/'

def get_text(url, timeout=60):
    req=urllib.request.Request(url, headers={'User-Agent':'Trackcade-StressLab/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8')

def fetch(name):
    stem=name.removesuffix('.mp3')
    try:
        data=json.loads(get_text(BASE+f'annotations_v2/jams/{stem}.jams'))
        tempo_ann=next((a for a in data.get('annotations',[]) if a.get('namespace')=='tempo'), None)
        vals=[]
        for item in (tempo_ann or {}).get('data',[]):
            vals.append({'bpm':float(item['value']), 'confidence':float(item.get('confidence',0.0))})
        vals.sort(key=lambda x:x['confidence'], reverse=True)
        return {'track_id':stem,'audio_name':name,'tempo_votes':vals,'error':None}
    except Exception as e:
        return {'track_id':stem,'audio_name':name,'tempo_votes':[],'error':repr(e)}

def main():
    names=[x.strip() for x in get_text(BASE+'splits/files.txt').splitlines() if x.strip()]
    rows=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for row in ex.map(fetch,names): rows.append(row)
    rows.sort(key=lambda r:r['track_id'])
    with open('giantsteps_annotations.jsonl','w') as f:
        for r in rows: f.write(json.dumps(r,sort_keys=True)+'\n')
    summary={
      'tracks':len(rows),
      'errors':sum(bool(r['error']) for r in rows),
      'with_secondary':sum(len(r['tempo_votes'])>1 for r in rows),
      'mean_primary_confidence':sum((r['tempo_votes'][0]['confidence'] if r['tempo_votes'] else 0) for r in rows)/max(1,len(rows)),
    }
    with open('giantsteps_annotations_summary.json','w') as f: json.dump(summary,f,indent=2,sort_keys=True)
    print(json.dumps(summary,indent=2,sort_keys=True))
if __name__=='__main__': main()
