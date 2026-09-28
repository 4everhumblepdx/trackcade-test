#!/usr/bin/env python3
"""Offline, Stage-1-only representability and descriptive packet footprint audit."""
import argparse
import collections
import hashlib
import json
import math
import statistics
from pathlib import Path

import evaluate_stage1_drop_v1 as frozen
import analyze_stage1_anchor_coverage_v1 as baseline

HEAD = '7e63c00df981b116b502ba0ddfcf11af8a62bc2e'
IDENTITIES = {
    'baseZip': 'accfe84fc54feda56f0c99404a1ed7b245beb9ef74a1876b3b185e8d494a131a',
    'v2Zip': '627330db82b6e28060260bb357501d15d339ff790ee097e0739de40d0c9640bd',
    'baseManifest': '350a621cfac110369ab4852a925a96964c01b744168e4991ff90df82b24134ff',
    'v2Manifest': '82c9d82688314a18b676d0f5e8e251b6ebd9cff7306a243210f63a8fa45d3bf9',
    'references': '1b74d185d47ea52db62d4c23cdbd44375b6ba0a05cf3824c4278e88646db9d1c',
}
FAMILIES = ('current', 'interaction core', 'interaction core+accent', 'interaction all',
            'current+core', 'current+core+accent', 'beatGrid all')

def require(ok, msg):
    if not ok:
        raise SystemExit('FAIL-CLOSED: ' + msg)

def blob(path):
    b = path.read_bytes()
    return hashlib.sha1(b'blob ' + str(len(b)).encode() + b'\0' + b).hexdigest()

