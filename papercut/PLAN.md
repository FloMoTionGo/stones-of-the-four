# Papercut Noir build: plan and status

The port analysis said three things: the rules engine ports almost mechanically, everything the player sees is a rewrite, and the first commit has to be a seeded random generator plus a move-log exporter. This build follows that order, but the target is the browser, not Unreal.

## Why a Three.js diorama and not Unreal for the MVP

- Unreal is not installed on this machine, and the analysis puts an Unreal build at 4 to 7 weeks. An MVP to try out had to exist today.
- Everything the Papercut Noir artboard faked with CSS is real in WebGL too: paper layers as lit meshes casting shadows from the moon, scorch flames with ember light, shards as debris, the stones as meshes with a paper material. That is the case the analysis made for Unreal, and it holds for Three.js at this scale (one board, a few dozen stones).
- The engine and the move logs are the bridge if Unreal comes later. `engine.js` is pure functions over plain state, `tests/engine.test.mjs` pins the hashes, and a C++ port replays the same JSON logs. Nothing in this build makes that harder.

## Phases

| Phase | What | Status |
|---|---|---|
| 0 | Seeded randomness (mulberry32 streams on the state), move log export, replay test | done, commit 3c1567f |
| 1 | Rules engine out of `index.html` into `engine.js`; the classic game runs on it unchanged | done, commit 3c1567f |
| 2 | One 3D emblem per element from Higgsfield (reference image, then image to 3D) | done, 4 textured GLBs in `assets/models/` |
| 3 | Design system for the interface and the board, taken from the artboard | done, see tokens below |
| 4 | The diorama: board stack, red moon light, horizon of hills and burning ground, paper stones, scorch, shatter, push, air links, hover preview | done, `scene.js` |
| 5 | Screens as paper sheets over the diorama: title, match HUD, result, Stonecutter, run end, rules | done, `app.js` + `index.html` |
| 6 | Polish: bag to hand flight, sound, touch pass on a real device, reduced motion for the 3D effects, narrower layouts | next |

## Design tokens

Palette and type come from the Papercut Noir artboard (canvas JUetu6SMAfgKfXce9cb5me, row 2). They are the same in the HTML sheets and in the diorama's materials.

| Token | Value | Used for |
|---|---|---|
| night | `#07080c` | ground, scrim, fog |
| card / card-2 / card-3 / card-deep | `#1a1e27` / `#232838` / `#262b3a` / `#12151c` | paper sheets, the board's sheet and backing, the hand tray |
| board / grid / labels | `#2a2d38` / `#646a7c` / `#9aa0b4` | the board paper and its printed grid |
| bone / ash | `#e9e2d2` / `#a8a295` | text, the opponent's stones, labels |
| ink / ink-hi | `#0a0b0f` / `#3a3f4d` | your stones and their cut edge |
| moon / ember / blood | `#d8352a` / `#ff5a36` / `#5a1612` | the moon, danger and scorch glow, the pass button and score backing |
| fire | `#e8343c` `#f7a21b` `#f9d64f` | the three flame tones |
| water / earth / air | `#4a9ee6` / `#5fb86a` / `#b9c8dd` | emblem tints, pips (light for you, dark for the opponent) |
| display type | Nunito 900 italic | titles, numbers, stone names |
| body type | Cabin 500 to 700 | everything else |

Paper vocabulary: a sheet has a hard black drop (`0 5px 0 #000`) under a soft one, sits slightly rotated, and is torn or tagged at the edge. Mottle and grain overlays sit over everything, canvas included. Your stones are black card with a lighter cut edge; the opponent's are bone, the brightest things on the board.

Rules the artboard set and this build keeps: stones, never cards, in the hand; no chrome the artboard lacks (no coins, scrolls, shields); every effect is physical (scorch burns, shatter throws shards, push slides the stone, air links are dotted paper threads, cracked armor shows as a crack).

## Asset pipeline (Higgsfield, free plan)

Reference images: Z Image (`z_image`, 0.15 credits each), prompt pattern "a single papercraft sculpture of a stylised {flame | cresting wave | mountain mound | cumulus cloud} built from stacked layers of thick coloured card, …, no base, plain white background, three-quarter view". The PNGs are in `assets/ref/` (not committed; 5 MB each).

3D: SAM 3D Objects (`sam_3_3d`, 1.3 credits each) with `--export_textured_glb true`. The Meshy-based models (`multi_image_to_3d`, `image_to_3d`) and Tripo (9 credits) did not fit the remaining balance; GPT Image needs the Basic plan. Each GLB is one mesh with one baked texture: fire 4.8k triangles, water 24.5k, earth 41.9k, air 8.6k. The meshes do not share an up or front axis; `scene.js` rotates each into place (`EMBLEM` table) and scales them to a common height.

The disc under every emblem is procedural (a cylinder with a paper material) so one GLB serves both owners: the opponent's copy is the same mesh with its material tinted dark. Tier pips and the tier III ring are procedural too. The fire GLB doubles as the flame on scorched points.

## Running it

```bash
./play.sh                # then open http://127.0.0.1:8000/papercut/
node --test tests/engine.test.mjs
node tools/shot.mjs --url papercut/index.html --ready window.__ready --out shot.png
```

The build needs a web server (the GLBs and ES modules do not load from `file://`). Three.js comes from jsdelivr, pinned to 0.170.0.

## Next

1. The bag to hand flight the artboard shows, and a draw sound.
2. A real touch pass (tap twice is wired, untested on a device).
3. Reduced motion: the HTML respects it, the 3D effects do not yet.
4. Layouts under 900 px wide.
5. If Unreal: port `engine.js` to a C++ struct plus static functions, replay the logs that `tests/` produces, assert equal hashes, then rebuild `scene.js` as world-space actors and `app.js` as UMG.
