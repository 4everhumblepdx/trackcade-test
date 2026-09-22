// Docs: engine/webgpu/ui.md — usage, recipes & traps (this file = exact type signatures)
import type { MsdfFont } from './msdf-font.js';
import type { UiStyle } from './ui-style.js';
/**
 * Is every character in `str` one the LATIN text paths can actually render?
 *
 * The MSDF atlas and the bitmap font both bake a fixed Latin charset and lay
 * glyphs out left-to-right with no shaping or bidi — CJK comes out blank and
 * Arabic comes out reversed and unjoined (see msdf.md). Anything past Latin
 * Extended-B has to go through UnicodeText instead, and a WIDGET label is
 * exactly the place a game will hand us '开始' or 'ابدأ' without thinking about
 * it. So the widget layer decides per string rather than making the game pick.
 */
export declare function isLatinText(str: string): boolean;
/** What the widget layer needs from the input service (structural, so `Input`
 *  satisfies it without this module importing it). */
/** Horizontal alignment for any text a widget draws. */
export type TextAlign = 'left' | 'center' | 'right';
/**
 * What a container does when its content is taller than it is — CSS's
 * `overflow`, with the same names and the same meanings.
 *
 * - `'auto'` (default) — clip, scroll, and show the scrollbar only when there
 *   IS something to scroll.
 * - `'scroll'` — clip and scroll, with the scrollbar always visible, so a
 *   layout does not reflow the moment content grows.
 * - `'hidden'` — clip, but no scrolling and no bar.
 * - `'visible'` — no clipping at all: content spills out of the box. Matches
 *   CSS, and is just as much of a footgun here.
 */
export type Overflow = 'auto' | 'scroll' | 'hidden' | 'visible';
export interface UiInputSource {
    onText(handler: (char: string) => void): () => void;
    key(...codes: string[]): boolean;
    keyPressed(...codes: string[]): boolean;
    /** Wheel movement this frame in pixels — what scrolling regions ride on. */
    readonly wheelDelta: number;
}
/**
 * The look of every widget at once. Each entry is a {@link UiStyle} (or the name
 * of one), so retheming a whole game's UI is one object — which is exactly the
 * granularity someone means by "make the UI look like X".
 */
export interface UiTheme {
    /** Buttons, and the pressable rows of a list. */
    button?: string | UiStyle;
    /** Frames, dialogs, windows — the things other widgets sit on. */
    window?: string | UiStyle;
    /**
     * A container's TITLE BAR, and standalone section headings. Deliberately a
     * slot of its own and deliberately NOT interactive: a heading that hovers and
     * depresses reads as a button you can press, which is a lie. It should not
     * LOOK like one either — no rim, no gloss, set into the surface rather than
     * raised off it.
     */
    header?: string | UiStyle;
    /** The accent rule along the bottom of a header — the bit that reads as
     *  "heading" rather than "another panel". Set `null`-ish (alpha 0) to drop it. */
    headerRule?: string | UiStyle;
    /** Title-bar text colour. Defaults to `text`; a theme with a strongly
     *  coloured caption bar needs its own (white on navy, say). */
    headerText?: string;
    /**
     * Does a container's title bar take its colour from the container it sits in?
     * True for themes derived from ONE base colour, where a header that ignored
     * its host would be the one thing that did not match. False when the caption
     * is deliberately FIXED — a desktop-style title bar is the same colour
     * whatever window it captions, and that consistency is the look. Default true.
     */
    headerInherit?: boolean;
    /** The position indicator down the edge of a scrolling region. */
    scrollbar?: string | UiStyle;
    /** Sunken parts: slider tracks, progress backgrounds, checkbox wells, text fields. */
    track?: string | UiStyle;
    /** The moving/filled part: slider fill, progress fill, toggle "on" body. */
    fill?: string | UiStyle;
    /** Knobs and handles. */
    knob?: string | UiStyle;
    /** The checkmark strokes inside a ticked checkbox. */
    tick?: string | UiStyle;
    /** Label colour. */
    text?: string;
    /** Secondary/placeholder colour. */
    textMuted?: string;
    /** Label size in surface units. */
    fontSize?: number;
    /** Default control height (checkbox box, slider track, toggle). */
    size?: number;
    /** Space between a control and its label. */
    gap?: number;
    /** Inner padding for text inside a control. */
    pad?: number;
    /** Scrollbar thickness. Its GRAB area is wider than it draws, but a bar you
     *  can barely see is a bar you will not aim at, so this is not tiny. */
    scrollbarSize?: number;
}
/** Options a built-in theme is generated FROM — the knobs an agent should reach
 *  for before it starts hand-writing styles. */
