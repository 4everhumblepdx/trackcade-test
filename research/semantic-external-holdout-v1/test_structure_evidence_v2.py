#!/usr/bin/env python3
"""Source-backed validation; no provider, audio, Analyzer, or compiler execution."""
import argparse
import copy
import json
import unittest
import zipfile
from pathlib import Path

import export_structure_evidence_v2 as ex

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.analysis=ANALYSIS
        self.packet=PACKET
        self.ev,self.mapping=ex.build(self.analysis,self.packet,EVIDENCE_SHA)

    def test_exact_context_round_trip(self):
        result=ex.validate(self.ev,self.mapping,self.analysis,self.packet,EVIDENCE_SHA)
        self.assertTrue(result['contextReconstructed'])
        self.assertEqual(result['anchorsChecked'],len(self.ev['anchors']))

    def test_changed_timestamp_rejected(self):
        self.ev['anchors'][0][0] += .001
        with self.assertRaises(ValueError):
            ex.validate(self.ev,self.mapping,self.analysis,self.packet,EVIDENCE_SHA)

    def test_changed_alias_rejected(self):
        self.mapping['aliases'][0]=[[],[],[]]
        with self.assertRaises(ValueError):
            ex.validate(self.ev,self.mapping,self.analysis,self.packet,EVIDENCE_SHA)

    def test_changed_context_rejected(self):
        self.ev['context']['timingTrust']['strictScoringAllowed']=True
        with self.assertRaises(ValueError):
            ex.validate(self.ev,self.mapping,self.analysis,self.packet,EVIDENCE_SHA)

    def test_changed_source_bytes_rejected(self):
        with self.assertRaises(ValueError):
            ex.build(self.analysis+b' ',self.packet,EVIDENCE_SHA)

    def test_object_and_table_equal_features(self):
        obj,_=ex.build(self.analysis,self.packet,EVIDENCE_SHA,'current-core-accent-objects-v2')
        self.assertEqual(ex.rows(obj),ex.rows(self.ev))
        self.assertEqual(obj['context'],self.ev['context'])

    def test_exact_duplicates_keep_every_alias(self):
        a=json.loads(self.analysis)
        selected=next(i for i,c in enumerate(a['interactionCandidates']) if c['priority']=='core')
        duplicate=copy.deepcopy(a['interactionCandidates'][selected])
        a['interactionCandidates'].append(duplicate)
        ab=ex.canonical(a)
        p=json.loads(self.packet)
        p['source']['analysisJsonSha256']=ex.digest(ab)
        pb=ex.canonical(p)
        ev,mapping=ex.build(ab,pb,EVIDENCE_SHA)
        self.assertEqual(len(ev['anchors']),len(self.ev['anchors']))
        aliased=next(x for x in mapping['aliases'] if selected in x[2])
        self.assertIn(len(a['interactionCandidates'])-1,aliased[2])
        ex.validate(ev,mapping,ab,pb,EVIDENCE_SHA)

    def test_close_distinct_times_not_merged(self):
        a=json.loads(self.analysis)
        c=copy.deepcopy(next(c for c in a['interactionCandidates'] if c['priority']=='core'))
        used={r[0] for r in self.ev['anchors']}
        c['time']+=.000001
        while c['time'] in used:
            c['time']+=.000001
        a['interactionCandidates'].append(c)
        ab=ex.canonical(a)
        p=json.loads(self.packet)
        p['source']['analysisJsonSha256']=ex.digest(ab)
        ev,_=ex.build(ab,ex.canonical(p),EVIDENCE_SHA)
        self.assertEqual(len(ev['anchors']),len(self.ev['anchors'])+1)
        self.assertIn(c['time'],[r[0] for r in ev['anchors']])

    def test_unknown_policy_rejected(self):
        with self.assertRaises(ValueError):
            ex.build(self.analysis,self.packet,EVIDENCE_SHA,'label-tuned-policy')

    def test_all_fifty_frozen_packet_hashes_and_source_maps(self):
        prep=json.loads((ARGS.v2_root/'STAGE1_V2_PREP_MANIFEST_V1.json').read_bytes())
        with zipfile.ZipFile(ARGS.bundle) as z:
            manifest=json.loads(z.read('MANIFEST.json'))
            self.assertEqual(len(manifest['files']),100)
            for name,meta in manifest['files'].items():
                content=z.read(name)
                self.assertEqual(ex.digest(content),meta['sha256'])
                self.assertEqual(len(content),meta['bytes'])
            for row in prep['tracks']:
                case=f"cases/{row['ordinal']:02d}-{row['stem']}"
                ev=json.loads(z.read(case+'/structure-evidence-v2.json'))
                source_map=json.loads(z.read(case+'/structure-evidence-v2-source-map.json'))
                ex.validate(ev,source_map,(ARGS.base_root/case/'analysis-v019.json').read_bytes(),
                    (ARGS.v2_root/case/'interpretation-packet-v1.json').read_bytes(),row['hashes']['structureEvidenceSha256'])

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    for n in ('base-root','v2-root','bundle'):
        ap.add_argument('--'+n,required=True,type=Path)
    ARGS=ap.parse_args()
    prep=json.loads((ARGS.v2_root/'STAGE1_V2_PREP_MANIFEST_V1.json').read_bytes())
    row=sorted(prep['tracks'],key=lambda r:r['ordinal'])[0]
    case=f"cases/{row['ordinal']:02d}-{row['stem']}"
    ANALYSIS=(ARGS.base_root/case/'analysis-v019.json').read_bytes()
    PACKET=(ARGS.v2_root/case/'interpretation-packet-v1.json').read_bytes()
    EVIDENCE_SHA=row['hashes']['structureEvidenceSha256']
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(EvidenceTests))
    raise SystemExit(0 if result.wasSuccessful() else 1)
