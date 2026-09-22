/** Options for {@link envMap}. */
export interface EnvMapOptions {
    /** Canvas edge length in pixels (square). Default `64`. */
    size?: number;
    /** Sky colour at the top of the reflection. Default `'#7ec8ff'`. */
    sky?: string;
    /** Horizon band colour. Default `'#f5e9d0'`. */
    horizon?: string;
    /** Ground colour at the bottom. Default `'#4a3b2a'`. */
    ground?: string;
    /** Sun / key-light hotspot colour. `null` removes it. Default `'#ffffff'`. */
    sun?: string | null;
    /** Integer seed for the horizontal cloud/highlight streaks. Default `7`. */
    seed?: number;
}
/**
 * A spherical environment map — "the world reflected in a chrome ball" — for
 * fake-reflection sphere mapping on 3D materials (use the canvas as a texture,
 * e.g. register it with `game.assets.frames(...)`). Sky above,
 * ground below, a bright sun hotspot and horizontal streaks: the streaks are
 * what sells the fake chrome when it sweeps across a surface. Colour the world
 * to match your scene (night: dark sky, fire-orange sun).
 */
export declare function envMap(opts?: EnvMapOptions): HTMLCanvasElement;
/** Options for {@link noiseNormalMap} and {@link brickNormalMap}. */
export interface NormalMapOptions {
    /** Canvas edge length in pixels (square). Default `64`. */
    size?: number;
    /** Bump frequency for the noise map — lattice cells per tile edge. Default `5`. */
    scale?: number;
    /** Relief strength — slope steepness. `1` reads clearly; `2` is heavy relief. Default `1`. */
    strength?: number;
    /** Integer seed for deterministic patterns. Default `7`. */
    seed?: number;
}
/**
 * A tileable NOISE normal map — bumpy stone, hammered metal, rough plaster —
 * for use as a tangent-space normal-map texture on lit 3D materials.
 * Two octaves of wrapped value noise turned into surface slopes: the lighting
 * picks out per-pixel bumps that flat geometry can't show. `scale` sets bump
 * frequency, `strength` how deep the relief reads.
 */
export declare function noiseNormalMap(opts?: NormalMapOptions): HTMLCanvasElement;
/**
 * A brick-relief normal map matching `brickTile`'s layout (two offset courses
 * per tile) — the mortar joints read as real grooves under a moving light.
 * Use it WITH the color tile on the same material so relief and paint line up:
 * `{ texture: brickTile(), normalMap: brickNormalMap() }` (any sizes — both
 * stretch over the same UVs).
 */
export declare function brickNormalMap(opts?: NormalMapOptions): HTMLCanvasElement;
/** Options for {@link characterSheet}. */
export interface CharacterOptions {
    /** Frame size in pixels (square). Default `16`. */
    size?: number;
    /** Head and body fill colour. Default `'#ffd166'` (warm yellow). */
    body?: string;
    /** Eye and outline colour. Default `'#26233a'` (near-black). */
    outline?: string;
    /** Leg stroke colour. Default `'#c98aab'` (mauve). */
    leg?: string;
}
/**
 * 4-frame walking character sprite sheet — round-headed figure with swinging legs.
 * The figure **faces right** (a snout pokes past the head's leading edge and the eyes
 * sit on the front of the face), so mirroring it with `flip.x` visibly turns it to face left.
 * Returns a `(4 × size) × size` horizontal strip; use as a `SpriteSheet` with frame width = `size`.
 */