export interface UiThemeOptions {
    /** The base colour the whole theme is derived from. Every built-in theme
     *  builds its buttons, fills, ticks and accents out of this one value. */
    color?: string;
    /** Label colour (default: white for `casual`, a soft grey for `compact`,
     *  black for `sharp`, which is a light theme). */
    text?: string;
    /** Base label size, in the surface's units. */
    fontSize?: number;
}
/**
 * The built-in themes, each generated from ONE base colour.
 *
 * - **`casual`** (the default) — the bright, chunky, high-contrast look: fat
 *   rims, gradients, gloss, rounded everything. Arcade, puzzle, match-3, hyper-
 *   casual, kids' games.
 * - **`compact`** — small, flat and quiet: 1px rims, tight radii, no gloss, the
 *   base colour used only as an accent. Strategy, sim, editors, tools, anything
 *   with a lot of controls on screen at once.
 * - **`sharp`** — the 90s desktop: square corners, hard 2px rims, flat grey
 *   faces, no curve or gloss anywhere. The only LIGHT theme of the three.
 *   Retro, hacker/terminal, tycoon and management games, in-fiction computers.
 */
export declare const UI_THEMES: Record<string, (o: UiThemeOptions) => Required<UiTheme>>;
/** Generate a built-in theme. An unknown name falls back to `casual`. */
export declare function buildUiTheme(name: string, opts?: UiThemeOptions): Required<UiTheme>;
/**
 * The widget layer bound to ONE draw surface. Reach it as `d.ui` — world space
 * on `game.draw`, screen pixels on `game.hud`; never construct one.
 */
