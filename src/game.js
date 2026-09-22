// Game boot — the scene roster + Game.create + run(), and nothing else.
//
// The roster leads with Boot (registered as `intro`, so it runs first): it
// resolves the `?track=` manifest URL — fetching, validating and installing
// the Trackcade release — before Title/Play ever see the track config. With
// no parameter the built-in fallback track plays.
import { Game } from '../engine/webgpu.js';
import { GAME_OPTIONS } from './config.js';
import { Boot } from './scenes/boot.js';
import { Title } from './scenes/title.js';
import { Play } from './scenes/play.js';
import { GameOver } from './scenes/gameover.js';
import { trackParamFrom } from './track/loader.js';
// Game.create is async (it acquires the GPU device — WebGPU, or the built-in
// WebGL2 fallback where WebGPU is absent), so the boot is a top-level await.
// Boot order: the first registered of intro → title → play. Move between
// screens with this.gotoTitle() / gotoPlay() / gotoGameOver(result).
//
// The Boot scene (the Trackcade manifest loader) only joins the roster when a
// `?track=` URL is present — with no parameter the game boots straight to the
// title on the built-in fallback track, exactly as before.
const hasManifest = trackParamFrom(globalThis.location ?? { search: '' }) !== null;
const game = await Game.create({
    ...GAME_OPTIONS,
    scenes: hasManifest
        ? { intro: Boot, title: Title, play: Play, gameOver: GameOver }
        : { title: Title, play: Play, gameOver: GameOver },
});
game.run();
