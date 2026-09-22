// GameOver — run results + nearly instant restart. Tap / Space / Enter goes
// straight back into a fresh run (the Play scene rebuilds from scratch and the
// soundtrack restarts with it). The 500 ms input grace on scene entry stops an
// end-of-song tap from skipping the screen.
//
// Trackcade runs always end the same way: the song completes. There is no
// death — mistakes cost score and combo, never the music.
import { Scene } from '../../engine/webgpu.js';
import { TRACK } from '../track/active.js';
export class GameOver extends Scene {
    titleText;
    scoreText;
    statsText;
    bestText;
    retryText;
    creditText;
    t = 0;
    async setup(data) {
        const g = this.game;
        const pal = TRACK.palette;
        const r = (data ?? { score: 0, best: 0, isBest: false, orbs: 0, nearMisses: 0, distance: 0 });
        this.titleText = g.assets.unicodeText('SONG COMPLETE!', { fontSize: 34, fontWeight: 800, color: pal.collectible, align: 'center' });
        this.scoreText = g.assets.unicodeText(String(r.score), { fontSize: 54, fontWeight: 800, color: '#ffffff', align: 'center' });
        this.statsText = g.assets.unicodeText([`${TRACK.artist} — ${TRACK.title}`, `${r.distance}m travelled`, `${r.orbs} orbs · ${r.nearMisses} near misses`, `finish bonus +${TRACK.finishBonus}`], { fontSize: 14, fontFamily: 'monospace', color: '#8fa3d9', align: 'center', lineHeight: 1.5 });
        this.bestText = g.assets.unicodeText(r.isBest ? '★ NEW BEST ★' : `BEST ${r.best}`, { fontSize: 17, fontFamily: 'monospace', color: pal.collectible, align: 'center' });
        this.retryText = g.assets.unicodeText('TAP TO DASH AGAIN', { fontSize: 22, fontWeight: 800, color: '#ffffff', align: 'center' });
        this.creditText = g.assets.unicodeText('made by Forever Humble PDX', { fontSize: 11, fontFamily: 'monospace', color: '#7d90c4', align: 'center' });
        g.post.add('bloom', { threshold: 0.5, strength: TRACK.baseBloom, radius: 2.5 });
        g.post.add('vignette', { strength: 0.4 });
        this.input.onTap(() => this.gotoPlay());
        this.sound.play({ notes: 'C4 G3 E3 C3:2', step: 0.13, type: 'triangle', volume: 0.45 });
    }
    update(dt) {
        super.update(dt);
        this.t += dt;
        if (this.input.keyPressed('Space', 'Enter'))
            this.gotoPlay();
    }
    draw(d) {
        super.draw(d);
        const pal = TRACK.palette;
        d.rect(0, 0, this.width, this.height, pal.skyTop);
        d.rect(0, this.height * 0.5, this.width, this.height * 0.5, pal.road);
        d.rect(0, this.height * 0.5, this.width, 2, pal.secondary, 0.6);
    }
    drawHud(d) {
        const W = d.w;
        const H = d.h;
        d.unicodeText(this.titleText, W / 2, H * 0.16, { origin: { x: 0.5, y: 0.5 } });
        d.unicodeText(this.scoreText, W / 2, H * 0.3, { origin: { x: 0.5, y: 0.5 } });
        d.unicodeText(this.bestText, W / 2, H * 0.3 + 46, { origin: { x: 0.5 } });
        d.unicodeText(this.statsText, W / 2, H * 0.46, { origin: { x: 0.5 } });
        const pulse = 0.75 + Math.sin(this.t * 3.4) * 0.25;
        d.unicodeText(this.retryText, W / 2, H * 0.72, { origin: { x: 0.5, y: 0.5 }, alpha: pulse });
        d.unicodeText(this.creditText, W / 2, H - 22, { origin: { x: 0.5 }, alpha: 0.85 });
    }
}
