import { FALLBACK_TRACK } from '../track.config.js';
/** The query parameter that carries a manifest URL. */
export const TRACK_PARAM = 'track';
/** A validation failure with a player-friendly message. */
export class ManifestError extends Error {
}
/**
 * The manifest URL from `?track=…`, or null when absent/blank. Other query
 * parameters are ignored, so a release link can carry tracking params too.
 */
export function trackParamFrom(loc) {
    let params;
    try {
        params = new URLSearchParams(loc.search);
    }
    catch {
        return null;
    }
    const raw = params.get(TRACK_PARAM);
    const trimmed = raw?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
}
const FETCH_TIMEOUT_MS = 15000;
/**
 * Fetch and validate a Trackcade manifest. Throws ManifestError with a
 * player-friendly message on any failure (network, HTTP, invalid JSON,
 * missing fields). `fetchImpl` is injectable for headless tests.
 */
export async function loadManifest(url, fetchImpl) {
    const f = fetchImpl ?? globalThis.fetch;
    if (!f)
        throw new ManifestError('this browser cannot fetch track manifests');
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    }
    catch {
        throw new ManifestError('the track URL is not a valid URL');
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new ManifestError('the track URL must be http(s)');
    }
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl
        ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
        : null;
    let text;
    try {
        const res = await f(url, ctrl ? { signal: ctrl.signal } : {});
        if (!res.ok) {
            throw new ManifestError(`the track server answered HTTP ${res.status}`);
        }
        text = await res.text();
    }
    catch (e) {
        if (e instanceof ManifestError)
            throw e;
        const aborted = e instanceof Error && e.name === 'AbortError';
        throw new ManifestError(aborted ? 'the track request timed out' : 'the track could not be reached');
    }
    finally {
        if (timer !== null)
            clearTimeout(timer);
    }
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new ManifestError('the track file is not valid JSON');
    }
    return validateManifest(normalizeLegacyManifest(data));
}
// ── Compatibility ────────────────────────────────────────────────────────────
// Canonical Trackcade uses songLength plus event { t, kind }. Legacy v1
// manifests used a few alternate names. Normalize them before validation so
// old releases continue to play without weakening the internal game config.
const LEGACY_SECTION_KINDS = new Set([
    'intro', 'verse', 'chorus', 'hook', 'bridge', 'break', 'breakdown',
    'build', 'buildup', 'build-up', 'outro', 'prechorus', 'pre-chorus',
]);
function finiteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}
function normalizeLegacyEvent(raw) {
    if (!isRecord(raw))
        return raw;
    const out = { ...raw };
    const t = finiteNumber(raw.t ?? raw.time ?? raw.timestamp ?? raw.start ?? raw.startTime ?? raw.seconds);
    if (t !== undefined)
        out.t = t;
    const rawKind = raw.kind ?? raw.type ?? raw.event;
    if (typeof rawKind === 'string') {
        const normalizedKind = rawKind.trim().toLowerCase();
        if (EVENT_KINDS.has(normalizedKind)) {
            out.kind = normalizedKind;
        }
        else if (LEGACY_SECTION_KINDS.has(normalizedKind)) {
            out.kind = 'section';
            if (out.name === undefined)
                out.name = raw.name ?? raw.label ?? raw.section ?? rawKind;
        }
    }
    if (out.name === undefined) {
        const name = raw.label ?? raw.section;
        if (typeof name === 'string')
            out.name = name;
    }
    const duration = finiteNumber(raw.duration ?? raw.length);
    if (duration !== undefined)
        out.duration = duration;
    return out;
}
function normalizeLegacyManifest(data) {
    if (!isRecord(data))
        return data;
    const out = { ...data };
    if (out.songLength === undefined) {
        const duration = finiteNumber(data.duration ?? data.trackLength ?? data.song_duration);
        if (duration !== undefined)
            out.songLength = duration;
    }
    const bpm = finiteNumber(data.bpm);
    if (bpm !== undefined)
        out.bpm = bpm;
    const beatOffset = finiteNumber(data.beatOffset ?? data.beat_offset);
    if (beatOffset !== undefined)
        out.beatOffset = beatOffset;
    if (Array.isArray(data.events))
        out.events = data.events.map(normalizeLegacyEvent);
    return out;
}
// ── Validation ───────────────────────────────────────────────────────────────
const EVENT_KINDS = new Set([
    'beat', 'section', 'energy', 'drop', 'peak',
]);
const PALETTE_KEYS = [
    'skyTop', 'skyBottom', 'road', 'roadAlt', 'laneGlow', 'edgeLeft', 'edgeRight',
    'primary', 'secondary', 'collectible', 'hazard', 'overdriveA', 'overdriveB',
];
const ART_KEYS = [
    'player', 'obstacleLow', 'obstacleWall', 'orb', 'cell', 'skyline',
];
/** Numeric tuning fields validated as finite numbers (min, max). */
const NUMERIC_FIELDS = [
    ['baseSpeed', 1, 5000],
    ['maxSpeed', 1, 10000],
    ['speedRampPerSec', 0, 100],
    ['energySpeedBoost', 0, 1000],
    ['overdriveSpeedMult', 1, 5],
    ['jumpTime', 0.05, 5],
    ['jumpHeight', 1, 1000],
    ['laneSwitchTime', 0.01, 2],
    ['invincibleTime', 0, 30],
    ['spawnMinGapZ', 0, 10000],
    ['scorePerMeter', 0, 1000],
    ['orbScore', 0, 100000],
    ['nearMissScore', 0, 100000],
    ['comboEvery', 1, 1000],
    ['comboCap', 1, 1000],
    ['overdriveComboBonus', 0, 1000],
    ['overdriveOrbChance', 0, 1],
    ['overdriveBloom', 0, 10],
    ['baseBloom', 0, 10],
    ['crashScoreFraction', 0, 1],
    ['crashScoreFlat', 0, 1000000],
    ['crashStunTime', 0, 30],
    ['crashInvincibleTime', 0, 60],
];
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function fail(msg) {
    throw new ManifestError(msg);
}
function reqString(obj, key) {
    const v = obj[key];
    if (typeof v !== 'string' || v.trim().length === 0) {
        fail(`the track manifest is missing "${key}"`);
    }
    return v;
}
function optString(obj, key, fallback = '') {
    const v = obj[key];
    if (v === undefined || v === null)
        return fallback;
    if (typeof v !== 'string')
        fail(`the track manifest field "${key}" must be a string`);
    return v;
}
function reqNumber(obj, key, min, max) {
    const v = obj[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        fail(`the track manifest is missing "${key}"`);
    }
    if (v < min || v > max)
        fail(`the track manifest field "${key}" is out of range`);
    return v;
}
function optNumber(obj, key, fallback, min, max) {
    const v = obj[key];
    if (v === undefined || v === null)
        return fallback;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
        fail(`the track manifest field "${key}" must be a number between ${min} and ${max}`);
    }
    return v;
}
function reqUrl(obj, key) {
    const v = reqString(obj, key);
    if (!/^https?:\/\//.test(v))
        fail(`the track manifest field "${key}" must be an http(s) URL`);
    return v;
}
function reqHexColor(obj, key) {
    const v = reqString(obj, key);
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
        fail(`the track manifest palette colour "${key}" must be #rrggbb`);
    }
    return v;
}
/** A URL-safe slug for deriving a per-track high-score key. */
export function slugify(s) {
    const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'track';
}
function parseEvent(raw, index) {
    if (!isRecord(raw))
        fail(`music event #${index + 1} is not an object`);
    if (typeof raw.t !== 'number' || !Number.isFinite(raw.t) || raw.t < 0) {
        fail(`music event #${index + 1} has no valid time "t"`);
    }
    if (typeof raw.kind !== 'string' || !EVENT_KINDS.has(raw.kind)) {
        fail(`music event #${index + 1} has an unknown kind "${String(raw.kind)}"`);
    }
    const e = { t: raw.t, kind: raw.kind };
    if (raw.name !== undefined) {
        if (typeof raw.name !== 'string')
            fail(`music event #${index + 1} has a non-string name`);
        e.name = raw.name;
    }
    if (raw.duration !== undefined) {
        if (typeof raw.duration !== 'number' || !Number.isFinite(raw.duration) || raw.duration <= 0) {
            fail(`music event #${index + 1} has an invalid duration`);
        }
        e.duration = raw.duration;
    }
    return e;
}
/**
 * Validate unknown JSON into a complete TrackConfig. Required identity/music
 * fields must be present; palette/art/tuning fields fall back to the built-in
 * track's values so a minimal manifest (identity + audio + bpm + length) is a
 * working release. Throws ManifestError on anything unusable.
 */
