'use strict';

// HOMEHUB DRAGON – Block 1: DATA / CONFIG
// ── Konstanten, Paletten, Sprite-Daten, Tilemaps ──
// ════════════════════════════════════════════

// Farben für Pixel-Sprites
const PIXEL_COLORS = {
  '.': 'transparent',
  'K': '#0b0b0f',
  'D': '#134d2d',
  'G': '#1f8a43',
  'L': '#63d47c',
  'H': '#a4ffb7',
  'Y': '#f5c84c',
  'O': '#d79a18',
  'B': '#8a5a30',
  'M': '#a77446',
  'S': '#c8b38a',
  'R': '#6f4725'
};

// ════════════════════════════════════════════
// HOMEHUB DRAGON – Pixel-Sprite Datenstruktur
// ════════════════════════════════════════════
//
// Format: DRAGON_PIXEL_SPRITES[key] = { frames: [ [32 Zeilen], ... ], w, h }
//
// Mehrere Frames ermöglichen spätere Animation:
//   frames[0] = dragon_egg_1 (Ruhezustand)
//   frames[1] = dragon_egg_2 (leichtes Wackeln)
//   frames[2] = dragon_egg_3 (stärkeres Wackeln)
//
// Aktuell: je 1 Frame pro Stufe.
// Animation: Frames werden später per drawDragonScene() getaktet.
//
// Zielgrößen in der 96×96 Scene (Pixel-Einheiten, unscaled):
//   dragon_egg:        24×24
//   dragon_hatchling:  28×28
//   dragon_young:      32×32
//   dragon_adult:      40×40
//   dragon_guardian:   48×48
//   dragon_legendary:  56×56
//
// Neue Stufe hinzufügen:
//   1. Eintrag in DRAGON_PIXEL_SPRITES anlegen (w, h, frames)
//   2. validatePixelSprite() prüft automatisch w×h je Frame
//   3. In DRAGON_STAGES sprite-Feld auf den neuen Key setzen
//   4. drawDragonScene() zentriert das Sprite automatisch

// Sprite-Größen pro Entwicklungsstufe (für Fallback-Renderer)
const DRAGON_SPRITE_SIZES = {
  dragon_egg:       { w: 24, h: 24 },
  dragon_hatchling: { w: 28, h: 28 },
  dragon_young:     { w: 32, h: 32 },
  dragon_adult:     { w: 40, h: 40 },
  dragon_guardian:  { w: 48, h: 48 },
  dragon_legendary: { w: 56, h: 56 },
};

// ── HOMEHUB DRAGON – Futter-Pixel-Sprites ──────────────────────────────────
// Vorbereitet für spätere Raster-Sprites analog zu DRAGON_PIXEL_SPRITES.
// Aktuell: frames[0] = null → Fallback auf DRAGON_SPRITES base64-img.
// Eigene 16×16-Raster hier eintragen:
//   frames: [ [ '...16 Zeichen...', ... 16 Zeilen ] ]

// Futter-Pixel-Sprites (frames-Struktur, 16×16)
const FOOD_PIXEL_SPRITES = {
  rat:         { w:16, h:16, frames:[ null ] },  // TODO: Raster eintragen
  chicken:     { w:16, h:16, frames:[ null ] },
  boar:        { w:16, h:16, frames:[ null ] },
  adventurer:  { w:16, h:16, frames:[ null ] },
  knight:      { w:16, h:16, frames:[ null ] },
  dragonheart: { w:16, h:16, frames:[ null ] },  // Schlüssel = 'heart' in DRAGON_FOOD
};

/**
 * drawFoodSprite(foodKey, container)
 *
 * Zeichnet ein Futter-Sprite in container.
 * Wenn FOOD_PIXEL_SPRITES[foodKey].frames[0] ein Array ist → Canvas-Render.
 * Sonst → <img> mit DRAGON_SPRITES['food_'+foodKey] als Fallback.
 *
 * @param {string}      foodKey    - Schlüssel in FOOD_PIXEL_SPRITES / DRAGON_FOOD
 * @param {HTMLElement} container  - Ziel-Element (wird mit Canvas oder img befüllt)
 */

// Drachen-Pixel-Sprites (Raster-Definitionen, frames-Struktur)
const DRAGON_PIXEL_SPRITES = {
  dragon_egg: {
    w: 24, h: 24,
    // frames[0] = Ruhezustand – Ei mit Nest (hinten + vorne integriert)
    // frames[1], frames[2] = spätere Animationsframes (noch nicht implementiert)
    frames: [
      [
        '........................',
        '........................',
        '........................',
        '..........DDDD..........',
        '.........DDGGDD.........',
        '........DDGGGGDD........',
        '.......DHLGGGGGDD.......',
        '.......DDLGGGGGDD.......',
        '......DDLGGGGYGGDD......',
        '......DDGGGGGYOGDD......',
        '......DDGGGGGGGKDD......',
        '......DDGGGGGGGDDD......',
        '......DDGGGGGOYGDD......',
        '.......DDGGGYGGDD.......',
        '.....BMBDGGGGGGDD.......',
        '....RBMSDDGYGGDD.SMBR...',
        '....RMBSBDDGGDD.BSBMR...',
        '....RBMBSMDBMB.MSBMBR...',
        '...RBMSBMBSBMBMMSBMBR...',
        '...RBMSMMMMMMSMMMMMBR...',
        '...RBMMMBMMMBMMMMMMBR...',
        '...RBMMSMMMMMMMSMMMBR...',
        '...RBMMMMMSMMMBMMMMBR...',
        '...RBMMMMMMMMMMMMMMBR...'
      ]
      // Weitere Frames später:
      // [ /* dragon_egg Frame 2 – leichtes Wackeln */ ],
      // [ /* dragon_egg Frame 3 – stärkeres Wackeln */ ],
    ]
  }
  // Weitere Stufen später:
  // dragon_hatchling: { w:28, h:28, frames:[ [...] ] },
  // dragon_young:     { w:32, h:32, frames:[ [...] ] },
  // dragon_adult:     { w:40, h:40, frames:[ [...] ] },
  // dragon_guardian:  { w:48, h:48, frames:[ [...] ] },
  // dragon_legendary: { w:56, h:56, frames:[ [...] ] },
};

/**
 * validatePixelSprite(spriteKey)
 *
 * Prüft ob ein Sprite korrekt definiert ist:
 *   - Sprite existiert in DRAGON_PIXEL_SPRITES
 *   - Hat .w, .h und .frames[] (mind. 1 Frame)
 *   - Jeder Frame: genau h Zeilen, jede Zeile genau w Zeichen
 *   - Nur erlaubte Zeichen aus PIXEL_COLORS
 *
 * Gibt { valid: true } oder { valid: false, errors: [...] } zurück.
 * Gibt bei Fehlern console.warn() aus, wirft keine Exception.
 */

// Cave: Farb-Palette (8-Bit-artige Höhlenfarben)
const CAVE_TILE_COLORS = {
  '.': 'transparent',
  'K': '#05070d', '0': '#0b0d16', '1': '#171221', '2': '#241b33', '3': '#33213a',
  'R': '#24140b', 'r': '#3a2110', 'B': '#6a4724', 'M': '#4a2f19',
  'S': '#b9aa88', 's': '#8f8777',
  'C': '#78dff2', 'c': '#b8f5ff', 'H': '#ffffff',
  'T': '#7a3f16', 'F': '#ff8a1d', 'O': '#ffd75a', 'f': '#b73712',
  'G': '#3f7a3a', 'g': '#245124',
  'W': '#d8d8d8', 'w': '#8a8a8a',
  'P': '#5b3b68', 'p': '#3a2444',
};

// ── Basis-Tiles 8×8 (Hintergrund) ──

// Cave: Basis-Tiles 8×8
const CAVE_TILES = {

  // Tiefes Dunkel – Deckenzone, sehr dunkel
  wall_dark: { w:8, h:8, rows: [
    'KKKKKKKK',
    'K0K000KK',
    'K000000K',
    '00K00000',
    '000000K0',
    '0K000000',
    '00000K00',
    'K00000KK',
  ]},

  // Mittlere Wand – Felsstruktur, dunkle Töne
  wall_mid: { w:8, h:8, rows: [
    '00000000',
    '01100000',
    '01110010',
    '00111100',
    '01111100',
    '00011100',
    '00001100',
    '00000010',
  ]},

  // Wandschatten – fast schwarz, locker gestreut
  wall_shadow: { w:8, h:8, rows: [
    'K0000000',
    '000K0000',
    '0000000K',
    '00K00000',
    '0000K000',
    'K0000000',
    '000000K0',
    '0000K000',
  ]},

  // Übergang links – links hoch, Mitte abfallend
  wall_low: { w:8, h:8, rows: [
    '00000000',
    '01000000',
    '11100000',
    '1111r000',
    '111rrr00',
    '11rrrrrr',
    '1rrrrrrr',
    'rrrrrrrr',
  ]},

  // Übergang rechts – rechts hoch, versetzt
  wall_low_r: { w:8, h:8, rows: [
    '00000000',
    '00000010',
    '00001100',
    '0001rrr0',
    '001rrrrr',
    'r1rrrrrr',
    'rrrrrrr1',
    'rrrrrrrr',
  ]},

  // Übergang Mitte – tiefer als die Seiten
  wall_low_m: { w:8, h:8, rows: [
    '00000000',
    '00000000',
    '00000000',
    '01100000',
    '1111r000',
    '1rrrr100',
    'rrrrrrr1',
    'rrrrrrrr',
  ]},

  // Boden normal
  floor: { w:8, h:8, rows: [
    'rMrrrrrr',
    'rrrrrMrr',
    'rrMrrrrr',
    'rrrrrrrM',
    'rrrrMrrr',
    'rMrrrrrr',
    'rrrrrrMr',
    'rrrMrrrr',
  ]},

  // Boden dunkel
  floor_dark: { w:8, h:8, rows: [
    'RrrRrrrr',
    'rrRrrrrR',
    'rrrrrRrr',
    'RrrrrrRr',
    'rrRrrrrr',
    'rrrRrrrR',
    'rrrrRrrr',
    'RrrrrRrr',
  ]},

  // Sauberer Boden
  floor_clean: { w:8, h:8, rows: [
    'rrBrrrrr',
    'rrrrrrBr',
    'rBrrrrrr',
    'rrrrBrrr',
    'rrrrrrBr',
    'rBrrrrrr',
    'rrrrrBrr',
    'rrBrrrrr',
  ]},
};

