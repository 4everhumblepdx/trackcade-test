"""Generate preflight once, before any external audio read. Commit before decoding."""
import hashlib,json
from pathlib import Path
from dsp_base import CFG,canonical,digest
ROOT=Path(__file__).resolve().parent
if __name__=='__main__':
    files=sorted([p for p in ROOT.iterdir() if p.suffix in ['.py','.cjs']]+[ROOT/'config.json',ROOT/'CALIBRATION.json'])
    value={'schema':'trackcade-micro-motif-v2-pre-external-freeze','sourceCommit':'6f1555db2a6a7aa2c8cf7e7b59390c17788b39b9','microMotifV1Commit':'6f1555db2a6a7aa2c8cf7e7b59390c17788b39b9','algorithmVersion':CFG['version'],'configuration':CFG,'configSha256':digest(CFG),'codeSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files},'featureSet':'72-dimensional baseline-subtracted HP-soft-mask band patches; robust scaling; mixture chroma; relative times and strengths','alignment':'one interior insertion/deletion; endpoints observed; no invented timestamps; fixed search scope','falseDiscoveryPolicy':'per-track maximum over all searched families and all three control types for each of 31 fixed seeds; plus-one empirical exceedance <=.05; surrogate screen not proven FDR','timingDecision':'all independent synthetic validation classes pass before strict research candidates; true real timing remains unknown','externalRunsAllowed':1,'externalTrackSpecificHandling':False,'externalAudioReadBeforeFreeze':False,'providerCalls':0,'spendUSD':0,'classificationRules':{'A':'specificity and timing convincing across all five','B':'timing only','C':'specificity only','D':'both insufficient or external failure','E':'development succeeds, external fails'},'productionIntegrationAuthorized':False}
    with (ROOT/'PREFLIGHT.json').open('xb') as f:f.write(canonical(value))
    print(digest(value))
