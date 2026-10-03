"""Provider-free proximity forensics using frozen scores, never recompute Drop matches."""
from pathlib import Path
import json,csv,hashlib,subprocess,collections,math,sys
w=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent;repo=w/'trackcade-test';base=repo/'research/semantic-external-holdout-v1';out=w/'v9-reclassification-forensics-v1';out.mkdir(exist_ok=True)
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *args:subprocess.check_output(['git',*args],cwd=repo)
HEAD='e06de28e8d5bc2d062a766ab6d133b2edd1140c9'
assert git('merge-base','--is-ancestor',HEAD,'HEAD')==b'' and not git('status','--porcelain')
def frozen(name,commit=HEAD):
 p=base/name;data=git('show',commit+':research/semantic-external-holdout-v1/'+name);assert p.read_bytes().replace(b'\r\n',b'\n')==data;return json.loads(data)
bm=frozen('STAGE1_MIXED_V7_V8_PREDICTION_MANIFEST_V1.json','4205d8bd01e074bdb76dd2561acfd5d8a8d79c88')
vm=frozen('STAGE1_V9_GROUNDED_PREDICTION_MANIFEST_V1.json','288dec76ba93632e238622ef080d561109a6dca1')
br=frozen('STAGE1_MIXED_V7_V8_RAW_RESULT_V1.json','44c3fe1d2ab50f905bbb54367b5cb6d517c94420')
vr=frozen('STAGE1_V9_GROUNDED_RAW_RESULT_V1.json')
refpath=w/'stage1-raw-evaluation-20261003/stage1-reference-value.json';assert sha(refpath.read_bytes())==br['stage1ReferenceSha256']==vr['stage1ReferenceSha256']
refs={x['id']:sorted(x['dropsSeconds']) for x in load(refpath)};assert len(refs)==50
bs={c['ordinal']:c for c in br['sensitivity']['2']['perTrack']};vs={c['ordinal']:c for c in vr['sensitivity']['2']['perTrack']}
assert [c['semanticVersion'] for c in bm['cases']]==['V7']*3+['V8']*47
def within(d,t):return d is not None and d<=t+1e-12
def nearest(events,t):return min(events,key=lambda e:(abs(e['timestamp']-t),e['timestamp'],e['eventIndex'])) if events else None
def proximity(events,t):
 e=nearest(events,t);d=abs(e['timestamp']-t) if e else None
 ties=[{'eventIndex':x['eventIndex'],'kind':x['kind'],'timestamp':x['timestamp']} for x in events if e and abs(abs(x['timestamp']-t)-d)<1e-12]
 return {'v9NearestEvent':e,'v9Timestamp':e['timestamp'] if e else None,'v9Kind':e['kind'] if e else 'none','v9DistanceSeconds':d,'within1':within(d,1),'within2':within(d,2),'within5':within(d,5),'equalDistanceTies':ties,'nearbyKindsAt2':sorted({x['kind'] for x in events if within(abs(x['timestamp']-t),2)}),'nearbyKindsAt5':sorted({x['kind'] for x in events if within(abs(x['timestamp']-t),5)})}
def bucket(row,t):
 if within(row['v9DistanceSeconds'],t):return row['v9Kind'] if row['v9Kind'] in ['drop','peak','energy','section'] else 'other'
 return 'only_2_to_5' if t==2 and row['within5'] else 'absent_within_5'
def event_rows(proposal,packet):
 rows=[]
 for i,e in enumerate(proposal['events']):
  a=e['anchor'];assert a['type']=='evidence' and type(a['index']) is int
  t=packet['anchors'][a['index']][0];assert isinstance(t,(int,float)) and math.isfinite(t)
  rows.append({**e,'eventIndex':i,'timestamp':t})
 return rows
def anchor_observations(packet,index):
 if index is None:return None
 t=packet['anchors'][index][0];ctx=packet['context'];anchors=packet['anchors'];cols=packet['anchorColumns']
 def decoded(i):
  d=dict(zip(cols,anchors[i]));d['anchorIndex']=i
  for column,enum in [('sourceCode','sourceCodes'),('priorityCode','priorityCodes')]:
   value=d.get(column);d[column+'Name']=packet[enum][value] if type(value) is int and 0<=value<len(packet[enum]) else None
  return d
 curve=ctx.get('energy',{}).get('curve',[]);before=[v for v in curve if v['time']<=t];after=[v for v in curve if v['time']>t]
 local={k:[x for x in ctx.get(k,[]) if type(x.get('anchor')) is int and within(abs(anchors[x['anchor']][0]-t),5)] for k in ['boundaries','landmarks']}
 return {'anchor':decoded(index),'adjacentAnchorRows':[decoded(i) for i in range(max(0,index-2),min(len(anchors),index+3))],'onsetSourceAnchorRowsWithin2Seconds':[decoded(i) for i,row in enumerate(anchors) if row[2] is not None and packet['sourceCodes'][row[2]]=='onset' and within(abs(row[0]-t),2)],'existingEnergySamples':before[-2:]+after[:2],'contextWithin5Seconds':local,'interpretationLimit':'Existing numeric packet values only. Onset source tags and salience are not waveform attack measurements or Drop probability; coarse energy samples do not prove concentrated impact.'}
