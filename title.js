// Title — the Neon Dash front door. Rainy neon city behind the track's logo
// (or cover art), the release credit, the high score, and the Forever Humble
// PDX credit. The tap/Space that leaves this scene is the user gesture that
// lets the soundtrack start with the run.
//
// Everything here comes from the ACTIVE track (src/track/active.ts) — the
// built-in demo or whatever Trackcade manifest `?track=` resolved to — so a
// different song reskins the whole screen.
import { Scene } from '../../engine/webgpu.js';
import { TRACK, TRACK_ORIGIN } from '../track/active.js';
import { HighScore } from '../logic/hiscore.js';
export class Title extends Scene {
    logoFrame = 0;
    coverFrame = 0;
    skylineFrame = 0;
    startText;
    creditText;
    trackText;
    bestText;
    tagText;
    controlsText;
    rain = [];
    t = 0;
    preload(load) {
        if (TRACK.logoUrl)
            load.image(TRACK.logoUrl);
        if (TRACK.coverUrl)
            load.image(TRACK.coverUrl);
        load.image(TRACK.art.skyline);
    }
    async setup() {
        const g = this.game;
        const pal = TRACK.palette;
        if (TRACK.logoUrl)
            this.logoFrame = g.assets.framesOf(TRACK.logoUrl);
        if (TRACK.coverUrl)
            this.coverFrame = g.assets.framesOf(TRACK.coverUrl);
        this.skylineFrame = g.assets.framesOf(TRACK.art.skyline);
        this.startText = g.assets.unicodeText('TAP TO DASH', { fontSize: 26, fontWeight: 800, color: '#ffffff', align: 'center' });
        // artist/title can be any writing system — the unicode path shapes them
        this.trackText = g.assets.unicodeText(`${TRACK.artist} — ${TRACK.title}`, {
            fontSize: 15, fontWeight: 600, color: pal.collectible, align: 'center',
        });
        this.creditText = g.assets.unicodeText('made by Forever Humble PDX', { fontSize: 11, fontFamily: 'monospace', color: '#7d90c4', align: 'center' });
        const best = new HighScore(TRACK.highScoreKey, globalThis.localStorage ?? { getItem: () => null, setItem: () => { } });
        this.bestText = g.assets.unicodeText(best.value > 0 ? `BEST ${best.value}` : '', { fontSize: 14, fontFamily: 'monospace', color: pal.secondary, align: 'center' });
        this.tagText = g.assets.unicodeText(TRACK_ORIGIN.source === 'manifest' ? 'TRACKCADE RELEASE' : 'TRACKCADE DEMO TRACK', { fontSize: 10, fontFamily: 'monospace', color: pal.primary, align: 'center' });
        this.controlsText = g.assets.unicodeText('swipe or ← → to steer · tap or SPACE to jump', { fontSize: 10, fontFamily: 'monospace', color: '#8fa3d9', align: 'center' });
        for (let i = 0; i < 34; i++)
            this.rain.push({ x: Math.random(), y: Math.random(), len: 8 + Math.random() * 10, spd: 280 + Math.random() * 140 });
        g.post.add('bloom', { threshold: 0.5, strength: TRACK.baseBloom, radius: 2.5 });
        g.post.add('vignette', { strength: 0.35 });
        this.input.onTap(() => this.gotoPlay());
    }
    update(dt) {
        super.update(dt);
        this.t += dt;
        for (const r of this.rain) {
            r.y += (r.spd * dt) / this.height;
            r.x -= (r.spd * 0.18 * dt) / this.width;
            if (r.y > 1) {
                r.y = -0.05;
                r.x = Math.random() * 1.2;
            }
        }
        if (this.input.keyPressed('Space', 'Enter'))
            this.gotoPlay();
    }
    draw(d) {
        super.draw(d);
        const pal = TRACK.palette;
        const W = this.width;
        const H = this.height;
        // sky + skyline
        d.rect(0, 0, W, H, pal.skyTop);
        d.rect(0, H * 0.3, W, H * 0.4, pal.skyBottom, 0.85);
        const skyW = W * 1.5;
        const skyH = skyW * (240 / 384);
        const pan = (this.t * 6) % skyW;
        d.sprite(this.skylineFrame, -pan, H * 0.52 - skyH, { w: skyW, h: skyH, alpha: 0.9 });
        d.sprite(this.skylineFrame, skyW - pan, H * 0.52 - skyH, { w: skyW, h: skyH, alpha: 0.9 });
        // wet street hint
        d.rect(0, H * 0.52, W, H * 0.48, pal.road);
        d.rect(0, H * 0.52, W, 2, pal.primary, 0.5);
        d.rect(0, H * 0.55, W, H * 0.45, '#8fb8ff', 0.05);
        // neon edge strips
        d.rect(0, H * 0.52, 3, H * 0.48, pal.edgeLeft, 0.7);
        d.rect(W - 3, H * 0.52, 3, H * 0.48, pal.edgeRight, 0.7);
        // rain
        for (const r of this.rain) {
            d.line(r.x * W, r.y * H, r.x * W - r.len * 0.18, r.y * H + r.len, 0.7, '#9fc8ff', 0.3);
        }
    }
    drawHud(d) {
        const W = d.w;
        const H = d.h;
        const pal = TRACK.palette;
        let creditY = H * 0.16;
        // logo wordmark (world-space image drawn via HUD coords: scale to fit)
        if (TRACK.logoUrl) {
            const logoW = Math.min(W * 0.86, 460);
            const logoH = logoW * (141 / 640);
            const bob = Math.sin(this.t * 1.6) * 3;
            d.sprite(this.logoFrame, (W - logoW) / 2, H * 0.16 + bob, { w: logoW, h: logoH });
            creditY = H * 0.16 + logoH + 18;
        }
        // cover art — a framed square under the logo
        if (TRACK.coverUrl) {
            const size = Math.min(W * 0.42, 150);
            const cx = W / 2;
            const cy = creditY + 10;
            d.rect(cx - size / 2 - 3, cy - 3, size + 6, size + 6, '#0a0d1fee');
            d.sprite(this.coverFrame, cx - size / 2, cy, { w: size, h: size });
            d.rect(cx - size / 2 - 3, cy - 3, size + 6, 2, pal.primary);
            d.rect(cx - size / 2 - 3, cy + size + 1, size + 6, 2, pal.secondary);
            creditY = cy + size + 22;
        }
        d.unicodeText(this.trackText, W / 2, creditY, { origin: { x: 0.5 } });
        d.unicodeText(this.tagText, W / 2, creditY + 24, { origin: { x: 0.5 }, alpha: 0.85 });
        const pulse = 0.75 + Math.sin(this.t * 3.4) * 0.25;
        d.unicodeText(this.startText, W / 2, H * 0.62, { origin: { x: 0.5, y: 0.5 }, alpha: pulse });
        d.unicodeText(this.controlsText, W / 2, H * 0.7, { origin: { x: 0.5 } });
        d.unicodeText(this.bestText, W / 2, H * 0.76, { origin: { x: 0.5 } });
        d.unicodeText(this.creditText, W / 2, H - 22, { origin: { x: 0.5 }, alpha: 0.85 });
    }
}
