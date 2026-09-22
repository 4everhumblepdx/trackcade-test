// High-score persistence — pure logic, no engine imports.
// Storage is injected so verify.ts can run it in Node with an in-memory map.
export class HighScore {
    key;
    store;
    best;
    constructor(key, store) {
        this.key = key;
        this.store = store;
        this.best = Number(this.store.getItem(this.key) ?? 0) || 0;
    }
    get value() {
        return this.best;
    }
    /** Submit a finished run's score. Returns true when it's a new best. */
    submit(score) {
        const s = Math.floor(score);
        if (s > this.best) {
            this.best = s;
            this.store.setItem(this.key, String(s));
            return true;
        }
        return false;
    }
}
/** In-memory storage for tests / non-DOM environments. */
export function memoryStorage() {
    const map = new Map();
    return {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => void map.set(k, v),
    };
}