tp=[];fp=[];fn=[];reference_rows=[];tracks=[];lost=[];all_events=[];provenance=[];overlap={'retained':[],'lost':[],'newV9TP':[],'baselineFNStillFN':[]}
for bc,vc in zip(bm['cases'],vm['cases']):
 n=bc['ordinal'];assert n==vc['ordinal'] and bc['id']==vc['id'] and bc['stem']==vc['stem']
 stem=f"{n:02d}-{bc['stem']}.json";bp=w/'stage1-mixed-collection/proposals'/stem;vp=w/'v9-paid-evidence/collection/proposals'/stem;packetpath=w/'v9-paid-evidence/collection/packets'/stem;baselinepacket=w/'stage1-mixed-collection/packets'/stem
 assert sha(bp.read_bytes())==bc['normalizedProposalSha256'];assert sha(vp.read_bytes())==vc['normalizedProposalSha256'];assert sha(packetpath.read_bytes())==vc['packetSha256']==bc['packetSha256']==sha(baselinepacket.read_bytes())
 packet=load(packetpath);baseline=load(bp);v9=load(vp);be=event_rows(baseline,packet);ve=event_rows(v9,packet);drops=sorted([e for e in be if e['kind']=='drop'],key=lambda e:(e['timestamp'],e['eventIndex']))
 B,V=bs[n],vs[n];ref=refs[bc['id']];assert B['referenceDropsSeconds']==V['referenceDropsSeconds']==ref
 assert B['predictedDropsSeconds']==[e['timestamp'] for e in drops];assert V['predictedDropsSeconds']==sorted(e['timestamp'] for e in ve if e['kind']=='drop')
 bmatch={p['referenceIndex']:p for p in B['matchedPairs']};vmatch={p['referenceIndex']:p for p in V['matchedPairs']};bci={p['candidateIndex'] for p in B['matchedPairs']}
 identity={'ordinal':n,'id':bc['id'],'stem':bc['stem']}
 for ri,t in enumerate(ref):
  r={**identity,'referenceIndex':ri,'referenceTimestamp':t,**proximity(ve,t),'baselineRawDropTP':ri in bmatch,'v9RawDropTP':ri in vmatch}
  reference_rows.append(r)
  if ri in bmatch and ri in vmatch:overlap['retained'].append(r)
  elif ri in bmatch:overlap['lost'].append(r)
  elif ri in vmatch:overlap['newV9TP'].append(r)
  else:overlap['baselineFNStillFN'].append(r)
  if ri not in vmatch:
   nearb=nearest(drops,t);bd=abs(nearb['timestamp']-t) if nearb else None
   r={**r,'baselineNearbyDrop':nearb,'baselineNearestDropDistance':bd,'baselineDropWithin2':within(bd,2),'baselineDropWithin5':within(bd,5),'baselineReferenceStatus':'baseline TP' if ri in bmatch else 'baseline nearby FP/unmatched' if any(within(abs(e['timestamp']-t),2) and ci not in bci for ci,e in enumerate(drops)) else 'no baseline Drop nearby','baselineRawReferenceStatus':'baseline TP' if ri in bmatch else 'baseline FN'}
   fn.append(r)
 for p in B['matchedPairs']:
  ri,ci=p['referenceIndex'],p['candidateIndex'];b=drops[ci];t=ref[ri]
  r={**identity,'referenceIndex':ri,'referenceTimestamp':t,'baselineCandidateIndex':ci,'baselineTimestamp':b['timestamp'],'baselineTimingErrorSeconds':abs(b['timestamp']-t),'baselineEvent':b,'baselineRationale':b.get('rationale'),**proximity(ve,t),'retainedAsV9RawDropTP':ri in vmatch,'baselineCandidateAssessmentsAtAnchor':[a for a in baseline.get('candidateAssessments',[]) if a['anchor']['index']==b['anchor']['index']]}
  r['nearestTransition2']=bucket(r,2);r['nearestTransition5']=bucket(r,5)
  r['retentionAwareTransition2']='retained_raw_drop_tp' if ri in vmatch else r['nearestTransition2'];r['retentionAwareTransition5']='retained_raw_drop_tp' if ri in vmatch else r['nearestTransition5']
  tp.append(r)
  if ri not in vmatch:
   e=r['v9NearestEvent'];nearestanchor=e['anchor']['index'] if e else None
   nearassess=sorted([a for a in v9.get('candidateAssessments',[]) if within(abs(packet['anchors'][a['anchor']['index']][0]-t),5)],key=lambda a:(abs(packet['anchors'][a['anchor']['index']][0]-t),a['anchor']['index']))
   r.update(v9CandidateAssessmentsWithin5=nearassess,v9AssessmentsAtBaselineAnchor=[a for a in v9.get('candidateAssessments',[]) if a['anchor']['index']==b['anchor']['index']],v9AssessmentsAtNearestEventAnchor=[a for a in v9.get('candidateAssessments',[]) if a['anchor']['index']==nearestanchor],packetObservationsAtBaselineAnchor=anchor_observations(packet,b['anchor']['index']),packetObservationsAtNearestV9EventAnchor=anchor_observations(packet,nearestanchor))
   r['focusedClassification']=('correct moment retained, Drop→'+e['kind'].capitalize() if r['within2'] and e['kind'] in ['peak','energy','section'] else 'correct moment retained, other type' if r['within2'] else 'moment represented but timing shifted 2–5s' if r['within5'] else 'moment absent')
   r['classificationMeaning']='Temporal correspondence to expert reference only; semantic correctness and player interaction suitability not established.'
   lost.append(r)
 for ci in B['unmatchedCandidateIndices']:
  b=drops[ci];t=b['timestamp'];r={**identity,'baselineCandidateIndex':ci,'baselineTimestamp':t,'baselineEvent':b,'baselineRationale':b.get('rationale'),'nearestReferenceDistanceSeconds':min((abs(x-t) for x in ref),default=None),**proximity(ve,t),'baselineCandidateAssessmentsAtAnchor':[a for a in baseline.get('candidateAssessments',[]) if a['anchor']['index']==b['anchor']['index']]}
  r['nearestTransition2']=bucket(r,2);r['nearestTransition5']=bucket(r,5)
  r['v9DropExistsWithin2']=any(e['kind']=='drop' and within(abs(e['timestamp']-t),2) for e in ve);r['v9DropExistsWithin5']=any(e['kind']=='drop' and within(abs(e['timestamp']-t),5) for e in ve)
  r['eliminatedAsDropAt2']=not r['v9DropExistsWithin2'];r['eliminatedAsDropAt5']=not r['v9DropExistsWithin5']
  r['v9AssessmentsAtBaselineAnchor']=[a for a in v9.get('candidateAssessments',[]) if a['anchor']['index']==b['anchor']['index']]
  r['v9CandidateAssessmentsWithin5']=[a for a in v9.get('candidateAssessments',[]) if within(abs(packet['anchors'][a['anchor']['index']][0]-t),5)]
  r['packetObservationsAtBaselineAnchor']=anchor_observations(packet,b['anchor']['index']);fp.append(r)
 counts=collections.Counter(e['kind'] for e in ve)
 tracks.append({**identity,'referenceDropCount':len(ref),'baselineDropCount':len(drops),'baselineTP':B['truePositives'],'baselineFP':B['falsePositives'],'baselineFN':B['falseNegatives'],'v9DropCount':counts['drop'],'v9TP':V['truePositives'],'v9FP':V['falsePositives'],'v9FN':V['falseNegatives'],'v9PeakCount':counts['peak'],'v9EnergyCount':counts['energy'],'v9SectionCount':counts['section'],'referencesWithAnyV9EventWithin2':sum(proximity(ve,t)['within2'] for t in ref),'referencesWithAnyV9EventWithin5':sum(proximity(ve,t)['within5'] for t in ref)})
 for e in ve:all_events.append({**identity,**e,'nearestReferenceDistance':min((abs(e['timestamp']-t) for t in ref),default=None)})
 provenance.append({**identity,'baselineSemanticVersion':bc['semanticVersion'],'baselineProposalSha256':bc['normalizedProposalSha256'],'v9ProposalSha256':vc['normalizedProposalSha256'],'packetSha256':vc['packetSha256'],'baselineResultArtifact':bc['resultArtifact'],'v9ResultArtifact':vc['resultArtifact']})
