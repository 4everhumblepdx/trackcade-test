import unittest
import score_stage1_mixed_raw_v1 as s
class Tests(unittest.TestCase):
    def test_synthetic_50_cases_deterministic_and_subgroups(self):
        rows=[{'ordinal':n,'id':str(n),'semanticVersion':'V7' if n<=3 else 'V8','dropTimes':[10.0]} for n in range(1,51)]
        refs={str(n):[11.5] for n in range(1,51)}
        a=s.evaluate(rows,refs);self.assertEqual(a,s.evaluate(rows,refs));self.assertEqual(a['2']['aggregate']['micro']['truePositives'],50);self.assertEqual(a['1']['aggregate']['micro']['truePositives'],0);self.assertEqual(a['5']['aggregate']['micro']['truePositives'],50)
        self.assertEqual(a['2']['subgroups']['V7']['matchedSupport'],3);self.assertEqual(a['2']['subgroups']['V8']['matchedSupport'],47)
    def test_duplicate_predictions_not_deduplicated(self):
        x=s.frozen.score_track([10],[10,10],2);self.assertEqual((x['truePositives'],x['falsePositives'],x['falseNegatives']),(1,1,0))
    def test_no_reference_empty_predictions_convention(self):
        x=s.frozen.score_track([],[],2);self.assertEqual(x['f1'],1)
if __name__=='__main__':unittest.main(verbosity=2)
