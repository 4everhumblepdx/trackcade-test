"""Execution-only V9 plumbing. Frozen semantic builder/runner are not edited."""
import argparse,hashlib,json,os,subprocess,tempfile,zipfile
from pathlib import Path
from decimal import Decimal
import run_stage1_v9_grounded_v1 as r
import stage_stage1_v9_grounded_v1 as stage

BASE=r.BASE;ROOT=r.ROOT
SEMANTIC='3ee7028529e69950d514537f1d6e16841519bad9'
WF='.github/workflows/trackcade-semantic-external-stage1-v9-grounded-v1.yml'
AUDIT_WF='.github/workflows/trackcade-semantic-external-stage1-v9-grounded-audit-v1.yml'
POLICY=BASE/'STAGE1_V9_EXECUTION_POLICY_V1.json'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def sha(p):return hashlib.sha256(p.read_bytes().replace(b'\r\n',b'\n')).hexdigest()
def no_key():
    if os.environ.get('OPENAI_API_KEY'):raise ValueError('credential forbidden in this step')
def gh(path):return json.loads(subprocess.check_output(['gh','api','repos/'+os.environ['GITHUB_REPOSITORY']+'/'+path],text=True))
def pages(path,key):
    all_items=[];page=1
    while True:
        d=gh(path+('?' if '?' not in path else '&')+'per_page=100&page='+str(page));items=d[key];all_items+=items
        if len(items)<100:return all_items
        page+=1
def save(p,d):p.write_bytes((json.dumps(d,indent=2,sort_keys=True)+'\n').encode())

def prep():
    no_key();mapping_before=sha(BASE/'STAGE1_V9_GROUNDED_MAPPING_V1.json');diff_before=sha(BASE/'STAGE1_V9_GROUNDED_SEMANTIC_DIFF_V1.patch')
    with tempfile.TemporaryDirectory() as temp:
        paths=[]
        for label,manifest,names in [('source','STAGE1_V7_PREP_MANIFEST_V1.json',['structure-evidence-v2.json','learned-request-v7.json']),('flex','STAGE1_V7_FLEX8192_PREP_MANIFEST_V1.json',['openai-payload-v7-flex8192.json'])]:
            src=Path('/tmp/v9-'+label+'-original');p=Path(temp)/(label+'.zip');paths.append(p)
            data=(src/manifest).read_bytes();rows=json.loads(data)['tracks']
            if [x['ordinal'] for x in rows]!=list(range(1,51)):raise ValueError('not exact Stage1 prep')
            with zipfile.ZipFile(p,'w') as z:
                z.writestr(manifest,data)
                for x in rows:
                    case=f"cases/{x['ordinal']:02d}-{x['stem']}"
                    for name in names:z.writestr(case+'/'+name,(src/case/name).read_bytes())
        stage.stage(paths[0],paths[1],r.SOURCE,BASE/'STAGE1_MIXED_V7_V8_PREDICTION_MANIFEST_V1.json')
    if sha(BASE/'STAGE1_V9_GROUNDED_MAPPING_V1.json')!=mapping_before or sha(BASE/'STAGE1_V9_GROUNDED_SEMANTIC_DIFF_V1.patch')!=diff_before:raise ValueError('frozen V9 preparation changed')