assert len(tp)==21 and len(fp)==60 and len(fn)==35 and len(reference_rows)==46 and len(tracks)==50
assert collections.Counter(e['kind'] for e in all_events)=={'section':242,'peak':84,'energy':113,'drop':21}
count=lambda rows,field:dict(sorted(collections.Counter(r[field] for r in rows).items()))
coverage={str(t):{'name':'semantic-event coverage around expert Drop references','referenceCount':46,'covered':sum(r[f'within{t}'] for r in reference_rows),'nearestEventKindCountsAmongCovered':dict(collections.Counter(r['v9Kind'] for r in reference_rows if r[f'within{t}'])),'nearbyKindPresenceCountsNonexclusive':{k:sum(k in r[f'nearbyKindsAt{t}'] for r in reference_rows) for k in ['drop','peak','energy','section']} if t!=1 else {k:sum(any(e['ordinal']==r['ordinal'] and e['kind']==k and within(abs(e['timestamp']-r['referenceTimestamp']),t) for e in all_events) for r in reference_rows) for k in ['drop','peak','energy','section']}} for t in [1,2,5]}
summary={'baselineTP21':{'rawDropTPRetained':len(overlap['retained']),'rawDropTPLost':len(lost),'nearestEventPrimary2':count(tp,'nearestTransition2'),'retentionAwarePrimary2':count(tp,'retentionAwareTransition2'),'nearestEventSensitivity5':count(tp,'nearestTransition5'),'retentionAwareSensitivity5':count(tp,'retentionAwareTransition5')},'baselineFP60':{'nearestEventPrimary2':count(fp,'nearestTransition2'),'nearestEventSensitivity5':count(fp,'nearestTransition5'),'dropEliminatedPrimary2':sum(r['eliminatedAsDropAt2'] for r in fp),'dropEliminatedSensitivity5':sum(r['eliminatedAsDropAt5'] for r in fp),'eliminatedPrimary2Transitions':count([r for r in fp if r['eliminatedAsDropAt2']],'nearestTransition2'),'eliminatedSensitivity5Transitions':count([r for r in fp if r['eliminatedAsDropAt5']],'nearestTransition5')},'v9FN35':{'primary2':count(fn,'nearestTransition2') if all('nearestTransition2' in r for r in fn) else dict(collections.Counter(bucket(r,2) for r in fn)),'sensitivity5':dict(collections.Counter(bucket(r,5) for r in fn)),'coveredWithin2':sum(r['within2'] for r in fn),'coveredWithin5':sum(r['within5'] for r in fn),'lostBaselineTPs':len(lost),'baselineAlreadyMissedStillV9FN':len(overlap['baselineFNStillFN']),'newV9TPsAmongBaselineFNs':len(overlap['newV9TP'])},'lostBaselineTPs':{'count':len(lost),'within2':sum(r['within2'] for r in lost),'within5':sum(r['within5'] for r in lost),'primary2':count(lost,'nearestTransition2'),'sensitivity5':count(lost,'nearestTransition5')},'all46ReferenceCoverage':coverage,'v9EventCountsNearReferences':{k:{'total':sum(e['kind']==k for e in all_events),**{f'within{t}':sum(e['kind']==k and within(e['nearestReferenceDistance'],t) for e in all_events) for t in [2,5]}} for k in ['drop','peak','energy','section']},'rawOverlap':{k:len(v) for k,v in overlap.items()}}
sources={'startCommit':HEAD,'baselineManifestCommit':'4205d8bd01e074bdb76dd2561acfd5d8a8d79c88','baselineRawResultCommit':'44c3fe1d2ab50f905bbb54367b5cb6d517c94420','v9PredictionFreezeCommit':'288dec76ba93632e238622ef080d561109a6dca1','v9ScoringContractCommit':'1a959b3f0bffff1a073f38461abf4a598fcd6a5c','paidRunId':37145954313,'hashByteAuthority':'Immutable Git blob bytes for repo manifests/results; exact artifact bytes for packets/proposals. Working-tree CRLF permitted only when LF-normalized bytes equal Git blob; no prediction bytes normalized or changed.','manifestHashes':{n:sha(git('show','HEAD:research/semantic-external-holdout-v1/'+n)) for n in ['STAGE1_MIXED_V7_V8_PREDICTION_MANIFEST_V1.json','STAGE1_V9_GROUNDED_PREDICTION_MANIFEST_V1.json']},'rawResultHashes':{n:sha(git('show','HEAD:research/semantic-external-holdout-v1/'+n)) for n in ['STAGE1_MIXED_V7_V8_RAW_RESULT_V1.json','STAGE1_V9_GROUNDED_RAW_RESULT_V1.json']},'referenceSha256':sha(refpath.read_bytes()),'referenceIsolationProof':br['isolationProof'],'perCaseHashesAndArtifactProvenance':provenance}
data={'schema':'trackcade-stage1-v9-reclassification-forensics-v1','status':'provider-free-development-forensics-no-prediction-changes','baselineName':'V7/V8 accepted50 baseline','method':{'dropTPFPFN':'Consume immutable existing ±2s matchedPairs and unmatched indices; no scorer execution or match changes.','nearestEvent':'Absolute timestamp distance, ties by earlier timestamp then original event array index; equal-distance ties retained; no preferred event kind.','eventCorrespondence':'Per-query nearest event, reusable across queries; proximity is descriptive, not proof of causal reclassification or gameplay suitability.','thresholdsSeconds':[1,2,5],'fpEliminatedDefinition':'No V9 kind=drop event within ±2s of original baseline FP timestamp; ±5s sensitivity. Net 60→10 FP reduction alone does not identify a paired set of 50 eliminated FPs.','headlineRetention':'Frozen V9 RAW Drop TP membership reported separately from nearest-event-kind proximity.','baselineFNStatus':'Frozen reference FN status separately from nearby unmatched baseline Drop; neither inferred from proximity alone.','packetEvidence':'Exact existing anchor rows, onset source tags, localEnergyContext, boundaries/landmarks and neighboring energy samples. No audio, new acoustic measurements, or label-derived thresholds.'},'sources':sources,'summary':summary,'baselineTruePositiveTransitions':tp,'baselineFalsePositiveTransitions':fp,'v9FalseNegativeForensics':fn,'lostBaselineTruePositives':lost,'allReferenceEventCoverage':reference_rows,'trackCoverage':tracks,'allV9SemanticEvents':all_events,'restrictions':{'providerCalls':0,'providerSpendUsd':'0','predictionsChanged':False,'scoringContractChanged':False,'v9GenerationRerun':False,'semanticTreatmentChanged':False,'terminalAccessed':False,'terminalMetadataInspected':False,'analyzerInvoked':False,'compilerInvoked':False,'labelInformedDevelopmentAnalysis':True,'unseenValidationClaimed':False}}
(out/'STAGE1_V9_RECLASSIFICATION_FORENSICS_V1.json').write_bytes((json.dumps(data,indent=2)+'\n').encode())
def csvwrite(name,rows,fields):
 with (out/name).open('w',encoding='utf-8',newline='') as f:
  writer=csv.DictWriter(f,fieldnames=fields,lineterminator='\n');writer.writeheader()
  for r in rows:
   row={k:r.get(k) for k in fields}
   for k,v in row.items():
    if isinstance(v,(dict,list)):row[k]=json.dumps(v,ensure_ascii=False,separators=(',',':'))
   writer.writerow(row)