def compact(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def stats(values):
    return dict(total=sum(values), mean=statistics.mean(values), median=statistics.median(values),
                minimum=min(values), maximum=max(values))

def checked(path, expected):
    require(frozen.sha256(path) == expected, 'hash mismatch: ' + str(path))
    return frozen.load(path)

def times(rows):
    require(all(isinstance(r, dict) and frozen.finite_number(r.get('time')) for r in rows), 'invalid anchor time')
    return baseline.unique_times(r['time'] for r in rows)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for name in ('base-root', 'v2-root', 'base-zip', 'v2-zip', 'references', 'output'):
        ap.add_argument('--' + name, required=True, type=Path)
    a = ap.parse_args()
    here = Path(__file__).parent
    require(blob(here / 'evaluate_stage1_drop_v1.py') == '3d74996281ec260e170ea10929bd0115a6d4ac70', 'matcher changed')
    require(blob(here / 'analyze_stage1_anchor_coverage_v1.py') == 'dd9594b6dde70e00025c9bfc74f2430d2b0356c6', 'baseline helpers changed')
    for path, key in ((a.base_zip, 'baseZip'), (a.v2_zip, 'v2Zip')):
        require(frozen.sha256(path) == IDENTITIES[key], key + ' mismatch')
    base = checked(a.base_root / 'STAGE1_PREP_MANIFEST_V1.json', IDENTITIES['baseManifest'])
    prep = checked(a.v2_root / 'STAGE1_V2_PREP_MANIFEST_V1.json', IDENTITIES['v2Manifest'])
    refs_doc = checked(a.references, IDENTITIES['references'])
    # The shared reference container is hashed intact; only its stage1 rows are selected or scored.
    require(refs_doc['schema'] == frozen.REFERENCE_SCHEMA and refs_doc['eventKind'] == 'drop', 'reference contract')
    refs = {r['id']: r['dropsSeconds'] for r in refs_doc['stage1']}
    require(len(refs) == len(refs_doc['stage1']) == 50, 'Stage 1 references')
    require(sum(map(len, refs.values())) == 46, 'reference support')
    require(prep['schema'] == baseline.PREP_SCHEMA and prep['status'] == baseline.PREP_STATUS, 'v2 schema/status')
    require(base['schema'] == frozen.PREP_SCHEMA, 'base schema')
    require(prep['basePrepManifestSha256'] == IDENTITIES['baseManifest'], 'base linkage')
    for doc in (base, prep):
        require(doc['trackCount'] == len(doc['tracks']) == 50, 'track count')
        require(doc['terminalTracksProcessed'] is False and doc['referenceLabelsReadByPreparation'] is False, 'research boundary')
        require({r['ordinal'] for r in doc['tracks']} == set(range(1, 51)), 'ordinals')
        require({r['id'] for r in doc['tracks']} == set(refs), 'identity set')
    base_rows = {r['id']: r for r in base['tracks']}
    views = {f: [] for f in FAMILIES}
    provenance = []
    for row in sorted(prep['tracks'], key=lambda r: r['ordinal']):
        old = base_rows[row['id']]
        for key in ('id', 'ordinal', 'stem', 'analysisJsonSha256', 'analyzerRunnerSha256', 'analyzerSourceCommit'):
            require(old[key] == row[key], 'base/v2 disagreement: ' + key)
        require(row['analyzerRunnerSha256'] == frozen.ANALYZER_RUNNER_SHA256 and row['analyzerSourceCommit'] == frozen.ANALYZER_SOURCE_COMMIT, 'Analyzer identity')
        case = 'cases/' + f"{row['ordinal']:02d}-{row['stem']}"
        analysis = checked(a.base_root / case / 'analysis-v019.json', row['analysisJsonSha256'])
        evidence = checked(a.v2_root / case / 'structure-evidence-v1.json', row['hashes']['structureEvidenceSha256'])
        checked(a.base_root / case / 'structure-evidence-v1.json', row['hashes']['structureEvidenceSha256'])
        packet_path = a.v2_root / case / 'interpretation-packet-v1.json'
        packet = checked(packet_path, row['hashes']['interpretationPacketSha256'])
        require(evidence['source']['analysisJsonSha256'] == row['analysisJsonSha256'], 'evidence source')
        require(evidence['source']['analyzerRunnerSha256'] == frozen.ANALYZER_RUNNER_SHA256, 'evidence Analyzer')
        current = evidence['boundaries'] + evidence['landmarks']
        require(times(packet['boundaries'] + packet['landmarks']) == times(current), 'packet anchor mismatch')
        candidates = analysis['interactionCandidates']
        times(candidates)
        require(all(c.get('priority') in ('core', 'accent', 'optional') for c in candidates), 'unknown priority')
        core = [c for c in candidates if c['priority'] == 'core']
        accent = [c for c in candidates if c['priority'] in ('core', 'accent')]
        families = (current, core, accent, candidates, current + core, current + accent, analysis['beatGrid'])
        selected_extra = ([], core, accent, candidates, core, accent, analysis['beatGrid'])
        current_set = set(times(current))
        provenance.append(dict(ordinal=row['ordinal'], id=row['id'], analysisJsonSha256=row['analysisJsonSha256'],
                               structureEvidenceSha256=row['hashes']['structureEvidenceSha256'], interpretationPacketSha256=row['hashes']['interpretationPacketSha256']))
        for name, raw, extra in zip(FAMILIES, families, selected_extra):
            unique = times(raw)
            # Footprints are hypothetical audit envelopes, never provider payloads or a v2 schema proposal.
            hypothetical = dict(packet)
            if name.startswith('interaction') or name == 'beatGrid all':
                hypothetical.pop('boundaries')
                hypothetical.pop('landmarks')
            if extra:
                hypothetical['auditCandidateRecords'] = extra
            before, after = len(compact(packet)), len(compact(hypothetical))
            types = collections.Counter(str(c.get('type', c.get('source', c.get('role', 'unspecified')))) for c in extra)
            priorities = collections.Counter(str(c.get('priority', 'not-applicable')) for c in extra)
            if name == 'current' or name.startswith('current+'):
                types.update({'boundary': len(evidence['boundaries']), 'landmark': len(evidence['landmarks'])})
                priorities['not-applicable'] += len(current)
            extra_times = times(extra)
            footprint = dict(originalPacketFileBytes=packet_path.stat().st_size, baselineCompactPacketBytes=before,
                             hypotheticalCompactPacketBytes=after, deltaCompactBytes=after-before,
                             estimatedBaselineTokens=math.ceil(before/4), estimatedHypotheticalTokens=math.ceil(after/4),
                             estimatedTokenDelta=math.ceil(after/4)-math.ceil(before/4), rawCandidateRecordsBytes=len(compact(extra)))
            views[name].append(dict(ordinal=row['ordinal'], id=row['id'], rawAnchorCount=len(raw), uniqueAnchorCount=len(unique),
                duplicateTimeCount=len(raw)-len(unique), uniqueTimesOverlappingCurrent=len(set(unique)&current_set),
                extraRecordsOverlappingCurrent=sum(round(float(c['time']),9) in current_set for c in extra),
                extraUniqueTimesOverlappingCurrent=len(set(extra_times)&current_set), extraUniqueTimesNewVsCurrent=len(set(extra_times)-current_set),
                candidateTypeDistribution=dict(sorted(types.items())), candidatePriorityDistribution=dict(sorted(priorities.items())),
                footprint=footprint, byTolerance={str(t): baseline.score_refs(refs[row['id']], unique, t) for t in baseline.TOLERANCES}))
    results = {}
    for name, rows in views.items():
        results[name] = dict(aggregates={str(t):baseline.aggregate([r['byTolerance'][str(t)] for r in rows]) for t in baseline.TOLERANCES},
            counts={k:stats([r[k] for r in rows]) for k in ('rawAnchorCount','uniqueAnchorCount','duplicateTimeCount','uniqueTimesOverlappingCurrent','extraRecordsOverlappingCurrent','extraUniqueTimesOverlappingCurrent','extraUniqueTimesNewVsCurrent')},
            footprint={k:stats([r['footprint'][k] for r in rows]) for k in rows[0]['footprint']},
            candidateTypeDistribution=dict(sum((collections.Counter(r['candidateTypeDistribution']) for r in rows),collections.Counter())),
            candidatePriorityDistribution=dict(sum((collections.Counter(r['candidatePriorityDistribution']) for r in rows),collections.Counter())), tracks=rows)
    require([results['current']['aggregates'][str(t)]['matchedReferenceSupport'] for t in baseline.TOLERANCES] == [19,28,41], 'frozen baseline did not reproduce')
    result = dict(schema='trackcade-stage1-interaction-anchor-coverage-v1', sourceCommit=HEAD, trackCount=50,
        providerCallsMade=0, terminalTracksProcessed=False, audioDecoded=False, analyzerExecuted=False,
        tolerancesSeconds=list(baseline.TOLERANCES), primaryToleranceSeconds=2.0,
        sourceHashes=IDENTITIES, scriptSha256=frozen.sha256(Path(__file__)), matcherGitBlobSha=blob(here/'evaluate_stage1_drop_v1.py'),
        analyzerRunnerSha256=frozen.ANALYZER_RUNNER_SHA256, analyzerSourceCommit=frozen.ANALYZER_SOURCE_COMMIT,
        method=dict(families=list(FAMILIES), core="priority == core", coreAccent="priority in {core, accent}",
            current='union of frozen structure evidence boundaries and landmarks', deduplication='same baseline round(time,9), sorted unique times; matching uses unique locations',
            duplicates='exact equality after rounding to 9 decimals; no tolerance-based merging',
            type='Current records use boundary/landmark; interaction records use type if present, otherwise source; beatGrid uses role. Distributions count all raw family records; current and beatGrid priority is not-applicable.',
            packet='Descriptive compact sorted UTF-8 JSON: retain other packet fields; remove boundaries/landmarks for interaction-only and beatGrid; append full source records as auditCandidateRecords. Unions retain current fields. No schema or provider request is changed.',
            tokens='ceil(compact UTF-8 bytes / 4), rough estimate only; not model tokenizer counts or billable usage',
            meaning='Representability ceiling, not Drop detection performance; beatGrid all is descriptive density upper bound only; Stage 1 is label-aware development.'),
        inputTracks=provenance, views=results)
    data=(json.dumps(result,indent=2,sort_keys=True)+'\n').encode('utf-8')
    a.output.parent.mkdir(parents=True,exist_ok=True)
    require(not a.output.exists() or a.output.read_bytes()==data, 'refusing to overwrite different result')
    a.output.write_bytes(data)
    print(json.dumps({n:dict(matches=[v['aggregates'][str(t)]['matchedReferenceSupport'] for t in baseline.TOLERANCES],meanAnchors=v['counts']['uniqueAnchorCount']['mean'],meanTokenDelta=v['footprint']['estimatedTokenDelta']['mean']) for n,v in results.items()},indent=2))

if __name__ == '__main__':
    main()