def wiring(wf):
    steps=wf['jobs']['serial']['steps'];by={s['id']:s for s in steps if 'id' in s}
    if len(by)!=sum('id' in s for s in steps):raise ValueError('duplicate step id')
    for n in range(1,51):
        tag=f'{n:02d}';lock='${{ steps.lock'+tag+'.outputs.artifact-id }}';result='${{ steps.result'+tag+'.outputs.artifact-id }}'
        for prefix in ['verify','live','gate']:
            if by[prefix+tag].get('env',{}).get('LOCK_ARTIFACT_ID')!=lock:raise ValueError('missing/cross-ordinal lock wiring')
        if by['gate'+tag]['env'].get('RESULT_ARTIFACT_ID')!=result:raise ValueError('missing/cross-ordinal result wiring')
        if by['live'+tag]['env'].get('OPENAI_API_KEY')!='${{ secrets.OPENAI_API_KEY }}':raise ValueError('credential wiring drift')
        if by['live'+tag]['if']!='${{ success() && steps.verify'+tag+".outcome == 'success' }}":raise ValueError('secret not gated by verified lock')
        for prefix in ['lock','verify','live','result','gate']:
            if 'continue-on-error' in by[prefix+tag]:raise ValueError('failure bypass')
        for prefix in ['lock','result']:
            if by[prefix+tag]['with']['overwrite'] is not False:raise ValueError('mutable artifact')
        expected='${{ success() }}' if n==1 else '${{ success() && steps.gate'+f'{n-1:02d}'+".outcome == 'success' }}"
        if by['prep'+tag]['if']!=expected:raise ValueError('serial predecessor bypass')
    secret_steps=[s['id'] for s in steps if 'secrets.' in json.dumps(s)]
    if secret_steps!=[f'live{n:02d}' for n in range(1,51)]:raise ValueError('secret exposed outside live steps')
    if wf['on']!={'push':{'branches':['trackcade-semantic-external-holdout-v1'],'paths':['research/semantic-external-holdout-v1/STAGE1_V9_GROUNDED_ACTIVATE_V1.json']}}:raise ValueError('unexpected trigger')
    return 50

def static():
    no_key();p=r.load(POLICY);wiring(r.load(ROOT/WF))
    for path,h in p['frozenSemanticFilesSha256'].items():
        if sha(ROOT/path)!=h:raise ValueError('frozen semantic source drift')
        if hashlib.sha256(subprocess.check_output(['git','show',SEMANTIC+':'+path],cwd=ROOT)).hexdigest()!=h:raise ValueError('semantic provenance drift')
    allow=set(r.load(ROOT/WF)['jobs']['serial']['steps'][0]['with']['sparse-checkout'].splitlines())
    if any(any(x in path.lower() for x in ['reference_drops','terminal','forensic','scor','analyzer','compiler']) for path in allow):raise ValueError('forbidden generation checkout path')
    if r.load(ROOT/WF)['jobs']['serial']['steps'][0]['with']['persist-credentials'] is not False:raise ValueError('persistent credential')
    return p

def approval():
    a=r.load(r.AUTH);x=r.load(r.ACT);budget=r.gate(a,x)
    if budget!=Decimal('2.74'):raise ValueError('ceiling drift')
    common={'semanticTreatmentSource':SEMANTIC,'attemptsPerOrdinal':1,'fallbacks':0,'reservationUsdPerAttempt':'0.225'}
    r.base.exact(a,common);r.base.exact(x,common)
    if a['auditedExecutionSourceCommit']!=x['auditedSourceCommit']:raise ValueError('source binding drift')
    for path,h in x['sourceSha256'].items():
        if sha(ROOT/path)!=h:raise ValueError('execution source drift')
        if hashlib.sha256(subprocess.check_output(['git','show',x['auditedSourceCommit']+':'+path],cwd=ROOT)).hexdigest()!=h:raise ValueError('audited source differs')
    return budget,a,x

