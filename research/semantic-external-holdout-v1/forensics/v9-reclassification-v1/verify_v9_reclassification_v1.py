"""Independent provider-free witness checks; consume frozen matches without rescoring."""
from pathlib import Path
import json,hashlib,csv,subprocess,collections,zipfile,math,sys
w=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent;repo=w/'trackcade-test';base=repo/'research/semantic-external-holdout-v1';out=w/'v9-reclassification-forensics-v1'
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
sha=lambda b:hashlib.sha256(b).hexdigest()
d=load(out/'STAGE1_V9_RECLASSIFICATION_FORENSICS_V1.json');vr=load(base/'STAGE1_V9_GROUNDED_RAW_RESULT_V1.json');br=load(base/'STAGE1_MIXED_V7_V8_RAW_RESULT_V1.json');checks=[]
def check(name,value):assert value,name;checks.append(name)
check('81 baseline transition rows partition into 21 frozen TPs and 60 frozen FPs',len(d['baselineTruePositiveTransitions'])==21 and len(d['baselineFalsePositiveTransitions'])==60)
check('Frozen matched reference intersection is 11 retained, ten lost, no new V9 TPs',d['summary']['rawOverlap']=={'retained':11,'lost':10,'newV9TP':0,'baselineFNStillFN':25})
for rows,target in [(d['allReferenceEventCoverage'],'referenceTimestamp'),(d['baselineTruePositiveTransitions'],'referenceTimestamp'),(d['baselineFalsePositiveTransitions'],'baselineTimestamp'),(d['v9FalseNegativeForensics'],'referenceTimestamp')]:
 for r in rows:
  events=[e for e in d['allV9SemanticEvents'] if e['ordinal']==r['ordinal']]
  distances=sorted((abs(e['timestamp']-r[target]),e['timestamp'],e['eventIndex'],e['kind']) for e in events)
  assert distances and abs(r['v9DistanceSeconds']-distances[0][0])<1e-12
  assert r['v9Timestamp']==distances[0][1] and r['v9Kind']==distances[0][3]
  for t in [1,2,5]:assert r[f'within{t}']==(distances[0][0]<=t+1e-12)
check('Independent nearest-event enumeration verifies every TP/FP/FN/reference row and window',True)
check('All 46 references and all 35 V9 FNs are represented',len(d['allReferenceEventCoverage'])==46 and len(d['v9FalseNegativeForensics'])==35)
check('Coverage monotonicity and 19/26/39 closure',all(d['summary']['all46ReferenceCoverage'][str(t)]['covered']==value for t,value in [(1,19),(2,26),(5,39)]))
check('FN coverage 15 at ±2 and 28 at ±5',sum(r['within2'] for r in d['v9FalseNegativeForensics'])==15 and sum(r['within5'] for r in d['v9FalseNegativeForensics'])==28)
check('Lost baseline TP coverage nine at both windows, one absent',sum(r['within2'] for r in d['lostBaselineTruePositives'])==9 and sum(r['within5'] for r in d['lostBaselineTruePositives'])==9)
eliminated=[r for r in d['baselineFalsePositiveTransitions'] if r['eliminatedAsDropAt2']]
check('50 eliminated FP identities independently verified, not inferred from net count',len(eliminated)==50 and sum(r['within2'] for r in eliminated)==47 and sum(r['within5'] for r in eliminated)==48)
retained=[r for r in d['baselineFalsePositiveTransitions'] if not r['eliminatedAsDropAt2']]
check('Retained FP correspondences are ten distinct V9 Drop events',len({(r['ordinal'],r['v9NearestEvent']['eventIndex']) for r in retained})==10 and all(r['v9Kind']=='drop' and r['within2'] for r in retained))
vs={r['ordinal']:r for r in vr['sensitivity']['2']['perTrack']}
for r in retained:
 drops=sorted([e for e in d['allV9SemanticEvents'] if e['ordinal']==r['ordinal'] and e['kind']=='drop'],key=lambda e:(e['timestamp'],e['eventIndex']))
 ci=next(i for i,e in enumerate(drops) if e['eventIndex']==r['v9NearestEvent']['eventIndex'])
 assert ci in vs[r['ordinal']]['unmatchedCandidateIndices']
