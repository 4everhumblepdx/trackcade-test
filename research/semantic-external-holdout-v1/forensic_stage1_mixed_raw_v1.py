"""Offline descriptive analysis of frozen Stage1 outputs; no scoring or generation.

Explicit cached packet/proposal inputs only. Never reads reference source, audio,
credentials, terminal holdout, or executes experimental runners.
"""
import argparse
import collections
import csv
import hashlib
import io
import json
import math
from pathlib import Path

BASE = Path(__file__).resolve().parent
PREFIX = 'STAGE1_MIXED_V7_V8_FORENSIC_'

def load(path):
    return json.loads(path.read_bytes())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, value):
    p = BASE / (PREFIX + name + '_V1.json')
    p.write_bytes((json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + '\n').encode())
    return {'path': p.name, 'sha256': digest(p)}

def quantile(values, p):
    a = sorted(values)
    x = (len(a)-1)*p
    lo, hi = math.floor(x), math.ceil(x)
    return a[lo] + (a[hi]-a[lo])*(x-lo)

def numeric(values):
    return dict(count=len(values), median=quantile(values,.5), q1=quantile(values,.25),
                q3=quantile(values,.75), iqr=quantile(values,.75)-quantile(values,.25),
                minimum=min(values), maximum=max(values)) if values else {'count':0}

def energy(curve, t):
    if not curve or t < curve[0]['time'] or t > curve[-1]['time']:
        return None
    for a,b in zip(curve,curve[1:]):
        if a['time'] <= t <= b['time']:
            return a['energy'] + (b['energy']-a['energy'])*(t-a['time'])/(b['time']-a['time'])
    return curve[-1]['energy']

def packet_at(p, t):
    c=p['context']; anchors=[dict(zip(p['anchorColumns'],a)) for a in p['anchors']]
    sections=c['sections']
    containing=next((i for i,s in enumerate(sections) if s['start']<=t<s['end']),None)
    if containing is None and sections and t==sections[-1]['end']: containing=len(sections)-1
    f={}; detail={}
    for role, offset in [('section',0),('previousSection',-1),('followingSection',1),('twoSectionsBack',-2)]:
        s=sections[containing+offset] if containing is not None and 0<=containing+offset<len(sections) else None
        detail[role]=s
        for k in ['energy','activity','confidence','duration']:
            f[role+'.'+k]=s.get(k) if s else None
    s=detail['section']; prev=detail['previousSection']
    f['section.ageSeconds']=t-s['start'] if s else None
    f['section.energyChangeFromPrevious']=s['energy']-prev['energy'] if s and prev else None
    f['section.activityChangeFromPrevious']=s['activity']-prev['activity'] if s and prev else None
    before=detail['twoSectionsBack']
    f['previousSection.energyReductionFromPrior']=before['energy']-prev['energy'] if before and prev else None
    for role, items in [('boundary',c['boundaries']),('landmark',c['landmarks'])]:
        item=min(items,key=lambda x:(abs(anchors[x['anchor']]['time']-t),anchors[x['anchor']]['time'],x['anchor'])) if items else None
        detail['nearest'+role.title()]=item
        at=anchors[item['anchor']]['time'] if item else None
        f[role+'.distanceSeconds']=abs(at-t) if at is not None else None
        f[role+'.signedOffsetSeconds']=at-t if at is not None else None
        for k in (['energyDelta','incomingSectionConfidence','incomingSectionEnergy','previousSectionConfidence','previousSectionEnergy'] if role=='boundary' else ['intensity']):
            f[role+'.'+k]=item.get(k) if item else None
        local=item.get('localEnergyContext',{}) if item else {}
        for k in ['at','before','after','riseInto','changeAfter','netChange','windowSeconds']:
            f[role+'.localEnergy.'+k]=local.get(k)
    windows=c['lowDemandWindows']
    active=[x for x in windows if x['start']<=t<x['end']]
    preceding=[x for x in windows if x['end']<=t]
    low=max(preceding,key=lambda x:x['end']) if preceding else None
    detail['previousLowDemandWindow']=low; detail['containingLowDemandWindows']=active
    f['inLowDemandWindow']=bool(active)
    for k in ['energy','confidence']:
        f['previousLowDemandWindow.'+k]=low.get(k) if low else None
    f['previousLowDemandWindow.durationSeconds']=low['end']-low['start'] if low else None
    f['previousLowDemandWindow.gapSeconds']=t-low['end'] if low else None
    f['energy.interpolatedAtEvent']=energy(c['energy']['curve'],t)
    f['energy.global']=c['energy']['global']
    f['structureConfidence']=c['structureTrust']['structureConfidence']
    for k,v in c['timingTrust'].items():
        f['timingTrust.'+k]=' | '.join(v) if isinstance(v,list) else v
    return f,detail