export declare class Ui {
    private d;
    private deps;
    /**
     * Raise everything `body` draws onto the next LAYER — panels, their labels and
     * their MSDF text together — so it stacks wholly above what is already on
     * screen. This is what makes a modal a modal:
     *
     * ```ts
     * d.panel(20, 20, 400, 300, 'panel');          // a page, with text on it
     * d.ui.label(40, 40, 'lots of body copy…');
     *
     * if (confirming) d.ui.modal(() => {           // …and a dialog OVER it
     *   d.panel(140, 120, 300, 140, 'glossy');
     *   d.ui.label(290, 150, 'Delete the save?', { align: 'center' });
     *   if (d.ui.button(170, 200, 110, 34, 'Delete')) doIt();
     *   if (d.ui.button(300, 200, 110, 34, 'Cancel')) confirming = false;
     * });
     * ```
     *
     * No stencils, no second surface, no ordering rules for the game to learn —
     * the dialog is simply on a layer above the page. Layers nest: a modal opened
     * inside a modal claims the one above its parent.
     *
     * {@link window} does this for you when you give it a `body`, so reach for
     * `modal` only when you are building the frame yourself. Whatever `body`
     * returns comes straight back, so a dialog can report what the user chose.
     */
    modal<T>(body: () => T): T;
    /** The look of every widget. Mutate a field, or replace it via `setTheme`. */
    theme: Required<UiTheme>;
    /** Was the widget drawn by the LAST call hovered? (For tooltips and cursors.) */
    hovered: boolean;
    private font;
    private blocks;
    /** Non-Latin labels, cached the same way — see {@link isLatinText}. */
    private uniBlocks;
    private memory;
    private seq;
    private frameNo;
    private lastTime;
    private dt;
    /** The focused text field's id, or null. */
    private focus;
    /** The open dropdown's id, or null — only ever one at a time. */
    private open;
    /** Deferred draws (an open dropdown's popup) flushed at END of frame, so the
     *  list paints OVER whatever was drawn after the select itself. */
    private overlays;
    /** Characters typed since the last frame, waiting for the focused field. */
    private typed;
    private unsubscribe;
    /** Key-repeat clock for Backspace / arrows (the browser's repeat doesn't
     *  reach `keyPressed`, which deliberately ignores auto-repeat). */
    private repeatKey;
    private repeatLeft;
    /** Last pointer Y per drag-scrolling region, so a drag moves by the delta. */
    private dragY;
    /**
     * Use a crisp MSDF font for every label (recommended — labels then stay sharp
     * at any scale). Without one the widgets bake a plain system font on first
     * use, so they work with zero setup.
     */
    setFont(font: MsdfFont | null): this;
    /**
     * Can the CURRENT font draw every character of `str`?
     *
     * This asks the font, not a codepoint range, and the difference is the whole
     * reason the hosted atlases carry typographic punctuation: an em dash is far
     * outside Latin, but if the atlas HAS it the string should stay on the crisp
     * distance-field path. A range test would have sent it to the bitmap path
     * forever, however good the font was. Falls back to {@link isLatinText} when
     * there is no MSDF font, since the bitmap fallback really is Latin-only.
     */
    private canRender;
    /** The retained UNICODE block for a non-Latin label (cached like the MSDF
     *  ones — an immediate-mode label must not re-rasterize every frame). */
    private uniBlock;
    /** The laid-out size of a string, honouring wrap — what a bounded text
     *  container needs in order to know how far it scrolls. */
    textSize(str: string, opts?: {
        size?: number;
        wrap?: number;
        align?: TextAlign;
    }): {
        w: number;
        h: number;
    };
    /**
     * Set the look of every widget. Two forms:
     *
     * - **A built-in theme by NAME, generated from one base colour** — the first
     *   thing to reach for, and usually the only styling a game needs:
     *   `ui.setTheme('casual', { color: '#7ac74f' })`,
     *   `ui.setTheme('compact', { color: '#4d9cb5' })`,
     *   `ui.setTheme('sharp', { color: '#000080' })`.
     *   This REPLACES the theme wholesale.
     * - **A partial object**, which MERGES into the current theme:
     *   `ui.setTheme({ fontSize: 20 })`.
     *
     * Either way the theme is PERSISTENT surface state, not per-frame: it stays
     * until changed again.
     */
    setTheme(theme: string | UiTheme, opts?: UiThemeOptions): this;
    /** Back to the default look (`casual`). Because `setTheme` persists, a screen
     *  that themes part of itself should reset first rather than inherit whatever
     *  the last screen (or the last frame) left behind. */
    resetTheme(): this;
    private id;
    private mem;
    /** Width of `str` at `size`, in surface units — for laying widgets out. */
    measure(str: string, size?: number): number;
    private block;
    /** A line of text with its LEFT edge at `x` and its baseline box top at `y`. */
    label(x: number, y: number, str: string, opts?: {
        size?: number;
        color?: string;
        align?: TextAlign;
        /**
         * Word-wrap width. With it, `x` is the LEFT edge of the wrap box and
         * `align` positions each line inside that box — the bounded text
         * container. Without it, `align` positions the single line about `x`.
         */
        wrap?: number;
        bold?: boolean;
    }): void;
    /** Centre a label in a rect — the layout every widget wants. */
    private labelIn;
    /**
     * A push button. Returns TRUE on the frame it is clicked (press and release
     * both on the button), so the whole thing is one `if`:
     * ```ts
     * if (d.ui.button(x, y, 180, 52, 'Start')) startGame();
     * ```
     */
    button(x: number, y: number, w: number, h: number, label: string, opts?: {
        style?: string | UiStyle;
        size?: number;
        color?: string;
        id?: string | number;
        disabled?: boolean;
    }): boolean;
    /**
     * A labelled checkbox. The game owns the value — pass it in, store what comes
     * back: `sound = d.ui.checkbox(x, y, 'Sound', sound);`
     * The whole row (box + label) is clickable.
     */
    checkbox(x: number, y: number, label: string, checked: boolean, opts?: {
        size?: number;
        fontSize?: number;
        id?: string | number;
    }): boolean;
    /**
     * An on/off switch — the same value contract as {@link checkbox}, with the
     * knob sliding between the ends.
     */
    toggle(x: number, y: number, on: boolean, opts?: {
        w?: number;
        h?: number;
        id?: string | number;
    }): boolean;
    /**
     * A horizontal slider. Returns the value, so it reads as an assignment:
     * `volume = d.ui.slider(x, y, 240, volume);`
     * Dragging keeps tracking after the pointer leaves the track.
     */
    slider(x: number, y: number, w: number, value: number, opts?: {
        min?: number;
        max?: number;
        step?: number;
        h?: number;
        id?: string | number;
    }): number;
    /** A read-only bar: `frac` is 0..1. Health, XP, loading, cooldowns. */
    progress(x: number, y: number, w: number, h: number, frac: number, opts?: {
        fill?: string | UiStyle;
        track?: string | UiStyle;
        label?: string;
    }): void;
    /**
     * A frame to sit other widgets on, with an optional title bar. Returns the
     * INNER rect, so the contents lay out against it rather than magic numbers.
     */
    window(x: number, y: number, w: number, h: number | 'auto', title?: string, opts?: {
        style?: string | UiStyle;
        pad?: number;
        /**
         * Draw the contents here and the window SIZES ITSELF TO THEM, with the
         * padding guaranteed on every side — including the bottom, which is the
         * one a hand-written height always gets wrong. Required when `h` is
         * `'auto'`; with a fixed `h` it just measures for the returned rect.
         *
         * ```ts
         * ui.window(x, y, 320, 'auto', 'Settings', { body: (r) => {
         *   sound = ui.checkbox(r.x, r.y, 'Sound', sound);
         * }});
         * ```
         */
        body?: (inner: {
            x: number;
            y: number;
            w: number;
            h: number;
        }) => void;
    }): {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /**
     * A SINGLE-LINE text field — HTML's `<input type="text">`. The game owns the
     * string: `name = d.ui.input(x, y, 240, 40, name);`
     *
     * It never wraps: overflow scrolls horizontally to keep the caret in view.
     * For a paragraph that wraps inside its box, use {@link textarea}.
     *
     * Click to focus (click away, or Enter/Escape, to blur). Typing, Backspace,
     * Delete, arrows and Home/End all work; there is no selection or clipboard.
     */
    input(x: number, y: number, w: number, h: number, value: string, opts?: {
        placeholder?: string;
        max?: number;
        size?: number;
        align?: TextAlign;
        id?: string | number;
    }): string;
    /**
     * A MULTI-LINE text box — HTML's `<textarea>`. Word-wraps to its own width,
     * aligns, scrolls when the content outgrows the box, and is clipped to its
     * bounds so nothing spills:
     * `notes = d.ui.textarea(x, y, 320, 160, notes);`
     *
     * Enter inserts a newline here (it does NOT blur — Escape does, or a click
     * away). Wheel or drag to scroll when it overflows.
     */
    textarea(x: number, y: number, w: number, h: number, value: string, opts?: {
        placeholder?: string;
        max?: number;
        size?: number;
        align?: TextAlign;
        /** Read-only: still scrolls and takes focus, but never edits. */
        readOnly?: boolean;
        /** What to do when the text outgrows the box (default `'auto'`). */
        overflow?: Overflow;
        id?: string | number;
    }): string;
    /**
     * One option of a radio GROUP — HTML's `<input type="radio">`. Pass the
     * group's current value and this option's own value; the call returns the
     * value the group should now hold, so a group is one line per option:
     * ```ts
     * for (const o of OPTIONS) mode = d.ui.radio(x, y += 28, o, mode, o);
     * ```
     */
    radio<T>(x: number, y: number, label: string, group: T, value: T, opts?: {
        size?: number;
        fontSize?: number;
        id?: string | number;
    }): T;
    /**
     * A heading bar — a container's title, or a section divider in a form. Inert
     * by design: it does not hover, press or report clicks, because it is a
     * LABEL on a surface, not a control. {@link window} draws its title with
     * this, so retheming `header` retitles every container at once.
     */
    header(x: number, y: number, w: number, h: number, text: string, opts?: {
        size?: number;
        color?: string;
        align?: TextAlign;
        bold?: boolean;
        /**
         * The container this heading is cut into. Its colour and corner radius
         * are INHERITED, so a retheme that changes only `window` still gets a
         * matching header — a heading belongs to its panel, not to the theme.
         */
        inside?: string | UiStyle;
    }): void;
    /**
     * A scrolling region. Everything the callback draws is clipped to the box and
     * shifted by the scroll offset; rows scrolled out of view are neither drawn
     * nor clickable. `contentHeight` is how tall the content is in total.
     *
     * ```ts
     * d.ui.list(x, y, 260, 200, items.length * 32, (lx, ly, lw) => {
     *   items.forEach((it, i) => { if (d.ui.button(lx, ly + i * 32, lw, 28, it)) pick(it); });
     * });
     * ```
     */
    list(x: number, y: number, w: number, h: number, contentHeight: number, body: (x: number, y: number, w: number) => void, opts?: {
        style?: string | UiStyle;
        pad?: number;
        overflow?: Overflow;
        id?: string | number;
    }): void;
    /**
     * A dropdown — HTML's `<select>`. Shows the current value; click to drop a
     * scrolling list of options over everything else, click one to choose it.
     * Same value contract as the rest: pass the value, store what comes back.
     *
     * ```ts
     * quality = d.ui.select(x, y, 200, 32, quality, ['Low', 'Medium', 'High']);
     * ```
     *
     * The popup is deferred to the end of the frame, so it paints over widgets
     * drawn after this one, and it is clipped and scrolled like any other list.
     */
    select<T>(x: number, y: number, w: number, h: number, value: T, options: readonly T[], opts?: {
        /** How to label an option (default: `String(option)`). */
        label?: (option: T) => string;
        /** Tallest the dropped list may get before it scrolls. Default 220. */
        maxHeight?: number;
        size?: number;
        id?: string | number;
    }): T;
    private pointerInRect;
    /**
     * A line stroke from (ax, ay) to (bx, by) as a capsule panel.
     *
     * Icon strokes have to be built from their ENDPOINTS, not by laying panels
     * side by side and rotating them: a panel rotates about its own centre, which
     * shortens its horizontal reach, so two 'adjacent' arms end up separated by
     * the projection they each lost. Everything drawn as line art here — the
     * checkbox tick, the select chevron — goes through this.
     */
    private stroke;
    /** Focus/blur bookkeeping shared by `input` and `textarea`. Returns whether
     *  THIS field holds focus after the click is accounted for. */
    private focusField;
    /** Apply this frame's typing and edit keys to `text`, returning the new value.
     *  `multiline` decides whether Enter inserts a newline or blurs. */
    private editText;
    /**
     * Advance a scroll offset from the wheel, from dragging the CONTENT, and from
     * dragging the SCROLLBAR — which move in opposite directions, and both feel
     * right that way:
     *
     * - dragging the content is touch-style, the content follows the finger, so
     *   pulling DOWN reveals what is ABOVE;
     * - dragging the bar is absolute, the thumb follows the pointer, so pulling
     *   DOWN reveals what is BELOW.
     *
     * They are separate hit regions (the content's stops short of the bar's
     * gutter), so one drag never drives both.
     */
    private scrollBy;
    /** The thin position indicator down the right edge of a scrolling box. */
    private scrollbar;
}
