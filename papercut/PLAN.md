# Papercut Noir build: plan and status

The port analysis said three things: the rules engine ports almost mechanically, everything the player sees is a rewrite, and the first commit has to be a seeded random generator plus a move-log exporter. This build follows that order. The look is settled in the browser first; Unreal follows once the design is fixed.

## Pseudo-3D, cut from paper

The first MVP was a Three.js diorama (commits 8f6f4eb and 8e4b248, since removed). It was replaced by a flat build that only pretends to have depth, because that is what a paper cut does:

- **A receding board.** The grid is drawn in a mild perspective: rows tighten and narrow toward the far side (`board.js`, `P(p)` maps a point to screen space with a depth scale per row). Discs on the board are flattened to that view; the emblems stand upright on them, as cut-outs do.
- **Thickness everywhere.** Every sheet and every stone has a paper edge under it and a hard, offset shadow from one light, the moon at the upper right. The board sits on its sheet, the sheet on a backing card.
- **Layers inside each stone.** A stone is a hand-cut disc of card plus an emblem of three paper layers; each layer throws a small shadow on the one beneath (`stones.js`).
- **Three cuts of everything.** Every element has three emblem shapes and every disc three hand-cut outlines. A stone keeps its identity (`uid`) from bag to hand to board, so the same stone always looks the same, and a board of Fire I stones is a crowd rather than copies. `tools/gallery.html` shows the whole set.
- **Parallax and tilt.** The scenery behind the table (moon, clouds, hills, dead trees, burning ground, straight from the artboard) drifts in four layers with the pointer, and the board tilts a degree or two toward it. Both switch off under `prefers-reduced-motion`.
- **Everything physical moves.** A placed stone drops, a pushed stone slides, a shattered stone shrinks and throws paper shards, scorched points burn with a flickering three-tone flame, ember glow and rising sparks, Air links are dotted paper threads, cracked Earth armor shows a crack. A drawn stone flies from the bag into the hand along an arc and lands with a bounce.

Why not raster images from Higgsfield for the stones: a real paper cut is layers, and layers are what carry the depth illusion (per-layer shadows, variants by recombination). Vector paths give that for free and keep the build at a few kilobytes; the earlier reference renders in `assets/ref/` remain as style references.

## Phases

| Phase | What | Status |
|---|---|---|
| 0 | Seeded randomness, move log export, replay test | done, 3c1567f |
| 1 | Rules in `engine.js`, shared by the classic game and this build | done, 3c1567f |
| 2 | Design system for board and interface, from the Papercut Noir artboard | done, tokens below |
| 3 | Cut-paper stone library: three variants per element, three disc cuts, ghosts, flames, shards | done, `stones.js` |
| 4 | The pseudo-3D board, hand, bag flight, scenery parallax | done, `board.js` |
| 5 | Screens: title, match, result, Stonecutter, run end, rules | done, `app.js` |
| 6 | Design pass with the user on the live build; sound; touch check on a device | next |
| 7 | Unreal: port `engine.js` to C++ (replay the logs, assert hashes), rebuild the board as UMG with the same layers | after 6 |

## Design tokens

Palette and type come from the Papercut Noir artboard (canvas JUetu6SMAfgKfXce9cb5me, row 2).

| Token | Value | Used for |
|---|---|---|
| night | `#07080c` | ground, scrim |
| card / card-2 / card-3 / card-deep | `#1a1e27` / `#232838` / `#262b3a` / `#12151c` | sheets, the board's sheet and backing, the palm |
| board / grid / labels | `#2a2d38` / `#5a5f70` / `#9aa0b4` | the board paper and its printed grid |
| bone / ash | `#e9e2d2` / `#a8a295` | text, the opponent's stones, labels |
| ink / ink-hi | `#15171d` / `#3a3f4d` | your stones and their cut edge |
| moon / ember / blood | `#d8352a` / `#ff5a36` / `#5a1612` | the moon, danger and scorch glow, the pass button and score backing |
| fire | `#e8343c` `#f7a21b` `#f9d64f` | the three flame layers |
| water | `#145266` `#4a9ee6` `#8bc8ff` | swell, body, foam |
| earth | `#9ad59a` `#1e4f30` `#5fb86a` | peak, slopes, foothill |
| air | `#6f7f96` `#b9c8dd` `#e9e2d2` | cloud layers back to front |
| display type | Nunito 900 italic | titles, numbers, stone names |
| body type | Cabin 500 to 700 | everything else |

The opponent's emblems use darker tones of the same three layers; pips are light on your stones and dark on theirs, as on the artboard. Rules the artboard set and this build keeps: stones, never cards, in the hand; no chrome the artboard lacks; every effect is physical.

## Running it

```bash
./play.sh                      # then open http://127.0.0.1:8000/papercut/
node --test tests/engine.test.mjs
node tools/shot.mjs --url papercut/index.html --ready window.__ready --out shot.png
node tools/shot.mjs --url "papercut/tools/gallery.html?size=96" --ready window.__ready --w 1300 --h 1500 --out gallery.png
```

No build step and no dependencies beyond the Google Fonts. The page needs a web server for the ES modules.
