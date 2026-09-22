export declare class Rng {
    private s;
    constructor(seed: number);
    /** Next uint32. */
    next(): number;
    /** Float in [0, 1). */
    float(): number;
    /** Integer in [0, n). */
    int(n: number): number;
    /** Index into a weight table (uniform over indices when total weight is 0). */
    weighted(weights: number[]): number;
    /** Fisher–Yates shuffle in place. */
    shuffle<T>(arr: T[]): T[];
}