export function validateManifest(data) {
    if (!isRecord(data))
        fail('the track manifest is not a JSON object');
    const artist = reqString(data, 'artist');
    const title = reqString(data, 'title');
    const audioUrl = reqUrl(data, 'audioUrl');
    const bpm = reqNumber(data, 'bpm', 20, 400);
    const songLength = reqNumber(data, 'songLength', 5, 3600);
    // events: optional, sorted by t, must land inside the song
    let events = [];
    if (data.events !== undefined) {
        if (!Array.isArray(data.events))
            fail('the track manifest field "events" must be an array');
        events = data.events.map(parseEvent);
        events.sort((a, b) => a.t - b.t);
        if (events.some((e) => e.t > songLength)) {
            fail('the track manifest has music events beyond the song length');
        }
    }
    // energyCurve: optional array of 0..1 samples
    let energyCurve = [];
    if (data.energyCurve !== undefined) {
        if (!Array.isArray(data.energyCurve)) {
            fail('the track manifest field "energyCurve" must be an array of numbers');
        }
        energyCurve = data.energyCurve.map((v, i) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) {
                fail(`energyCurve sample #${i + 1} is not a number`);
            }
            return Math.min(1, Math.max(0, v));
        });
    }
    // palette: fall back per colour to the built-in track
    const rawPalette = isRecord(data.palette) ? data.palette : {};
    const palette = {};
    for (const key of PALETTE_KEYS) {
        const v = rawPalette[key];
        if (v === undefined) {
            palette[key] = FALLBACK_TRACK.palette[key];
        }
        else {
            palette[key] = reqHexColor(rawPalette, key);
        }
    }
    // art: fall back per image to the built-in track
    const rawArt = isRecord(data.art) ? data.art : {};
    const art = {};
    for (const key of ART_KEYS) {
        const v = rawArt[key];
        if (v === undefined) {
            art[key] = FALLBACK_TRACK.art[key];
        }
        else {
            art[key] = reqUrl(rawArt, key);
        }
    }
    const cfg = {
        artist,
        title,
        audioUrl,
        coverUrl: optString(data, 'coverUrl'),
        logoUrl: optString(data, 'logoUrl'),
        highScoreKey: optString(data, 'highScoreKey') || `trackcade.high.${slugify(artist)}.${slugify(title)}`,
        bpm,
        beatOffset: optNumber(data, 'beatOffset', 0, 0, 60),
        songLength,
        finishBonus: optNumber(data, 'finishBonus', 500, 0, 1000000),
        events,
        energyCurve,
        palette,
        art,
        lanes: 3,
        baseSpeed: 0, maxSpeed: 0, speedRampPerSec: 0, energySpeedBoost: 0,
        overdriveSpeedMult: 0, jumpTime: 0, jumpHeight: 0, laneSwitchTime: 0,
        maxHits: 0, invincibleTime: 0, spawnRowEveryBeats: 0, spawnMinGapZ: 0,
        scorePerMeter: 0, orbScore: 0, nearMissScore: 0, comboEvery: 0, comboCap: 0,
        overdriveComboBonus: 0, overdriveOrbChance: 0, overdriveBloom: 0, baseBloom: 0,
        crashScoreFraction: 0, crashScoreFlat: 0, crashStunTime: 0, crashInvincibleTime: 0,
    };
    for (const [key, min, max] of NUMERIC_FIELDS) {
        cfg[key] = optNumber(data, key, FALLBACK_TRACK[key], min, max);
    }
    cfg.maxHits = Math.max(1, Math.round(optNumber(data, 'maxHits', FALLBACK_TRACK.maxHits, 1, 10)));
    cfg.spawnRowEveryBeats = Math.max(1, Math.round(optNumber(data, 'spawnRowEveryBeats', FALLBACK_TRACK.spawnRowEveryBeats, 1, 16)));
    return cfg;
}
