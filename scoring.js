export class ScoreKeeper {
    cfg;
    score = 0;
    orbs = 0;
    nearMisses = 0;
    hits = 0;
    /** Combo multiplier (1 = none). */
    multiplier = 1;
    /** Orbs collected toward the next combo step. */
    comboProgress = 0;
    constructor(cfg) {
        this.cfg = cfg;
    }
    /** Effective multiplier including the Overdrive bonus. */
    effectiveMultiplier(overdrive) {
        return this.multiplier + (overdrive ? this.cfg.overdriveComboBonus : 0);
    }
    /** Distance score — call every frame with metres travelled. */
    addDistance(metres, overdrive) {
        this.score += metres * this.cfg.scorePerMeter * this.effectiveMultiplier(overdrive);
    }
    /** An energy orb was collected. Returns the points awarded. */
    collectOrb(overdrive) {
        this.orbs++;
        this.comboProgress++;
        if (this.comboProgress >= this.cfg.comboEvery) {
            this.comboProgress = 0;
            this.multiplier = Math.min(this.multiplier + 1, this.cfg.comboCap);
        }
        const pts = this.cfg.orbScore * this.effectiveMultiplier(overdrive);
        this.score += pts;
        return pts;
    }
    /** A near miss was dodged. Returns the points awarded. */
    nearMiss(overdrive) {
        this.nearMisses++;
        const pts = this.cfg.nearMissScore * this.effectiveMultiplier(overdrive);
        this.score += pts;
        return pts;
    }
    /** A flat bonus (e.g. for surviving to the end of the song). */
    addBonus(points) {
        this.score += points;
    }
    /** A hit was taken — combo breaks. */
    registerHit() {
        this.hits++;
        this.multiplier = 1;
        this.comboProgress = 0;
    }
    /**
     * A crash (energy ran out) — the Trackcade penalty. A large chunk of the
     * score is deducted (fraction + flat) and the combo resets, but the run and
     * the song continue. Returns the points deducted.
     */
    applyCrashPenalty() {
        const lost = Math.min(this.score, Math.round(this.score * this.cfg.crashScoreFraction + this.cfg.crashScoreFlat));
        this.score -= lost;
        this.multiplier = 1;
        this.comboProgress = 0;
        return lost;
    }
}
