"""Pure transformation of pinned label-blind V7/V8 requests; no I/O or transport.

Caller must supply and verify frozen input identities. No label/result/forensic
artifact is accepted or consulted. Existing schema and packet pass through.
"""
import copy
import hashlib
import json

VERSION = 'stage1-v9-decisive-impact-evidence-grounding-v1'
BASELINE_INSTRUCTION_SHA256 = 'cb47f65fdb5b8402602cf6bb363c27c3364a7bcc7fcf4071ac24ba4f5242dc3b'
MARKER = '- Set `structuralContext` independently to one of '
GROUNDING = """V9 decisive-impact evidence grounding procedure (existing musical definition unchanged):
- Apply this procedure only to the existing decisiveImpact judgment for an already-discovered candidate being considered as drop. Do not broaden candidate discovery or coverage, add candidates for this procedure, or change preparation or sustainedStrongerPassage requirements.
- Before marking decisiveImpact clear, use the existing candidate rationale to identify the specific anchor-local observations actually present in the supplied packet that substantiate a concentrated onset/impact at this same proposed evidence anchor. Identify the relevant packet anchor or sample/field observations so the support is traceable; no new output fields are required.
- Distinguish that anchor-local support explicitly from broader structural context and section-average energy differences. A chorus/section beginning, average section-energy rise, quieter-to-stronger passage, return/reentry, or upward trend across multiple seconds does not by itself substantiate concentrated decisive impact.
- Anchor-local concentrated support may still justify decisiveImpact clear under the existing definition. Cite only what the packet actually contains; an anchor's priority, salience, confidence or source code is not by itself impact proof. Do not describe coarse sampled rises as measured transient, rhythmic, spectral or instrumentation evidence unless those observations actually exist in the packet.
- If the packet does not substantiate concentrated impact at this anchor, do not invent support or mark decisiveImpact clear. Use the existing weak/absent/unclear judgment as appropriate. Retain an appropriate existing non-Drop semantic event type for a meaningful transition; semantic non-Drop status does not remove gameplay/actionability eligibility.
- This is evidence citation for the existing impact judgment only: no numeric energy/confidence threshold, chorus/return/repetition veto, fixed Drop-count policy, post-semantic filter, timestamp adjustment, new musical event definition or relaxed impact requirement is introduced.
"""

def sha(data):
    return hashlib.sha256(data).hexdigest()

def instruction(old):
    if sha(old.encode()) != BASELINE_INSTRUCTION_SHA256:
        raise ValueError('Frozen baseline instruction identity mismatch')
    if old.count(MARKER) != 1:
        raise ValueError('Grounding insertion marker mismatch')
    pos=old.index(MARKER)
    return old[:pos]+GROUNDING+old[pos:]

def cap(n):
    if type(n) is not int or n not in range(1,51):
        raise ValueError('Only Stage1 ordinals 1â€“50')
    return 8192 if n<=3 else 25000

def assert_label_blind(value):
    forbidden={'referencedropsseconds','referencecount','truepositives','falsepositives','falsenegatives','tp','fp','fn','errorgroup','nearestreferencedistanceseconds','zeroreferencetrack','forensic','terminal','dropsseconds','diagnosticlabelhint','diagnostictypehint','aliases','aliascolumns','baselineresult'}
    if isinstance(value,dict):
        for key,item in value.items():
            if key.lower() in forbidden:raise ValueError('Forbidden provider-input field')
            assert_label_blind(item)
    elif isinstance(value,list):
        for item in value:assert_label_blind(item)

def treatment_request(old):
    assert_label_blind(old)
    new=copy.deepcopy(old)
    if set(old)!={'schema','instruction','packet','responseContract','integrity'}:
        raise ValueError('Unexpected baseline request fields')
    new['instruction']=instruction(old['instruction'])
    new['integrity']['instructionSha256']=sha(new['instruction'].encode())
    new['integrity']['developmentRevision']=VERSION
    return new

def treatment_payload(old,n):
    if set(old)!={'input','instructions','max_output_tokens','model','reasoning','service_tier','store','text'}:
        raise ValueError('Unexpected provider-facing payload fields')
    if (old['model'],old['reasoning'],old['service_tier'],old['store'],old['max_output_tokens']) != ('gpt-6-sol',{'effort':'high'},'flex',False,cap(n)):
        raise ValueError('Baseline provider settings mismatch')
    data=json.loads(old['input'])
    assert_label_blind(data)
    if set(data)!={'packet','responseContract','integrity'}:
        raise ValueError('Unexpected provider input fields')
    new=copy.deepcopy(old)
    new['instructions']=instruction(old['instructions'])
    data['integrity']['instructionSha256']=sha(new['instructions'].encode())
    data['integrity']['developmentRevision']=VERSION
    new['input']=json.dumps(data,sort_keys=True,separators=(',',':'))
    return new
