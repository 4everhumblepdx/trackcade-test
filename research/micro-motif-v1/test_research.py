import copy, json, unittest
import numpy as np
import analyze as A

def synth():
    sr=A.CFG['sampleRate'];x=np.zeros(sr*5,dtype=np.float32);truth=[.3,.7,1.4,2.1,2.5,3.2,3.9,4.3]
    for i,t in enumerate(truth):
        n=np.arange(round(.15*sr));env=np.exp(-n/(sr*.04))*np.minimum(n/(sr*.003),1)
        tone=np.sin(2*np.pi*(220+(i%3)*110)*n/sr)*env
        x[round(t*sr):round(t*sr)+len(n)]+=.8*tone
    return x,truth

def event(t,i,strength=.8,band=None):
    band=band or [1.]+[0.]*11
    return {'id':'e'+str(i),'time':t,'strength':strength,'timingConfidence':.95,'timingUncertaintySeconds':.005,'strictGameplayCandidate':True,'nearExistingBeat':True,'beatOffsetSeconds':0,'acoustic':band,'chroma':band,'sourceIdentity':'UNKNOWN'}

def recurring():
    # Synthetic oracle only; it is never a fixture-song annotation or DSP hint.
    es=[]
    for repeat in range(8):
        for j,(offset,strength) in enumerate(zip([0,.25,.85],[.5,1.,.65])):
            band=[0.]*12;band[j]=1.;es.append(event(repeat*2+offset,len(es),strength,band))
    return es

class ResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.x,cls.truth=synth();cls.detected=A.detect_events(cls.x,[.3,.7,1.4,2.1,2.5,3.2,3.9,4.3]);cls.es=recurring();cls.f=A.motif_families(cls.es,16)
    def test_01_deterministic_events(self):self.assertEqual(self.detected,A.detect_events(self.x,self.truth))
    def test_02_ordered_unique_events(self):self.assertEqual(sorted(set(e['time'] for e in self.detected)),[e['time'] for e in self.detected])
    def test_03_confidence_bounded(self):self.assertTrue(all(0<=e['timingConfidence']<=1 for e in self.detected))
    def test_04_synthetic_attack_error(self):
        errors=[min(abs(t-e['time']) for e in self.detected) for t in self.truth];self.assertLess(max(errors),.020)
    def test_05_matching_deterministic(self):self.assertEqual(self.f,A.motif_families(self.es,16))
    def test_06_ids_stable(self):self.assertEqual([f['id'] for f in self.f],[f['id'] for f in A.motif_families(self.es,16)])
    def test_07_recurs_at_least_four(self):self.assertTrue(self.f);self.assertTrue(all(f['occurrenceCount']>=4 for f in self.f))
    def test_08_small_tempo_variation(self):
        p=A.pattern(self.es[:3]);alter=copy.deepcopy(self.es[:3]);alter[1]['time']*=1.04;alter[2]['time']*=1.04;self.assertTrue(A.similarities(p,[A.pattern(alter)])[0][0])
    def test_09_gross_rhythm_differs(self):
        alter=copy.deepcopy(self.es[:3]);alter[1]['time']=.65;self.assertFalse(A.similarities(A.pattern(self.es[:3]),[A.pattern(alter)])[0][0])
    def test_10_trivial_bpm_rejected(self):self.assertEqual(A.motif_families([event(i*.5,i) for i in range(40)],20),[])
    def test_11_acoustic_separates(self):
        alter=copy.deepcopy(self.es[:3]);
        for e in alter:e['acoustic']=[0.]*11+[1.]
        self.assertFalse(A.similarities(A.pattern(self.es[:3]),[A.pattern(alter)])[0][0])
    def test_12_chroma_separates(self):
        alter=copy.deepcopy(self.es[:3]);
        for e in alter:e['chroma']=[0.]*11+[1.]
        self.assertFalse(A.similarities(A.pattern(self.es[:3]),[A.pattern(alter)])[0][0])
    def test_13_not_track_hints(self):
        code=(A.ROOT/'analyze.py').read_text(encoding='utf-8');self.assertNotIn('ruffmix',code);self.assertNotIn('gemf',code);self.assertEqual(A.CFG['patternEventLengths'],[2,3,4,5,6])
    def test_14_single_instance_not_anchor(self):self.assertEqual(A.motif_families(self.es[:3],2),[])
    def test_15_prominence_bounded(self):self.assertTrue(all(0<=f['motifProminence']<=1 for f in self.f))
    def simulation(self,es=None,families=None):
        return A.simulate(es or self.es,families or self.f,[e['time'] for e in self.es],16,[{'stage':'mid-hard-push','endSeconds':16,'targetsPerSecond':4}],[])
    def test_16_coverage_deterministic(self):self.assertEqual(self.simulation(),self.simulation())
    def test_17_no_invented_hits(self):self.assertTrue(all(h['time'] in [e['time'] for e in self.es] for h in self.simulation()['anchorHits']))
    def test_18_no_beat_snap(self):
        es=copy.deepcopy(self.es)
        for e in es:e['time']+=.031;e['nearExistingBeat']=False
        f=A.motif_families(es,17);r=self.simulation(es,f);self.assertTrue(all(h['time'] in [e['time'] for e in es] for h in r['anchorHits']));self.assertEqual(r['newOffbeatEventCount'],len(r['anchorHits']))
    def test_19_no_label_reader(self):
        code=(A.ROOT/'analyze.py').read_text(encoding='utf-8');self.assertNotIn('semantic-external-holdout',code);self.assertNotIn('reference_label',code)
    def test_20_no_terminal_reader(self):self.assertNotIn('holdout/',(A.ROOT/'analyze.py').read_text(encoding='utf-8'))
    def test_21_no_provider_dependency(self):
        code=(A.ROOT/'analyze.py').read_text(encoding='utf-8');self.assertNotIn('requests.',code);self.assertNotIn('openai.',code);self.assertNotIn('urllib',code)
    def test_22_unknown_source_preserved(self):self.assertTrue(all(e['sourceIdentity']=='UNKNOWN' for e in self.detected))
    def test_23_silence_no_events(self):self.assertEqual(A.detect_events(np.zeros(22050,dtype=np.float32),[]),[])
    def test_24_nonfinite_fails_closed(self):self.assertRaises(ValueError,A.detect_events,np.array([float('nan')]),[])
    def test_25_untrusted_no_anchor(self):
        es=copy.deepcopy(self.es)
        for e in es:e['strictGameplayCandidate']=False
        self.assertTrue(all(not f['gameplayAnchorCandidate'] for f in A.motif_families(es,16)))
    def test_26_small_interval_no_double_hit(self):
        r=self.simulation();ts=[h['time'] for h in r['anchorHits']];self.assertTrue(all(b-a>=.18 for a,b in zip(ts,ts[1:])))
    def test_27_postending_no_hit(self):self.assertTrue(all(h['time']+.36<=16 and h['time']<=14.75 for h in self.simulation()['anchorHits']))
    def test_28_family_limit(self):self.assertLessEqual(len(self.f),A.CFG['maximumFamilies'])
    def test_29_exact_gate_no_live_authorization(self):self.assertFalse(A.CFG['productionIntegrationAuthorized']);self.assertTrue(all(not f['productionTimingValidated'] for f in self.f))
    def test_31_beats_only_annotate_not_move_events(self):
        other=A.detect_events(self.x,[t+.1 for t in self.truth]);self.assertEqual([e['time'] for e in other],[e['time'] for e in self.detected])
    def test_30_provenance_canonical(self):self.assertEqual(A.digest({'a':1,'b':2}),A.digest({'b':2,'a':1}))

if __name__=='__main__':unittest.main()