export declare function characterSheet(opts?: CharacterOptions): HTMLCanvasElement;
/** Options shared by all tile generators. */
export interface TileOptions {
    /** Tile edge length in pixels (square). Default `16`. */
    size?: number;
    /** Primary fill colour. */
    base?: string;
    /** Shadow / mortar / grain colour. */
    detail?: string;
    /** Highlight / accent colour. */
    accent?: string;
    /** Integer seed for deterministic random speckle patterns. */
    seed?: number;
}
/** Tileable two-tone checkerboard — THE classic retro-3D scrolling floor (and a fine 2D tile). `base`/`detail` set the two squares. */
export declare function checkerTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable brick wall — offset courses with mortar joints. Use for walls, platforms, dungeon floors. */
export declare function brickTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable grass — green base with scattered darker flecks and bright blade accents. Use for outdoor ground layers. */
export declare function grassTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable stone block — grey base with bevel edges and dark speckle cracks. Use for dungeon floors, cave walls. */
export declare function stoneTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable dirt / earth — brown base with randomised darker and lighter clods. Use for underground or farmland layers. */
export declare function dirtTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable water — blue base with sine-wave ripple rows that tile seamlessly. Use for lakes, rivers, ocean backgrounds. */
export declare function waterTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable sand / desert floor — warm beige with random grain speckles and faint dune ripple lines. */
export declare function sandTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable sci-fi metal panel — bevelled edges, inset panel recess, and corner bolts. Use for space stations, mechs, industrial levels. */
export declare function metalTile(opts?: TileOptions): HTMLCanvasElement;
/**
 * Thin wooden plank for one-way platforms — visible surface occupies the top ~30 % of the cell, transparent below.
 * The drawn surface aligns with a northward one-way collision line so the player stands exactly on the plank.
 * 2D platforms ONLY: the transparent 70 % makes 3D faces see-through — texture 3D wood with `woodTile` instead.
 */
export declare function plankTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable wooden crate — plank border with a diagonal brace and highlight. Use for breakable blocks, storage areas. */
export declare function crateTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable lava — dark crust with glowing diagonal crack veins and bright ember speckles. Use for hazard / damage zones. */
export declare function lavaTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable ice — pale blue with a corner sheen and seeded hairline cracks. Use for frozen / slippery surfaces. */
export declare function iceTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable snow — near-white with faint blue-grey flecks and a soft bottom shadow. Use for winter / arctic ground. */
export declare function snowTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable wood — horizontal plank seams with grain marks. Use for floors, bridges, cabin interiors. */
export declare function woodTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable cobblestone — four rounded stones with highlighted tops over dark mortar. Use for medieval roads, town squares. */
export declare function cobbleTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable gravel — grey base with randomised light and dark grain speckles. Use for paths, riverbanks. */
export declare function gravelTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable hedge / dense foliage — dark-green base with randomised light and dark leafy clumps. Use for maze walls, garden borders. */
export declare function hedgeTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable asphalt road / tarmac — dark grey with randomised grit speckles. Use for city streets, racing tracks. */
export declare function roadTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable circuit board — dark PCB substrate with crossing green traces and a solder pad. Use for sci-fi / cyber levels. */
export declare function circuitTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable mud — dark wet earth with elliptical puddle blobs and light grain speckles. Use for swamp, rain-soaked terrain. */
export declare function mudTile(opts?: TileOptions): HTMLCanvasElement;
/** Tileable marble — pale stone with two sine-wave grey vein lines that wrap seamlessly. Use for palace, temple, luxury interiors. */
export declare function marbleTile(opts?: TileOptions): HTMLCanvasElement;
/**
 * Pack equal-size tile canvases into a single horizontal strip image for use with `Tilemap`.
 * Tiles are indexed left-to-right starting at 0; pass the result as the tileset argument to `Tilemap`.
 * @param tiles Array of same-size tile canvases (e.g. from `grassTile`, `stoneTile`, etc.).
 * @returns A `(tileWidth × count) × tileHeight` canvas.
 */
export declare function tileset(tiles: HTMLCanvasElement[]): HTMLCanvasElement;
/** Options shared by all sprite generators. Single-frame sprites return a `size × size` canvas; animated sheets return a horizontal multi-frame strip. */
export interface SpriteOptions {
    /** Sprite size in pixels (square frame). Default `16`. */
    size?: number;
    /** Primary / body colour. */
    color?: string;
    /** Highlight / secondary colour. */
    accent?: string;
    /** Shadow / outline / detail colour. */
    detail?: string;
    /** Integer seed for sprites with randomised elements (e.g. `asteroid`, `building`). */
    seed?: number;
}
/**
 * Spinning gold coin — 4-frame animation strip (face → edge-on → face).
 * Use as a `SpriteSheet` for collectible coins, currency pickups.
 */
