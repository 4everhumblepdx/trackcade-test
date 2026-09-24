export class MusicDirector {
    /** The full ordered timeline (metrical beats + authored structural events). */
    timeline;
    /** Seconds per beat for legacy/fallback manifests. */
    beatLen;
    /** Ordered metrical beat times used by this run. */
    beatTimes;
    cursor = 0;
    constructor(cfg, songLengthHint = 600) {
        this.beatLen = 60 / cfg.bpm;
        const authoredBeats = cfg.events
            .filter((event) => event.kind === 'beat')
            .map((event) => event.t)
            .filter((time) => Number.isFinite(time) && time >= 0)
            .sort((a, b) => a - b);
        const useAuthoredGrid = authoredBeats.length >= 2;
        const beats = [];
        if (useAuthoredGrid) {
            this.beatTimes = authoredBeats;
        }
        else {
            for (let t = cfg.beatOffset, i = 0; t <= songLengthHint; t += this.beatLen, i++) {
                beats.push({ t, kind: 'beat', name: `beat-${i}` });
            }
            this.beatTimes = beats.map((beat) => beat.t);
        }
        this.timeline = [
            ...cfg.events,
            ...(useAuthoredGrid ? [] : beats),
        ].sort((a, b) => a.t - b.t);
    }
    /** Restart the song clock (same song, fresh run). */
    reset() {
        this.cursor = 0;
    }
    /** Current beat position (fractional) for a song time in seconds. */
    beatAt(songTime, offset) {
        if (this.beatTimes.length < 2)
            return Math.max(0, (songTime - offset) / this.beatLen);
        const first = this.beatTimes[0];
        if (songTime <= first)
            return 0;
        let lo = 0;
        let hi = this.beatTimes.length - 1;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (this.beatTimes[mid] <= songTime)
                lo = mid;
            else
                hi = mid - 1;
        }
        const index = lo;
        if (index >= this.beatTimes.length - 1)
            return index + Math.max(0, (songTime - this.beatTimes[index]) / this.beatLen);
        const current = this.beatTimes[index];
        const next = this.beatTimes[index + 1];
        const span = Math.max(1e-6, next - current);
        return index + Math.max(0, Math.min(1, (songTime - current) / span));
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
