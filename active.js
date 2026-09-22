import { FALLBACK_TRACK } from '../track.config.js';
// eslint-disable-next-line prefer-const
export let TRACK = FALLBACK_TRACK;
/** Where the active track came from (for HUD tags and debugging). */
export let TRACK_ORIGIN = { source: 'builtin' };
/** Install the resolved track. Called once by the Boot scene. */
export function setActiveTrack(cfg, origin) {
    TRACK = cfg;
    TRACK_ORIGIN = origin;
}