check('All ten retained nearby FP Drops have frozen V9 unmatched-candidate identity',True)
check('Full track totals preserve frozen baseline and V9 RAW counts',all(sum(r[key] for r in d['trackCoverage'])==value for key,value in [('referenceDropCount',46),('baselineDropCount',81),('baselineTP',21),('baselineFP',60),('baselineFN',25),('v9DropCount',21),('v9TP',11),('v9FP',10),('v9FN',35)]))
check('V9 event kind totals and no empty semantic track',dict(collections.Counter(e['kind'] for e in d['allV9SemanticEvents']))=={'section':242,'peak':84,'energy':113,'drop':21} and len({e['ordinal'] for e in d['allV9SemanticEvents']})==50)
for t in [2,5]:
 for k in ['section','peak','energy','drop']:
  count=sum(e['kind']==k and e['nearestReferenceDistance'] is not None and e['nearestReferenceDistance']<=t+1e-12 for e in d['allV9SemanticEvents'])
  assert count==d['summary']['v9EventCountsNearReferences'][k][f'within{t}']
check('Event-near-reference counts distinguish events from covered references',True)
pins=load(base/'STAGE1_V9_AUDIT_FIXTURE_REPAIR_RECEIPT_V1.json')['sourceGitBlobSha256']
for p,digest in pins.items():assert sha(subprocess.check_output(['git','show','HEAD:'+p],cwd=repo))==digest
check('All 28 audited semantic/execution/template source Git hashes unchanged',True)
for name,digest in {**d['sources']['manifestHashes'],**d['sources']['rawResultHashes']}.items():assert sha(subprocess.check_output(['git','show','HEAD:research/semantic-external-holdout-v1/'+name],cwd=repo))==digest
check('Frozen prediction manifests and original RAW result Git bytes unchanged',True)
refs=w/'stage1-raw-evaluation-20261003/stage1-reference-value.json';assert sha(refs.read_bytes())==d['sources']['referenceSha256']
check('Only exact previously isolated Stage1 reference hash used',True)
for p in d['sources']['perCaseHashesAndArtifactProvenance']:
 for kind,folder in [('baseline','stage1-mixed-collection'),('v9','v9-paid-evidence/collection')]:
  filename=f"{p['ordinal']:02d}-{p['stem']}.json"
  assert sha((w/folder/'proposals'/filename).read_bytes())==p[kind+'ProposalSha256']
  assert sha((w/folder/'packets'/filename).read_bytes())==p['packetSha256']
check('All 100 proposal and 100 packet file hashes match frozen manifests',True)
for p in d['sources']['perCaseHashesAndArtifactProvenance']:
 a=p['v9ResultArtifact'];z=w/'v9-paid-evidence/archives'/(str(a['id'])+'.zip')
 assert sha(z.read_bytes())==a['digest'].removeprefix('sha256:')
 with zipfile.ZipFile(z) as archive:assert sha(archive.read('normalized-proposal.json'))==p['v9ProposalSha256']
check('All 50 V9 immutable result ZIP digests and proposal entry hashes verified',True)
for name,count in [('STAGE1_V9_RECLASSIFICATION_EVENT_TABLE_V1.csv',81),('STAGE1_V9_FN_ANY_EVENT_TABLE_V1.csv',35),('STAGE1_V9_TRACK_COVERAGE_V1.csv',50),('STAGE1_V9_REFERENCE_ANY_EVENT_COVERAGE_V1.csv',46),('STAGE1_V9_LOST_TP_FOCUSED_TABLE_V1.csv',10)]:
 with (out/name).open(encoding='utf-8',newline='') as f:assert len(list(csv.DictReader(f)))==count
check('All five CSV row counts and partition closures verified',True)
check('Scientific conclusions retain failed Drop preregistration and label-informed limitation',d['conclusions']['recommendedDevelopmentHypothesis']['implemented'] is False and d['qualitativeComparison']['cleanSeparatingEvidenceFound'] is False)
report={'schema':'trackcade-stage1-v9-provider-free-forensic-verification-v1','status':'PASS','checksPassed':len(checks),'failures':0,'checks':checks,'providerCalls':0,'providerSpendUsd':'0','rawScoringExecuted':False,'terminalAccessed':False}
(out/'STAGE1_V9_RECLASSIFICATION_OFFLINE_AUDIT_V1.json').write_bytes((json.dumps(report,indent=2)+'\n').encode())
print(json.dumps(report))
