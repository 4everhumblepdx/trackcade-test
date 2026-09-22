// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Audio system — SFX (synthesised or sampled) and streamed music through a single WebAudio graph. Accessed as `this.game.sound` on every scene. */
/**
 * Frequency in Hz of a named note — `'C5'`, `'F#4'`, `'Bb3'` (letter, optional `#`/`b`, octave).
 * Equal temperament, A4 = 440. Returns 0 for an unrecognised name.
 */
export declare function noteFreq(name: string): number;
/** A filter stage in a synthesised sound. Sweep a lowpass over `'noise'` for crunchy explosions. */
export interface SoundFilter {
    /** Filter shape (`'lowpass'`, `'highpass'`, `'bandpass'`, …). Default `'lowpass'`. */
    type?: BiquadFilterType;
    /** Cutoff frequency in Hz at the start of the sound. Default 1000. */
    freq?: number;
    /** Optional cutoff sweep target in Hz — e.g. 2400 → 60 collapses a blast into a rumble. */
    freqEnd?: number;
    /** Resonance (Q). Higher = a whistly peak at the cutoff. Default 1. */
    q?: number;
}
/** Pitch wobble (LFO) for a synthesised sound — sirens, UFO drones, magic shimmer. Ignored for `'noise'`. */
export interface SoundVibrato {
    /** Wobble rate in Hz. Default 8. */
    freq?: number;
    /** Wobble depth as a fraction of the base pitch (0.1 = ±10%). Default 0.06. */
    depth?: number;
}
/** Parameters for a synthesised sound effect (SFX / beep / tone / noise). */
export interface SoundSpec {
    /** Oscillator waveform, or `'noise'` for white noise. Default `'square'`. */
    type?: OscillatorType | 'noise';
    /** Start frequency in Hz. Ignored for `'noise'`. Default 440. */
    freq?: number;
    /** Optional frequency sweep target in Hz — creates a zap/pew slide. */
    freqEnd?: number;
    /** Shape of the `freq` → `freqEnd` slide. `'exponential'` sounds pitch-linear to the ear — better lasers, jumps, falls. Default `'linear'`. */
    sweep?: 'linear' | 'exponential';
    /**
     * Pitch sequence (overrides `freq`/`freqEnd`).
     * - `number[]` — Hz steps spread evenly across `duration`, glued under one envelope (coins, power-up runs).
     * - `string` — **jingle notation**: each note gets its own envelope (real articulation — 'ta-daa!' fanfares).
     *   Tokens: notes `C5`/`F#4`/`Bb3`, chords `C4+E4+G4`, rests `-`; append `:N` to stretch (`C5:3` = 3 steps).
     *   One step lasts `step` seconds; total length comes from the notation (`duration` is ignored).
     */
    notes?: number[] | string;
    /** Seconds per notation step in jingle mode (`notes` as a string). Default 0.12. */
    step?: number;
    /** Duration in seconds. Default 0.15. */
    duration?: number;
    /** Amplitude 0→1 relative to master volume. Default 1. */
    volume?: number;
    /** Attack ramp in seconds. Default 0.005. */
    attack?: number;
    /** Release ramp in seconds. Default 0.06. */
    release?: number;
    /** Shape of the release ramp. `'exponential'` = percussive, natural die-away (explosions, thumps, plucks). Default `'linear'`. */
    curve?: 'linear' | 'exponential';
    /** Random per-play pitch variation 0→1 (0.1 = up to ±10%) — keeps rapid-fire SFX from sounding robotic. Default 0. */
    jitter?: number;
    /** Pitch wobble (LFO): `{ freq, depth }` — sirens, drones, shimmer. */
    vibrato?: SoundVibrato;
    /** Pulse width 0→0.5 for `'square'` (0.5 = even square). 0.25/0.125 give classic thin chip-tune timbres. */
    duty?: number;
    /** Filter stage: `{ type, freq, freqEnd, q }`. A swept lowpass over `'noise'` is the crunchy-explosion move. */
    filter?: SoundFilter;
    /** Distortion drive 0→1 — adds grit/crunch (explosions, heavy impacts, dirty lasers). Default 0. */
    distortion?: number;
    /** Stereo position -1 (left) → 1 (right). Default 0 (centre). */
    pan?: number;
    /** Start offset in seconds — sequence the layers of a compound sound (`play([...])`). Default 0. */
    delay?: number;
}
/** Options for `sound.music(url, opts)` — looped background music / BGM / audio track. */
export interface MusicOptions {
    /** Loop the track. Default `true`. */
    loop?: boolean;
    /** Track volume 0→1 relative to master. Default 1. */
    volume?: number;
    /** Fade-in duration in seconds. Default 0 (instant). */
    fadeIn?: number;
}
/** A sound definition: a synthesised `SoundSpec`, an array of specs played together (a layered/compound sound), or a URL string to an audio file (mp3/ogg/wav). */
export type Sound = SoundSpec | SoundSpec[] | string;
/** Audio service (SFX / music / master volume). The Game owns one as `this.sound`. The AudioContext is created lazily on the first user gesture (browser autoplay policy). All methods are no-ops where WebAudio is unavailable. */
export declare class Audio {
    private ctx;
    private volumeNode;
    private muteNode;
    private recordDest;
    private destroyed;
    private readonly defs;
    private readonly buffers;
    private musicEl;
    private musicGain;
    private musicViaWebAudio;
    private masterVolume;
    private wake;
    private _muted;
    constructor(masterVolume?: number);
    private ensure;
    /** Pulse-shaped PeriodicWave per duty cycle (quantised), built lazily per AudioContext. */
    private readonly pulseWaves;
    /** WaveShaper curves per distortion drive (quantised). */
    private readonly shaperCurves;
    /** Build (and cache) a pulse wave of width `duty` from its Fourier series. */
    private pulseWave;
    /** Build (and cache) a soft-clip waveshaper curve for a 0→1 drive. */
    private distortionCurve;
    private playSpec;
    /**
     * Play a jingle (`notes` as notation string): every note/chord is its own enveloped
     * voice — real articulation between notes — all feeding one shared
     * filter → distortion → pan → volume chain into the master.
     */
    private playJingle;
    private loadSample;
    private playSample;
    private playSound;
    /** Play a named sound (registered with `define`), an inline `SoundSpec`, or an array of specs fired together (layer a compound sound — stagger layers with `delay`). Use for one-shot SFX / audio cues. */
    play(sound: string | SoundSpec | SoundSpec[]): void;
    /** Register a reusable sound under a name — a `SoundSpec`, an array of specs (a layered sound), or a URL to an audio file (mp3/ogg/wav). Audio files are preloaded immediately. Call during scene `preload` or `setup`. */
    define(name: string, sound: Sound): void;
    /** Preload an audio file by URL so the first `play` is gapless. Resolves when the file is decoded and cached. */
    load(url: string): Promise<void>;
    /** `true` if `url`'s sample has already been decoded and cached — so re-queuing it needs no load. */
    isLoaded(url: string): boolean;
    /** `true` when all audio is silenced (master gain forced to 0). */
    get muted(): boolean;
    /** Silence (`on = true`, the default) or restore all audio by forcing/relaxing the master gain. Music keeps playing (muted), so unmuting never restarts the track. Persists if set before the first sound plays. */
    mute(on?: boolean): void;
    /** Flip the mute state and return it — handy for a mute button. */
    toggleMute(): boolean;
    /** Stream and loop a music track from a URL (BGM / background music / chiptune). Replaces any currently playing track. */
    music(url: string, opts?: MusicOptions): void;
    /** Stop the currently playing music track. Pass `{ fadeOut: seconds }` for a smooth fade. */
    stopMusic(opts?: {
        fadeOut?: number;
    }): void;
    /** Master volume 0→1. Affects all SFX and music simultaneously. Default 0.25. */
    get volume(): number;
    set volume(v: number);
    /** Suspend all audio output (SFX + music) — use when showing a pause overlay. */
    pause(): void;
    /** Resume audio after `pause()` or after the browser's autoplay-suspended boot. */
    resume(): void;
    /** Tear down the audio system: stop music, close the AudioContext, remove event listeners. After this every method is a no-op. Called automatically by `Game.destroy()`. */
    destroy(): void;
}
