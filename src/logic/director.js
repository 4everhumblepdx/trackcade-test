export class MusicDirector {
    /** The full ordered timeline (synthesised beats + authored events). */
    timeline;
    /** Seconds per beat. */
    beatLen;
    cursor = 0;
    constructor(cfg, songLengthHint = 600) {
        this.beatLen = 60 / cfg.bpm;
        const beats = [];
        for (let t = cfg.beatOffset, i = 0; t <= songLengthHint; t += this.beatLen, i++) {
            beats.push({ t, kind: 'beat', name: `beat-${i}` });
        }
        this.timeline = [...cfg.events, ...beats].sort((a, b) => a.t - b.t);
    }
    /** Restart the song clock (same song, fresh run). */
    reset() {
        this.cursor = 0;
    }
    /** Current beat position (fractional) for a song time in seconds. */
    beatAt(songTime, offset) {
        return Math.max(0, (songTime - offset) / this.beatLen);
    }
    /**
     * Advance to `songTime` (seconds) and return every event crossed since the
     * previous tick, in time order. Monotonic: an event fires exactly once.
     */
    tick(songTime, offset) {
        const fired = [];
        while (this.cursor < this.timeline.length && this.timeline[this.cursor].t <= songTime) {
            const e = this.timeline[this.cursor++];
            fired.push({ ...e, beat: this.beatAt(e.t, offset) });
        }
        return fired;
    }
    /** The next event of a kind at/after `songTime` (for HUD hints), if any. */
    nextOfKind(songTime, kind) {
        for (let i = this.cursor; i < this.timeline.length; i++) {
            if (this.timeline[i].kind === kind)
                return this.timeline[i];
        }
        return undefined;
    }
}
