export class PlayerState {
    cfg;
    /** Target lane index (0 = left … lanes-1 = right). */
    lane;
    /** Continuous lateral position in lane units (eases toward `lane`). */
    x;
    /** Seconds since the jump started; >= jumpTime means grounded. */
    jumpT;
    /** Hits taken this run (energy cells spent). */
    hits = 0;
    /** Mercy invincibility remaining (seconds). */
    invincibleT = 0;
    /** Stun remaining (seconds) — no steering while stunned. */
    stunT = 0;
    /** Seconds since the last lane change started (for near-miss detection). */
    sinceSwitch = 99;
    constructor(cfg) {
        this.cfg = cfg;
        this.lane = Math.floor(cfg.lanes / 2);
        this.x = this.lane;
        this.jumpT = cfg.jumpTime; // grounded
    }
    get grounded() {
        return this.jumpT >= this.cfg.jumpTime;
    }
    /** Height above the road right now (world units). */
    get jumpOffset() {
        if (this.grounded)
            return 0;
        const p = this.jumpT / this.cfg.jumpTime;
        return Math.sin(p * Math.PI) * this.cfg.jumpHeight;
    }
    get invincible() {
        return this.invincibleT > 0;
    }
    /** True while the rider is stunned after a crash — controls locked out. */
    get stunned() {
        return this.stunT > 0;
    }
    moveLeft() {
        return this.moveTo(this.lane - 1);
    }
    moveRight() {
        return this.moveTo(this.lane + 1);
    }
    moveTo(lane) {
        if (this.stunned)
            return false;
        const clamped = Math.max(0, Math.min(this.cfg.lanes - 1, lane));
        if (clamped === this.lane)
            return false;
        this.lane = clamped;
        this.sinceSwitch = 0;
        return true;
    }
    jump() {
        if (!this.grounded || this.stunned)
            return false;
        this.jumpT = 0;
        return true;
    }
    /**
     * Register a hit. Returns 'ignored' (invincible), 'hit', or 'crash' when the
     * last energy cell was spent. A crash stuns the rider, grants a longer
     * invulnerability window and REFILLS every cell — the run always continues.
     */
    hit() {
        if (this.invincible)
            return 'ignored';
        this.hits++;
        if (this.hits >= this.cfg.maxHits) {
            this.hits = 0; // energy restored — the song plays on
            this.stunT = this.cfg.crashStunTime;
            this.invincibleT = this.cfg.crashInvincibleTime;
            return 'crash';
        }
        this.invincibleT = this.cfg.invincibleTime;
        return 'hit';
    }
    /** Heal one energy cell (from a battery pickup). */
    heal() {
        this.hits = Math.max(0, this.hits - 1);
    }
    update(dt) {
        // Ease toward the target lane: laneSwitchTime seconds per lane.
        const rate = 1 / Math.max(0.01, this.cfg.laneSwitchTime);
        const d = this.lane - this.x;
        const step = Math.sign(d) * rate * dt;
        this.x = Math.abs(step) >= Math.abs(d) ? this.lane : this.x + step;
        if (this.jumpT < this.cfg.jumpTime)
            this.jumpT += dt;
        if (this.invincibleT > 0)
            this.invincibleT -= dt;
        if (this.stunT > 0)
            this.stunT -= dt;
        this.sinceSwitch += dt;
    }
}
