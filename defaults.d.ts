// Docs: engine/webgpu/scenes.md — usage, recipes & traps (this file = exact type signatures)
import { Scene } from './scene.js';
import type { Draw } from './draw.js';
/** Fallback title: "PRESS SPACE TO START" → 'play'. Register your own `title` to replace. */
export declare class DefaultTitle extends Scene {
    private font;
    setup(): void;
    update(dt: number): void;
    drawHud(d: Draw): void;
}
/** Fallback game-over: "YOU WIN!" / "GAME OVER" (from `{ win }` in the payload) → 'title'. */
export declare class DefaultGameOver extends Scene {
    private font;
    private won;
    setup(data?: unknown): void;
    update(dt: number): void;
    drawHud(d: Draw): void;
}
