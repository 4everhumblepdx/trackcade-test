// Play — the Neon Dash run. A pseudo-3D three-lane endless runner rendered
// entirely immediate-mode: obstacles/collectibles live in pooled depth-sorted
// pools and are projected onto a rain-soaked neon street. The MusicDirector
// drives everything from the song clock — beats spawn rows on the grid,
// sections shift the city, energy events raise the speed, drops fire
// OVERDRIVE, peaks drop golden orb spirals.
//
// THE SONG IS THE AUTHORITATIVE TIMELINE. The master clock is the audio
// element's own playhead: gameplay waits in a pre-roll until the stream is
// audible, follows el.currentTime while live (holding position through buffer
// stalls), pauses/resumes with it, and the run ends when the song ends. The
// music is never stretched, looped, sped up or slowed down to fit the game.
//
// TRACKCADE CRASH POLICY: running out of energy never ends the run — it costs
// score and combo, stuns the rider, grants invulnerability and refills the
// cells. The song plays on.
import { Scene, particleCanvas } from '../../engine/webgpu.js';
import { TRACK } from '../track/active.js';
import { MusicDirector } from '../logic/director.js';
import { ScoreKeeper } from '../logic/scoring.js';
import { Difficulty } from '../logic/difficulty.js';
import { RowGenerator } from '../logic/spawner.js';
import { HighScore } from '../logic/hiscore.js';
import { PlayerState } from '../entities/player.js';
// ── World layout (projection constants — rendering, not gameplay tuning) ──
const VIEW_Z = 560; // spawn/cull depth
const FOCAL = 0.92; // projection strength
const CAM_H = 30; // camera height above the road
const HORIZON_Y = 108; // screen y of the horizon
const GROUND_Y = 342; // screen y of the road at the camera
const LANE_W = 44; // world units between lane centres
const ROAD_HALF = 76; // road half-width in world units
const PLAYER_Z = 26; // the rider's fixed depth
const HIT_DEPTH = 10; // collision window around the player
const NEAR_MISS_DEPTH = 13; // near-miss skim window
const POOL_OBSTACLES = 28;
const POOL_PICKUPS = 24;
const RAIN_DROPS = 42;
// Skyline tint per musical section — the environment shifts with the song.
const SECTION_TINTS = ['#ffffff', '#ffd9f2', '#d2f6ff', '#fff3c4', '#e4d6ff'];
// Pre-roll fallback: if no audio element is reachable after this many frames
// (no WebAudio in the environment), run on the frame clock so the game plays.
const PREROLL_FALLBACK_FRAMES = 600;
const s = (z) => FOCAL * CAM_H / (CAM_H + z); // perspective scale
const groundY = (z) => HORIZON_Y + (GROUND_Y - HORIZON_Y) * s(z);
export class Play extends Scene {
    // logic
    player;
    director;
    scorer;
    difficulty;
    ramp;
    hiscore;
    // run state
    songTime = 0;
    elapsed = 0;
    distance = 0;
    speed = 0;
    paused = false;
    phase = 'preroll';
    prerollFrames = 0;
    lastAudioT = -1;
    stalledT = 0;
    overdriveT = 0; // seconds of Overdrive remaining
    beatPulse = 0; // 1 right after a beat, decays
    beatCount = 0;
    rowIndex = 0;
    sectionIdx = 0;
    sectionTint = SECTION_TINTS[0];
    peakQueue = 0; // pending peak-spiral orbs
    resultSent = false;
    // pools
    obstacles = [];
    pickups = [];
    floaters = [];
    rain = [];
    splashes = [];
    buildings = [];
    // art
    frames;
    hudScore;
    hudCombo;
    hudTrack;
    hudBanner;
    hudPause;
    hudPauseHint;
    hudSync;
    bloom = null;
    bannerT = 0;
    keys;
    preload(load) {
        const a = TRACK.art;
        load.image(a.player);
        load.image(a.obstacleLow);
        load.image(a.obstacleWall);
        load.image(a.orb);
        load.image(a.cell);
        load.image(a.skyline);
    }
    async setup() {
        const g = this.game;
        this.player = new PlayerState(TRACK);
        this.director = new MusicDirector(TRACK, TRACK.songLength + 5);
        this.scorer = new ScoreKeeper(TRACK);
        this.difficulty = new RowGenerator(TRACK);
        this.ramp = new Difficulty(TRACK);
        this.hiscore = new HighScore(TRACK.highScoreKey, globalThis.localStorage ?? {
            getItem: () => null, setItem: () => { },
        });
        // frames
        this.frames = {
            player: g.assets.framesOf(TRACK.art.player),
            low: g.assets.framesOf(TRACK.art.obstacleLow),
            wall: g.assets.framesOf(TRACK.art.obstacleWall),
            orb: g.assets.framesOf(TRACK.art.orb),
            cell: g.assets.framesOf(TRACK.art.cell),
            skyline: g.assets.framesOf(TRACK.art.skyline),
            soft: g.assets.frames(particleCanvas({ kind: 'soft' })),
        };
        // HUD text blocks use browser/system fonts so the standalone build has no external font dependency.
        this.hudScore = g.assets.unicodeText('0', { fontSize: 30, fontWeight: 800, color: '#ffffff' });
        this.hudCombo = g.assets.unicodeText('', { fontSize: 13, fontFamily: 'monospace', color: TRACK.palette.collectible });
        this.hudTrack = g.assets.unicodeText(`${TRACK.artist} — ${TRACK.title}`, { fontSize: 10, fontFamily: 'monospace', color: '#8fa3d9', align: 'center' });
        this.hudBanner = g.assets.unicodeText('', { fontSize: 34, fontWeight: 800, color: TRACK.palette.overdriveA, align: 'center' });
        this.hudPause = g.assets.unicodeText('PAUSED', { fontSize: 40, fontWeight: 800, color: '#ffffff', align: 'center' });
        this.hudPauseHint = g.assets.unicodeText('tap or P to resume', { fontSize: 14, fontFamily: 'monospace', color: '#8fa3d9', align: 'center' });
        this.hudSync = g.assets.unicodeText('SYNCING AUDIO', { fontSize: 14, fontFamily: 'monospace', color: TRACK.palette.primary, align: 'center' });
        // pools
        for (let i = 0; i < POOL_OBSTACLES; i++)
            this.obstacles.push({ alive: false, lane: 0, kind: 'low', z: 0, resolved: false, nearMissed: false });
        for (let i = 0; i < POOL_PICKUPS; i++)
            this.pickups.push({ alive: false, lane: 0, kind: 'orb', z: 0, phase: 0 });
        for (let i = 0; i < RAIN_DROPS; i++)
            this.rain.push({ x: Math.random(), y: Math.random(), len: 8 + Math.random() * 10, spd: 300 + Math.random() * 160 });
        for (let layer = 0; layer < 2; layer++) {
            for (let i = 0; i < 9; i++) {
                this.buildings.push({
                    x: i * 34 + Math.random() * 12, w: 20 + Math.random() * 16,
                    h: 26 + Math.random() * (layer ? 34 : 52), hue: Math.random(),
                    side: i % 2 ? 1 : -1, layer,
                });
            }
        }
        // look: neon bloom + vignette, starless rainy sky handled in draw
        this.bloom = g.post.add('bloom', { threshold: 0.5, strength: TRACK.baseBloom, radius: 2.5 });
        g.post.add('vignette', { strength: 0.35 });
        // input — keyboard + gestures
        this.keys = this.input.bind({
            left: [KEY_LEFT, 'KeyA'],
            right: [KEY_RIGHT, 'KeyD'],
            jump: [KEY_SPACE, KEY_UP, 'KeyW'],
            pause: ['KeyP', 'Escape'],
        });
        this.input.onSwipe((e) => {
            if (this.paused || this.player.stunned)
                return;
            if (e.direction === 'left')
                this.player.moveLeft();
            else if (e.direction === 'right')
                this.player.moveRight();
            else if (e.direction === 'up')
                this.player.jump();
        });
        this.input.onTap((e) => {
            if (this.paused) {
                this.togglePause();
                return;
            }
            if (this.player.stunned)
                return;
            // top-right corner = pause button; anywhere else = jump
            const hudScale = g.hud.w > 0 ? g.hud.h / this.height : 1;
            if (e.x * hudScale > g.hud.w - 56 && e.y * hudScale < 56) {
                this.togglePause();
                return;
            }
            this.player.jump();
        });
        // The soundtrack starts here (this scene is reached by the title-screen
        // tap — the user gesture autoplay policies require). The track plays once:
        // when the song ends, the run ends. The game clock then FOLLOWS the audio
        // element's playhead, so gameplay and audio can never drift apart.
        this.sound.music(TRACK.audioUrl, { loop: false, volume: 0.55 });
    }
    // ── helpers ──────────────────────────────────────────────────────────────
    get overdrive() { return this.overdriveT > 0; }
    /** The engine audio service's live music element (the master clock). */
    musicEl() {
        const snd = this.game.sound;
        return snd.musicEl ?? null;
    }
    laneX(lanePos, z) {
        return this.centerX + (lanePos - 1) * LANE_W * s(z);
    }
    spawnObstacle(lane, kind) {
        const o = this.obstacles.find((e) => !e.alive);
        if (!o)
            return;
        o.alive = true;
        o.lane = lane;
        o.kind = kind;
        o.z = VIEW_Z;
        o.resolved = false;
        o.nearMissed = false;
    }
    spawnPickup(lane, kind, z = VIEW_Z) {
        const p = this.pickups.find((e) => !e.alive);
        if (!p)
            return;
        p.alive = true;
        p.lane = lane;
        p.kind = kind;
        p.z = z;
        p.phase = Math.random() * Math.PI * 2;
    }
    floater(str, color, size = 15) {
        if (this.floaters.length > 7)
            this.floaters.shift();
        this.floaters.push({
            text: this.game.assets.unicodeText(str, { fontSize: size, fontFamily: 'monospace', color, align: 'center' }),
            t: 0, life: 0.9, x: this.game.hud.w / 2, y: this.game.hud.h * 0.3,
        });
    }
    banner(str) {
        this.bannerT = 1.6;
        this.hudBanner.setText(str);
    }
    togglePause() {
        this.paused = !this.paused;
        if (this.paused)
            this.sound.pause();
        else
            this.sound.resume();
    }
    // ── music events ─────────────────────────────────────────────────────────
    onMusicEvent(e) {
        const pal = TRACK.palette;
        switch (e.kind) {
            case 'beat': {
                this.beatPulse = 1;
                this.beatCount++;
                // obstacle rows spawn on the beat grid
                if (this.beatCount % TRACK.spawnRowEveryBeats === 0) {
                    const row = this.difficulty.row(this.rowIndex * 7919 + 13, this.ramp.spawnIntensity(this.elapsed, this.songTime), this.overdrive);
                    this.rowIndex++;
                    for (const o of row.obstacles)
                        this.spawnObstacle(o.lane, o.kind);
                    for (const p of row.pickups)
                        this.spawnPickup(p.lane, p.kind);
                }
                break;
            }
            case 'section': {
                this.sectionIdx++;
                this.banner((e.name ?? 'section').toUpperCase());
                this.game.camera.flash(pal.primary, 0.12);
                // the city changes with the music: re-seed building lights, retint the sky
                for (const b of this.buildings)
                    b.hue = Math.random();
                this.sectionTint = SECTION_TINTS[this.sectionIdx % SECTION_TINTS.length];
                break;
            }
            case 'energy': {
                this.ramp.energyLevel++;
                this.floater('ENERGY UP', pal.primary, 17);
                this.game.fx.emit({ x: this.centerX, y: this.centerY, count: 26, speed: 130, colors: [pal.primary, '#ffffff'], add: true, drag: 2 });
                break;
            }
            case 'drop': {
                this.overdriveT = e.duration ?? 12;
                this.banner('OVERDRIVE!');
                this.game.camera.flash(pal.overdriveA, 0.35);
                this.game.camera.shake(5, 0.4);
                this.sound.play({ notes: 'C5 E5 G5 C6:2', step: 0.09, type: 'square', volume: 0.5 });
                break;
            }
            case 'peak': {
                // golden orb spiral: a stream of orbs weaving across the lanes
                this.peakQueue = 14;
                this.banner('PEAK!');
                this.game.camera.flash(pal.collectible, 0.25);
                break;
            }
        }
    }
    /** Ambient animation that also runs during pre-roll (rain, floaters). */
    updateAmbient(dt) {
        const rainBoost = this.overdrive ? 1.6 : 1;
        for (const r of this.rain) {
            r.y += (r.spd * rainBoost * dt) / this.height;
            r.x -= (r.spd * 0.18 * dt) / this.width;
            if (r.y > 1) {
                r.y = -0.05;
                r.x = Math.random() * 1.2;
                if (Math.random() < 0.25 && this.splashes.length < 10)
                    this.splashes.push({ x: r.x, t: 0 });
            }
        }
        for (const sp of this.splashes)
            sp.t += dt;
        this.splashes = this.splashes.filter((sp) => sp.t < 0.4);
        for (const f of this.floaters)
            f.t += dt;
        this.floaters = this.floaters.filter((f) => f.t < f.life);
    }
    // ── frame ────────────────────────────────────────────────────────────────
    update(dt) {
        super.update(dt);
        if (this.paused) {
            if (this.keys.pause.pressed)
                this.togglePause();
            return;
        }
        if (this.keys.pause.pressed) {
            this.togglePause();
            return;
        }
        const el = this.musicEl();
        // ── pre-roll: the world animates but the song clock stays at 0:00 until
        // the stream is actually audible — gameplay and audio begin together.
        if (this.phase === 'preroll') {
            this.prerollFrames++;
            if (el && !el.paused && el.currentTime > 0.02) {
                this.phase = 'live';
                this.lastAudioT = el.currentTime;
            }
            else if (!el && this.prerollFrames > PREROLL_FALLBACK_FRAMES) {
                this.phase = 'live'; // no audio element reachable — frame clock
            }
            this.updateAmbient(dt);
            return;
        }
        // ── master clock: follow the audio playhead. While the stream buffers,
        // the song clock holds its position instead of drifting ahead.
        if (el) {
            const t = el.currentTime;
            if (t !== this.lastAudioT) {
                this.songTime = t;
                this.lastAudioT = t;
                this.stalledT = 0;
            }
            else if (!el.ended) {
                this.stalledT += dt;
            }
        }
        else {
            this.songTime += dt;
        }
        this.elapsed += dt;
        for (const e of this.director.tick(this.songTime, TRACK.beatOffset))
            this.onMusicEvent(e);
        // the run ends when the song ends — bank the finish bonus, show results
        if (this.songTime >= TRACK.songLength || (el?.ended ?? false)) {
            if (!this.resultSent) {
                this.resultSent = true;
                this.scorer.addBonus(TRACK.finishBonus);
                const isBest = this.hiscore.submit(this.scorer.score);
                this.sound.stopMusic({ fadeOut: 0.4 });
                this.gotoGameOver({
                    score: Math.floor(this.scorer.score), best: this.hiscore.value, isBest,
                    orbs: this.scorer.orbs, nearMisses: this.scorer.nearMisses,
                    distance: Math.floor(this.distance), finished: true,
                });
            }
            return;
        }
        // speed + distance + score
        this.speed = this.ramp.speed(this.elapsed, this.overdrive);
        const dz = this.speed * dt;
        this.distance += dz;
        this.scorer.addDistance(dz, this.overdrive);
        if (this.overdriveT > 0)
            this.overdriveT -= dt;
        this.beatPulse = Math.max(0, this.beatPulse - dt * 3.2);
        if (this.bannerT > 0)
            this.bannerT -= dt;
        this.bloom?.set('strength', this.overdrive ? TRACK.overdriveBloom : TRACK.baseBloom + this.beatPulse * 0.15);
        // peak orb spiral
        if (this.peakQueue > 0) {
            this.peakQueue -= dt * 9;
            while (this.peakQueue >= 1) {
                this.peakQueue -= 1;
                const lane = Math.floor((Math.sin(this.elapsed * 5) * 0.5 + 0.5) * 2.999);
                this.spawnPickup(lane, 'orb', VIEW_Z);
            }
            this.peakQueue = Math.max(0, this.peakQueue);
        }
        // input
        if (!this.player.stunned) {
            if (this.keys.left.pressed)
                this.player.moveLeft();
            if (this.keys.right.pressed)
                this.player.moveRight();
            if (this.keys.jump.pressed)
                this.player.jump();
        }
        // player
        this.player.update(dt);
        const pal = TRACK.palette;
        // hoverboard trail (a stream — pooled by the engine)
        const px = this.laneX(this.player.x, PLAYER_Z);
        const py = groundY(PLAYER_Z) - this.player.jumpOffset;
        this.game.fx.emit({
            x: px, y: py + 2, count: this.overdrive ? 2 : 1, speed: 8, life: 0.4,
            size: this.overdrive ? 4 : 2.5, colors: this.overdrive ? [pal.overdriveA, pal.overdriveB] : [pal.primary],
            add: true, alpha: 0.7, frame: this.frames.soft,
        });
        // obstacles
        for (const o of this.obstacles) {
            if (!o.alive)
                continue;
            o.z -= dz;
            if (o.z < -30) {
                o.alive = false;
                continue;
            }
            if (o.resolved)
                continue;
            const dzp = o.z - PLAYER_Z;
            if (Math.abs(dzp) < HIT_DEPTH) {
                const lateral = Math.abs(this.player.x - o.lane);
                if (lateral < 0.42) {
                    const clears = o.kind === 'low' && this.player.jumpOffset > 20;
                    if (!clears) {
                        o.resolved = true;
                        const result = this.player.hit();
                        if (result !== 'ignored') {
                            this.scorer.registerHit();
                            this.game.camera.shake(6, 0.35);
                            this.game.camera.flash(pal.hazard, 0.25);
                            this.game.fx.emit({ x: px, y: py - 10, count: 30, speed: 150, colors: [pal.hazard, '#ffffff'], add: true, drag: 2 });
                            this.sound.play({ type: 'noise', duration: 0.3, filter: { type: 'lowpass', freq: 2400, freqEnd: 120 }, distortion: 0.5, volume: 0.7 });
                            if (result === 'crash') {
                                // energy ran out — heavy penalty, brief stun, then the cells
                                // refill and the song plays on (Trackcade: no game over)
                                const lost = this.scorer.applyCrashPenalty();
                                this.banner('CRASH!');
                                this.floater(`−${lost} PTS`, pal.hazard, 18);
                                this.game.camera.shake(10, 0.7);
                                this.game.camera.flash('#ffffff', 0.4);
                                this.sound.play({ notes: 'A3 F3 D3 A2:3', step: 0.14, type: 'sawtooth', volume: 0.6 });
                            }
                            else {
                                this.floater(`${TRACK.maxHits - this.player.hits} ENERGY LEFT`, pal.hazard, 14);
                            }
                        }
                    }
                }
                else if (!o.nearMissed && lateral >= 0.42 && lateral < 1.45 && Math.abs(dzp) < NEAR_MISS_DEPTH) {
                    // skimmed past in an adjacent lane (or mid-switch)
                    o.nearMissed = true;
                    const pts = this.scorer.nearMiss(this.overdrive);
                    this.floater(`NEAR MISS +${pts}`, pal.secondary, 13);
                    this.sound.play({ type: 'sine', freq: 1400, freqEnd: 2200, duration: 0.08, volume: 0.35 });
                }
            }
            if (dzp < -NEAR_MISS_DEPTH)
                o.resolved = true; // behind us — stop testing
        }
        // pickups
        for (const p of this.pickups) {
            if (!p.alive)
                continue;
            p.z -= dz;
            p.phase += dt * 4;
            if (p.z < -30) {
                p.alive = false;
                continue;
            }
            const dzp = p.z - PLAYER_Z;
            if (Math.abs(dzp) < HIT_DEPTH + 4 && Math.abs(this.player.x - p.lane) < 0.5) {
                p.alive = false;
                const sx = this.laneX(p.lane, p.z);
                const sy = groundY(p.z) - 14;
                if (p.kind === 'orb') {
                    const pts = this.scorer.collectOrb(this.overdrive);
                    this.floater(`+${pts}`, pal.collectible, 14);
                    this.game.fx.emit({ x: sx, y: sy, count: 12, speed: 70, life: 0.45, size: 2.5, colors: [pal.collectible, '#fff2b0'], add: true });
                    this.sound.play({ type: 'sine', freq: 880, freqEnd: 1760, sweep: 'exponential', duration: 0.12, volume: 0.4 });
                }
                else {
                    this.player.heal();
                    this.floater('+1 ENERGY', pal.primary, 15);
                    this.game.fx.emit({ x: sx, y: sy, count: 18, speed: 90, life: 0.5, colors: [pal.primary, '#ffffff'], add: true });
                    this.sound.play({ notes: 'E5 G5 C6', step: 0.07, type: 'triangle', volume: 0.5 });
                }
            }
        }
        this.updateAmbient(dt);
    }
    // ── world ────────────────────────────────────────────────────────────────
    draw(d) {
        super.draw(d);
        const pal = TRACK.palette;
        const W = this.width;
        const cx = this.centerX;
        const pulse = this.beatPulse;
        // sky
        d.rect(0, 0, W, HORIZON_Y + 2, pal.skyTop);
        d.rect(0, HORIZON_Y * 0.55, W, HORIZON_Y * 0.45 + 2, pal.skyBottom, 0.85);
        // skyline band (parallax pan, drawn twice for wraparound)
        const skyFrame = this.frames.skyline;
        const skyW = W * 1.6;
        const skyH = skyW * (240 / 384);
        const pan = (this.distance * 0.02) % skyW;
        d.sprite(skyFrame, -pan, HORIZON_Y - skyH + 4, { w: skyW, h: skyH, alpha: 0.9, tint: this.sectionTint });
        d.sprite(skyFrame, skyW - pan, HORIZON_Y - skyH + 4, { w: skyW, h: skyH, alpha: 0.9, tint: this.sectionTint });
        // roadside buildings (two parallax layers, wrapping)
        for (const b of this.buildings) {
            const speedF = b.layer === 0 ? 0.12 : 0.3;
            const span = 9 * 34 + 40;
            let bx = (b.x - this.distance * speedF) % span;
            if (bx < 0)
                bx += span;
            const side = b.side;
            const baseX = side < 0 ? cx - ROAD_HALF - 6 - bx * 0.9 : cx + ROAD_HALF + 6 + bx * 0.9;
            const h = b.h * (b.layer === 0 ? 1.25 : 0.85);
            const w = b.w * (b.layer === 0 ? 1.1 : 0.8);
            const x = side < 0 ? baseX - w : baseX;
            if (x > W || x + w < 0)
                continue;
            const body = b.layer === 0 ? '#0d1230' : '#080c22';
            d.rect(x, HORIZON_Y - h, w, h, body, b.layer === 0 ? 0.95 : 0.8);
            // neon trim + a few lit windows
            const trim = b.hue < 0.5 ? pal.secondary : pal.primary;
            d.rect(x, HORIZON_Y - h, w, 1.5, trim, 0.9);
            const cols = Math.max(1, Math.floor(w / 7));
            const rows = Math.max(1, Math.floor(h / 10));
            for (let wy = 0; wy < rows; wy++) {
                for (let wx = 0; wx < cols; wx++) {
                    const lit = Math.sin(b.x * 12.9 + wx * 7.7 + wy * 3.3) > 0.35;
                    if (lit)
                        d.rect(x + 3 + wx * 7, HORIZON_Y - h + 4 + wy * 10, 2.5, 3.5, b.hue < 0.33 ? '#ffd147' : trim, 0.8);
                }
            }
        }
        // road — trapezoid with alternating depth bands (the forward-motion cue)
        const roadHalfAt = (z) => ROAD_HALF * s(z) + 2;
        const band = 26;
        const off = this.distance % band;
        for (let z = -band; z < VIEW_Z; z += band) {
            const z0 = z + off;
            const z1 = z0 + band;
            if (z1 < 0)
                continue;
            const y0 = groundY(z0);
            const y1 = groundY(z1);
            const h0 = roadHalfAt(z0);
            const h1 = roadHalfAt(z1);
            const alt = Math.floor((z + this.distance) / band) % 2 === 0;
            d.fill([{ x: cx - h1, y: y1 }, { x: cx + h1, y: y1 }, { x: cx + h0, y: y0 }, { x: cx - h0, y: y0 }], alt ? pal.road : pal.roadAlt);
        }
        // wet sheen on the asphalt
        d.fill([{ x: cx - roadHalfAt(VIEW_Z), y: groundY(VIEW_Z) }, { x: cx + roadHalfAt(VIEW_Z), y: groundY(VIEW_Z) },
            { x: cx + roadHalfAt(0), y: groundY(0) }, { x: cx - roadHalfAt(0), y: groundY(0) }], '#8fb8ff', 0.05 + pulse * 0.03);
        // lane dividers — a faint continuous rail plus bright scrolling dashes
        for (const boundary of [-0.5, 0.5]) {
            d.line(cx + boundary * LANE_W * s(0), groundY(0), cx + boundary * LANE_W * s(VIEW_Z), groundY(VIEW_Z), 1, pal.laneGlow, 0.16);
            for (let z = 6; z < VIEW_Z; z += 22) {
                const zr = z + (this.distance % 22);
                const x0 = cx + boundary * LANE_W * s(zr);
                const x1 = cx + boundary * LANE_W * s(zr + 9);
                d.line(x0, groundY(zr), x1, groundY(zr + 9), Math.max(0.8, 2.6 * s(zr)), pal.laneGlow, 0.5 + pulse * 0.35);
            }
        }
        // road edges — the neon rails; they shift hue in Overdrive
        const edgeL = this.overdrive ? pal.overdriveB : pal.edgeLeft;
        const edgeR = this.overdrive ? pal.overdriveA : pal.edgeRight;
        const edgeAlpha = 0.75 + pulse * 0.25;
        d.line(cx - roadHalfAt(0), groundY(0), cx - roadHalfAt(VIEW_Z), groundY(VIEW_Z), 2.4, edgeL, edgeAlpha);
        d.line(cx + roadHalfAt(0), groundY(0), cx + roadHalfAt(VIEW_Z), groundY(VIEW_Z), 2.4, edgeR, edgeAlpha);
        d.line(cx - roadHalfAt(0) - 3, groundY(0), cx - roadHalfAt(VIEW_Z) - 1, groundY(VIEW_Z), 1, edgeL, 0.3);
        d.line(cx + roadHalfAt(0) + 3, groundY(0), cx + roadHalfAt(VIEW_Z) + 1, groundY(VIEW_Z), 1, edgeR, 0.3);
        // entities — depth sorted far → near
        const liveO = this.obstacles.filter((o) => o.alive).sort((a, b) => b.z - a.z);
        const liveP = this.pickups.filter((p) => p.alive).sort((a, b) => b.z - a.z);
        let pi = 0;
        for (const o of liveO) {
            while (pi < liveP.length && liveP[pi].z > o.z) {
                this.drawPickup(d, liveP[pi]);
                pi++;
            }
            this.drawObstacle(d, o);
        }
        while (pi < liveP.length) {
            this.drawPickup(d, liveP[pi]);
            pi++;
        }
        // player
        this.drawPlayer(d);
        // rain (screen-space streaks over the world)
        const rainColor = this.overdrive ? pal.overdriveA : '#9fc8ff';
        for (const r of this.rain) {
            const rx = r.x * W;
            const ry = r.y * this.height;
            d.line(rx, ry, rx - r.len * 0.18, ry + r.len, 0.7, rainColor, 0.35);
        }
        for (const sp of this.splashes) {
            const p = sp.t / 0.4;
            d.ring(sp.x * W, GROUND_Y - 4, 1 + p * 5, 0.6, rainColor, 0.4 * (1 - p));
        }
        // Overdrive heat wash
        if (this.overdrive) {
            d.rect(0, 0, W, this.height, pal.overdriveB, 0.05 + 0.03 * Math.sin(this.elapsed * 9));
        }
    }
    drawObstacle(d, o) {
        const pal = TRACK.palette;
        const sc = s(o.z);
        const x = this.laneX(o.lane, o.z);
        const gy = groundY(o.z);
        const frame = o.kind === 'low' ? this.frames.low : this.frames.wall;
        const natW = o.kind === 'low' ? 64 : 59;
        const natH = o.kind === 'low' ? 33 : 64;
        const w = natW * sc * 1.05;
        const h = natH * sc * 1.05;
        // wet reflection under it
        d.sprite(frame, x - w / 2, gy, { w, h: h * 0.5, alpha: 0.18, tint: o.kind === 'low' ? pal.hazard : pal.secondary });
        d.sprite(frame, x - w / 2, gy - h, { w, h, fx: { glow: { color: o.kind === 'low' ? pal.hazard : pal.secondary, size: 6 * sc + 2 } } });
    }
    drawPickup(d, p) {
        const pal = TRACK.palette;
        const sc = s(p.z);
        const x = this.laneX(p.lane, p.z);
        const bob = Math.sin(p.phase) * 3 * sc;
        const gy = groundY(p.z) - 16 * sc + bob;
        const frame = p.kind === 'orb' ? this.frames.orb : this.frames.cell;
        const nat = p.kind === 'orb' ? 63 : 36;
        const natH = 64;
        const size = nat * sc * 0.55;
        const h = natH * sc * 0.55;
        const glowColor = p.kind === 'orb' ? pal.collectible : pal.primary;
        d.sprite(this.frames.soft, x - size, gy - h * 0.15 - size, { w: size * 2, h: size * 2, tint: glowColor, alpha: 0.35 + this.beatPulse * 0.2 });
        d.sprite(frame, x - size / 2, gy - h, { w: size, h, fx: { glow: { color: glowColor, size: 5 * sc + 2 } } });
    }
    drawPlayer(d) {
        const pal = TRACK.palette;
        const sc = s(PLAYER_Z);
        const x = this.laneX(this.player.x, PLAYER_Z);
        const jump = this.player.jumpOffset;
        const gy = groundY(PLAYER_Z);
        const w = 49 * sc * 1.15;
        const h = 64 * sc * 1.15;
        // ground shadow (shrinks with height)
        const shadowW = w * (1 - jump / (TRACK.jumpHeight * 2.4));
        d.sprite(this.frames.soft, x - shadowW / 2, gy - 3, { w: shadowW, h: 7, tint: '#000010', alpha: 0.5 * (1 - jump / (TRACK.jumpHeight * 2)) });
        // wet reflection
        d.sprite(this.frames.player, x - w / 2, gy + 2, { w, h: h * 0.45, alpha: 0.16, tint: pal.primary });
        // rider — leans into lane switches, blinks during mercy invincibility,
        // glows hazard-red while stunned after a crash
        const lean = (this.player.lane - this.player.x) * 0.55;
        const blink = this.player.invincible && Math.floor(this.elapsed * 14) % 2 === 0;
        if (!blink) {
            d.sprite(this.frames.player, x - w / 2, gy - jump - h, {
                w, h, rot: lean,
                fx: { glow: { color: this.player.stunned ? pal.hazard : this.overdrive ? pal.overdriveA : pal.primary, size: 7 } },
            });
        }
    }
    // ── HUD (CSS pixels) ─────────────────────────────────────────────────────
    drawHud(d) {
        const pal = TRACK.palette;
        const W = d.w;
        // score
        this.hudScore.setText(String(Math.floor(this.scorer.score)));
        d.unicodeText(this.hudScore, 12, 10);
        // combo
        const mult = this.scorer.effectiveMultiplier(this.overdrive);
        if (mult > 1) {
            this.hudCombo.setText(`COMBO x${mult}`);
            this.hudCombo.setColor(this.overdrive ? pal.overdriveA : pal.collectible);
            d.unicodeText(this.hudCombo, 12, 46);
        }
        // energy cells — chunky battery pips
        const remaining = TRACK.maxHits - this.player.hits;
        for (let i = 0; i < TRACK.maxHits; i++) {
            const x = 12 + i * 26;
            const y = 62;
            const filled = i < remaining;
            d.rect(x - 1, y - 1, 22, 14, '#0a0d1f');
            d.rect(x, y, 20, 12, filled ? pal.secondary : '#2a2138');
            if (filled) {
                d.rect(x + 2, y + 2, 16, 3, '#ffffff', 0.55);
                d.rect(x + 20, y + 3, 3, 6, pal.secondary);
            }
        }
        // track credit, top centre
        d.unicodeText(this.hudTrack, W / 2, 8, { origin: { x: 0.5 }, alpha: 0.8 });
        // song progress — the run ends when the bar fills
        const prog = Math.min(1, this.songTime / TRACK.songLength);
        d.rect(W / 2 - 70, 22, 140, 3, '#ffffff22');
        d.rect(W / 2 - 70, 22, 140 * prog, 3, this.overdrive ? pal.overdriveA : pal.primary);
        // pause button
        d.rect(W - 46, 12, 34, 30, '#ffffff14');
        d.rect(W - 36, 19, 4, 16, '#cfe4ff');
        d.rect(W - 28, 19, 4, 16, '#cfe4ff');
        // overdrive meter
        if (this.overdrive) {
            const frac = Math.min(1, this.overdriveT / 15);
            d.rect(W / 2 - 60, 26, 120, 5, '#2a1030');
            d.rect(W / 2 - 60, 26, 120 * frac, 5, pal.overdriveA);
        }
        // banner
        if (this.bannerT > 0) {
            const a = Math.min(1, this.bannerT / 0.4);
            const scale = 1 + Math.max(0, this.bannerT - 1.2) * 0.8;
            d.unicodeText(this.hudBanner, W / 2, d.h * 0.24, { origin: { x: 0.5, y: 0.5 }, alpha: a, scale });
        }
        // floaters
        for (const f of this.floaters) {
            const p = f.t / f.life;
            d.unicodeText(f.text, f.x, f.y - p * 34, { origin: { x: 0.5 }, alpha: 1 - p * p });
        }
        // pre-roll sync indicator
        if (this.phase === 'preroll') {
            const dots = '.'.repeat(1 + (Math.floor(this.prerollFrames / 30) % 3));
            this.hudSync.setText(`SYNCING AUDIO${dots}`);
            d.unicodeText(this.hudSync, W / 2, d.h * 0.42, { origin: { x: 0.5, y: 0.5 } });
        }
        // pause overlay
        if (this.paused) {
            d.rect(0, 0, W, d.h, '#05060fd9');
            d.unicodeText(this.hudPause, W / 2, d.h * 0.42, { origin: { x: 0.5, y: 0.5 } });
            d.unicodeText(this.hudPauseHint, W / 2, d.h * 0.42 + 44, { origin: { x: 0.5 } });
        }
    }
}
const KEY_LEFT = 'ArrowLeft';
const KEY_RIGHT = 'ArrowRight';
const KEY_SPACE = 'Space';
const KEY_UP = 'ArrowUp';