common=['ordinal','id','stem','referenceIndex','referenceTimestamp','baselineTimestamp','baselineTimingErrorSeconds','v9Timestamp','v9Kind','v9DistanceSeconds','within1','within2','within5','nearestTransition2','nearestTransition5','retainedAsV9RawDropTP','nearestReferenceDistanceSeconds','v9DropExistsWithin2','v9DropExistsWithin5','eliminatedAsDropAt2','eliminatedAsDropAt5','baselineRationale','v9NearestEvent','baselineCandidateAssessmentsAtAnchor','v9AssessmentsAtBaselineAnchor','equalDistanceTies','nearbyKindsAt2','nearbyKindsAt5']
csvwrite('STAGE1_V9_RECLASSIFICATION_EVENT_TABLE_V1.csv',[{'group':'baseline_TP',**r} for r in tp]+[{'group':'baseline_FP',**r} for r in fp],['group']+common)
csvwrite('STAGE1_V9_FN_ANY_EVENT_TABLE_V1.csv',fn,['ordinal','id','stem','referenceIndex','referenceTimestamp','v9Kind','v9Timestamp','v9DistanceSeconds','within1','within2','within5','baselineRawReferenceStatus','baselineReferenceStatus','baselineDropWithin2','baselineDropWithin5','baselineNearestDropDistance','baselineNearbyDrop','v9NearestEvent','equalDistanceTies','nearbyKindsAt2','nearbyKindsAt5'])
csvwrite('STAGE1_V9_TRACK_COVERAGE_V1.csv',tracks,list(tracks[0]))
csvwrite('STAGE1_V9_REFERENCE_ANY_EVENT_COVERAGE_V1.csv',reference_rows,['ordinal','id','stem','referenceIndex','referenceTimestamp','baselineRawDropTP','v9RawDropTP','v9Kind','v9Timestamp','v9DistanceSeconds','within1','within2','within5','nearbyKindsAt2','nearbyKindsAt5','v9NearestEvent','equalDistanceTies'])
print(json.dumps(summary,indent=2))
