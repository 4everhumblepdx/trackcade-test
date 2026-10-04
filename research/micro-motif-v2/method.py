"""Frozen local numerical research; metadata/title never enters feature computation."""
import itertools
import numpy as np
from dsp_base import CFG, canonical, digest, detect_events, spectra, unit

def median_axis(s, width, axis):
    pads=[(0,0)]*s.ndim; pads[axis]=(width//2,width//2)
    v=np.lib.stride_tricks.sliding_window_view(np.pad(s,pads,mode='edge'),width,axis=axis)
    return np.median(v,axis=-1)

def features(x, events, use_hp=True):
    """Baseline-subtracted attack patches; masks partition texture, never name sources."""
    s=spectra(x,2048,CFG['hopSamples']); freqs=np.fft.rfftfreq(2048,1/CFG['sampleRate'])
    edges=np.geomspace(60,10000,13); bands=[(freqs>=a)&(freqs<b) for a,b in zip(edges,edges[1:])]
    h=median_axis(s,CFG['hpMedianFrames'],0); p=median_axis(s,CFG['hpMedianBins'],1)
    mask=h*h/np.maximum(h*h+p*p,1e-12)
    components=[s*mask,s*(1-mask)] if use_hp else [s,s]
    banded=[np.stack([np.log1p(10*c[:,b]).mean(axis=1) for b in bands],axis=1) for c in components]
    result=[]; dt=CFG['hopSamples']/CFG['sampleRate']
    for e in events:
        i=round(e['time']/dt); chunks=[]
        for b in banded:
            baseline=b[max(0,i-9):max(1,i-2)].mean(axis=0)
            for a,z in [(0,4),(4,11),(11,21)]:
                patch=b[min(i+a,len(b)-1):min(i+z,len(b))].mean(axis=0)-baseline
                chunks.append(np.maximum(patch,0))
        result.append(np.concatenate(chunks))
    v=np.asarray(result)
    if not len(v): return np.empty((0,72))
    # Per-track scale reduces ubiquitous bands, without using another song or labels.
    v=v/np.maximum(np.quantile(v,.75,axis=0),.05)
    return unit(np.log1p(v)).astype(np.float32)

def sample_indices(n, limit):
    return np.unique(np.linspace(0,n-1,min(n,limit),dtype=int)) if n else np.array([],dtype=int)

def windows(events):
    t=np.array([e['time'] for e in events]); result={}
    for length in range(2,8):
        starts=np.arange(max(0,len(t)-length+1)); d=t[starts+length-1]-t[starts]
        starts=starts[(d>=CFG['patternDurationSeconds'][0])&(d<=CFG['patternDurationSeconds'][1])]
        starts=starts[sample_indices(len(starts),CFG['targetWindowsPerLength'])]
        result[length]=starts[:,None]+np.arange(length)
    return result

def mappings(a,b):
    if a==b: return [(np.arange(a),np.arange(b),'exact')]
    if abs(a-b)!=1 or min(a,b)<2: return []
    # Endpoints are retained: one interior missing/ornamental attack only.
    if a>b: return [(np.delete(np.arange(a),i),np.arange(b),'missing-canonical-'+str(i)) for i in range(1,a-1)]
    return [(np.arange(a),np.delete(np.arange(b),i),'extra-observed-'+str(i)) for i in range(1,b-1)]

def alignment(seed, targets, times, strengths, acoustic, chroma, use_chroma=True):
    """Vectorized bounded monotone matching; no inferred timestamps, no recovery."""
    n=len(targets); best=np.full(n,np.inf); details={k:np.zeros(n) for k in ['distortion','acoustic','chroma','attack']}; codes=np.full(n,-1,int)
    maps=mappings(len(seed),targets.shape[1]); st=times[seed]; td=times[targets[:,-1]]-times[targets[:,0]]
    tempo=td/max(st[-1]-st[0],1e-9)
    for mi,(si,ti,kind) in enumerate(maps):
        a=seed[si]; b=targets[:,ti]; q=(times[a]-times[a[0]])/(times[a[-1]]-times[a[0]])
        r=(times[b]-times[b[:,0,None]])/(times[b[:,-1]]-times[b[:,0]])[:,None]
        # Endpoint-normalized temporal displacement; two-event phrases still require acoustic contour.
        distortion=np.max(abs(r-q),axis=1)
        ac=acoustic[a[None,:],b].mean(axis=1); cc=chroma[a[None,:],b].mean(axis=1)
        sa=strengths[a]/max(strengths[a].max(),1e-9); sb=strengths[b]/np.maximum(strengths[b].max(axis=1)[:,None],1e-9)
        ad=np.max(abs(sb-sa),axis=1); gap=0 if kind=='exact' else CFG['gapPenalty']
        cost=.40*distortion+.35*(1-ac)+.15*ad+(.10*(1-cc) if use_chroma else 0)+gap
        valid=(distortion<=CFG['rhythmRelativeTolerance'])&(ac>=CFG['acousticCosineMinimum'])&(ad<=CFG['strengthContourTolerance'])&(tempo>=CFG['maximumTempoRatio'][0])&(tempo<=CFG['maximumTempoRatio'][1])
        if use_chroma: valid&=cc>=CFG['chromaCosineMinimum']
        valid&=cost<=CFG['maximumAlignmentCost']; choose=valid&(cost<best)
        best[choose]=cost[choose];codes[choose]=mi
        for key,val in [('distortion',distortion),('acoustic',ac),('chroma',cc),('attack',ad)]:details[key][choose]=val[choose]
    return best,details,codes,maps

class Search:
    def __init__(self,events,descriptor,duration):
        self.events=events;self.duration=duration;self.times=np.array([e['time'] for e in events]);self.strength=np.array([e['strength'] for e in events]);self.desc=descriptor
        self.chroma=unit(np.array([e['chroma'] for e in events]));self.acoustic=(descriptor@descriptor.T).clip(0,1);self.tonal=(self.chroma@self.chroma.T).clip(0,1);self.windows=windows(events)
        self.seeds={l:self.windows[l][sample_indices(len(self.windows[l]),CFG['seedWindowsPerLength'])] for l in range(2,7)}
    def run(self, order=None, use_chroma=True, retain=True):
        order=np.arange(len(self.events)) if order is None else order
        ac=self.acoustic[np.ix_(order,order)];cc=self.tonal[np.ix_(order,order)];strength=self.strength[order];desc=self.desc[order];families=[]; top=0.;searched_family_count=0;best_summary={'score':0.,'similarity':0.,'occurrences':0,'preTimingEligible':0}
        for l,seeds in self.seeds.items():
            for seed in seeds:
                gaps=np.diff(self.times[seed]);rhythm=gaps/gaps.mean();attack=strength[seed]/max(strength[seed].max(),1e-9)
                distinct=float(max(np.std(rhythm),np.std(attack),np.mean(1-np.sum(desc[seed[1:]]*desc[seed[:-1]],axis=1))))
                if distinct<CFG['minimumDistinctiveness']:continue
                candidates=[]
                for length in range(max(2,l-1),min(7,l+1)+1):
                    targets=self.windows[length]
                    if not len(targets):continue
                    costs,d,codes,maps=alignment(seed,targets,self.times,strength,ac,cc,use_chroma)
                    for j in np.flatnonzero(np.isfinite(costs)):
                        indices=targets[j];candidates.append((self.times[indices[0]],float(costs[j]),indices,{k:float(v[j]) for k,v in d.items()},maps[codes[j]]))
                occ=[];end=-float('inf')
                for start,cost,ids,d,mapping in sorted(candidates,key=lambda c:(c[0],c[1],len(c[2]))):
                    if start<end+CFG['minimumOccurrenceSeparationSeconds']:continue
                    si,ti,kind=mapping;es=[self.events[i] for i in ids]
                    occ.append({'startTime':float(start),'endTime':es[-1]['time'],'eventTimes':[e['time'] for e in es],'eventIds':[e['id'] for e in es],'canonicalMatchedIndices':si.tolist(),'observedMatchedIndices':ti.tolist(),'alignment':kind,'alignmentCost':round(cost,6),'timingDistortion':round(d['distortion'],6),'rhythmSimilarity':round(1-d['distortion'],6),'descriptorSimilarity':round(d['acoustic'],6),'acousticSimilarity':round(d['acoustic'],6),'chromaSimilarity':round(d['chroma'],6),'internallyStable':all(e['strictGameplayCandidate'] for e in es),'productionValidated':False})
                    end=es[-1]['time']
                if len(occ)<CFG['minimumRecurrences']:continue
                searched_family_count+=1
                span=(occ[-1]['endTime']-occ[0]['startTime'])/max(1,self.duration);similarity=np.mean([1-o['alignmentCost'] for o in occ]);score=float(.30*min(1,len(occ)/12)+.30*similarity+.20*span+.20*min(1,distinct))
                summary={'score':round(score,6),'similarity':round(float(similarity),6),'occurrences':len(occ),'preTimingEligible':int(score>=CFG['minimumProminence'] and span>=.15)}
                if score>top:top=score;best_summary=summary
                if not retain:continue
                representation={'normalizedIntervals':rhythm.round(6).tolist(),'attackContour':attack.round(6).tolist(),'localDescriptorContour':desc[seed].round(6).tolist(),'mixtureChromaContour':self.chroma[order[seed]].round(6).tolist(),'notePitchContour':None}
                families.append({'id':'v2-'+digest(representation)[:12],'eventCount':l,'eventLengthRange':[min(len(o['eventTimes']) for o in occ),max(len(o['eventTimes']) for o in occ)],'canonicalPattern':representation,'occurrenceCount':len(occ),'occurrences':occ,'motifProminence':round(score,6),'recurrenceSimilarity':round(float(similarity),6),'songSpan':round(span,6),'distinctiveness':round(distinct,6),'sourceIdentity':'UNKNOWN'})
        selected=[]
        for f in sorted(families,key=lambda f:(-f['motifProminence'],f['id'])):
            ts=[o['startTime'] for o in f['occurrences']]
            if any(sum(any(abs(t-o['startTime'])<.15 for o in g['occurrences']) for t in ts)/len(ts)>.75 for g in selected):continue
            selected.append(f)
            if len(selected)>=CFG['maximumFamilies']:break
        best_summary['searchedFamilyCount']=searched_family_count
        return selected,best_summary

def surrogate_order(events, kind, seed):
    rng=np.random.default_rng(seed);n=len(events);order=np.arange(n)
    if kind=='descriptor-shuffle':return rng.permutation(n)
    if kind=='timing-misalignment':
        for a in range(0,n,32):
            b=min(n,a+32);order[a:b]=np.roll(order[a:b],int(rng.integers(1,max(2,b-a))))
        return order
    if kind!='rhythm-preserving':raise ValueError('Unknown control')
    # Conditional shuffles preserve timing and broad attack-strength/density strata.
    strength=np.array([e['strength'] for e in events]);times=np.array([e['time'] for e in events]);density=np.r_[np.diff(times),np.median(np.diff(times))]
    sb=np.searchsorted(np.quantile(strength,[.25,.5,.75]),strength);db=np.searchsorted(np.quantile(density,[.33,.67]),density)
    for s,d in itertools.product(range(4),range(3)):
        ids=np.flatnonzero((sb==s)&(db==d));order[ids]=rng.permutation(ids)
    return order

CONTROL_KINDS=['descriptor-shuffle','timing-misalignment','rhythm-preserving']
def null_distribution(search,use_chroma=True):
    distributions={kind:[] for kind in CONTROL_KINDS}
    for seed in CFG['nullSeeds']:
        for kind in CONTROL_KINDS:
            _,summary=search.run(surrogate_order(search.events,kind,seed),use_chroma,False);distributions[kind].append({'seed':seed,**summary})
    return distributions

def approve(families, distributions, calibration_pass):
    maxima=np.max([[r['score'] for r in distributions[k]] for k in CONTROL_KINDS],axis=0)
    for f in families:
        p=(1+int(np.sum(maxima>=f['motifProminence'])))/(1+len(maxima))
        separated=p<=CFG['falseDiscoveryAlpha'];strict=sum(o['internallyStable'] for o in f['occurrences']) if calibration_pass else 0
        eligible=separated and strict>=CFG['minimumRecurrences'] and f['motifProminence']>=CFG['minimumProminence'] and f['songSpan']>=.15 and all(min(np.diff(o['eventTimes']))>=.18 for o in f['occurrences'])
        f.update(empiricalSearchMaxExceedance=p,nullMax=float(maxima.max()),nullPercentile=float(np.mean(maxima<f['motifProminence'])),falseDiscoveryStatus='surrogate-max separated' if separated else 'rejected: search-max null not separated',calibrationSupportedOccurrences=strict,gameplayAnchorCandidate=bool(eligible),trustedMicroEventTime=False,approvalReason='research anchor candidate only; real timing truth absent' if eligible else 'fail closed: specificity, calibration, recurrence or playable spacing gate failed')
    return families
