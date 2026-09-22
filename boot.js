// Boot — the Trackcade front door, registered as `intro` so it always runs
// first. Reads the `?track=` URL parameter:
//
//   • no parameter   → install the built-in fallback track, straight to Title.
//   • a manifest URL → show a loading card, fetch + validate the manifest,
//                      probe its artwork and audio, install it as the active
//                      track, then continue to Title.
//
// Any failure (network, HTTP, invalid JSON, missing fields, broken artwork or
// audio) lands on a clear error card with RETRY and DEMO actions — the player
// is never left on a blank or broken screen.
import { Scene, getImage } from '../../engine/webgpu.js';
import { FALLBACK_TRACK } from '../track.config.js';
import { loadManifest, trackParamFrom, ManifestError } from '../track/loader.js';
import { setActiveTrack } from '../track/active.js';
const AUDIO_PROBE_TIMEOUT_MS = 20000;
export class Boot extends Scene {
    phase = 'idle';
    status = '';
    errorMsg = '';
    url = null;
    busy = false;
    t = 0;
    titleText;
    statusText;
    errorText;
    retryText;
    demoText;
    buttons = [];
    async setup() {
        const g = this.game;
        this.titleText = g.assets.unicodeText('TRACKCADE', { fontSize: 34, fontWeight: 800, color: '#ffffff', align: 'center' });
        this.statusText = g.assets.unicodeText('', { fontSize: 13, fontFamily: 'monospace', color: '#8fa3d9', align: 'center' });
        this.errorText = g.assets.unicodeText('', { fontSize: 13, fontFamily: 'monospace', color: '#ff4d6d', align: 'center', lineHeight: 1.45 });
        this.retryText = g.assets.unicodeText('RETRY', { fontSize: 18, fontWeight: 800, color: '#ffffff', align: 'center' });
        this.demoText = g.assets.unicodeText('PLAY DEMO', { fontSize: 18, fontWeight: 800, color: '#ffffff', align: 'center' });
        g.post.add('bloom', { threshold: 0.5, strength: 0.9, radius: 2.5 });
        this.url = trackParamFrom(globalThis.location ?? { search: '' });
        if (!this.url) {
            // Safety net — game.ts only registers Boot when ?track= is present.
            setActiveTrack(FALLBACK_TRACK, { source: 'builtin' });
            this.gotoTitle();
            return;
        }
        this.input.onTap((e) => {
            const hudScale = g.hud.h / this.height;
            const hx = e.x * hudScale;
            const hy = e.y * hudScale;
            for (const b of this.buttons) {
                if (hx >= b.x && hx <= b.x + b.w && hy >= b.y && hy <= b.y + b.h) {
                    if (b.action === 'retry')
                        void this.startLoad();
                    else
                        this.playDemo();
                    return;
                }
            }
        });
        await this.startLoad();
    }
    /** Fetch → validate → probe → install. Errors land on the error card. */
    async startLoad() {
        if (this.busy || !this.url)
            return;
        this.busy = true;
        this.phase = 'loading';
        this.errorMsg = '';
        try {
            this.status = 'fetching track manifest…';
            const cfg = await loadManifest(this.url);
            this.status = `checking artwork for “${cfg.title}”…`;
            const artUrls = [cfg.coverUrl, cfg.logoUrl, ...Object.values(cfg.art)].filter((u) => u.length > 0);
            const failedArt = await this.probeArt(artUrls);
            if (failedArt.length > 0) {
                throw new ManifestError(`artwork failed to load: ${failedArt.map(shortName).join(', ')}`);
            }
            this.status = 'checking the audio stream…';
            if (!(await this.probeAudio(cfg.audioUrl))) {
                throw new ManifestError('the audio stream could not be loaded');
            }
            setActiveTrack(cfg, { source: 'manifest', url: this.url });
            this.busy = false;
            this.gotoTitle();
        }
        catch (e) {
            this.errorMsg = e instanceof ManifestError
                ? e.message
                : 'something unexpected went wrong while loading the track';
            this.phase = 'error';
            this.busy = false;
        }
    }
    playDemo() {
        setActiveTrack(FALLBACK_TRACK, { source: 'builtin' });
        this.gotoTitle();
    }
    /** Warm every image through the engine cache; report the ones that failed. */
    async probeArt(urls) {
        const failed = [];
        await Promise.all(urls.map(async (u) => {
            try {
                await this.game.assets.loadFrames(u);
                if (!getImage(u))
                    failed.push(u);
            }
            catch {
                failed.push(u);
            }
        }));
        return failed;
    }
    /** Probe the audio stream by loading its metadata in a scratch element. */
    probeAudio(url) {
        return new Promise((resolve) => {
            if (typeof globalThis.Audio === 'undefined') {
                resolve(true);
                return;
            }
            const el = new globalThis.Audio();
            let done = false;
            const finish = (ok) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                el.removeAttribute('src');
                try {
                    el.load();
                }
                catch { /* ignore */ }
                resolve(ok);
            };
            const timer = setTimeout(() => finish(false), AUDIO_PROBE_TIMEOUT_MS);
            el.addEventListener('loadedmetadata', () => finish(true), { once: true });
            el.addEventListener('error', () => finish(false), { once: true });
            el.preload = 'metadata';
            el.src = url;
        });
    }
    update(dt) {
        super.update(dt);
        this.t += dt;
        if (this.phase === 'error') {
            if (this.input.keyPressed('Enter', 'Space'))
                void this.startLoad();
            if (this.input.keyPressed('KeyD'))
                this.playDemo();
        }
    }
    draw(d) {
        super.draw(d);
        const W = this.width;
        const H = this.height;
        d.rect(0, 0, W, H, '#070a1e');
        d.rect(0, H * 0.55, W, H * 0.45, '#1b1440', 0.6);
        // pulsing neon rings — the loading heartbeat
        const cx = this.centerX;
        const cy = H * 0.4;
        for (let i = 0; i < 3; i++) {
            const p = (this.t * 0.7 + i / 3) % 1;
            d.ring(cx, cy, 12 + p * 46, 1.6, i % 2 ? '#ff2fb0' : '#19e3ff', (1 - p) * 0.5);
        }
        d.circle(cx, cy, 5, '#ffffff', 0.9);
    }
    drawHud(d) {
        const W = d.w;
        const H = d.h;
        d.unicodeText(this.titleText, W / 2, H * 0.16, { origin: { x: 0.5, y: 0.5 } });
        this.buttons = [];
        if (this.phase === 'loading') {
            const dots = '.'.repeat(1 + (Math.floor(this.t * 2.5) % 3));
            this.statusText.setText(truncate(this.status, 64) + dots);
            d.unicodeText(this.statusText, W / 2, H * 0.62, { origin: { x: 0.5 } });
            return;
        }
        if (this.phase === 'error') {
            this.errorText.setText([
                'COULDN’T LOAD THIS TRACK',
                truncate(this.errorMsg, 90),
                truncate(this.url ?? '', 72),
            ]);
            d.unicodeText(this.errorText, W / 2, H * 0.52, { origin: { x: 0.5 } });
            this.drawButton(d, W / 2 - 118, H * 0.72, 108, 40, this.retryText, '#19e3ff', 'retry');
            this.drawButton(d, W / 2 + 10, H * 0.72, 108, 40, this.demoText, '#ff2fb0', 'demo');
        }
    }
    drawButton(d, x, y, w, h, label, color, action) {
        d.rect(x, y, w, h, '#0a0d1fee');
        d.rect(x, y, w, 2, color);
        d.rect(x, y + h - 2, w, 2, color);
        d.rect(x, y, 2, h, color);
        d.rect(x + w - 2, y, 2, h, color);
        d.unicodeText(label, x + w / 2, y + h / 2, { origin: { x: 0.5, y: 0.5 } });
        this.buttons.push({ x, y, w, h, action });
    }
}
function shortName(url) {
    try {
        const path = new URL(url).pathname;
        return path.slice(path.lastIndexOf('/') + 1) || url;
    }
    catch {
        return url;
    }
}
function truncate(s, max) {
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
