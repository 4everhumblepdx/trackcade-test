#!/usr/bin/env python3
"""Label-free compact evidence prototype. No provider or compiler integration."""
import copy
import hashlib
import json
import math

SCHEMA = 'trackcade-structure-evidence-v2'
SELECTED = 'current-core-accent-table-v2'
POLICIES = {
    'current-core-table-v2': (('core',), 'table'),
    'current-core-accent-objects-v2': (('core', 'accent'), 'objects'),
    SELECTED: (('core', 'accent'), 'table'),
    'current-all-table-v2': (('core', 'accent', 'optional'), 'table'),
}
PRIORITIES = ['core', 'accent', 'optional']
SOURCES = ['beat', 'onset', 'downbeat', 'transition']
COLUMNS = ['time', 'priorityCode', 'sourceCode', 'salience', 'confidence']
ANALYZER_COMMIT = 'e308d867980fb1877c3f2e4ce27950deecac0855'
ANALYZER_SHA = '9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432'
CONTEXT_KEYS = ['timingTrust', 'structureTrust', 'energy', 'sections', 'boundaries', 'landmarks', 'lowDemandWindows']

def require(ok, reason):
    if not ok:
        raise ValueError('EVIDENCE V2 FAIL-CLOSED: ' + reason)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')

def digest(data):
    return hashlib.sha256(data).hexdigest()

def finite(x):
    return isinstance(x, (int,float)) and not isinstance(x,bool) and math.isfinite(x)

def rows(evidence):
    if evidence['encoding'] == 'table':
        return evidence['anchors']
    return [[r[k] for k in COLUMNS] for r in evidence['anchors']]

def build(analysis_bytes, packet_bytes, evidence_sha256, policy=SELECTED):
    """Input content only; intentionally accepts no labels, scores or reference paths."""
    require(policy in POLICIES, 'unknown policy')
    analysis, packet = json.loads(analysis_bytes), json.loads(packet_bytes)
    require(packet.get('schema') == 'trackcade-interpretation-packet-v1', 'packet schema')
    source = copy.deepcopy(packet['source'])
    require(source['analysisJsonSha256'] == digest(analysis_bytes), 'analysis hash')
    require(source['analyzerSourceCommit'] == ANALYZER_COMMIT and source['analyzerRunnerSha256'] == ANALYZER_SHA, 'Analyzer identity')
    require(source['analyzerRelease'] == 'v0.19', 'Analyzer release')
    require(source['duration'] == analysis['duration'] and finite(source['duration']) and source['duration'] > 0, 'duration')
    require(isinstance(evidence_sha256,str) and len(evidence_sha256)==64 and all(c in '0123456789abcdef' for c in evidence_sha256), 'evidence hash')
    source['interpretationPacketV1Sha256'] = digest(packet_bytes)
    source['structureEvidenceV1Sha256'] = evidence_sha256
    selected_priorities, encoding = POLICIES[policy]
    candidates = analysis['interactionCandidates']
    require(isinstance(candidates,list), 'candidate list')
    for c in candidates:
        require(isinstance(c,dict) and c.get('priority') in PRIORITIES and c.get('source') in SOURCES, 'candidate enum')
        require(all(finite(c.get(k)) for k in ('time','salience','confidence')), 'candidate numeric fields')
        require(0 <= c['time'] <= source['duration'], 'candidate time range')
        require(0 <= c['salience'] <= 1 and 0 <= c['confidence'] <= 1, 'candidate feature range')
    # Exact numeric equality only. Do not round or move a timestamp.
    groups = {}
    for kind, field in enumerate(('boundaries','landmarks')):
        require(isinstance(packet[field],list), 'current anchor list')
        for index, record in enumerate(packet[field]):
            t = record.get('time')
            require(finite(t) and 0 <= t <= source['duration'], 'current anchor time')
            require('anchor' not in record, 'reserved context key')
            groups.setdefault(t,[[],[],[]])[kind].append(index)
    for index,c in enumerate(candidates):
        if c['priority'] in selected_priorities:
            groups.setdefault(c['time'],[[],[],[]])[2].append(index)
    ordered = sorted(groups)
    anchors, aliases = [], []
    for t in ordered:
        alias = groups[t]
        ids = alias[2]
        if ids:
            representative = min(ids, key=lambda i:(PRIORITIES.index(candidates[i]['priority']),i))
            c = candidates[representative]
            row = [t,PRIORITIES.index(c['priority']),SOURCES.index(c['source']),c['salience'],c['confidence']]
        else:
            row = [t,None,None,None,None]
        anchors.append(row if encoding=='table' else dict(zip(COLUMNS,row)))
        aliases.append(alias)
    context = {k:copy.deepcopy(packet[k]) for k in CONTEXT_KEYS}
    index_by_time = {t:i for i,t in enumerate(ordered)}
    for key in ('boundaries','landmarks'):
        for r in context[key]:
            r['anchor'] = index_by_time[r.pop('time')]
    provenance = dict(schema='trackcade-structure-evidence-v2-source-map', policy=policy, source=source,
                      aliasColumns=['boundaryIndices','landmarkIndices','interactionCandidateIndices'], aliases=aliases)
    evidence = dict(schema=SCHEMA,policy=policy,source=source,sourceMapSha256=digest(canonical(provenance)),
        encoding=encoding,anchorColumns=COLUMNS,priorityCodes=PRIORITIES,sourceCodes=SOURCES,
        anchors=anchors,context=context,
        interpretationContract=dict(timingAuthority='frozen-analyzer-derived-anchor-only',anchorReference='zero-based anchors row index',
            independentTimestampsAllowed=False,beatOrBpmEditsAllowed=False,analyzerSemanticHintsExposed=False,
            usage='offline-evidence-research-only',compilerIntegration='not-enabled',
            instruction='Anchor time is deterministic. Priority, salience and confidence are Analyzer features, not Drop probability or gameplay authorization. No provider request or compiler policy is defined here.'))
    require('diagnostic' not in canonical(evidence).decode().lower(), 'forbidden diagnostic data')
    return evidence, provenance

def validate(evidence, provenance, analysis_bytes, packet_bytes, evidence_sha256):
    """Reconstruct expected output from immutable inputs; reject any changed field or alias."""
    expected, expected_map = build(analysis_bytes,packet_bytes,evidence_sha256,evidence.get('policy'))
    require(canonical(evidence)==canonical(expected), 'evidence differs from deterministic export')
    require(canonical(provenance)==canonical(expected_map), 'source map differs from deterministic export')
    require(evidence['sourceMapSha256']==digest(canonical(provenance)), 'source map hash')
    original = json.loads(packet_bytes)
    restored = copy.deepcopy(evidence['context'])
    anchor_rows = rows(evidence)
    for field in ('boundaries','landmarks'):
        for record in restored[field]:
            record['time'] = anchor_rows[record.pop('anchor')][0]
    require(restored=={k:original[k] for k in CONTEXT_KEYS}, 'context reconstruction')
    analysis = json.loads(analysis_bytes)
    count = 0
    for index,alias in enumerate(provenance['aliases']):
        require(any(alias), 'anchor without provenance')
        for field,indices in zip(('boundaries','landmarks','interactionCandidates'),alias):
            source_rows = analysis[field] if field=='interactionCandidates' else original[field]
            for i in indices:
                require(source_rows[i]['time']==anchor_rows[index][0], 'source timestamp mismatch')
                count += 1
    return dict(anchorsChecked=len(anchor_rows),sourceReferencesChecked=count,contextReconstructed=True)