export declare function coinSheet(opts?: SpriteOptions): HTMLCanvasElement;
/** Faceted green gem — a single-frame collectible jewel with facet lines. Use for score pickups, RPG loot. */
export declare function gem(opts?: SpriteOptions): HTMLCanvasElement;
/** Brilliant-cut diamond — blue-white faceted gem. Use for rare collectibles, shop currency, puzzle gems. */
export declare function diamond(opts?: SpriteOptions): HTMLCanvasElement;
/** Five-point gold star — use for score pickups, ratings, achievement icons. */
export declare function star(opts?: SpriteOptions): HTMLCanvasElement;
/** Red heart — use for lives / health pickups, health HUD icons. */
export declare function heart(opts?: SpriteOptions): HTMLCanvasElement;
/** Gold key — bow + shaft + teeth. Use for door / chest unlock collectibles. */
export declare function key(opts?: SpriteOptions): HTMLCanvasElement;
/** Red apple with a brown stem and green leaf. Use for food pickups, health items, orchard collectibles. */
export declare function apple(opts?: SpriteOptions): HTMLCanvasElement;
/** Pair of red cherries on a forked green stem. Use for bonus pickups, fruit collectibles. */
export declare function cherry(opts?: SpriteOptions): HTMLCanvasElement;
/** Vertical sword pointing up — tapered blade, cross-guard, leather grip, round pommel. Use for melee weapon pickups. */
export declare function sword(opts?: SpriteOptions): HTMLCanvasElement;
/** Heater shield with a gold rim and cross emblem — use for defensive item pickups, knight / warrior characters. */
export declare function shield(opts?: SpriteOptions): HTMLCanvasElement;
/**
 * Side-view running person (player character) — 6-frame strip: frame 0 idle, frames 1–4 run cycle, frame 5 jump.
 * Use with `addAnim('run', t, [1,2,3,4])`. Default palette: red cap, blue trousers.
 */
export declare function personSheet(opts?: SpriteOptions): HTMLCanvasElement;
/** The Anthropic Claude mascot — clay-orange sunburst disc with a friendly face. */
export declare function claude(opts?: SpriteOptions): HTMLCanvasElement;
/** Pac-Man-style ghost — rounded top with a scalloped skirt and dot eyes. Use for enemy characters in maze or horror games. */
export declare function ghost(opts?: SpriteOptions): HTMLCanvasElement;
/** Green alien — rounded head with large almond eyes, antennae with bulb tips. Use for space / sci-fi enemy characters. */
export declare function alien(opts?: SpriteOptions): HTMLCanvasElement;
/** Slime blob enemy — rounded teardrop body with dot eyes. Use for basic enemy sprites in platformers or RPGs. */
export declare function slime(opts?: SpriteOptions): HTMLCanvasElement;
/** Blocky robot — rectangular head and body with glowing blue eyes and a centre antenna. Use for sci-fi enemies or NPCs. */
export declare function robot(opts?: SpriteOptions): HTMLCanvasElement;
/** Top-down arcade spaceship pointing up — swept hull, swept wings, cockpit dome, engine exhaust. Use for shoot-em-up player ships. */
export declare function spaceship(opts?: SpriteOptions): HTMLCanvasElement;
/** Side-view rocket pointing up — tapered body, delta fins, porthole, flame plume. Use for launch sequences, missile sprites. */
export declare function rocket(opts?: SpriteOptions): HTMLCanvasElement;
/** Side-view car — body, windscreen, headlight, two wheels with hub caps. Use for racing or driving games. */
export declare function car(opts?: SpriteOptions): HTMLCanvasElement;
/** Side-view lorry / truck — trailer box, cab with window, three wheels. Use for delivery or road obstacle sprites. */
export declare function truck(opts?: SpriteOptions): HTMLCanvasElement;
/** Sun with 8 radiating rays and a smiling face. Use for sky decoration, weather indicators. */
export declare function sun(opts?: SpriteOptions): HTMLCanvasElement;
/**
 * Animated wall torch — 3-frame flicker strip (flame sways left / centre / right).
 * Use as a `SpriteSheet` for dungeon, cave, or castle wall light sources.
 */
