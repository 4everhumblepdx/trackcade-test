export interface VersusConfig<R, S> {
    /** How many attack units a resolved move sends. */
    attack: (result: R) => number;
    /** Materialise `units` of garbage on a board; returns the steps/journal it made. */
    receive: (board: unknown, units: number) => S;
    /** Cap on units delivered in one drop (Puyo's 5-row rock cap). Default Infinity. */
    maxPerDelivery?: number;
    /** `hold` keeps queued garbage until the sender stops clearing (Fever); `immediate`
     * drops it as soon as their chain ends (Tsu). Default `immediate`. */
    timing?: 'immediate' | 'hold';
}
export interface Duel<R, S> {
    /** Register a player's board handle. */
    addPlayer(id: string, board: unknown): void;
    /** A player resolved a move: compute attack, offset it against their OWN pending
     * incoming first, send the remainder to the opponent(s). Returns units sent. */
    send(id: string, result: R): number;
    /** Units currently queued to land on a player (the incoming meter for the HUD). */
    pending(id: string): number;
    /** Materialise the queued garbage on a player's board (call when it's safe). */
    deliver(id: string): S | null;
}
/** Create a 1-v-1 (or N-way) versus channel. Opponent = every other registered id. */
export declare function createVersus<R, S>(cfg: VersusConfig<R, S>): Duel<R, S>;
