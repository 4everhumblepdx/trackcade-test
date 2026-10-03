from pathlib import Path
import json,collections,sys
w=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent;d=json.loads((w/'v9-reclassification-forensics-v1/STAGE1_V9_RECLASSIFICATION_FORENSICS_V1.json').read_text())
def feature(r):
 # Pick closest existing candidate assessment; no label-conditioned acoustic derivation.
 candidates=r.get('v9CandidateAssessmentsWithin5',[])
 packet=json.loads((w/'v9-paid-evidence/collection/packets'/f"{r['ordinal']:02d}-{r['stem']}.json").read_text())
 a=min(candidates,key=lambda a:(abs(packet['anchors'][a['anchor']['index']][0]-r['baselineTimestamp']),a['anchor']['index'])) if candidates else None
 return {'ordinal':r['ordinal'],'time':r['baselineTimestamp'],'assessment':a,'assessmentTime':packet['anchors'][a['anchor']['index']][0] if a else None,'onsetTags':len(r['packetObservationsAtBaselineAnchor']['onsetSourceAnchorRowsWithin2Seconds']),'boundaryCount':len(r['packetObservationsAtBaselineAnchor']['contextWithin5Seconds']['boundaries'])}
report={}
for name,rows in [('lostTPs',d['lostBaselineTruePositives']),('eliminatedFPs',[r for r in d['baselineFalsePositiveTransitions'] if r['eliminatedAsDropAt2']])]:
 rows=[feature(r) for r in rows]
 report[name]={'count':len(rows),'nearestAssessmentWithin5Count':sum(r['assessment'] is not None for r in rows),'existingOnsetTagWithin2Count':sum(r['onsetTags']>0 for r in rows),'existingBoundaryWithin5Count':sum(r['boundaryCount']>0 for r in rows),'categories':{field:dict(collections.Counter(r['assessment'].get(field,'missing') if r['assessment'] else 'missing' for r in rows)) for field in ['decisiveImpact','preparation','sustainedStrongerPassage','structuralContext','semanticRole','repetitionRelation']},'rows':rows}
print(json.dumps({k:{a:b for a,b in v.items() if a!='rows'} for k,v in report.items()},indent=2))
(w/'v9-reclassification-forensics-v1/prelabel-feature-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
