/** Deterministic PRNG (mulberry32) — same seed, same run, every machine. */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** True when a row can be survived: some lane is free or only jumpable. */
export function rowIsSurvivable(row, lanes) {
    for (let lane = 0; lane < lanes; lane++) {
        const obs = row.obstacles.filter((o) => o.lane === lane);
        if (obs.length === 0 || obs.every((o) => o.kind === 'low'))
            return true;
    }
    return false;
}
export class RowGenerator {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    /**
     * Generate the row for one spawn tick.
     * @param seed      deterministic seed (e.g. row index)
     * @param intensity 0..1 difficulty (from Difficulty.intensity)
     * @param overdrive true during Overdrive (more obstacles + more orbs)
     */
    row(seed, intensity, overdrive) {
        const rand = rng(seed);
        const lanes = this.cfg.lanes;
        const obstacles = [];
        const pickups = [];
        // How many lanes get obstacles: 1 early, up to 2 (of 3) when intense.
        const roll = rand();
        const obstacleLanes = roll < 0.32 - intensity * 0.12 ? 1 : 2;
        // Pick which lanes, shuffled deterministically.
        const order = [0, 1, 2].slice(0, lanes);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        const chosen = order.slice(0, Math.min(obstacleLanes, lanes - 1));
        // Guarantee survivability: at most (lanes-1) obstacles, and never all walls.
        let walls = 0;
        for (const lane of chosen) {
            const wallChance = 0.34 + intensity * 0.38 + (overdrive ? 0.1 : 0);
            const kind = rand() < wallChance && walls < lanes - 2 ? 'wall' : 'low';
            if (kind === 'wall')
                walls++;
            obstacles.push({ lane, kind });
        }
        // Collectibles: usually an orb on a survivable lane; Overdrive adds more.
        const safeLanes = order.filter((l) => !chosen.includes(l));
        const orbLane = safeLanes.length ? safeLanes[0] : chosen.find((l) => obstacles.some((o) => o.lane === l && o.kind === 'low')) ?? 0;
        const orbChance = 0.55 + (overdrive ? this.cfg.overdriveOrbChance : 0);
        if (rand() < orbChance)
            pickups.push({ lane: orbLane, kind: 'orb' });
        // Rare health cell, only when not at full intensity chaos.
        if (rand() < 0.06)
            pickups.push({ lane: (orbLane + 1) % lanes, kind: 'cell' });
        const row = { obstacles, pickups };
        // Final safety net — should be unreachable given the construction above.
        if (!rowIsSurvivable(row, lanes)) {
            row.obstacles = row.obstacles.slice(0, lanes - 1);
            for (const o of row.obstacles)
                o.kind = 'low';
        }
        return row;
    }
}