export declare function torchSheet(opts?: SpriteOptions): HTMLCanvasElement;
/** Round bomb with a curved lit fuse and glinting body. Use for throwable weapons, hazards, countdown objects. */
export declare function bomb(opts?: SpriteOptions): HTMLCanvasElement;
/** Round deciduous tree — brown trunk, dark green foliage cluster. Use for forest / outdoor scenery. */
export declare function tree(opts?: SpriteOptions): HTMLCanvasElement;
/** Fluffy white cloud — three overlapping circular puffs. Use for sky backgrounds, parallax layers, weather sprites. */
export declare function cloud(opts?: SpriteOptions): HTMLCanvasElement;
/** Orange citrus fruit with a highlight and green leaf. Use for food pickups, collectible items. */
export declare function orange(opts?: SpriteOptions): HTMLCanvasElement;
/** Yellow lemon with pointed nubs and a highlight. Use for food pickups, sour-themed collectibles. */
export declare function lemon(opts?: SpriteOptions): HTMLCanvasElement;
/** Purple bunch of grapes — three rows of berries narrowing to a point, stem and leaf. Use for fruit pickups, vineyard-themed games. */
export declare function grapes(opts?: SpriteOptions): HTMLCanvasElement;
/** Yellow banana — thick crescent arc with brown tip dots. Use for food pickups, jungle-themed collectibles. */
export declare function banana(opts?: SpriteOptions): HTMLCanvasElement;
/** Red strawberry with a star-shaped calyx and seed dots. Use for food pickups, garden or farming game collectibles. */
export declare function strawberry(opts?: SpriteOptions): HTMLCanvasElement;
/** Green pear — bulb body with narrow neck, brown stem, highlight. Use for food pickups, orchard collectibles. */
export declare function pear(opts?: SpriteOptions): HTMLCanvasElement;
/** Green watermelon with dark stripe arcs and a flesh-coloured sheen. Use for summer / tropical food pickups. */
export declare function watermelon(opts?: SpriteOptions): HTMLCanvasElement;
/** Peach / apricot with a vertical crease arc, highlight, and green leaf. Use for food pickups in orchard or farm games. */
export declare function peach(opts?: SpriteOptions): HTMLCanvasElement;
/** Purple plum — oval body with a crease arc and highlight. Use for food pickups, orchard collectibles. */
export declare function plum(opts?: SpriteOptions): HTMLCanvasElement;
/** Glossy oval ruby cabochon — red with a soft highlight. Use for rare gem pickups, RPG loot, score bonuses. */
export declare function ruby(opts?: SpriteOptions): HTMLCanvasElement;
/** Rectangular step-cut emerald with chamfered corners and inner facet lines. Use for green gem pickups, RPG loot. */
export declare function emerald(opts?: SpriteOptions): HTMLCanvasElement;
/** Round brilliant-cut sapphire — blue disc with 8 radiating facet spokes and a light table. Use for blue gem pickups, RPG loot. */
export declare function sapphire(opts?: SpriteOptions): HTMLCanvasElement;
/** Pointed-cut amethyst — purple pentagon shape with a bright crown facet. Use for purple gem pickups, magic items. */
export declare function amethyst(opts?: SpriteOptions): HTMLCanvasElement;
/** Gold ingot / gold bar — isometric parallelogram top face and trapezoid front. Use for treasure, currency, reward items. */
export declare function goldBar(opts?: SpriteOptions): HTMLCanvasElement;
/** Gold ring with a set diamond-shaped gem — use for RPG equippable accessories, loot, engagement / magic ring items. */
export declare function ring(opts?: SpriteOptions): HTMLCanvasElement;
/** Gold crown with three points and gem jewels — use for royalty, boss loot, leaderboard trophies. */
export declare function crown(opts?: SpriteOptions): HTMLCanvasElement;
/** Lustrous pearl — iridescent white sphere with a soft highlight. Use for rare collectibles, jewellery, ocean-themed loot. */
export declare function pearl(opts?: SpriteOptions): HTMLCanvasElement;
/** Flying saucer / UFO — metallic disc body with a glass dome and three under-lights. Use for alien invader, escort, or backdrop sprites. */
export declare function ufo(opts?: SpriteOptions): HTMLCanvasElement;
/** Planet with two equatorial band stripes and a polar highlight. Use for space backgrounds, level-select screens. */
export declare function planet(opts?: SpriteOptions): HTMLCanvasElement;
/** Saturn-style ringed planet — planet disc with a tilted elliptical ring drawn front and back. Use for space scenery, level-select worlds. */
export declare function ringedPlanet(opts?: SpriteOptions): HTMLCanvasElement;
/** Grey moon disc with four seeded craters. Use for space backgrounds, night-scene decoration. */
export declare function moon(opts?: SpriteOptions): HTMLCanvasElement;
/** Seeded irregular asteroid with two craters — shape varies per `seed`. Use for space obstacle sprites. */
export declare function asteroid(opts?: SpriteOptions): HTMLCanvasElement;
/** Space satellite — rectangular body flanked by two solar panels with grid lines and a dish antenna. Use for sci-fi / space scenery. */
export declare function satellite(opts?: SpriteOptions): HTMLCanvasElement;
/** Round potion flask with a corked neck and shine dot. Use for health / mana / buff pickups in RPG or adventure games. */
export declare function potion(opts?: SpriteOptions): HTMLCanvasElement;
/** Parchment scroll with rolled ends and ink text lines. Use for quest items, spell tomes, note pickups. */
export declare function scroll(opts?: SpriteOptions): HTMLCanvasElement;
/** Battle axe — wooden handle with a wedge blade head and edge highlight. Use for melee weapon pickups in RPG or action games. */
export declare function axe(opts?: SpriteOptions): HTMLCanvasElement;
/** Mage staff — wooden rod topped with a glowing orb. Use for magic weapon pickups, wizard character equipment. */
export declare function staff(opts?: SpriteOptions): HTMLCanvasElement;
/** Treasure chest — wooden body with gold bands and a lock. Use for loot containers, level-end rewards. */
export declare function chest(opts?: SpriteOptions): HTMLCanvasElement;
/** Skull and teeth — cranium, jaw, eye sockets, nose triangle, and tooth marks. Use for death / game-over icons, enemy indicators, horror themes. */
export declare function skull(opts?: SpriteOptions): HTMLCanvasElement;
/** Simple house — rectangular wall, triangular roof, door, and window. Use for town scenery, village-building games. */
export declare function house(opts?: SpriteOptions): HTMLCanvasElement;
/** City skyscraper / office building — tall block with a seeded random lit/unlit window grid. Use for urban backgrounds. */
export declare function building(opts?: SpriteOptions): HTMLCanvasElement;
/** Traffic light — dark box on a pole with red, amber, and green signal lenses. Use for city / road-crossing games. */
export declare function trafficLight(opts?: SpriteOptions): HTMLCanvasElement;
/** Arrow signpost on a pole pointing right. Use for navigation markers, level direction hints, town decorations. */
export declare function signpost(opts?: SpriteOptions): HTMLCanvasElement;
/** Street lamppost — curved arm with a glowing lamp head and hood. Use for city / street scenery in side-scrollers. */
export declare function lamppost(opts?: SpriteOptions): HTMLCanvasElement;
/** Red fire hydrant — dome top, side nozzles, base plate. Use for city / street scenery, obstacle sprites. */
export declare function hydrant(opts?: SpriteOptions): HTMLCanvasElement;
/** Crab-style space invader — oval body with side claws, three bottom legs, and dot eyes. Use for shoot-em-up enemy sprites. */
export declare function crabAlien(opts?: SpriteOptions): HTMLCanvasElement;
/** Squid / octopus alien — domed head, four tentacle pairs, round eyes. Use for shoot-em-up invader enemies. */
export declare function squidAlien(opts?: SpriteOptions): HTMLCanvasElement;
/** Enemy interceptor fighter pointing down — swept wings, narrow fuselage, red cockpit. Use for shoot-em-up diving enemy ships. */
export declare function interceptor(opts?: SpriteOptions): HTMLCanvasElement;
/** Bulky enemy bomber — wide oval hull with engine pods and glowing exhausts. Use for heavy shoot-em-up enemies. */
export declare function bomber(opts?: SpriteOptions): HTMLCanvasElement;
/** Spiky space mine — eight spike protrusions around a dark body with a red blink light. Use for hazard / obstacle sprites in space games. */
export declare function mine(opts?: SpriteOptions): HTMLCanvasElement;
/** Six-petal flower on a stem with a leaf. Use for garden, meadow, or pickup-collectible decoration. */
export declare function flower(opts?: SpriteOptions): HTMLCanvasElement;
/** Tulip flower on a stem with a side leaf — cup of three petals. Use for spring / garden scenery. */
export declare function tulip(opts?: SpriteOptions): HTMLCanvasElement;
/** Sunflower — 10 yellow petals around a dark brown seed head, on a stem. Use for field / garden scenery or collectibles. */
export declare function sunflower(opts?: SpriteOptions): HTMLCanvasElement;
/** Red mushroom with white spots and a pale stem. Use for forest scenery, Mario-style powerup or hazard sprites. */
export declare function mushroom(opts?: SpriteOptions): HTMLCanvasElement;
/** Green cactus — round-capped body with two upward arms and spine flecks. Use for desert / western scenery or obstacles. */
export declare function cactus(opts?: SpriteOptions): HTMLCanvasElement;
/** Rounded bush — four overlapping green circles with a sheen highlight and shadow base. Use for outdoor scenery, platformer decoration. */
export declare function bush(opts?: SpriteOptions): HTMLCanvasElement;
/** Pine / fir tree — three stacked triangular tiers over a brown trunk. Use for forest, mountain, or Christmas scenery. */
export declare function pineTree(opts?: SpriteOptions): HTMLCanvasElement;
/** Grey rock / boulder — irregular polygon with a light top facet. Use for outdoor obstacles, cave scenery, breakable blocks. */
export declare function rock(opts?: SpriteOptions): HTMLCanvasElement;
/** Wizard — pointed hat with a star, long beard, and eyes. Use for mage NPC, player class sprite. */
export declare function wizard(opts?: SpriteOptions): HTMLCanvasElement;
/** Bat — dark body with pointed ears, scalloped wings, and glowing eyes. Use for cave enemies, Halloween-themed sprites. */
export declare function bat(opts?: SpriteOptions): HTMLCanvasElement;
/** Floating eyeball — sclera with vein lines, iris, pupil, and glint. Use for horror enemy, floating eye monster. */
export declare function eyeball(opts?: SpriteOptions): HTMLCanvasElement;
/** Human nose with nostrils and a tip shade. Use for face-builder UIs, character customisation. */
export declare function nose(opts?: SpriteOptions): HTMLCanvasElement;
/** Green frog — oval body, bulging eye bumps, wide grin. Use for swamp / pond enemy or animal sprites. */
export declare function frog(opts?: SpriteOptions): HTMLCanvasElement;
/** Carved Halloween pumpkin — orange body with rib arcs, green stem, and triangle eyes + jagged mouth. Use for Halloween themes, seasonal decoration. */
export declare function pumpkin(opts?: SpriteOptions): HTMLCanvasElement;
/** Snail — coiled shell with swirl arcs, green body / foot, eye stalks. Use for garden / slow enemy sprites. */
export declare function snail(opts?: SpriteOptions): HTMLCanvasElement;