def preflight():
    no_key();p=static();budget,a,x=approval()
    if git('diff','--name-only','HEAD^','HEAD')!='research/semantic-external-holdout-v1/STAGE1_V9_GROUNDED_ACTIVATE_V1.json' or git('rev-parse','HEAD^')!=x['authorizationCommit']:raise ValueError('not separate activation-only commit')
    if set(x['sourceSha256'])!=set(p['executionFiles']):raise ValueError('source pin coverage incomplete')
    audit=gh('actions/runs/'+str(x['providerFreeAuditRunId']))
    r.base.exact(audit,{'head_sha':x['auditedSourceCommit'],'status':'completed','conclusion':'success','run_attempt':1,'path':AUDIT_WF})
    runs=pages('actions/workflows/'+WF.split('/')[-1]+'/runs','workflow_runs')
    if [z['id'] for z in runs]!=[int(os.environ['GITHUB_RUN_ID'])]:raise ValueError('prior paid run; no rerun/resume')
    if any(z['name'].startswith(r.NAMESPACE+'-case-') for z in pages('actions/artifacts','artifacts')):raise ValueError('prior attempt artifacts')
    for expected in r.CONTRACT['artifacts']:
        artifact=gh('actions/artifacts/'+str(expected['id']))
        r.base.exact(artifact,{'id':expected['id'],'name':expected['name'],'digest':expected['digest'],'expired':False})
    r.initialize(budget);save(r.WORK/'preflight.json',{'runId':os.environ['GITHUB_RUN_ID'],'head':os.environ['GITHUB_SHA'],'authorizationSha256':sha(r.AUTH),'activationSha256':sha(r.ACT)})

def bound():
    budget,a,x=approval();proof=r.load(r.WORK/'preflight.json')
    r.base.exact(proof,{'runId':os.environ['GITHUB_RUN_ID'],'head':os.environ['GITHUB_SHA'],'authorizationSha256':sha(r.AUTH),'activationSha256':sha(r.ACT)})
    return budget
def output(value):
    with Path(os.environ['GITHUB_OUTPUT']).open('a') as f:f.write('eligible='+('true' if value else 'false')+'\n')
def prepare(n):
    no_key();budget=bound();ledger=r.load(r.ledger_path())
    # Validate sequence/evidence first, even when the next reservation cannot fit.
    try:r.ledger_for_next(ledger,n,budget)
    except ValueError as exc:
        if str(exc)!='next worst-case reservation exceeds authorized estimated ceiling':raise
        save(r.WORK/'budget-stop.json',{'classification':'clean_budget_stop_before_next_provider_call','nextOrdinal':n,'reconciledEstimatedSpendUsd':ledger['reconciledEstimatedSpendUsd'],'ceilingUsd':'2.74','reservationUsd':'0.225','providerCallForNextOrdinal':False});output(False);return
    r.prepare(n,budget);output(True)
def lock(n):
    no_key();bound();m=gh('actions/artifacts/'+os.environ['LOCK_ARTIFACT_ID']);r.verify_lock(n,r.load(r.lockfile(n)),m);save(r.lockfile(n).parent/'uploaded.json',m)
def live(n):r.run(n,bound())
def advance(n):
    no_key();budget=bound();m=gh('actions/artifacts/'+os.environ['RESULT_ARTIFACT_ID']);r.advance(n,budget,m)
def summary():
    no_key();data={'runId':os.environ['GITHUB_RUN_ID'],'head':os.environ['GITHUB_SHA'],'providerCalls':0,'cases':[]}
    if r.ledger_path().exists():data['ledger']=r.load(r.ledger_path())
    if (r.WORK/'budget-stop.json').exists():data['budgetStop']=r.load(r.WORK/'budget-stop.json')
    for n in range(1,51):
        if r.lockfile(n).exists():
            row={'ordinal':n,'lock':r.load(r.lockfile(n))}
            if (r.location(n)/'status.json').exists():row['status']=r.load(r.location(n)/'status.json');data['providerCalls']+=int(row['status'].get('providerCallAttempted',False))
            data['cases'].append(row)
    r.WORK.mkdir(exist_ok=True);save(r.WORK/'execution-summary.json',data)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['prep','preflight','prepare','lock','live','advance','summary']);ap.add_argument('ordinal',type=int,nargs='?',choices=range(1,51));a=ap.parse_args()
    if a.mode in ['prep','preflight','summary']:globals()[a.mode]()
    else:globals()[a.mode](a.ordinal)
