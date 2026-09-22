export class Difficulty {
    cfg;
    /** Permanent boost level from 'energy' events. */
    energyLevel = 0;
    constructor(cfg) {
        this.cfg = cfg;
    }
    /** Current run speed in world units/sec. */
    speed(elapsedSec, overdrive) {
        const base = this.cfg.baseSpeed +
            elapsedSec * this.cfg.speedRampPerSec +
            this.energyLevel * this.cfg.energySpeedBoost;
        const capped = Math.min(base, this.cfg.maxSpeed);
        return overdrive ? Math.min(capped * this.cfg.overdriveSpeedMult, this.cfg.maxSpeed * 1.35) : capped;
    }
    /** 0..1 — how hard the game currently is (drives pattern weights). */
    intensity(elapsedSec) {
        const raw = (this.speed(elapsedSec, false) - this.cfg.baseSpeed) /
            (this.cfg.maxSpeed - this.cfg.baseSpeed);
        return Math.min(1, Math.max(0, raw));
    }
    /**
     * Sample the track's energy curve at a song time (seconds). Returns null
     * when the track has no curve. Samples are spread evenly across the song
     * and linearly interpolated.
     */
    energyAt(songTime) {
        const curve = this.cfg.energyCurve;
        if (!curve || curve.length === 0)
            return null;
        if (curve.length === 1)
            return curve[0];
        const p = Math.min(1, Math.max(0, songTime / this.cfg.songLength)) * (curve.length - 1);
        const i = Math.floor(p);
        const f = p - i;
        const a = curve[i];
        const b = curve[Math.min(curve.length - 1, i + 1)];
        return a + (b - a) * f;
    }
    /**
     * The intensity handed to the row generator: the speed-derived ramp blended
     * with the track's energy curve when one exists.
     */
    spawnIntensity(elapsedSec, songTime) {
        const base = this.intensity(elapsedSec);
        const curve = this.energyAt(songTime);
        if (curve === null)
            return base;
        return Math.min(1, Math.max(0, base * 0.5 + curve * 0.5));
    }
}