// ── Overlay-Objekte 16×16 (auf Pixelposition gezeichnet) ──

// Cave: Overlay-Objekte 16×16+
const CAVE_OBJECTS_TILES = {

  crystal_blue: { w:16, h:16, rows: [
    '................',
    '................',
    '................',
    '..........1.....',
    '.........11.....',
    '........1CC.....',
    '.......1CCc.....',
    '......11CCc.....',
    '......1CCcc.....',
    '.....1CCCcc.....',
    '.....1CCCcc.....',
    '1....CCCCcc.....',
    '11..1CCCcc1.....',
    '111.11Ccc11.....',
    '1111111111111111',
    '1111111111111111',
  ]},

  torch: { w:16, h:16, rows: [
    '0000000000000000',
    '0000000000000000',
    '00000000T0000000',  // Wandhalter oben
    '00000000TT000000',
    '0000000TTT000000',
    '000000OTTT000000',  // Wandplatte
    '000000OFFO000000',
    '000000FFFF000000',
    '0000000FfF000000',
    '0000000TT0000000',
    '000000TTTT000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]},

  nest: { w:24, h:8, rows: [
    '........................',
    '........................',
    '...BBB..........BBB.....',
    '..BMBBB........BBBMB....',
    '.BMMBBBBB....BBBBBMM....',
    'BMMMBBBBBBBBBBBBBMMMB...',
    'rMMMMBBBBBBBBBBMMMMMr...',
    'rrMMMMMBBBBBMMMMMMrr....',
  ]},

  stalactites: { w:16, h:16, rows: [
    '0000000000000000',
    '.111.1111.1111..',
    '..11..111..111..',
    '..11..111..111..',
    '...1...11...11..',
    '...1...11...11..',
    '...1....1....1..',
    '....1...1....1..',
    '....1...1....1..',
    '.....1..1.....1.',
    '.....1..........',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]},

  stalagmites: { w:16, h:16, rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....M.....M....',
    '....MM.....MM...',
    '....MM..M..MM...',
    '...MMM..M..MMM..',
    '...MMM.MM..MMM..',
    '..MMMM.MM.MMMM..',
    '..MMMMrMMrMMMM..',
    '.MMMMMrMMrMMMMM.',
    'MMMMMMrMMrMMMMMM',
    'MMMMMMMMMMMMMMMr',
    'rrrrrrrMrrrrrrrr',
  ]},

  web: { w:16, h:16, rows: [
    'W..............W',
    '.W............W.',
    '..W..........W..',
    '...W........W...',
    '....W......W....',
    '.....W....W.....',
    '......W..W......',
    '.......WW.......',
    '......W..W......',
    '.....W....W.....',
    '....W......W....',
    '...Ww......wW...',
    '..Www........wW.',
    '.Wwww..........W',
    'Wwwww...........',
    'wwwww...........',
  ]},

  bones: { w:16, h:16, rows: [
    '................',
    '................',
    '...S............',
    '..SSSs.......S..',
    '...SSSs......SS.',
    '...sSSSs....SSS.',
    '....sSSS...sSS..',
    '....sSSSssSSSs..',
    '.....sSSSSSSs...',
    '......ssSSss....',
    '.......ssss.....',
    '.S.....SS.......',
    'SSs...SSS.......',
    'SSSs..SS.......S',
    'rSSSSrSS......SS',
    'rrrrrrrrrrrrrrSr',
  ]},

  puddle: { w:16, h:16, rows: [
    '................',
    '................',
    '................',
    '....pppppp......',
    '...pPPPPPpp.....',
    '..pPPPPPPPPp....',
    '..pPPPPPPPPp....',
    '..pPPPcPPPPp....',
    '..pPPPPPPPPp....',
    '...pPPPPPpp.....',
    '....pppppp......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]},

  dirt: { w:16, h:16, rows: [
    '................',
    '................',
    '....rrrr........',
    '...rrRRrr.......',
    '..rrRRRRrr......',
    '.rrrRRRRRrr.....',
    '.rrrRRRRRrr.....',
    '..rrRRRRrr......',
    '...rrRRrr.......',
    '....rrrr........',
    '...r....r.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]},

  moss: { w:16, h:16, rows: [
    '1111111111111111',
    '1g1g2g1g1g2g1g11',
    '1gG1gG1gG1gG1g11',
    '1GG1GG1GG1GG1G11',
    '2GGG2GGG2GGG2G21',
    '2GGGg2GGg2GGGg21',
    '1gGGGgGGGgGGGg11',
    '1ggGGGgGGGgGGg11',
    '1gggGGgGGgGGgg11',
    '11gggGgGGgGggg11',
    '11gggggGGggggg21',
    '111gggggGggggg11',
    '1111gggggggggg11',
    '11111ggggggggg11',
    '111111gggggggg11',
    '1111111111111111',
  ]},
};

// ── 12×12 Basis-Tilemaps (nur 8×8-Tiles) ──

// Cave: Grid-Konstanten (96×96 Scene ÷ 8px Tile = 12×12 Grid)
const CAVE_TILE_SIZE = 8;
const CAVE_GRID_W    = 12;
const CAVE_GRID_H    = 12;

// Cave: Tilemap-Layouts 12×12 (clean → light_dirty → dirty → filthy)
const CAVE_TILEMAPS = {
  // Row 7 (y=56): organischer Übergang mit wall_low/wall_low_m/wall_low_r
  clean: [
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',   'wall_dark'  ],
    ['wall_dark',  'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',   'wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow', 'wall_shadow', 'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_low',    'wall_low',    'wall_low_m',  'wall_low_m',  'wall_low_m',  'wall_low_m',  'wall_low_m',  'wall_low_r',  'wall_low_r',  'wall_low_r', 'wall_dark'  ],
    ['wall_dark',  'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean','wall_dark'  ],
    ['wall_dark',  'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean', 'floor_clean','wall_dark'  ],
    ['wall_dark',  'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',      'wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
  ],
  light_dirty: [
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',   'wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow', 'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow', 'wall_shadow', 'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_low_r',  'wall_low_r',  'wall_low_m',  'wall_low_m',  'wall_low_m',  'wall_low_r',  'wall_low_m',  'wall_low',    'wall_low',    'wall_low_r', 'wall_dark'  ],
    ['wall_dark',  'floor_clean', 'floor_clean', 'floor_dark',  'floor_clean', 'floor_clean', 'floor_clean', 'floor_dark',  'floor_clean', 'floor_clean', 'floor_clean','wall_dark'  ],
    ['wall_dark',  'floor_clean', 'floor_dark',  'floor_clean', 'floor_clean', 'floor_dark',  'floor_clean', 'floor_clean', 'floor_dark',  'floor_clean', 'floor_clean','wall_dark'  ],
    ['wall_dark',  'floor',       'floor',       'floor_dark',  'floor',       'floor',       'floor_dark',  'floor',       'floor',       'floor_dark',  'floor',      'wall_dark'  ],
    ['wall_dark',  'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',      'wall_dark'  ],
  ],
  dirty: [
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_mid',    'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow', 'wall_mid',    'wall_mid',    'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow', 'wall_shadow', 'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_mid',    'wall_mid',    'wall_mid',    'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_mid',    'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_dark',   'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_dark',   'wall_shadow', 'wall_shadow', 'wall_shadow', 'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_low',    'wall_low',    'wall_dark',   'wall_low_m',  'wall_low_m',  'wall_dark',   'wall_low_r',  'wall_low_r',  'wall_dark',   'wall_low',   'wall_dark'  ],
    ['wall_dark',  'floor',       'floor_dark',  'floor',       'floor_dark',  'floor',       'floor',       'floor_dark',  'floor',       'floor_dark',  'floor',      'wall_dark'  ],
    ['wall_dark',  'floor_dark',  'floor',       'floor_dark',  'floor',       'floor_dark',  'floor_dark',  'floor',       'floor_dark',  'floor',       'floor_dark', 'wall_dark'  ],
    ['wall_dark',  'floor',       'floor_dark',  'floor',       'floor_dark',  'floor',       'floor',       'floor_dark',  'floor',       'floor_dark',  'floor',      'wall_dark'  ],
    ['wall_dark',  'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',      'wall_dark'  ],
  ],
  filthy: [
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_shadow', 'wall_dark',   'wall_dark',   'wall_shadow', 'wall_dark',   'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow','wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_shadow', 'wall_dark',   'wall_dark',   'wall_dark',   'wall_shadow', 'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'wall_dark',   'wall_dark',   'wall_dark',   'wall_shadow', 'wall_dark',   'wall_shadow', 'wall_dark',   'wall_dark',   'wall_dark',   'wall_dark',  'wall_dark'  ],
    ['wall_dark',  'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',      'wall_dark'  ],
    ['wall_dark',  'wall_low',    'wall_dark',   'wall_low_m',  'wall_dark',   'wall_low_m',  'wall_low_m',  'wall_dark',   'wall_low_r',  'wall_dark',   'wall_low',   'wall_dark'  ],
    ['wall_dark',  'floor_dark',  'floor',       'floor_dark',  'floor',       'floor_dark',  'floor_dark',  'floor',       'floor_dark',  'floor',       'floor_dark', 'wall_dark'  ],
    ['wall_dark',  'floor',       'floor_dark',  'floor_dark',  'floor',       'floor',       'floor_dark',  'floor_dark',  'floor',       'floor_dark',  'floor',      'wall_dark'  ],
    ['wall_dark',  'floor_dark',  'floor',       'floor_dark',  'floor_dark',  'floor',       'floor',       'floor_dark',  'floor_dark',  'floor',       'floor_dark', 'wall_dark'  ],
    ['wall_dark',  'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',       'floor',      'wall_dark'  ],
  ],
};

// ── Overlay-Objekte pro Sauberkeitsstufe ──
// x,y = Pixelposition innerhalb der 96×96 Scene

// Cave: Overlay-Objekt-Positionen pro Sauberkeitsstufe
const CAVE_OBJECTS = {
  clean: [
    { key:'stalactites',  x:2,  y:0  },
    { key:'stalactites',  x:55, y:0  },
    { key:'torch',        x:70, y:6  },
    { key:'crystal_blue', x:6,  y:40 },
    { key:'crystal_blue', x:66, y:44 },
    { key:'stalagmites',  x:12, y:64 },
    { key:'stalagmites',  x:64, y:66 },
  ],
  light_dirty: [
    { key:'stalactites',  x:4,  y:0  },
    { key:'stalactites',  x:52, y:0  },
    { key:'torch',        x:72, y:6  },
    { key:'crystal_blue', x:5,  y:42 },
    { key:'moss',         x:28, y:12 },
    { key:'stalagmites',  x:10, y:65 },
    { key:'stalagmites',  x:65, y:67 },
    { key:'dirt',         x:38, y:76 },
  ],
  dirty: [
    { key:'stalactites',  x:2,  y:0  },
    { key:'torch',        x:70, y:6  },
    { key:'web',          x:0,  y:2  },
    { key:'web',          x:64, y:0  },
    { key:'crystal_blue', x:7,  y:44 },
    { key:'stalagmites',  x:14, y:64 },
    { key:'stalagmites',  x:62, y:66 },
    { key:'bones',        x:42, y:74 },
    { key:'dirt',         x:22, y:78 },
    { key:'dirt',         x:60, y:76 },
  ],
  filthy: [
    { key:'web',          x:0,  y:0  },
    { key:'web',          x:56, y:2  },
    { key:'web',          x:70, y:14 },
    { key:'torch',        x:68, y:6  },
    { key:'puddle',       x:8,  y:70 },
    { key:'puddle',       x:54, y:74 },
    { key:'bones',        x:30, y:72 },
    { key:'bones',        x:64, y:76 },
    { key:'dirt',         x:14, y:76 },
    { key:'dirt',         x:44, y:78 },
    { key:'stalagmites',  x:10, y:64 },
    { key:'stalagmites',  x:66, y:66 },
  ],
};

// ── Sauberkeit → Tilemap-Key ──

// ════════════════════════════════════════════

const DRAGON_SPRITES = {
  egg: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAApElEQVR42mNgIAD4+SX/48MM5AKYASI2cngxWRbBDNbIMyKIYZaQbXjAKje8FoDkibaEFJeT5RNsFpxYoPH/w6UA2hhOVR/gswDkAxjG5SOyLUA2HBmjBx9ZFuAyHNkSinxANwtwBRvdLIDFBdUjmarJFOZKXJmOIgtoVkxQvTQl1RKKi2qqGk6KJWQbjm4JvmqSgVJAs8oeBEDVICFMU8NJsQAAZWSEz+0CQjYAAAAASUVORK5CYII=',
  hatchling: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAzElEQVR42mNgIAD4+SX/g/CJBRr/P1wK+A/jI4sxkANghojYyIENCljl9l8jzwhOg8RgasgyHGQwyCBCGKSOJEtIMZxsC5AN+HBHDozR+TBMchBhswAW1sh8GA0So8gHhDBZPkC3BDlp4pKjKJio4npcLiRkAVE+wGfonX1NeDFRPsFmAcxl6AaiixMdTLgiD5/hJFmAKx6wBQvRYU9MUOGygOwSlJT0T1ExTQxmoARQLdeSk5Op4nqaWkAoLhgGPaBpCoLVyfgwKRYAAMx/4EIktXkBAAAAAElFTkSuQmCC',
  young: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAA40lEQVR42rWVMQ7CMAxFc4MuXVg6d2ZmZu5JmJk5CTOH6MzM3EP0BkFGMjLhO7HTptKXEjf5L/lp1BAKT9cd4vM+xvU1RWqzqE91WUMKVgCavBlAA8bLMatqgMXcAikC1mX4SprK+mYAD0arrgJIw913QMXpcY6eM+DxRYA01yLR3mkQ1Tw1Wq79R7kvCM3/yz3dAfVlFKhtBqR5eu8BQ7MAGM98g0IxQQBavayxYdrWzkHW1NXX7iD1+jngvQAwIg3giag/DX6AZwfNAQhiAnj+By5ArQjC4GYAvhNNAM0jknoDilgmZOa3+rMAAAAASUVORK5CYII=',
  adult: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAA/0lEQVR42rWULQ7DMAyFe4OSkpHi4uHg4p5kuHgnGR4eHh4e7iF2g02vkiPPsZPUVSs95dfvsxOlTZP52vb0fd2GVehL5dZITQnweU+ryXA5J8I81l0ALGqmmnYBlrmL4qZ8fjOAFsmIj2XWmwFktLUC66gS8+k+qhnX3AGPTQDWBis7K2PpkZh3oU82wewx9PFI0NcAiJPxf5cqAZ4jQrxagZa95x1IiAlAIPq1bRGASZ5NbfZaFRgTJAtANsvzmm1lBQlAM+cVwCgn639EkCzAU8E89hEaAdbj8lZAkHhEFsB7BxxySAUcclgFVQDvO6gCcIUQ1LakasAeHQ74AYI/a1b0K1aRAAAAAElFTkSuQmCC',
  guardian: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABBklEQVR42r2VwRGCMBBF0wEXL144UwRFUIRFWInnFEERnj1TRDqIE2eW+fnsJgFRZ/4QN/hffsiic/Tpumt8+iEO0xzTmLXcLzEs/aae7k+/47rTAAhBzUO/jhMI5zTzKuDmQyY05LndADEJYflsCQOwnqSZNwFaE+wC8N6LxnHMrqwqQMz5dGgQzVSDZOZaXCuNtWrZygyAEwKoGVsgXuRqjg+WAekIarIA6LM5NdiVvEqthnVtm0wArmTtiddUrFcBUpSx949DzwG/Oy5oCWrC9AwxAVbHlrp7F+C0BCX6NwnEx2nvjzMSZI2mAc5IUAT8LcGRPqgC8G+zdG2Ra73xqH4OeAPKeSQLBY9+ewAAAABJRU5ErkJggg==',
  legendary: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAA20lEQVR42u2VQRLCIAxFuUHXblz3OB6ix/EQHsJDuHbdQ3ADNMzE+f0QiYK6sTN/WiDkhUBoCPBM0y7F6yFdTnOKcU3LfCx0Xur9Yp/n3eeLH1WwAOoMxSAecwEQIhPjus9tBmC/qObcBfCu4CVAjhBS1ZLlfAPgAS9AbJsAjVqWygYeAEvTaQI8abFguF8bgA70AooVYIeeBt24d94cbEDnumG9AIQU+R8JkHbAnDOAi8lSDaA+Pw/gEzAKoJA/oA3ge2Qk4FHJPwP0FJoJGK3vAvDPZH3X9Mz2BvMoixK2A275AAAAAElFTkSuQmCC',
  cave100: 'data:image/png;base64,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',
  cave75: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAIdElEQVR42u1YXWwUVRRujBEihbb7/9fdbrttt9vtdjtsYaHlZ7FCW4hWCo0Y5M8GKyoIYkDAIIniT9AIkRfxJ0Z9IhITSfQJjTGxPlJ9rOFBwzMv+GCMxzl3e7a3O7Ozu7Oz093tffgys3PPvXfm+8459+ypW/5QPQgsHuoECRUiQMPDjZoYlLYz5LMzy77a91EI0LiiSRNDyd0M+ezMsq/2fYoWYMfG/QyFvkC57at9H4UATfUWTewaeo4hn51Z9tW+j0IAS71VE3tHX2bIZ2eWfbXvU7QAk2OvMRT6AuW2r5R9bDlwOM8+CgGsK22aeGHiLYZ8doTTk5dgcvfpgu2LXV/vPL378N9j5+BuUMeJJ9+Co/I+ZJe9nkIA2yqHJk7uvcyQz04v9K5PxJR7H4JjDp7GNFqsdlW8fvADOLPvMrOhOfw6CgHsDU5N0Ifms9OLc4euMZRr/VL3cc7B25RG0OZgiLjsqnjvxXfhpadOMRuaQ2vgekULYOcmlwNvTH3FUG4B9DgST3428f0+a06QDc3hRVAI4GhwKeDKgq9R+cxhEIgYh4FrGgX27U0uaLU5GbpdDljjs2XwSKtFAX4c7WkuroPrKQRwNroXwD2H5qZ5hGwLf5ONs4bBOLC4oc3uYoi6nbC22c4w1GZl2BVpVIDGyBbn0Rq4nqYAPPFIOqHHtfA3L0Stks8LQORnE39YWqmAmhAkgqoAriYPg0eG35JGu90DMfc81vsX/sZxsvXMza8lMC6sHgg5ZOfzuCDpdzA8GrLB7u4meHb1KoazgysUoDG0Q3uai+vgegoB3BYveOcQsHqhw+GFXo8XBgLzGGlf+BvH0Q7taa67hsC4sHmh3Sk7nNcN6wJO2Npuh4moBaYSDQznNtTDlW3LFcDnZIP2OA/n4zq4Xk4B1MhH4hF7ovP3uUSoZfKzBeDJB/jkNOL6zgcVIvACkAgKAQKuHmjz9ELYF4e+FgkGOxKwqz8FO7oicDiZkDeYvIk4sSUFe+MRmOhLj0v+CKxuTUCyKwV+RwQ6/AmQwqnM1cc9y3VfibYJ+b7VFQGpbTVs69sEg20dMN4Xg2NbkvDK5jBcHZfg6nYnfDYehJ+nIjI/w9OIOyfb4caElT2//nQM3hlphwuj/XBwTRc8HotAqrMbEsFuHQL8NyhvMgivbk4AioDPh7sTMBxPqQpQTWSr3Yfl+2QkpSrA80k/IxYJRrJ/O+KSufEy/HuhBX49tAq+39fMxs+nvEywvAIEZQE6vb3QG4jD+pAEG9vSXo5kH0vKCt8JM7w/koA3R2s/CkiAsLcLBjol2Nm/AUa6QvBMspt5NC8AvF13HmAZIO6dsgIfBRgpBQmQHQHo2ejhhwbSZMNHNoAvbEwMjAh8jiJhpGyKpiAaSIetr0aiAB0p2pKAjT2bVQVAz6b0gx4Pt+sY1ATAiNElAB8FXx7ww3dTfnZVE6DVmfaaak052ba8AH2BMGztjsP+gQHYEw9mzgDK8ywKrjyQAaUfPCNKPgMoCj7ckyYfr5T/s9NPuMoPXq1DGAXIFQVI9t8Xl2VAzyj/47nxRG8UtoSj+QUIeeMQaZYYqRQFSPbF8TT5eCVhcLzLE8mkH3+VH7zFRgF/FvxxdkUGvOdj+kHBSIA1bT3Q3RxVFyDICYAphUTAaDjzWJp8vOIz3vP59NOxxKKAKqJfjjdkQAcvjqNYWD0NdcUKE6BVFqDDlxYAPRvzO3r58dE0+XhF4ungrbXyk7dNaEQBiUD/C76dsmRAxOM42aIAa0Mx6AnEoN3Toy1ASBYgs/kcyUe2pcnHK098LR28+aKAr4jofwGlpM8P2DMg4nGcbNe1xyHW0lu4AJQDw7wncLmentcS2YWcBfz/AiSWIoLEQG/nicdxTF/xYB8ToNPXy/5z5RVA7YXCS4DsXFHAi0BnAqUknuxs4lEsnIMChJvjrNDRLcBSIFsrCujfMZ+SUAQkmcgmYYh4jBgULuKXWIGDAgQKEWApk52vR4QRgaRSq4LEyL7P2MhzWGEjcxssVABBtnanNDsiiGy64jP+/AzpEUCQXXipGla5522LFkCQbaytbgEEgcbYFi2AINBY25IEEASWblvyISzILs3W0CpIkF28rSGHsCBbv63hVZAguzhbww5hQbY+25BoRSyurWhFLLKtaEWIVoRoRYhWhGhFiFaEaEWIVoRoRYhWhGhFiFaEaEWIVoRoRYhWhGhFiFaEaEUsxVbE7H0QrYjFakXcnIXZMbhf0QSig9RkK8I/MzMt3f0dxv75s2K9Ne0gUJutCP/0j9PS7E8wdu92RaYR/+xf09K9u0ARWnOtCP+tG9PSzDcwdveHiszZfIRWdCsCc6SeF/Lf/Hhamv4Uxma/rsjDVC1CK64VwXKk7CF6X0i6dQnGZq5VZOXCR2ip6/IHuWGtCN5DarF+zxWhxa5LTmr4Icx7SCWTrTdF8hGqW0TOSQ1vRfAeUqmezbwv6+PNfIdchYZhhzB5SLkIPDq5U/e6WhFqlnPwTmrIIYyEmOnZY8ODqiIUsm6ujy+X4DnvVQoN3QIQIWaFcC4B8q2beUeNCDVa8GJscQ9dh7CWAGr3pUaMXsGz55VbcP57C7GlfXQLUG4C9QpO6xY6b7Het2gB1EK0nATqFVxrXiW9ryEClJNAvYJnzzNL8GLft2gB9OZWvQTqFbzUw9Ss99V1BujJrXoJXKzD1Kz3zSsAGguYB4UA+0djAiZCVYC1ER/DcDKUuacJamN4n2+MxnPNw6vWmtnr5/qd611o/Ur7PoUAhWwmxowbUwggSDF3TFUAQZh5Y6opSBBm3ljOFCQIM2dMMwUJwso/VnAZKggrz5goQ0UZKspQUYaKMlSUoaIMFWWoKENFGSrKUFGGCiwS/gcngy31FQgL9AAAAABJRU5ErkJggg==',
  cave50: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAADVUlEQVR42u2azWsTQRjGexKxsfloTdMmWvrhB8GqBCE5FKFQpFQPQaynQkFyUBAveuhBb4IXL549+x/4/63swLqxszuzMzs7k6W/wwNL5pmdd59ns/PyMEvXrzUiEA5LiLAgBjRvtJQ4GL0Q0PF88eu+jmRAa7mtxNHkVEDH88Wv+zrGBrx8di5QtICq+XVfRzKg3ego8frovYCO54tf93UkAzqNVSXOTj4J6Hi++HVfx9iA2fSrQNECqubXfR3JgNWba0p8ePNdQMdLcDH7Ec1OLwrzTe9vO892HdfPIxmwttJV4vPZTwEdzxa290+EqXod188jGXCrua5E8qA6ni2+vP0lUNX9fa+j08vYgKrx7d1vgdDC+IJkQLfZC4pEmNB1+IJkwHprA3gEBiyaAb32JvAIyYCNTh94BAYsmgFbvf1oe/NxtNN/Eu0NRtG9O0+j0YPDaNAd/rvO+i3vGu7/3FjTWNtY41hrKwMQ255rbAACuuUaG4CAbrlWBiCgO671HoCAbrjON2HENuOW2oQRsDzXWReE2Hbc0pswYpfjOu2CENuc62QTRmyiCKIIxCaKIIpAbKIIogjEJoogikBsogiiCMQmiiCKgEsUQRQBlyiCKAIuUQRRBFzDKGJlOTXg/lZqwE4/vVne9cPddBHddTxnsp8WpLrWrVvHGobbqQF3bxcw4CqI4rOG0gZcpbe1ihqMDeAz4raGXAOIIogiiCKIIogiiCKIIogiiCKIIjgVwakITkVwKoJTEZyK4FQEUQQCEkUQRSAgUQRRhO/iP85eEUXMb8KxID6Lnx4fZJpQd8OtDUgE8fWm5Bmgu2+RFyWk4fEaVpuwyoCs67L/GFvDL8+r2vD55y3CTdaxNqBqAW0NT+5bdF6oeo0NyPqLVimgreGqeYtUrxMDqhTQ1vDL83wZblqvsQG231ZbAW0NL7uZ+qrXag+w+bbaChhqM/VVr9aAmFwEzw/Hf4pyXcxzNT9U/XnzJAOOJ3tKjKe7Ajqeq3mu5oeqXzdPMuD85FE0Hg4ExA3mrhlzP5b5D0Awf2OSAYjidyzTAATzN5b5CUIwf2O5nyAE8zOm/AQhWPVjtKG0obShtKG0obShtKG0obShtKG0obShiBK6DQVh8BcvcAHdGlwM0gAAAABJRU5ErkJggg==',
  cave25: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAADyElEQVR42u1YvWsUQRwNKCJ6el/xcsmdEUMUCRjlEExxCEKEEFOEYKwCQblCg9hokUI7wcbG2to/wtrG2n9oZBZ/Mrc7v52PnZnbi6947N7Ou/l4b3fmx1u4eKEhgNlhASLUxIBfP3/8dkHzUkuUYTx6msHE8+XXbRxX/VgDWpfbQoftrcMMXHtq/ryOU2oAEXQd7j06zmA7gdj8eRxH1Zj9AtqNjqCrimfbrzPkn3OIzZ+3cVRtWQM6jW7hSjjafZdBfVaG2Px5GkenLWsAZ8Jk/2MG2wnE5s/LODotWQO6VxYFgX7T9c3zzxlUThlOJ1/E5PDUmu/av+//fMfxWU9eQ1VbrQGLV3tCBT2T1/dHX4VEnhMKvv2TMLHHcQVpxumqNeBac0nkQc/lVS5UxwmBDy+/ZYjVf8pxpFbyxSjT1NqAvAmxJv3p1fcMsQ2gLyam+CatWAN6zb4wwZbnChImRt+p4KKh1oCl1rKwgQv3f4GrfgUDIGJaFAzot1eAhCgYsNwZAAkBA+pmwI3+XXFz5Z5YG9wX68ORuL36QIzuPBbD3sa/e90z7h7caa7UVGorNZZaexkAsf25zgZAwLBcZwMgYFiulwEQMBzX+wyAgGG4wQ9hiO3GrXQIQ8Dq3GBVEMT241Y+hCF2NW7QKghiu3ODHMIQG1EEogiIjSgCUQTERhSBKAJiI4pAFAGxEUUgioDYiCIQRYCLKAJRBLiIIhBFgIsoAlEEuIgiEEWAiygCUQS4iCIQRYCLKAJRBLiIIhBFgIsoAlEEoghEEYgiEEUgikAUgSgCUQSiCEQRigHnz00bsNqfPoTXBtMdbt6aHkTXrg5uau93pydf1q6OZ2qv23zJgOtLlgZAwLDz9TYgtYAnLw7OpOHOBlAnUpCUb+Dek7F4Ozk4c4Z7G0CCpHoDOQNMhtMc62q4HMPJAOqkzADdgFW/GF/D93fGfxeZxnB1vTaG0/y8DYgtoK/h9AbmDajbfJ0N0H2iNm+g5Mt7gusnTONx/XECE992y6H+qH9fw/Pz4wwPYoBpQuqCTBPi3lBOIJOhOgO4LUftj367FhW2682/oJUP4VAT4g49kwHcoUcLtNlydAa4FhXc/ExfjNMZYNojq0zIdCj6vmE2ezZngEuV47Jeq0NYkiVkB3SP3/F+F8K4na11ICEKBhzvboqHG8MMkqDeoy18m/YLgGDp2goGQJS0bVoDIFi6Nu0WBMHStbFbEARL01a6BUGw+G0oQ1GGogxFGYoyFGUoylCUoShDUYaiDEUZClFmXYYCs8EfbY2ek4gr3rEAAAAASUVORK5CYII=',
  cave10: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAEXUlEQVR42u1aPWtUQRQNKCIa87GJyWYTI4YoGjDKEjBFEIQIIaYIwVgFgrKFithokUI7wcbG2tofYZ3GOo2N/8DGfzByH94w7+3MmzuzM2/fbk5xyOybO3funPPezHDIyMULowroH0ZAQk0E+Hn84yQU45cmVBEb7ScZTH0x4uswTy+cWQWYuDypTNhc389g6686flDncQpgE2Hn4WEGaQGp4wdxHtEXwJgcbSgdTzdfZSg+tyF1/KDNI9qCGqNTuUD6zTjYfpdBf1aG1PGDNE+R01IBbCJ0dj9mkBaQOn5Q5jFxaRVg6sq0YugD6febZ58z6DFlOOp8UZ39I3G8b/7QcaHzhKynyKHOrVGA6bEZpUNP8P7gqyIUY2IhND8Tk3oeX+jcmfqMAlwdn1VF6IlooaaYGPjw4luGVPmrnEfnzNYvFkCSMAY+vfyeIbUA/MX0i/xSAWbGm6oMnNgVFwImJkXuqiDlxyrA7MSccoEnkcSeJfjwYhTAdzKQ3hsnXQI0J1teoAl9xwwrQrjoEmCuMe8Nmjhk3DAhlIMoApx1EXpZe5cA15t31Y3WPbU0f18tL7TVrcU11b79SC3MrJy2Tc9sbcTmY4lT4pY4Jq6DBADZ4bHeAoDAuLHeAoDAuLFBAoDAeLHBZwAIjBMb/RAG2X6xPR3CtsSNsZYRocWX5QshxZYvlGxbPsnaot2CYhUUS9CyvBIBfPL6rDf6IRy7IFNeVz7fvFJBpXl9BU12C4pRUExBB2GLjHIIn6U9O/YWmcSKGOY9O/YWCSsCVgSsCFgRsCJgRcCKGCYrAmTLY5NYESBbHpvEigDZ8tgkVgTIlscmsSJANv4rAv8VAbJhRcCKQCysCFgRiIUVASsCsbAiYEUgFlYErAjEwoqAFYFYWBGwIhALKwJWBGJhRcCKQCysCFgRsCJgRcCKgBUBK6J+VsT5c3kBFpv5Q3hpPp9w9WZ+ElO/PrmrvzmVL76sX5/P1V+3elmAa7NCAUBg3HqDBaiawNfP94ZScG8BOAkRUuUbuPN4Q73t7A2d4MECMCFVvYE2AVyCc411FZzm8BKAk5QJYJqw1y8mVPDdrY3/i6xGcH29EsG5vmABUhMYKji/gUUB6lavtwCmT1TyBlI8tRm+nzDPZ8tnI5jjpVsO5+P8oYIX67MJHkUAV0H6glwF2d5QG0EuQU0C2LYcPR//9r1USNdbfEF7PoRjFWQ79FwC2A49XqBkyzEJ4HupsNXn+mK8zgAa+PfP71MBqB1aEI3lgqjtOhSlgnJe6qO2ZM82CUBjuR5ul91yTON5vcXxokOYggmUgNuEXyfHWUL6Syj2S38X8/iOr3t9vuO7zLit9eUMa3eWT9s68Dzu8y4BDrdX1YOVhQwUoLfRF7/P+AWAsOr6ugQAKdX2GQUAYdX1GbcgEFZdn3ULAmHV9JVuQSAsfR+uobiG4hqKayiuobiG4hqKayiuobiG4hqKayhI6fc1FOgP/gGQF/Gw+X7R+AAAAABJRU5ErkJggg==',
  cave0: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAFLUlEQVR42u1aPWtUQRQNKBJizLfJmsSoIYqKxhACWoSAsEKIKUJwRSQQlC1UxEaLFAZEBJs01tY2/gNrG2sbm/wDG//ByH04YXZ2Pu7Mm3nZXU9x2Lfv3jn3zj3z5s1etq//1KAAjg99KEKHCPDj+7efsRgeGBE6VpfvFzDZUvh3QpwyNbMKMHJ6VJhQv9MoYLNLDPQPOXFc/L44Pl5ufr44XgFsImyu7RbIVaDc/L44Pl5ufq44rCdAYnRwTKh4UH9eQL+vwzcR27jc/L44Pl5ufrY4rC1obHC8xZG+S+xsvC6g3jPBNxHbuNz8vjg+Xm5+pjh6TZ0C2ERobu0X4CaQ279b4phqaRVg/MyEkFAH0veXDz8WUH1c2GseiGZjj+0fyh87LjZOzHz0Gqq1NQowMTQpVKgEb3Y+CYLukwqx/LIwueOEQq2dyWYU4OzwlNChEtFETT4p8Pbp5wK5+KuMo9bMZmcLwCFMgQ/PvhTILYB8Yo6r+E4BJodrwgVJ7POLgSxMDu6qwK2PVYCpkXPCBxmE4/s/IaQuRgFCg6Ho5WrSJkBtdDoIFDB0TK8iphZtApwbmwkGBY4ZZ8JA/2DLZ7cgtgZJBEgtQrehzNzbBLhQuykuTd8S8zNLYmF2WVyZWxHLV++K2cnrR9eme7brbvWlJ5Cu6TMlL9WUaks1plpHCdBrxa7SN1gAFNB9vbd0cBDCGywAiu33fXXjfZPrGyVASEK2vRMilnwHoIBpfJO/hKueqGnP7YRi0xOv7gBZXsI24rGhaSNiJ+riIzvtuSG8Nr7YYtv4OHNLdgpKlVAqQV28HAFCeEPmm/wlnDohE6+PL5SXKyiXN1TQbKegFAmlFFS9p+7JXAHo/ZJii8xyCsqVUKft2aYzfcotMksrwpSM7xdit+zZqbfISlsRcjXhd0EPtiLkL22513eLMNlbEfBFKwKtCPhW3IpAsfm+WVoRKDbfN0srAsXm+2ZpRaDYfN8srQgUG/+KwL8iUGz8KwKtCPiiFYFWBHzRikArAr5oRaAVAV+0ItCKgC9aEWhFwBetCLQi4ItWBFoR8EUrAq0I+KIVgVYEWhFoRaAVgVYEWhGd14o4eaJVgLla60t4fqaVcPFyaxCTXQ3us9fGW5N32dV4Pnun5SsFOD/FFAAFTJtvtABVF/DFk+2eFDxYAElCBalyBW7eWxWvmts9J3i0ALIgVa1AmwA+wWWOnSo4xQgSQJK4BDAFLPvExAq+tb76b5LVCK7OlyO4zC9agNwFjBVcrkBdgE7LN1gA0yPKWYHkT9cSoY+wjGfjsxVY+nO3HMkn+WMF1/OzCZ5EAF9C6oTq9SXx+NFa8anCt0JtBdIFtfFzthyVT37X87Hxq4Kb8vMt0NIvYdcK1AUwwfeS9gkgBbfxc7YckwD6E2PjV1e0KT/fExP0DqCBf34fHglA1649jiMAJUQ8vpeib4VxBTDt2SYBKCeZD12HCkBjpACSK+glTM4EIpDXhF8/vxeE9EnQ7bbvtglIHt/4WP5YPn2eofz6eF+8tmbc+p2FAivXFo6uVeB+2vttAuxuLIrb12cLkIN6TbaLK43Dxv6Xr2VAHCqnK16oreBuvPsRAhrDjRfDr8bROY1PgCuRMgm4EkklQqwA3HhlBdA52wTgrLAUSLHaTbbYfLjxys5b5zQKkGt7gK3dZtyCULDqbNYtCAWrxubcglCw/LbgYyhsaW3Bx1DY0tqCj6GwpbXhGIpjKI6hOIbiGIpjKI6hOIbiGCqA48Nfm2LuH2VcOTEAAAAASUVORK5CYII=',
  food_rat: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAUElEQVR42mNgwAP4+SX/b5k27T+IhmG8ik9s2QLGBDWAJJry8jAwigZkU9A1wPhwDbhMxGkDWRoC3NwIKgZrIEYx5RpgmtBDChtmIEYRRRoA29/UVDbJwSUAAAAASUVORK5CYII=',
  food_chicken: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAATElEQVR42mNgwAP4+SX/o2O8ij88OwHGJ4zk4Gy8psEUIWvCMA0fBmkiWgNMDUka4J4exBq2VNiAMUwRMh9DAwiDJJHjAZ2PoYEYDACUQzAbbMbvKQAAAABJRU5ErkJggg==',
  food_boar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAQElEQVR42mNgoAvg55f8TywGKw5ws/lfkRIAxiA2LoyigZBCDBsI4Q8f7oBpojXANJGkgWQbSNYA9zTJ8UAKBgCeNsA7BbYScQAAAABJRU5ErkJggg==',
  food_knight: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAOCAYAAAAbvf3sAAAAVUlEQVR42mNgQAL8/JL/F6za8v/EAg0wBrFBYsgYQzE2jFcDiP5wRw6MkcWoZwNRGkCMlLwKnBpActTTAAtS5KAdYA208zQsHpAl0flYNSBHFLaIAwAoYEHSTR4o+wAAAABJRU5ErkJggg==',
  food_adventurer: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAOCAYAAAAbvf3sAAAAYklEQVR42mNgAAJ+fsn/PQFyYHxigQZW9odLAf9B6hjQNeDCH+7Ikaahwg1NAwjf2dIEp5HZIBqnBmwYqwaQRIrNAqwYJDcAGnAphuEB0ADDoEjCxsaqARaruPhYNeCyDYYBi74nQsnvwEEAAAAASUVORK5CYII=',
  food_heart: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAW0lEQVR42mNggAJ+fsn/MHynQuT/hztyYBpZHIThiu9oaMAxSPGHD3cgmpDEQRhDMSFMuYYPJ+TAGKcGbH7AawNyKBFSDA8lYjRhKManCadibJoIKkaPeQZKAQD6PMT/G0hczgAAAABJRU5ErkJggg==',
};

// HOMEHUB DRAGON – Block 2: ENGINE
// ── State, Persistenz, Spiellogik ──
// ════════════════════════════════════════════

/**
 * loadDragon()
 *
 * Lädt den Dragon-State aus localStorage.
 * Drei Fälle:
 *   A) data.dragon vorhanden → merge mit DRAGON_DEFAULTS
 *   B) data.dragon fehlt     → neuer State aus DRAGON_DEFAULTS
 *   C) data.dragon unvollständig → merge, fehlende Felder ergänzen
 *
 * Wird beim App-Start und nach jedem Import aufgerufen.
 * Kann niemals abstürzen, auch bei korrupten Daten.
 */
function loadDragon(savedData) {
  // savedData = data.dragon aus Backup (kann undefined/null sein)
  dragon = Object.assign({}, DRAGON_DEFAULTS, savedData || {});
  // Fehlende Inventar-Keys mit Defaults auffüllen (Fall C: unvollständiges Backup)
  dragon.inventory = Object.assign(
    {},
    DRAGON_DEFAULTS.inventory,
    dragon.inventory || {}
  );
  dragon.actionLog = Object.assign(
    {},
    dragon.actionLog || {}
  );
  // Alle weiteren DRAGON_DEFAULTS-Felder sicherstellen
  Object.keys(DRAGON_DEFAULTS).forEach(k => {
    if (dragon[k] === undefined) dragon[k] = DRAGON_DEFAULTS[k];
  });
  saveDragon();
}

// ════════════════════════════════════════════
// HOMEHUB DRAGON – State & Core
// ════════════════════════════════════════════
const DRAGON_DEFAULTS = {
  name: 'Nox', xp: 0, energy: 20, hunger: 70, cleanliness: 80,
  lastFeedDate: null, lastCleanDate: null, lastActionDate: null, actionLog: {},
  inventory: { rat:2, chicken:1, boar:0, knight:0, adventurer:0, heart:0 }
};
// Dragon-State (wird sofort per loadDragon() befüllt)
let dragon = {};

function saveDragon() {
  try { localStorage.setItem('vh_dragon', JSON.stringify(dragon)); } catch {}
}

// ── App-Start: Dragon laden und Decay nachholen ──
// loadDragon() liest localStorage und mergt mit DRAGON_DEFAULTS
loadDragon((() => {
  try { const d = JSON.parse(localStorage.getItem('vh_dragon')); return d || null; } catch { return null; }
})());
// Decay nachholen (datumbasiert, kein Timer)
(function applyDecay() {
  const t = new Date().toISOString().slice(0,10);
  if (!dragon._decayDate) { dragon._decayDate = t; saveDragon(); return; }
  const daysSince = Math.max(0, Math.floor((new Date(t) - new Date(dragon._decayDate)) / 86400000));
  if (daysSince <= 0) return;
  dragon.hunger      = Math.max(0, dragon.hunger      - daysSince * 5);
  const cleanDecayDays = Math.floor(daysSince / 2);
  dragon.cleanliness = Math.max(0, dragon.cleanliness - cleanDecayDays * 10);
  dragon._decayDate  = t;
  saveDragon();
})();

// ── Tageslimits Anti-Farming ──
const DRAGON_LIMITS = {
  expense:10, shopping:20, contractUpdate:5, meter:3, recipe:5, backup:1,
  feed:3, clean:1, contractCreate:3
};
function dragonDailyCount(action) {
  const t = new Date().toISOString().slice(0,10);
  return (dragon.actionLog[t] || {})[action] || 0;
}
function dragonIncrLog(action) {
  const t = new Date().toISOString().slice(0,10);
  if (!dragon.actionLog[t]) {
    const keys = Object.keys(dragon.actionLog).sort();
    while (keys.length > 6) delete dragon.actionLog[keys.shift()];
    dragon.actionLog[t] = {};
  }
  dragon.actionLog[t][action] = (dragon.actionLog[t][action] || 0) + 1;
}

// ── XP & Energie Rewards ──
const DRAGON_REWARDS = {
  expense:               { xp:3,   energy:2  },
  shopping:              { xp:2,   energy:1  },
  recipe:                { xp:8,   energy:4  },
  meter:                 { xp:15,  energy:8  },
  contractCreate:        { xp:20,  energy:10 },
  contractUpdate:        { xp:8,   energy:4  },
  backup:                { xp:20,  energy:10 },
  budgetSuccess:         { xp:100, energy:40 },
  foodBudgetSuccess:     { xp:50,  energy:20 },
  leisureBudgetSuccess:  { xp:75,  energy:30 },
  leisureBelowLastMonth: { xp:75,  energy:30 },
  leisure10PercentBetter:{ xp:120, energy:50 },
  leisure20PercentBetter:{ xp:180, energy:75 },
};

// ── Futter-Definitionen ──
const DRAGON_FOOD = {
  rat:        { label:'Ratte',      emoji:'🐀', hunger:15, xp:2,  energy:3, rarity:'common'   },
  chicken:    { label:'Huhn',       emoji:'🐔', hunger:20, xp:3,  energy:4, rarity:'common'   },
  boar:       { label:'Wildschwein',emoji:'🐗', hunger:25, xp:4,  energy:5, rarity:'uncommon' },
  adventurer: { label:'Abenteurer', emoji:'🧙', hunger:40, xp:6,  energy:8, rarity:'rare'     },
  knight:     { label:'Ritter',     emoji:'🛡️', hunger:50, xp:8,  energy:10,rarity:'rare'     },
  heart:      { label:'Drachenherz',emoji:'❤️‍🔥',hunger:100,xp:25, energy:20,rarity:'legendary'},
};

// ── Futter als Belohnung aus Aktionen ──
const DRAGON_FOOD_REWARDS = {
  expense:       { item:'rat',    chance:0.3 },
  shopping:      { item:'rat',    chance:0.2 },
  recipe:        { item:'chicken',chance:0.4 },
  meter:         { item:'boar',   chance:0.5 },
  contractCreate:{ item:'adventurer',chance:0.3 },
  backup:        { item:'boar',   chance:0.6 },
};

function rewardDragon(action) {
  const r = DRAGON_REWARDS[action];
  if (!r) return;
  const limit = DRAGON_LIMITS[action];
  if (limit !== undefined && dragonDailyCount(action) >= limit) return;
  dragonIncrLog(action);
  dragon.xp     += r.xp;
  dragon.energy  = Math.min(dragon.energy + r.energy, 999);
  dragon.lastActionDate = new Date().toISOString().slice(0,10);
  // Futter-Chance
  const fr = DRAGON_FOOD_REWARDS[action];
  let foodMsg = '';
  if (fr && Math.random() < fr.chance) {
    dragon.inventory[fr.item] = (dragon.inventory[fr.item] || 0) + 1;
    foodMsg = ` · ${DRAGON_FOOD[fr.item].emoji} gefunden!`;
  }
  saveDragon();
  showDragonToast(`+${r.xp} XP · +${r.energy} ⚡${foodMsg}`);
  const dc = document.getElementById('dragonCard');
  if (dc) renderDragonCard();
}

// ── Level-System ──
function getDragonLevel() { return Math.floor(dragon.xp / 100) + 1; }
function getDragonXpProgress() { return dragon.xp % 100; }

const DRAGON_STAGES = [
  { minLevel:1,  name:'Drachenei',         sprite:'egg'       },
  { minLevel:2,  name:'Schlüpfling',        sprite:'hatchling' },
  { minLevel:5,  name:'Jungdrache',         sprite:'young'     },
  { minLevel:10, name:'Erwachsener Drache', sprite:'adult'     },
  { minLevel:20, name:'Wächterdrache',      sprite:'guardian'  },
  { minLevel:30, name:'Legendärer Drache',  sprite:'legendary' },
];
function getDragonStage() {
  const lv = getDragonLevel();
  let stage = DRAGON_STAGES[0];
  for (const s of DRAGON_STAGES) { if (lv >= s.minLevel) stage = s; }
  return stage;
}

function getDragonMood() {
  const t  = new Date().toISOString().slice(0,10);
  const hr = new Date().getHours();
  if (dragon.cleanliness < 30)       return 'dirty';
  if (dragon.hunger < 25)            return 'hungry';
  if (dragon.lastFeedDate === t)     return 'happy';
  if (dragon.lastActionDate === t)   return 'proud';
  if (hr >= 21)                      return 'sleepy';
  return 'content';
}

const DRAGON_MOOD_TEXT = {
  happy:   'Nox ist satt und glücklich! 🎉',
  hungry:  'Nox hat großen Hunger… bitte füttere mich!',
  dirty:   'Nox fühlt sich unwohl. Die Höhle braucht Reinigung.',
  proud:   'Nox ist stolz auf deine Aktivitäten heute! 💪',
  sleepy:  'Nox schläft schon fast ein… zzz',
  content: 'Nox wartet geduldig auf neue Abenteuer.',
};

// ── Höhlen-Sprite je Sauberkeit ──
function getCaveSprite(cleanliness) {
  if (cleanliness >= 100) return DRAGON_SPRITES.cave100;
  if (cleanliness >= 75)  return DRAGON_SPRITES.cave75;
  if (cleanliness >= 50)  return DRAGON_SPRITES.cave50;
  if (cleanliness >= 25)  return DRAGON_SPRITES.cave25;
  if (cleanliness >= 10)  return DRAGON_SPRITES.cave10;
  return DRAGON_SPRITES.cave0;
}

// ── Toast ──
let _dragonToastTimer = null;
function showDragonToast(msg) {
  let el = document.getElementById('dragonToastEl');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dragonToastEl';
    el.className = 'dragon-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_dragonToastTimer);
  _dragonToastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Füttern ──
let _selectedFood = null;
function selectFood(item) {
  if (!(dragon.inventory[item] > 0)) return;
  _selectedFood = item;
  renderDragonCard();
}
function feedDragon() {
  const t = new Date().toISOString().slice(0,10);
  if (dragonDailyCount('feed') >= DRAGON_LIMITS.feed) { showDragonToast('Nox ist für heute satt!'); return; }
  const item = _selectedFood || Object.keys(dragon.inventory).find(k => dragon.inventory[k] > 0);
  if (!item || !dragon.inventory[item]) { showDragonToast('Kein Futter im Inventar!'); return; }
  const food = DRAGON_FOOD[item];
  if (!food) return;
  dragonIncrLog('feed');
  dragon.inventory[item]--;
  dragon.hunger      = Math.min(100, dragon.hunger + food.hunger);
  dragon.xp         += food.xp;
  dragon.energy      = Math.min(999, dragon.energy + food.energy);
  dragon.lastFeedDate = t;
  _selectedFood = null;
  saveDragon();
  showDragonToast(`*mampf* ${food.emoji}  Hunger +${food.hunger} · XP +${food.xp}`);
  renderDragonCard();
}

// ── Höhle reinigen ──
function cleanDragon() {
  const t = new Date().toISOString().slice(0,10);
  if (dragonDailyCount('clean') >= DRAGON_LIMITS.clean) { showDragonToast('Höhle heute schon geputzt!'); return; }
  if (dragon.energy < 8) { showDragonToast('Nicht genug Energie! (benötigt: 8 ⚡)'); return; }
  dragonIncrLog('clean');
  dragon.energy      = Math.max(0, dragon.energy - 8);
  dragon.cleanliness = 100;
  dragon.xp         += 5;
  dragon.lastCleanDate = t;
  saveDragon();
  showDragonToast('Höhle blitzsauber! ✨ +5 XP');
  renderDragonCard();
}

// ── Dragon-Card rendern ──
function renderDragonCard() {
  const el = document.getElementById('dragonCard');
  if (!el) return;
  const stage   = getDragonStage();
  const mood    = getDragonMood();
  const cleanCount = dragonDailyCount('clean');
  const canClean   = cleanCount < DRAGON_LIMITS.clean && dragon.energy >= 8;

  const hungerColor = dragon.hunger < 25 ? '#ef4444' : dragon.hunger < 60 ? '#f59e0b' : '#4ade80';
  const cleanColor  = dragon.cleanliness < 30 ? '#ef4444' : dragon.cleanliness < 60 ? '#f59e0b' : '#818cf8';

  const caveSprite   = getCaveSprite(dragon.cleanliness);
  const dragonSprite = DRAGON_SPRITES[stage.sprite] || DRAGON_SPRITES.egg;

  // Pixel-Sprite: Schlüssel aus stage.sprite ableiten
  const pixelSpriteKey = 'dragon_' + stage.sprite;
  const isPixelSprite  = !!DRAGON_PIXEL_SPRITES[pixelSpriteKey];

  // Inventar HTML – Icon-Wraps, drawFoodSprite() füllt nach DOM-Write
  const invHtml = Object.entries(DRAGON_FOOD).map(([key, food]) => {
    const count = dragon.inventory[key] || 0;
    const isSelected = _selectedFood === key;
    const isEmpty = count === 0;
    return `<div class="dragon-inv-item ${isSelected ? 'selected' : ''} ${isEmpty ? 'empty' : ''}"
      data-food="${key}" title="${food.label}: Hunger +${food.hunger}, XP +${food.xp}">
      <div class="dragon-food-icon-wrap" data-foodkey="${key}"></div>
      <div class="dragon-inv-count">x${count}</div>
      <div class="dragon-inv-label">${food.label}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="dragon-header">
      <span class="dragon-title">${dragonEsc(dragon.name)}</span>
      <span class="dragon-mood-badge mood-${mood}">${DRAGON_MOOD_TEXT[mood].split(' ').slice(0,3).join(' ')}…</span>
    </div>
    <div class="dragon-status-grid">
      <div class="dragon-status-card">
        <div class="dragon-status-val" style="color:#a5b4fc">✦ ${dragon.xp}</div>
      </div>
      <div class="dragon-status-card">
        <div class="dragon-status-bar-track"><div class="dragon-status-bar-fill" style="width:${dragon.hunger}%;background:${hungerColor}"></div></div>
      </div>
      <div class="dragon-status-card">
        <div class="dragon-status-bar-track"><div class="dragon-status-bar-fill" style="width:${dragon.cleanliness}%;background:${cleanColor}"></div></div>
      </div>
      <div class="dragon-status-card">
        <div class="dragon-status-val" style="color:#fbbf24">⚡ ${dragon.energy}</div>
      </div>
    </div>
    <div class="dragon-body">
      <div class="dragon-scene-wrap">
        <canvas id="dragonSceneCanvas" width="96" height="96"></canvas>
      </div>
      <div class="dragon-sidebar">
        <div class="dragon-inv-grid">${invHtml}</div>
        <button class="dragon-clean-btn" id="dragonCleanBtn" ${canClean ? '' : 'disabled'}>🧹<br>8⚡</button>
      </div>
    </div>
    ${dragon.cleanliness < 20 ? `<div class="dragon-dirty-warn">Nox fühlt sich unwohl in dieser Höhle.</div>` : ''}
  `;

  document.getElementById('dragonCleanBtn')?.addEventListener('click', cleanDragon);
  // Klick auf Futter-Item = direkt füttern
  el.querySelectorAll('.dragon-inv-item:not(.empty)').forEach(item => {
    item.addEventListener('click', () => {
      _selectedFood = item.dataset.food;
      feedDragon();
    });
  });

  // Futter-Sprites in Icon-Wraps zeichnen (nach DOM-Write)
  el.querySelectorAll('.dragon-food-icon-wrap').forEach(wrap => {
    drawFoodSprite(wrap.dataset.foodkey, wrap);
  });

  // HOMEHUB DRAGON – Scene-Canvas nach DOM-Write zeichnen
  drawDragonScene({
    caveSprite, dragonSprite,
    pixelSpriteKey, isPixelSprite,
    cleanliness: dragon.cleanliness,
    mood
  });
}

// Cave: Sauberkeit → Tilemap-Key + Validierung
function getCaveMapKey(cleanliness) {
  if (cleanliness >= 85) return 'clean';
  if (cleanliness >= 60) return 'light_dirty';
  if (cleanliness >= 30) return 'dirty';
  return 'filthy';
}

// ── Tile-Validierung ──
function validateCaveTile(tileKey) {
  const tile = CAVE_TILES[tileKey] || CAVE_OBJECTS_TILES[tileKey];
  const errors = [];
  const allowed = new Set(Object.keys(CAVE_TILE_COLORS));
  if (!tile) {
    const msg = `Tile "${tileKey}" nicht gefunden.`;
    console.warn('[Cave Tile]', msg);
    return { valid: false, errors: [msg] };
  }
  const expW = tile.w, expH = tile.h;
  if (!tile.rows || tile.rows.length !== expH) errors.push(`rows.length=${tile.rows?.length} (erwartet ${expH})`);
  (tile.rows || []).forEach((row, i) => {
    if (row.length !== expW) errors.push(`Zeile ${i+1}: ${row.length} Zeichen (erwartet ${expW})`);
    for (const ch of row) if (!allowed.has(ch)) errors.push(`Zeile ${i+1}: unbekanntes Zeichen "${ch}"`);
  });
  if (errors.length) { console.warn(`[Cave Tile] Fehler in "${tileKey}":\n`, errors.join('\n')); return { valid: false, errors }; }
  return { valid: true, errors: [] };
}

function validateCaveTilemap(mapKey) {
  const map = CAVE_TILEMAPS[mapKey];
  const errors = [];
  if (!map) { console.warn(`[Cave Tilemap] "${mapKey}" nicht gefunden.`); return { valid: false }; }
  if (map.length !== CAVE_GRID_H) errors.push(`Zeilen: ${map.length} (erwartet ${CAVE_GRID_H})`);
  map.forEach((row, gy) => {
    if (row.length !== CAVE_GRID_W) errors.push(`Zeile ${gy}: ${row.length} Tiles (erwartet ${CAVE_GRID_W})`);
    row.forEach(tk => { if (!CAVE_TILES[tk]) errors.push(`Basis-Tile "${tk}" unbekannt`); });
  });
  if (errors.length) { console.warn(`[Cave Tilemap] Fehler in "${mapKey}":\n`, errors.join('\n')); return { valid: false, errors }; }
  return { valid: true, errors: [] };
}

// ── Einzelnes Tile zeichnen (aus CAVE_TILES oder CAVE_OBJECTS_TILES) ──
function drawCaveTile(ctx, tileKey, px, py) {
  const tile = CAVE_TILES[tileKey] || CAVE_OBJECTS_TILES[tileKey];
  if (!tile) return;
  for (let y = 0; y < tile.h; y++) {
    const row = tile.rows[y];
    for (let x = 0; x < tile.w; x++) {
      const col = CAVE_TILE_COLORS[row ? row[x] : '.'];
      if (!col || col === 'transparent') continue;
      ctx.fillStyle = col;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }
}

// ── 12×12 Basis-Tilemap zeichnen ──
function drawCaveTilemap(ctx, mapKey) {
  const map = CAVE_TILEMAPS[mapKey] || CAVE_TILEMAPS.clean;
  ctx.imageSmoothingEnabled = false;
  for (let gy = 0; gy < CAVE_GRID_H; gy++) {
    for (let gx = 0; gx < CAVE_GRID_W; gx++) {
      const tileKey = (map[gy] && map[gy][gx]) || 'wall_dark';
      drawCaveTile(ctx, tileKey, gx * CAVE_TILE_SIZE, gy * CAVE_TILE_SIZE);
    }
  }
}

// ── Overlay-Objekte zeichnen ──
function drawCaveObjects(ctx, mapKey) {
  const objs = CAVE_OBJECTS[mapKey] || CAVE_OBJECTS.clean;
  for (const obj of objs) {
    drawCaveTile(ctx, obj.key, obj.x, obj.y);
  }
}

/**
 * drawDragonScene({ dragonSprite, pixelSpriteKey, isPixelSprite, cleanliness, mood })
 *
 * Zeichnet die 96×96 Scene auf #dragonSceneCanvas in 4 Layern:
 *
 *   Layer 1 – Höhle:        drawCaveTilemap() – kein Image.onload mehr
 *   Layer 2 – Dreck-Overlay: halbtransparente Flecken bei cleanliness < 50
 *   Layer 3 – Drache:       Pixel-Sprite (DRAGON_PIXEL_SPRITES) oder Fallback-img
 *   Layer 4 – Effekte:       Vorbereitet (derzeit leer)
 *
 * caveSprite (alte base64-PNGs) wird nicht mehr genutzt, bleibt aber im State.
 */

// ════════════════════════════════════════════
// HOMEHUB DRAGON – Block 3: RENDERER
// ── Pixel-Rendering: Sprites, Cave, Scene, Card ──
// ════════════════════════════════════════════

// Pixel-Sprite-Validierung
function validatePixelSprite(spriteKey) {
  const errors  = [];
  const sprite  = DRAGON_PIXEL_SPRITES[spriteKey];
  const allowed = new Set(Object.keys(PIXEL_COLORS));

  if (!sprite) {
    const msg = `Sprite "${spriteKey}" nicht in DRAGON_PIXEL_SPRITES gefunden.`;
    errors.push(msg);
    console.warn('[Dragon Sprite] ' + msg);
    return { valid: false, errors };
  }
  if (!sprite.frames || !Array.isArray(sprite.frames) || sprite.frames.length === 0) {
    errors.push(`Sprite "${spriteKey}": frames fehlt oder ist leer.`);
  }
  if (!sprite.w || !sprite.h) {
    errors.push(`Sprite "${spriteKey}": w oder h fehlt.`);
  }
  const W = sprite.w || 0;
  const H = sprite.h || 0;

  (sprite.frames || []).forEach((frame, fi) => {
    if (!Array.isArray(frame)) {
      errors.push(`Frame ${fi}: kein Array.`); return;
    }
    if (frame.length !== H) {
      errors.push(`Frame ${fi}: erwartet ${H} Zeilen, hat ${frame.length}.`);
    }
    frame.forEach((row, ri) => {
      if (row.length !== W) {
        errors.push(`Frame ${fi}, Zeile ${ri + 1}: erwartet ${W} Zeichen, hat ${row.length}. → "${row}"`);
      }
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (!allowed.has(ch)) {
          errors.push(`Frame ${fi}, Zeile ${ri + 1}, Pos ${x + 1}: unbekannter Buchstabe "${ch}"`);
        }
      }
    });
  });

  if (errors.length > 0) {
    console.warn(`[Dragon Sprite] Validierungsfehler in "${spriteKey}":\n` + errors.join('\n'));
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
}

/**
 * createPixelSprite(spriteKey, colors, frameIndex)
 *
 * Nicht mehr primär genutzt – drawDragonScene() übernimmt das Zeichnen.
 * Bleibt als Hilfsfunktion für Tests und externe Nutzung erhalten.
 * Erzeugt ein <canvas> aus einem einzelnen Frame.
 *
 * @param {string} spriteKey   - Schlüssel in DRAGON_PIXEL_SPRITES
 * @param {object} colors      - Farb-Mapping
 * @param {number} frameIndex  - Frame-Index (Standard: 0)
 * @returns {HTMLCanvasElement|null}
 */

function createPixelSprite(spriteKey, colors, frameIndex) {
  const validation = validatePixelSprite(spriteKey);
  if (!validation.valid) return null;

  const sprite = DRAGON_PIXEL_SPRITES[spriteKey];
  const W  = sprite.w;
  const H  = sprite.h;
  const fi = frameIndex || 0;
  const rows = sprite.frames[fi] || sprite.frames[0];
  const sc = 1;
  const canvas = document.createElement('canvas');
  canvas.width  = W * sc;
  canvas.height = H * sc;
  canvas.style.cssText = 'image-rendering:pixelated;image-rendering:-moz-crisp-edges;image-rendering:crisp-edges';
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < H; y++) {
    const row = rows[y];
    for (let x = 0; x < W; x++) {
      const col = colors[(row && row[x]) || '.'];
      if (!col || col === 'transparent') continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * sc, y * sc, sc, sc);
    }
  }
  return canvas;
}


// Balken-Renderer (Canvas, pixeliger Stil)
function drawPixelBar(ctx, x, y, w, h, percent, type) {
  const FILL_COLORS = {
    xp:          '#5b5ef4',
    hunger:      percent < 25 ? '#ef4444' : percent < 60 ? '#f59e0b' : '#4ade80',
    cleanliness: percent < 30 ? '#ef4444' : percent < 60 ? '#f59e0b' : '#818cf8',
    energy:      '#fbbf24',
  };
  const fill = FILL_COLORS[type] || '#888';
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * (w - 2));

  // Outline (1px)
  ctx.fillStyle = '#0a0c12';
  ctx.fillRect(x, y, w, h);
  // Hintergrund
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Heller Innenrand oben+links (1px)
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  // Gefüllter Bereich
  if (filled > 0) {
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, filled, h - 2);
  }
}

// Futter-Sprite-Renderer (Canvas oder img-Fallback)
function drawFoodSprite(foodKey, container) {
  if (!container) return;
  // Raster-Key anpassen (DRAGON_FOOD nutzt 'heart', FOOD_PIXEL_SPRITES 'dragonheart')
  const pixKey  = foodKey === 'heart' ? 'dragonheart' : foodKey;
  const def     = FOOD_PIXEL_SPRITES[pixKey];
  const frame0  = def && def.frames && def.frames[0];

  if (Array.isArray(frame0)) {
    // Pixel-Canvas Render (für spätere Raster)
    const W = def.w, H = def.h;
    const sc = 2;  // 16×2 = 32px Darstellungsgröße
    const cvs = document.createElement('canvas');
    cvs.width = W * sc; cvs.height = H * sc;
    cvs.className = 'dragon-food-canvas';
    cvs.style.width  = (W * sc) + 'px';
    cvs.style.height = (H * sc) + 'px';
    const ctx = cvs.getContext('2d');
    for (let y = 0; y < H; y++) {
      const row = frame0[y];
      for (let x = 0; x < W; x++) {
        const col = PIXEL_COLORS[(row && row[x]) || '.'];
        if (!col || col === 'transparent') continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * sc, y * sc, sc, sc);
      }
    }
    container.appendChild(cvs);
  } else {
    // Fallback: base64-img aus DRAGON_SPRITES
    const src = DRAGON_SPRITES['food_' + foodKey];
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'dragon-food-sprite';
      img.alt = foodKey;
      container.appendChild(img);
    }
  }
}

/**
 * drawPixelBar(ctx, x, y, w, h, percent, type)
 *
 * Zeichnet einen pixeligen Statusbalken auf einen Canvas-Context.
 * Eckig, keine CSS-Rundungen. Dunkle Outline, 1px heller Innenrand.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x, y       - Position in Canvas-Koordinaten
 * @param {number} w, h       - Breite/Höhe des Balkens
 * @param {number} percent    - 0–100
 * @param {string} type       - 'xp' | 'hunger' | 'cleanliness' | 'energy'
 *
 * Vorbereitet für spätere Integration in drawDragonScene() Layer 4.
 * Aktuell nutzt die Card DOM-Balken; drawPixelBar() für Canvas-Overlay später.
 */

// Cave-Tile- und Scene-Renderer
function drawDragonScene({ caveSprite, dragonSprite, pixelSpriteKey, isPixelSprite, cleanliness, mood }) {
  const cvs = document.getElementById('dragonSceneCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const SW  = 96, SH = 96;

  ctx.clearRect(0, 0, SW, SH);
  ctx.imageSmoothingEnabled = false;

  // ── Layer 1: Höhle per Tilemap ──
  const caveMapKey = getCaveMapKey(cleanliness);
  drawCaveTilemap(ctx, caveMapKey);
  drawCaveObjects(ctx, caveMapKey);

  // ── Layer 2: Dreck-Overlay ──
  if (cleanliness < 50) {
    const dirtyAlpha = Math.min(0.40, (50 - cleanliness) / 85);
    ctx.fillStyle = `rgba(55,35,12,${dirtyAlpha.toFixed(2)})`;
    for (let i = 0; i < 10; i++) {
      const dx = ((i * 17 + 7) % 76) + 4;
      const dy = ((i * 13 + 5) % 56) + 24;
      const dw = ((i * 11 + 3) % 10) + 4;
      const dh = ((i *  7 + 2) %  6) + 2;
      ctx.fillRect(dx, dy, dw, dh);
    }
  }

  // ── Layer 3: Drache ──
  const drawDragon = () => {
    if (isPixelSprite) {
      const validation = validatePixelSprite(pixelSpriteKey);
      if (validation.valid) {
        const sprite = DRAGON_PIXEL_SPRITES[pixelSpriteKey];
        const sW = sprite.w, sH = sprite.h;
        const rows = sprite.frames[0];
        const ox = Math.floor((SW - sW) / 2);
        const oy = SH - sH - 8;  // 8px Abstand: Nest bleibt über unterem Tilemap-Abschluss
        for (let y = 0; y < sH; y++) {
          const row = rows[y];
          for (let x = 0; x < sW; x++) {
            const col = PIXEL_COLORS[(row && row[x]) || '.'];
            if (!col || col === 'transparent') continue;
            ctx.fillStyle = col;
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      }
    } else {
      // Fallback: base64-img für Stufen ohne Pixel-Raster
      const dImg = new Image();
      dImg.onload = () => {
        ctx.imageSmoothingEnabled = false;
        const sz = DRAGON_SPRITE_SIZES[pixelSpriteKey];
        const dW = sz ? sz.w : 64, dH = sz ? sz.h : 64;
        const ox = Math.floor((SW - dW) / 2);
        const oy = SH - dH - 4;
        ctx.drawImage(dImg, ox, oy, dW, dH);
        // Layer 4: Effekte (Platzhalter)
      };
      dImg.src = dragonSprite;
      return;
    }
    // ── Layer 4: Effekte (Platzhalter) ──
    // drawDragonEffects(ctx, mood, SW, SH);
  };

  drawDragon();
}

// TODO: Budget-Boni – beim Monatsabschluss prüfen
// function checkDragonBudgetBonuses() { ... rewardDragon('budgetSuccess') ... }

// HTML-Escape für Dragon-Renderer (unabhängig von HomeHub's dragonEsc())
function dragonEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ── Globale Schnittstelle für HomeHub ──
// HomeHub greift auf diese Funktionen direkt über window zu
window.dragon          = dragon;
window.loadDragon      = loadDragon;
window.saveDragon      = saveDragon;
window.rewardDragon    = rewardDragon;
window.renderDragonCard = renderDragonCard;
window.feedDragon      = feedDragon;
window.cleanDragon     = cleanDragon;