def event_time(e,p):
    a=e['anchor']
    if a['type']!='evidence': raise ValueError('Unexpected non-evidence event anchor')
    return p['anchors'][a['index']][p['anchorColumns'].index('time')]

def main(cache):
    manifest_path=BASE/'STAGE1_MIXED_V7_V8_PREDICTION_MANIFEST_V1.json'
    result_path=BASE/'STAGE1_MIXED_V7_V8_RAW_RESULT_V1.json'
    assert digest(manifest_path) in {'2486614f9e02be0d01306c6df18119957cba4e29f7fd645b1eae1cad866ac8a0','383f937020bd6433667cce8b309528ae7e6025e191b28ea75c6d1258624ba2c5'}
    assert digest(result_path) in {'b804859986ebfca05c2ce05bc9ff8d4d731eae0230e669b1eed36f5430c930d2','a017c7af9868fe28b66c6007666f098efd80a51d02f91dbc5d5623404e8fd627'}
    manifest=load(manifest_path); result=load(result_path)
    tracks=result['sensitivity']['2']['perTrack']
    rows=[]; fns=[]; track_rows=[]; verified=[]
    for case,tr in zip(manifest['cases'],tracks):
        n=case['ordinal']; assert n==tr['ordinal']
        pp=cache/'packets'/f'{n:02}-{case["stem"]}.json'
        qp=cache/'proposals'/f'{n:02}-{case["stem"]}.json'
        assert digest(pp)==case['packetSha256']; assert digest(qp)==case['normalizedProposalSha256']
        p=load(pp); q=load(qp); verified.append({'ordinal':n,'packetSha256':digest(pp),'proposalSha256':digest(qp)})
        assert q['source']['analysisJsonSha256']==case['analysisJsonSha256']
        drops=sorted([(event_time(e,p),i,e) for i,e in enumerate(q['events']) if e['kind']=='drop'])
        assert [x[0] for x in drops]==tr['predictedDropsSeconds']
        matched={x['candidateIndex'] for x in tr['matchedPairs']}
        ref=tr['referenceDropsSeconds']
        track_rows.append({'ordinal':n,'id':case['id'],'referenceCount':len(ref),'dropCount':len(drops),
                           'semanticEventCount':len(q['events']),'durationSeconds':p['source']['duration'],
                           'trackSummary':q['trackSummary'],'packetGlobalEnergy':p['context']['energy']['global'],
                           'sectionCount':len(p['context']['sections']),'lowDemandWindowCount':len(p['context']['lowDemandWindows'])})
        for ci,(t,ei,e) in enumerate(drops):
            aa=[a for a in q['candidateAssessments'] if a['anchor']==e['anchor']]
            assert len(aa)==1
            a=aa[0]; f,detail=packet_at(p,t)
            raw_anchor=dict(zip(p['anchorColumns'],p['anchors'][e['anchor']['index']]))
            f.update({'anchor.priority':p['priorityCodes'][raw_anchor['priorityCode']] if raw_anchor['priorityCode'] is not None else None,
                      'anchor.source':p['sourceCodes'][raw_anchor['sourceCode']] if raw_anchor['sourceCode'] is not None else None,
                      'anchor.salience':raw_anchor['salience'],'anchor.confidence':raw_anchor['confidence'],
                      'event.semanticConfidence':e['semanticConfidence'],
                      'track.dropCount':len(drops),'track.semanticEventCount':len(q['events']),
                      'track.durationSeconds':p['source']['duration'],
                      'track.ambiguousCandidateCount':q['trackSummary']['ambiguousCandidateCount'],
                      'track.dropPresence':q['trackSummary']['dropPresence'],
                      'track.sectionCount':len(p['context']['sections']),
                      'track.lowDemandWindowCount':len(p['context']['lowDemandWindows'])})
            for k in ['decisiveImpact','preparation','sustainedStrongerPassage','repetitionRelation','semanticConfidence','semanticRole','structuralContext']:f['assessment.'+k]=a[k]
            prior=[(event_time(x,p),j,x) for j,x in enumerate(q['events']) if event_time(x,p)<t]
            pe=max(prior,key=lambda x:(x[0],x[1])) if prior else None
            f['previousSemanticEvent.kind']=pe[2]['kind'] if pe else None
            f['previousSemanticEvent.gapSeconds']=t-pe[0] if pe else None
            f['event.positionFraction']=t/p['source']['duration']
            distance=min([abs(t-r) for r in ref],default=None)
            outcome='TP' if ci in matched else 'FP'
            group='TP' if outcome=='TP' else 'zero_reference_FP' if not ref else 'greater_than_5s_FP' if distance>5 else '2_to_5s_FP'
            rows.append({'ordinal':n,'id':case['id'],'semanticVersion':case['semanticVersion'],
                         'candidateIndex':ci,'proposalEventIndex':ei,'outcome':outcome,'errorGroup':group,
                         'nearestReferenceDistanceSeconds':distance,'anchor':e['anchor'],'timeSeconds':t,
                         'event':e,'candidateAssessment':a,'trackSummary':q['trackSummary'],
                         'features':f,'packetContext':detail,'previousSemanticEvent':pe[2] if pe else None,
                         'unavailable':['spectral novelty','independent rhythmic change','instrumentation/density change',
                                        'physical silence','semantic section labels','event importance',
                                        'explicit buildup/breakdown measurements','independent impact measurement'],
                         'provenance':{'packetSha256':case['packetSha256'],'proposalSha256':case['normalizedProposalSha256']}})
        all_events=[(event_time(e,p),i,e) for i,e in enumerate(q['events'])]
        for ri in tr['unmatchedReferenceIndices']:
            t=ref[ri]
            near=min(all_events,key=lambda x:(abs(x[0]-t),x[0],x[1])) if all_events else None
            nd=min(drops,key=lambda x:(abs(x[0]-t),x[0],x[1])) if drops else None
            dist=abs(nd[0]-t) if nd else None; ad=abs(near[0]-t) if near else None
            category='nearby_drop_timing_2_to_5s' if dist is not None and 2<dist<=5 else 'non_drop_event_within_2s' if near and ad<=2 and near[2]['kind']!='drop' else 'semantic_event_2_to_5s' if near and 2<ad<=5 else 'no_semantic_event_within_5s'
            f,detail=packet_at(p,t)
            assessments=sorted(q['candidateAssessments'],key=lambda a:(abs(event_time(a,p)-t),event_time(a,p),a['anchor']['index']))
            nearest_assessment=assessments[0] if assessments else None
            fns.append({'ordinal':n,'id':case['id'],'referenceIndex':ri,'referenceSeconds':t,'category':category,
                        'nearestSemanticEvent':near[2] if near else None,'nearestSemanticEventSeconds':near[0] if near else None,
                        'nearestSemanticEventDistanceSeconds':ad,'nearestDropSeconds':nd[0] if nd else None,
                        'nearestDropDistanceSeconds':dist,'trackDropCount':len(drops),
                        'nearestCandidateAssessment':nearest_assessment,
                        'nearestCandidateAssessmentDistanceSeconds':abs(event_time(nearest_assessment,p)-t) if nearest_assessment else None,
                        'referenceConditionedPacketFeatures':f,'packetContext':detail,
                        'interpretationLimit':'Location queried using Stage1 reference; descriptive diagnosis, not a deployable pre-label feature. No semantic correctness inferred from other event type.'})
    assert len(rows)==81 and sum(r['outcome']=='TP' for r in rows)==21 and len(fns)==25
    groups={'TP':[r for r in rows if r['outcome']=='TP'],'all_FP':[r for r in rows if r['outcome']=='FP'],
            'zero_reference_FP':[r for r in rows if r['errorGroup']=='zero_reference_FP'],
            'greater_than_5s_FP':[r for r in rows if r['errorGroup']=='greater_than_5s_FP']}
    summaries={}
    for feature in sorted(rows[0]['features']):
        values=[r['features'][feature] for r in rows if r['features'][feature] is not None]
        is_numeric=bool(values) and all(isinstance(v,(int,float)) and not isinstance(v,bool) for v in values)
        summary={'type':'numeric' if is_numeric else 'categorical','groups':{}}
        for group, rr in groups.items():
            vv=[r['features'][feature] for r in rr if r['features'][feature] is not None]
            s=numeric(vv) if is_numeric else {'count':len(vv),'categories':[{'value':v,'count':count,'proportionOfAvailable':count/len(vv),'proportionOfGroup':count/len(rr)} for v,count in sorted(collections.Counter(vv).items(),key=lambda x:str(x[0]))]}
            s['missingCount']=len(rr)-len(vv); s['groupCount']=len(rr); summary['groups'][group]=s
        summaries[feature]=summary
    zero=[r for r in track_rows if r['referenceCount']==0]
    zero_summary={'trackCount':len(zero),'tracksWithDropProposals':sum(r['dropCount']>0 for r in zero),
                  'dropCountDistribution':dict(sorted(collections.Counter(r['dropCount'] for r in zero).items())),
                  'falseDropEventCount':sum(r['dropCount'] for r in zero),'tracks':zero}
    track_compare={}
    for key in ['dropCount','semanticEventCount','durationSeconds','packetGlobalEnergy','sectionCount','lowDemandWindowCount']:
        track_compare[key]={g:numeric([r[key] for r in track_rows if (r['referenceCount']>0)==positive]) for g,positive in [('reference_positive',True),('zero_reference',False)]}
    artifacts=[write('EVENTS',rows),write('FALSE_NEGATIVES',fns),write('TRACKS',track_rows),
               write('FEATURE_SUMMARIES',summaries),write('ZERO_REFERENCE',zero_summary),write('TRACK_COMPARISON',track_compare)]
    for label,data in [('EVENTS',rows),('FALSE_NEGATIVES',fns),('TRACKS',track_rows)]:
        flat=[]
        for row in data:
            out={k:(json.dumps(v,sort_keys=True,separators=(',',':')) if isinstance(v,(dict,list)) else v) for k,v in row.items() if k!='features'}
            out.update(row.get('features',{}));flat.append(out)
        stream=io.StringIO(newline=''); writer=csv.DictWriter(stream,fieldnames=list(flat[0]),lineterminator='\n');writer.writeheader();writer.writerows(flat)
        path=BASE/(PREFIX+label+'_V1.csv');path.write_bytes(stream.getvalue().encode());artifacts.append({'path':path.name,'sha256':digest(path)})
    methods={'schema':'trackcade-stage1-frozen-raw-forensic-tables-v1','sourceHead':'284c723148f72c3f5b05fed73660231b22012d14',
             'manifestSha256':digest(manifest_path),'resultSha256':digest(result_path),'verifiedCases':verified,
             'eventCount':len(rows),'TP':21,'FP':60,'FN':25,'FNCategoryCounts':dict(collections.Counter(r['category'] for r in fns)),
             'featureCount':len(summaries),'groupCounts':{k:len(v) for k,v in groups.items()},'artifacts':artifacts,
             'methods':['Outcomes copied from frozen two-second matched candidate indices; no scorer rerun.',
                        'Packet/proposal bytes checked against frozen manifest; proposal times must equal frozen result exactly.',
                        'Nearest packet boundary/landmark tie break: distance, time, anchor. Their energy windows are measurements at that anchor, not necessarily at proposal time; distance always retained.',
                        'Sections contain time with start inclusive, end exclusive; final endpoint inclusive. Previous/following sections are structural neighbors, not semantic labels.',
                        'Curve at event uses linear interpolation of existing frozen energy samples; no new audio analysis.',
                        'Most recent completed low-demand window is reported with gap; not asserted to prepare the event. Section activity is a frozen proxy, not instrumentation or rhythmic evidence.',
                        'Reference-conditioned FN context is diagnostic only. Nearest semantic event ties: distance, time, original event index. Existing 2s and 5s tolerances used descriptively.',
                        'All scalar pre-label features summarized. Text, identities, times, anchor indices and structured source context are preserved in rows; free text not fitted or assigned post-hoc musical categories.',
                        'Quartiles: linear interpolation at (n-1)*p; IQR=q3-q1. Categorical proportions include available and entire group denominators.',
                        'Event observations clustered within tracks; no independence claims, trained classifier, effect significance test, threshold optimization or counterfactual score.',
                        'Candidate gates/confidence are model assertions, not independent corroboration. Source codes denote frozen anchor provenance, not acoustic features.'],
             'providerCalls':0,'providerSpendUsd':'0','credentialAccessed':False,'terminalHoldoutAccessed':False,
             'predictionsChanged':False,'scoringRerun':False,'analyzerExecutedOrModified':False,'compilerInvoked':False,
             'hypothesesWritten':False,'nonDropGameplayEligibilityPreserved':True}
    write('TABLE_FREEZE',methods)
    print(json.dumps({k:methods[k] for k in ['eventCount','TP','FP','FN','FNCategoryCounts','featureCount','groupCounts']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--cache',type=Path,required=True)
    main(parser.parse_args().cache.resolve())
