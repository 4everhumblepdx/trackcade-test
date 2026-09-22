// ─────────────────────────────────────────────────────────────────────────────
// TRACKCADE TRACK CONFIGURATION — the shape of a Trackcade release + the
// BUILT-IN FALLBACK TRACK.
//
// Everything that makes a run of Neon Dash belong to a SONG is described by
// the TrackConfig interface: artist and title, the audio URL, the palette, the
// artwork, the music-event map (beats / sections / energy / drops / peaks) and
// every gameplay tuning number.
//
// A Trackcade release is a JSON document in this shape, served anywhere and
// handed to the deployed game through the `?track=` URL parameter:
//
//     neon-dash/?track=https://example.com/releases/song.json
//
// The engine fetches, validates (src/track/loader.ts) and runs it — shipping a
// new song NEVER requires touching this source, rebuilding or republishing.
// The FALLBACK_TRACK below is only the demo that plays when no `?track=` is
// given (or when a manifest fails and the player picks the demo).
//
// Timestamps are SECONDS into the audio track. The fallback map below was
// authored for the bundled 128 BPM synthwave track (~180 s): beats are
// synthesised from `bpm`, and the structural events (sections, energy ramps,
// the chorus drop, peaks) are hand-placed. Trackcade can generate a manifest
// from real audio analysis without changing any game code.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// THE BUILT-IN FALLBACK TRACK — "Neon Dash" demo song (generated synthwave,
// 128 BPM, ~180 s). Plays when no ?track= manifest is supplied.
// ─────────────────────────────────────────────────────────────────────────────
const BPM = 128;
const BAR = (60 / BPM) * 4; // 1.875 s per bar
export const FALLBACK_TRACK = {
    artist: 'Forever Humble PDX',
    title: 'Neon Dash',
    audioUrl: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/music/a-fast-neon-endless-runner-through-a-rai-381dec5fe844.mp3',
    coverUrl: '',
    logoUrl: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/art/neon-dash/logo-82e76a85b8.png',
    highScoreKey: 'neondash.high.v1',
    bpm: BPM,
    beatOffset: 0,
    songLength: 180, // the bundled track is ~179.9 s
    finishBonus: 500,
    events: [
        { t: 0, kind: 'section', name: 'intro' },
        { t: 8 * BAR, kind: 'section', name: 'verse' }, // 15 s
        { t: 16 * BAR, kind: 'energy' }, // 30 s
        { t: 24 * BAR, kind: 'section', name: 'build' }, // 45 s
        { t: 32 * BAR, kind: 'drop', name: 'chorus', duration: 15 }, // 60 s — OVERDRIVE
        { t: 40 * BAR, kind: 'peak' }, // 75 s
        { t: 48 * BAR, kind: 'section', name: 'verse2' }, // 90 s
        { t: 56 * BAR, kind: 'energy' }, // 105 s
        { t: 64 * BAR, kind: 'drop', name: 'chorus2', duration: 15 }, // 120 s — OVERDRIVE
        { t: 72 * BAR, kind: 'peak' }, // 135 s
        { t: 80 * BAR, kind: 'section', name: 'outro' }, // 150 s
        { t: 88 * BAR, kind: 'energy' }, // 165 s
    ],
    // A gentle rise into each chorus, a breather after — demonstrates how an
    // energy curve tilts obstacle density without touching the beat grid.
    energyCurve: [
        0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.85, 0.95, 1,
        0.6, 0.5, 0.55, 0.65, 0.75, 0.85, 0.95, 1, 0.7, 0.5,
    ],
    palette: {
        skyTop: '#070a1e',
        skyBottom: '#1b1440',
        road: '#1a2142',
        roadAlt: '#121831',
        laneGlow: '#19e3ff',
        edgeLeft: '#ff2fb0',
        edgeRight: '#19e3ff',
        primary: '#19e3ff',
        secondary: '#ff2fb0',
        collectible: '#ffd147',
        hazard: '#ff4d6d',
        overdriveA: '#ff9a3d',
        overdriveB: '#ff2fb0',
    },
    art: {
        player: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/art/sprites/sprites-1-bfce0e8a60.png',
        obstacleLow: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/art/sprites/sprites-2-5f5d8022bd.png',
        obstacleWall: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/art/sprites/sprites-3-79403a17ad.png',
        orb: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/art/sprites/sprites-4-bcdd52ebee.png',
        cell: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/art/sprites/sprites-5-7e5f29fce2.png',
        skyline: 'https://gameblocks.nyc3.digitaloceanspaces.com/FYoTdwL3Q16/art/background/bg-5baf40d2d6.png',
    },
    lanes: 3,
    baseSpeed: 120,
    maxSpeed: 380,
    speedRampPerSec: 1.1,
    energySpeedBoost: 20,
    overdriveSpeedMult: 1.36,
    jumpTime: 0.58,
    jumpHeight: 46,
    laneSwitchTime: 0.12,
    maxHits: 3,
    invincibleTime: 0.85,
    spawnRowEveryBeats: 1,
    spawnMinGapZ: 80,
    scorePerMeter: 1,
    orbScore: 25,
    nearMissScore: 15,
    comboEvery: 4,
    comboCap: 8,
    overdriveComboBonus: 2,
    overdriveOrbChance: 0.5,
    overdriveBloom: 1.5,
    baseBloom: 0.9,
    crashScoreFraction: 0.25,
    crashScoreFlat: 250,
    crashStunTime: 1.2,
    crashInvincibleTime: 2.5,
};
