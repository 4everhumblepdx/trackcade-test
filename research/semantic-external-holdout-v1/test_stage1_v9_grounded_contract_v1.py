"""Offline instruction/conformance tests, not tests of model behavior."""
import ast
import copy
import difflib
import hashlib
import json
import os
from pathlib import Path
import subprocess
import unittest
import build_stage1_v9_grounded_v1 as b
import run_stage1_v9_grounded_v1 as r

BASE=r.BASE
def git_file(path,ref='97ed64d35893eab13b3d721f85eded5bfec2afe1'):
    return subprocess.check_output(['git','show',ref+':'+path],cwd=r.ROOT)
def node(source,name):
    return ast.dump(next(x for x in ast.parse(source).body if isinstance(x,ast.FunctionDef) and x.name==name),include_attributes=False)

class GroundingContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.environ.get('OPENAI_API_KEY'):raise ValueError('Provider credential forbidden')
        cls.rows=r.MAPPING['cases'];cls.folders=[r.SOURCE/'cases'/f"{x['ordinal']:02d}-{x['stem']}" for x in cls.rows]
        cls.old=json.loads((cls.folders[0]/'baseline-request.json').read_bytes())
        cls.new=b.treatment_request(cls.old)
        cls.baseline_runner=git_file('research/semantic-external-holdout-v1/run_stage1_v8_remaining46_v1.py').decode()
        cls.runner=(BASE/'run_stage1_v9_grounded_v1.py').read_text()

    def test_credential_absent(self):self.assertFalse(os.environ.get('OPENAI_API_KEY'))
    def test_no_real_authorization(self):self.assertFalse(r.AUTH.exists())
    def test_no_activation(self):self.assertFalse(r.ACT.exists())
    def test_no_execution_workflow(self):self.assertFalse((r.ROOT/'.github/workflows/trackcade-stage1-v9-grounded-v1.yml').exists())
    def test_exact_50_ordinals(self):self.assertEqual([x['ordinal'] for x in self.rows],list(range(1,51)))
    def test_all_staged_hashes(self):
        for row,folder in zip(self.rows,self.folders):
            for name,sha in row['inputHashes'].items():self.assertEqual(b.sha((folder/name).read_bytes()),sha)
    def test_all_payloads_rebuild_exactly(self):
        for n,folder in enumerate(self.folders,1):
            old=json.loads((folder/'baseline-payload.json').read_bytes())
            self.assertEqual(b.treatment_payload(old,n),json.loads((folder/'openai-payload-v9-grounded.json').read_bytes()))
            request=json.loads((folder/'baseline-request.json').read_bytes())
            self.assertEqual(b.treatment_request(request),json.loads((folder/'learned-request-v9.json').read_bytes()))
    def test_inputs_packet_identical(self):
        for folder in self.folders:
            old=json.loads((folder/'baseline-request.json').read_bytes());new=json.loads((folder/'learned-request-v9.json').read_bytes())
            self.assertEqual(old['packet'],new['packet']);self.assertEqual(new['packet'],json.loads((folder/'structure-evidence-v2.json').read_bytes()))
    def test_all_mixed_caps(self):
        for n in range(1,51):self.assertEqual(r.provider_contract(n)['maxOutputTokens'],8192 if n<=3 else 25000)
    def test_all_provider_settings_and_schema(self):
        for n,folder in enumerate(self.folders,1):
            old=json.loads((folder/'baseline-payload.json').read_bytes());new=json.loads((folder/'openai-payload-v9-grounded.json').read_bytes())
            self.assertEqual({k:v for k,v in old.items() if k not in ['instructions','input']},{k:v for k,v in new.items() if k not in ['instructions','input']})
            self.assertEqual(json.loads(old['input'])['responseContract'],json.loads(new['input'])['responseContract'])
            self.assertEqual(new['model'],'gpt-6-sol');self.assertEqual(new['reasoning'],{'effort':'high'});self.assertEqual(new['service_tier'],'flex');self.assertIs(new['store'],False)
    def test_exact_single_instruction_insertion(self):
        self.assertEqual(self.new['instruction'].replace(b.GROUNDING,'',1),self.old['instruction'])
        self.assertEqual(self.new['instruction'].count(b.GROUNDING),1)
    def test_frozen_definition_and_other_criteria_retained(self):
        for text in ['A Drop requires one coherent transition','clear preparation/withdrawal/tension','clear sustained stronger passage','First assess plausible Drop/re-entry transition anchors individually','candidateAssessments must remain sparse','Do not rank candidates against one another','Do not impose or aim for a fixed number of Drops','Event time remains solely the Analyzer-derived packet anchor time']:
            self.assertIn(text,self.old['instruction']);self.assertIn(text,self.new['instruction'])
    def test_candidate_coverage_instruction_unchanged(self):
        old=[s for s in self.old['instruction'].splitlines() if 'candidate' in s.lower() or 'sparse' in s.lower()]
        restored=self.new['instruction'].replace(b.GROUNDING,'',1)
        self.assertEqual(old,[s for s in restored.splitlines() if 'candidate' in s.lower() or 'sparse' in s.lower()])
        self.assertIn('Do not broaden candidate discovery or coverage',b.GROUNDING)
    def test_confidence_and_non_drop_rules_unchanged(self):
        self.assertEqual(self.old['responseContract'],self.new['responseContract'])
        self.assertTrue(self.new['responseContract']['confidenceFieldsDiagnosticOnly'])
        self.assertIn('semantic non-Drop status does not remove gameplay/actionability eligibility',b.GROUNDING)
    def test_no_extra_request_changes(self):
        restored=copy.deepcopy(self.new);restored['instruction']=self.old['instruction']
        for k in ['instructionSha256','developmentRevision']:restored['integrity'][k]=self.old['integrity'][k]
        self.assertEqual(restored,self.old)
    def test_no_threshold_filter_or_veto(self):
        self.assertIn('no numeric energy/confidence threshold, chorus/return/repetition veto, fixed Drop-count policy, post-semantic filter',b.GROUNDING)
        self.assertFalse(any(c.isdigit() for c in b.GROUNDING.replace('V9','')))
    def test_label_leakage_absent_all_payloads(self):
        forbidden={'referenceDropsSeconds','referenceCount','truePositives','falsePositives','falseNegatives','TP','FP','FN','errorGroup','nearestReferenceDistanceSeconds','zeroReferenceTrack','forensic','terminal','dropsSeconds','diagnosticLabelHint','diagnosticTypeHint','aliases','aliasColumns'}
        def walk(v):
            if isinstance(v,dict):
                for k,x in v.items():
                    self.assertNotIn(k,forbidden);walk(x)
            elif isinstance(v,list):
                for x in v:walk(x)
        for folder in self.folders:
            p=json.loads((folder/'openai-payload-v9-grounded.json').read_bytes());walk(json.loads(p['input']))
            self.assertEqual(set(json.loads(p['input'])),{'packet','integrity','responseContract'})
            for token in ['forensic','zero-reference','21 TP','60 FP','25 FN','terminal']:
                self.assertNotIn(token,p['instructions']);self.assertNotIn(token,p['input'])
    def test_foreign_label_or_result_fields_rejected(self):
        for key in ['referenceDropsSeconds','forensic','baselineResult','terminal']:
            p=json.loads((self.folders[0]/'baseline-payload.json').read_bytes());d=json.loads(p['input']);d[key]=[];p['input']=json.dumps(d)
            with self.assertRaises(ValueError):b.treatment_payload(p,1)
    def test_nested_label_injection_rejected(self):
        p=json.loads((self.folders[0]/'baseline-payload.json').read_bytes());d=json.loads(p['input'])
        d['packet']['context']['forensic']={'TP':True};p['input']=json.dumps(d)
        with self.assertRaises(ValueError):b.treatment_payload(p,1)
    def test_all_instructions_same(self):
        self.assertEqual(len({json.loads((p/'openai-payload-v9-grounded.json').read_bytes())['instructions'] for p in self.folders}),1)
    def test_transport_one_call_and_no_retry(self):
        tree=ast.parse(self.runner);n=next(x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name=='one_provider_attempt')
        self.assertEqual(sum(isinstance(x,ast.Call) and isinstance(x.func,ast.Attribute) and x.func.attr=='urlopen' for x in ast.walk(n)),1)
        self.assertFalse(any(isinstance(x,(ast.For,ast.While)) for x in ast.walk(n)))
        self.assertEqual(node(self.runner.replace('openai-payload-v9-grounded.json','openai-payload-v8-flex25000.json'),'one_provider_attempt'),node(self.baseline_runner,'one_provider_attempt'))
    def test_pricing_usage_function_byte_behavior_unchanged(self):self.assertEqual(node(self.runner,'estimate_usage'),node(self.baseline_runner,'estimate_usage'))
    def test_budget_reconciliation_structure_preserved(self):
        mapped=self.runner.replace('stage1-v9-grounded','stage1-v8-remaining46').replace('len(entries)!=n-1','len(entries)!=n-5').replace('enumerate(entries,1)','enumerate(entries,5)').replace('entries[:previous-1]','entries[:previous-5]')
        self.assertEqual(node(mapped,'ledger_for_next'),node(self.baseline_runner,'ledger_for_next'))
        self.assertEqual(node(self.runner,'advance'),node(self.baseline_runner,'advance'))
    def test_pre_call_consumed_marker_precedes_key_access(self):
        run=self.runner[self.runner.index('def run('):self.runner.index('def advance(')]
        self.assertLess(run.index('verify_lock('),run.index('one_provider_attempt('));self.assertLess(run.index("open('x'"),run.index('one_provider_attempt('))
        self.assertIn('credential exposed before lock creation',self.runner)
    def test_per_ordinal_usage_cap_failure(self):
        self.assertIn("status['usage']['output_tokens']>provider_contract(n)['maxOutputTokens']",self.runner)
    def test_baseline_dependencies_unchanged(self):
        for path,sha in r.CONTRACT['frozenDependenciesSha256'].items():
            self.assertEqual(hashlib.sha256(git_file(path).replace(b'\r\n',b'\n')).hexdigest(),sha)
    def test_scorer_unchanged(self):
        for path in ['score_stage1_mixed_raw_v1.py','evaluate_stage1_v6_raw_v1.py','STAGE1_MIXED_V7_V8_RAW_SCORING_CONTRACT_V1.json']:
            rel='research/semantic-external-holdout-v1/'+path
            self.assertEqual(git_file(rel),git_file(rel,'HEAD'))
    def test_baseline_records_unchanged(self):
        names=subprocess.check_output(['git','diff','--name-only','97ed64d35893eab13b3d721f85eded5bfec2afe1'],cwd=r.ROOT,text=True).splitlines()
        self.assertTrue(all('v9' in p.lower() for p in names))
    def test_no_terminal_path_reads(self):
        source=(BASE/'stage_stage1_v9_grounded_v1.py').read_text()
        self.assertNotIn('extractall',source);self.assertNotIn('namelist',source)
        self.assertIn("case=f'cases/{n:02d}-{s[\"stem\"]}'",source)
        self.assertIn('range(1,51)',source)
        self.assertNotIn('REFERENCE_DROPS',source)
    def test_no_threshold_new_output_schema(self):self.assertEqual(self.old['responseContract'],self.new['responseContract'])
    def synthetic(self,kind):
        p=copy.deepcopy(self.old);p['packet']={'anchors':[[10.0]],'context':{'energy':{'curve':[{'time':8.0,'energy':.3},{'time':10.0,'energy':.8}]},'sections':[{'start':0,'end':10,'energy':.3},{'start':10,'end':20,'energy':.8}]},'syntheticInstructionTest':kind}
        p['packet']['context']['energy']['curve'] = ([{'time':9.9,'energy':.3},{'time':10.0,'energy':.8},{'time':10.1,'energy':.8}] if kind.startswith('anchor-local') else [{'time':8.0,'energy':.3},{'time':10.0,'energy':.5},{'time':12.0,'energy':.8}])
        return b.treatment_request(p)
    def test_synthetic_A_concentrated_support_permitted_by_instruction(self):
        p=self.synthetic('anchor-local observations explicitly supplied')
        self.assertIn('Anchor-local concentrated support may still justify decisiveImpact clear',p['instruction'])
        self.assertEqual(p['packet']['syntheticInstructionTest'],'anchor-local observations explicitly supplied')
    def test_synthetic_B_average_or_gradual_not_sufficient_instruction(self):
        p=self.synthetic('only section averages and multi-second sampled trend')
        self.assertIn('upward trend across multiple seconds does not by itself substantiate concentrated decisive impact',p['instruction'])
        self.assertIn('do not invent support or mark decisiveImpact clear',p['instruction'])
    def test_synthetic_C_meaningful_non_drop_retained_instruction(self):
        p=self.synthetic('meaningful entrance with insufficient impact evidence')
        self.assertIn('Retain an appropriate existing non-Drop semantic event type for a meaningful transition',p['instruction'])
        self.assertEqual(p['responseContract']['allowedKinds'],['section','energy','peak','drop'])

if __name__=='__main__':unittest.main()
