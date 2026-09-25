#!/usr/bin/env python3
"""Generate a new, explicitly versioned Trackcade metrical-mirror corpus.

This is NOT the historical 32+64 corpus; those exact fixture definitions were not
recoverable. The new corpus preserves the same testing principle: paired/mirrored
rhythmic evidence must not let a rule fix one side by destroying the other.
"""
import argparse
import json
import math
import struct
import wave
from pathlib import Path

SR = 16000
DURATION = 24.0
RATIOS = [
    ('two-thirds', 2/3),
    ('three-halves', 3/2),
    ('three-quarters', 3/4),
    ('four-thirds', 4/3),
    ('four-fifths', 4/5),
    ('five-fourths', 5/4),
    ('one-third', 1/3),
    ('triple', 3.0),
]
# Keep BOTH physical clocks within the Analyzer's legitimate 55-220 BPM search range.
BASES = {
    'two-thirds': [96.0, 108.0, 120.0, 132.0],
    'three-halves': [88.0, 96.0, 108.0, 120.0],
    'three-quarters': [96.0, 108.0, 120.0, 132.0],
    'four-thirds': [90.0, 102.0, 114.0, 126.0],
    'four-fifths': [96.0, 108.0, 120.0, 132.0],
    'five-fourths': [88.0, 100.0, 112.0, 124.0],
    'one-third': [180.0, 189.0, 198.0, 210.0],
    'triple': [60.0, 64.0, 68.0, 72.0],
}


def add_burst(buf, t, freq, amp, decay=0.055, phase=0.0):
    start = max(0, int(t * SR))
    nmax = min(len(buf)-start, int(0.12 * SR))
    for n in range(nmax):
        x = n / SR
        env = math.exp(-x / decay)
        v = amp * env * (0.76 * math.sin(2*math.pi*freq*x + phase) +
                         0.24 * math.sin(2*math.pi*(freq*2.07)*x + phase*0.37))
        buf[start+n] += v


def pulse_times(bpm, phase_s=0.0):
    step = 60.0 / bpm
    t = 0.35 + phase_s
    out=[]
    while t < DURATION - 0.15:
        out.append(t)
        t += step
    return out


def render(spec, path):
    n = int(DURATION * SR)
    buf = [0.0] * n
    pa = pulse_times(spec['clock_a_bpm'], spec['phase_a_s'])
    pb = pulse_times(spec['clock_b_bpm'], spec['phase_b_s'])
    for i,t in enumerate(pa):
        accent = 1.0 + (spec['accent_a'] if i % spec['accent_period_a'] == 0 else 0.0)
        add_burst(buf, t, spec['freq_a_hz'], spec['amp_a'] * accent, phase=0.1)
    for i,t in enumerate(pb):
        accent = 1.0 + (spec['accent_b'] if i % spec['accent_period_b'] == 0 else 0.0)
        add_burst(buf, t, spec['freq_b_hz'], spec['amp_b'] * accent, phase=0.7)
    for i in range(n):
        x=i/SR
        buf[i] += 0.0025*math.sin(2*math.pi*173.0*x) + 0.0015*math.sin(2*math.pi*311.0*x)
    peak=max(1e-9,max(abs(x) for x in buf))
    scale=0.88/peak
    pcm=bytearray()
    for x in buf:
        q=max(-32768,min(32767,int(round(x*scale*32767))))
        pcm += struct.pack('<h',q)
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm)


def base_spec(rname, ratio, base_bpm, variant):
    variants=[
        dict(amp_a=.62,amp_b=.58,phase_a_s=0.00,phase_b_s=0.00,accent_a=.24,accent_b=.18,apa=4,apb=4),
        dict(amp_a=.57,amp_b=.64,phase_a_s=0.00,phase_b_s=0.035,accent_a=.16,accent_b=.28,apa=3,apb=4),
        dict(amp_a=.66,amp_b=.54,phase_a_s=0.022,phase_b_s=0.00,accent_a=.10,accent_b=.34,apa=4,apb=3),
        dict(amp_a=.59,amp_b=.60,phase_a_s=0.018,phase_b_s=0.031,accent_a=.30,accent_b=.12,apa=5,apb=4),
    ][variant]
    return {
        'ratio_name': rname, 'ratio': ratio, 'variant': variant,
        'clock_a_bpm': base_bpm, 'clock_b_bpm': base_bpm*ratio,
        'freq_a_hz': 105.0, 'freq_b_hz': 880.0,
        'amp_a': variants['amp_a'], 'amp_b': variants['amp_b'],
        'phase_a_s': variants['phase_a_s'], 'phase_b_s': variants['phase_b_s'],
        'accent_a': variants['accent_a'], 'accent_b': variants['accent_b'],
        'accent_period_a': variants['apa'], 'accent_period_b': variants['apb'],
    }


def mirror(spec, mode):
    s=dict(spec)
    if mode == 'prominence':
        s['amp_a'],s['amp_b']=s['amp_b'],s['amp_a']
        s['accent_a'],s['accent_b']=s['accent_b'],s['accent_a']
        s['accent_period_a'],s['accent_period_b']=s['accent_period_b'],s['accent_period_a']
    elif mode == 'band':
        s['freq_a_hz'],s['freq_b_hz']=s['freq_b_hz'],s['freq_a_hz']
    else:
        raise ValueError(mode)
    return s


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    manifest=[]; idx=0
    for rname,ratio in RATIOS:
        bases=BASES[rname]
        for variant,base_bpm in enumerate(bases):
            core=base_spec(rname,ratio,base_bpm,variant)
            assert 55 <= core['clock_a_bpm'] <= 220
            assert 55 <= core['clock_b_bpm'] <= 220
            family=[('hard',core),('mirror-prominence',mirror(core,'prominence')),('mirror-band',mirror(core,'band'))]
            for kind,spec in family:
                idx+=1
                name=f'{idx:03d}_{rname}_v{variant}_{kind}.wav'
                render(spec,args.output/name)
                manifest.append({
                    'file':name,'case_index':idx,'kind':kind,
                    **spec,
                    'expected_clocks_bpm':[round(spec['clock_a_bpm'],6),round(spec['clock_b_bpm'],6)],
                    'corpus':'trackcade-v019-metrical-mirror-v1',
                })
    assert len(manifest)==96
    (args.output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({
        'corpus':'trackcade-v019-metrical-mirror-v1','tracks':len(manifest),
        'hard':sum(x['kind']=='hard' for x in manifest),
        'mirror_prominence':sum(x['kind']=='mirror-prominence' for x in manifest),
        'mirror_band':sum(x['kind']=='mirror-band' for x in manifest),
        'ratio_families':[x[0] for x in RATIOS],
        'clock_min_bpm':min(min(x['expected_clocks_bpm']) for x in manifest),
        'clock_max_bpm':max(max(x['expected_clocks_bpm']) for x in manifest),
        'sample_rate':SR,'duration_s':DURATION,
    },indent=2))

if __name__=='__main__': main()
