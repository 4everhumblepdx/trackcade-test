import unittest,json
from pathlib import Path
import numpy as np
from dsp_base import canonical,digest,unit,detect_events,CFG
from method import features,alignment,mappings,surrogate_order,Search,approve,CONTROL_KINDS,null_distribution
from calibrate import generate,metrics,CLASSES

def events(times,descs=None):
    return [{'id':str(i),'time':t,'strength':[.8,.6,1][i%3],'chroma':np.eye(12)[i%3].tolist(),'acoustic':np.eye(12)[i%3].tolist(),'strictGameplayCandidate':True,'sourceIdentity':'UNKNOWN'} for i,t in enumerate(times)]

class MethodTests(unittest.TestCase):
    def setUp(self):self.e=events(np.arange(30)*.5);self.t=np.array([e['time'] for e in self.e]);self.s=np.ones(30);self.a=np.eye(30);self.c=np.eye(30)
    def align(self,seed,target,t=None,a=None):return alignment(np.array(seed),np.array([target]),self.t if t is None else t,self.s,self.a if a is None else a,self.c if a is None else a)
    def test_01_canonical_byte_stability(self):self.assertEqual(canonical({'b':2,'a':1}),canonical({'a':1,'b':2}))
    def test_02_hash_changes(self):self.assertNotEqual(digest([1]),digest([2]))
    def test_03_unit_bounded(self):self.assertTrue(np.all(abs(unit(np.array([[1.,2.],[0,0]])))<=1))
    def test_04_known_truth_reproducible(self):a,t=generate('isolated',1009);b,u=generate('isolated',1009);self.assertEqual(t,u);self.assertEqual(a.tobytes(),b.tobytes())
    def test_05_polyphonic_recall_measured(self):x,t=generate('overlapping-tones',1009);m=metrics(detect_events(x,[]),t);self.assertGreater(m['matched'],0);self.assertEqual(m['matched']+m['missed'],len(t))
    def test_06_soft_truth_preserved(self):x,t=generate('soft-over-bed',1009);self.assertEqual(len(t),10);self.assertTrue(np.isfinite(x).all());m=metrics(detect_events(x,[]),t);self.assertEqual(m['matched']+m['missed'],10)
    def test_07_simultaneous_truth_single_event(self):x,t=generate('simultaneous',1009);self.assertEqual(len(t),len(set(t)))
    def test_08_false_positive_accounting(self):m=metrics(events([1,2,3]),[1,2]);self.assertEqual(m['falsePositives'],1)
    def test_09_missing_attack_alignment(self):a=np.ones((30,30));cost,*_=self.align([0,1,2],[0,2],a=a);self.assertTrue(np.isfinite(cost[0]));self.assertAlmostEqual(cost[0],.10)
    def test_10_extra_attack_alignment(self):a=np.ones((30,30));cost,*_=self.align([0,2],[0,1,2],a=a);self.assertTrue(np.isfinite(cost[0]))
    def test_11_unrelated_acoustics_reject(self):cost,*_=self.align([0,1,2],[3,4,5]);self.assertFalse(np.isfinite(cost[0]))
    def test_12_rhythm_insufficient(self):cost,*_=self.align([0,1],[4,5]);self.assertTrue(np.isinf(cost[0]))
    def test_13_descriptor_shuffle(self):o=surrogate_order(self.e,'descriptor-shuffle',1729);self.assertEqual(sorted(o.tolist()),list(range(30)));self.assertFalse(np.array_equal(o,np.arange(30)))
    def test_14_misalignment(self):o=surrogate_order(self.e,'timing-misalignment',1729);self.assertEqual(sorted(o.tolist()),list(range(30)));self.assertFalse(np.array_equal(o,np.arange(30)))
    def test_15_rhythm_surrogate_strata(self):o=surrogate_order(self.e,'rhythm-preserving',1729);self.assertEqual(sorted(o.tolist()),list(range(30)));self.assertEqual([e['strength'] for e in self.e],[self.e[i]['strength'] for i in o])
    def test_16_uniform_pulse_rejected(self):e=events(np.arange(100)*.5);[v.update(strength=1,chroma=[1]*12) for v in e];s=Search(e,unit(np.ones((100,8))),50);f,top=s.run();self.assertEqual(f,[]);self.assertEqual(top['score'],0)
    def test_17_fixed_31_seeds(self):self.assertEqual(CFG['nullSeeds'],list(range(1729,1760)))
    def test_18_null_order_repeatable(self):self.assertEqual(surrogate_order(self.e,'descriptor-shuffle',1729).tobytes(),surrogate_order(self.e,'descriptor-shuffle',1729).tobytes())
    def test_19_max_test_fail_closed(self):f={'motifProminence':.8,'occurrences':[{'internallyStable':True,'eventTimes':[1,2]}]*4,'songSpan':.5};d={k:[{'score':.9}]*31 for k in CONTROL_KINDS};approve([f],d,True);self.assertFalse(f['gameplayAnchorCandidate']);self.assertEqual(f['empiricalSearchMaxExceedance'],1)
    def test_20_id_stable(self):self.assertEqual(digest({'canonical':[.2,1]}),digest({'canonical':[.2,1]}))
    def test_21_no_manual_song_targets(self):self.assertNotIn('manualTimestamps',CFG);self.assertEqual(CFG['patternEventLengths'],[2,3,4,5,6])
    def test_22_no_lyric_input(self):self.assertNotIn('lyrics',CFG)
    def test_23_no_genre_input(self):self.assertNotIn('genre',CFG)
    def test_24_identity_unknown(self):self.assertTrue(all(e['sourceIdentity']=='UNKNOWN' for e in self.e))
    def test_25_time_order(self):x,t=generate('isolated',1009);e=detect_events(x,[]);self.assertEqual([v['time'] for v in e],sorted(v['time'] for v in e))
    def test_26_no_two_gaps(self):self.assertEqual(mappings(3,5),[])
    def test_27_endpoints_retained(self):self.assertTrue(all(a[0]==0 and a[-1]==3 for a,b,k in mappings(4,3)))
    def test_28_jitter_tolerance(self):t=self.t.copy();t[4]+=.015;a=np.ones((30,30));cost,*_=self.align([0,1,2],[3,4,5],t,a);self.assertTrue(np.isfinite(cost[0]))
    def test_29_large_tempo_rejected(self):a=np.ones((30,30));cost,*_=self.align([0,1,2],[3,5,7],a=a);self.assertTrue(np.isinf(cost[0]))
    def test_30_empty_descriptor_finite(self):self.assertTrue(np.isfinite(unit(np.zeros((3,12)))).all())
    def test_31_features_bounded_reproducible(self):x,t=generate('isolated',1009);e=detect_events(x,[]);a=features(x,e);b=features(x,e);self.assertEqual(a.tobytes(),b.tobytes());self.assertTrue(np.isfinite(a).all());self.assertTrue(np.all((a>=0)&(a<=1.000001)))
    def test_32_timing_absence_fails_gate(self):f={'motifProminence':1,'occurrences':[{'internallyStable':True,'eventTimes':[1,2]}]*4,'songSpan':.5};d={k:[{'score':0}]*31 for k in CONTROL_KINDS};approve([f],d,False);self.assertFalse(f['gameplayAnchorCandidate']);self.assertEqual(f['calibrationSupportedOccurrences'],0)
    def test_33_silence_no_attacks(self):self.assertEqual(detect_events(np.zeros(22050*2,dtype=np.float32),[]),[])
    def test_34_bad_pcm_rejected(self):self.assertRaises(ValueError,detect_events,np.array([np.nan]),[])
    def test_35_polyphonic_classes(self):self.assertEqual(len(CLASSES),10)
    def test_36_no_production_integration(self):self.assertFalse(CFG['productionIntegrationAuthorized'])
    def test_37_exact_alignment(self):cost,*_=self.align([0,1,2],[0,1,2]);self.assertEqual(cost[0],0)
    def test_38_matched_missed_balance(self):m=metrics(events([1]),[1,2,3]);self.assertEqual(m['matched'],1);self.assertEqual(m['missed'],2)
    def test_39_full_search_byte_repeatable(self):
        e=events(np.cumsum(np.tile([.3,.2,.5],12)));s=Search(e,np.tile(np.eye(3),(12,1)),12);a=s.run();b=s.run();self.assertEqual(canonical(a),canonical(b));self.assertGreater(len(a[0]),0)
    def test_40_full_null_distribution_byte_repeatable(self):
        e=events(np.cumsum(np.tile([.3,.2,.5],6)));s=Search(e,np.tile(np.eye(3),(6,1)),6);self.assertEqual(canonical(null_distribution(s)),canonical(null_distribution(s)))
    def test_41_hp_ablation_measurably_changes_patch(self):
        x,t=generate('harmonic-bed',1009);e=detect_events(x,[]);self.assertFalse(np.array_equal(features(x,e,True),features(x,e,False)))

if __name__=='__main__':unittest.main()
