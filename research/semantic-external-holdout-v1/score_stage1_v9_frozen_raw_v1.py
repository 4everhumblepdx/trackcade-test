"""One-use V9 reporting adapter for the frozen RAW candidate extractor and matcher."""
from pathlib import Path
import json,hashlib,subprocess,sys,time
import score_stage1_mixed_raw_v1 as raw
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 contract_path,expected_commit,collection,reference,output=map(Path,sys.argv[1:])
 repo=Path(__file__).resolve().parents[2]
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
 assert head==str(expected_commit)
 contract=json.loads(contract_path.read_text());assert contract['scoringExecutionsAuthorized']==1
 for source in contract['executionSources']:assert sha(repo/source['path'])==source['sha256']
 mp=repo/contract['predictionManifest']['path'];assert sha(mp)==contract['predictionManifest']['sha256']
 manifest=json.loads(mp.read_text());assert manifest['caseCount']==50 and all(c['semanticVersion']=='V9' for c in manifest['cases'])
 rows=raw.candidates(manifest,collection)
 assert raw.frozen.TOLERANCES==(1.0,2.0,5.0) and raw.frozen.PRIMARY_TOLERANCE==2.0
 output.mkdir(parents=True,exist_ok=False)
 lock={'schema':'trackcade-stage1-v9-one-use-scoring-lock-v1','status':'consumed-before-stage1-label-access','contractCommit':head,'contractSha256':sha(contract_path),'predictionManifestSha256':sha(mp),'createdUnix':time.time(),'terminalAccessed':False}
 (output/'SCORING_ATTEMPT_LOCK.json').write_text(json.dumps(lock,indent=2)+'\n')
 assert sha(reference)==contract['isolatedStage1Reference']['sha256']
 labels=json.loads(reference.read_text());refs={}
 for x in labels:
  assert isinstance(x,dict) and set(x)=={'id','dropsSeconds'} and x['id'] not in refs
  assert isinstance(x['dropsSeconds'],list) and all(raw.frozen.finite_number(v) and v>=0 for v in x['dropsSeconds'])
  refs[x['id']]=sorted(float(v) for v in x['dropsSeconds'])
 assert set(refs)=={x['id'] for x in rows}
 scores={}
 for tolerance in raw.frozen.TOLERANCES:
  cases=[]
  for c in rows:
   ref=refs[c['id']];cand=c['dropTimes'];s=raw.frozen.score_track(ref,cand,tolerance)
   s.update(ordinal=c['ordinal'],id=c['id'],semanticVersion='V9',referenceDropsSeconds=ref,predictedDropsSeconds=cand)
   mr={p['referenceIndex'] for p in s['matchedPairs']};mc={p['candidateIndex'] for p in s['matchedPairs']}
   s['unmatchedReferenceIndices']=[i for i in range(len(ref)) if i not in mr];s['unmatchedCandidateIndices']=[i for i in range(len(cand)) if i not in mc];cases.append(s)
  scores[str(int(tolerance))]={'toleranceSeconds':tolerance,'aggregate':raw.frozen.aggregate(cases),'perTrack':cases,'zeroReferenceFP':sum(c['falsePositives'] for c in cases if not c['referenceDropsSeconds'])}
 primary=scores['2'];micro=primary['aggregate']['micro'];baseline=contract['baseline']
 useful={'TPAtLeast21':micro['truePositives']>=baseline['TP'],'FPBelow60':micro['falsePositives']<baseline['FP'],'zeroReferenceFPBelow30':primary['zeroReferenceFP']<baseline['zeroReferenceFP']}
 kinds={}
 for c in manifest['cases']:
  proposal=json.loads((collection/'proposals'/f"{c['ordinal']:02d}-{c['stem']}.json").read_text())
  for event in proposal['events']:kinds[event['kind']]=kinds.get(event['kind'],0)+1
 result={'schema':'trackcade-stage1-v9-grounded-raw-result-v1','status':'frozen-complete-50-development-raw-drop-score','scoringContractCommit':head,'scoringContractSha256':sha(contract_path),'predictionManifest':contract['predictionManifest'],'stage1ReferenceSha256':sha(reference),'stage1ReferenceProvenance':contract['isolatedStage1Reference'],'caseCount':50,'primaryScoringPasses':1,'primaryToleranceSeconds':2,'headline':primary['aggregate'],'zeroReferenceFP':primary['zeroReferenceFP'],'sensitivity':scores,'baseline':baseline,'preregisteredCountChecks':useful,'allPreregisteredCountChecksPass':all(useful.values()),'semanticEventKindCounts':kinds,'nonDropGameplayActionability':'Non-Drop musical events remain eligible for gameplay interactions; Drop metrics do not assess gameplay usefulness.','providerCallsDuringScoring':0,'providerSpendDuringScoringUsd':'0','terminalHoldoutAccessed':False,'analyzerExecutedOrModified':False,'compilerInvoked':False,'predictionModifiedOrRegenerated':False,'interpretation':'Stage1 development evidence only; no unseen-track generalization claim.'}
 (output/'STAGE1_V9_GROUNDED_RAW_RESULT_V1.json').write_bytes((json.dumps(result,indent=2)+'\n').encode())
 print(json.dumps({'headline':result['headline'],'zeroReferenceFP':result['zeroReferenceFP'],'preregisteredCountChecks':useful,'semanticEventKindCounts':kinds,'sensitivities':{k:{'micro':v['aggregate']['micro'],'zeroReferenceFP':v['zeroReferenceFP']} for k,v in scores.items()}}))
if __name__=='__main__':main()
