# Stones of the Four

A roguelite take on 9×9 Go. You draw stones from a bag. Up to half of them are element stones (Fire, Water, Earth and Air), each bending the rules of Go in its own way across three tiers. The rest are plain Go stones. Beat three opponents in a row and upgrade your bag between matches.

The classic game is two files: `index.html` (the screens and the board) and `engine.js` (the rules). It needs no build step and has no dependencies beyond a few Google Fonts, and it falls back to system fonts when offline.

There is also a second front end, the **Papercut Noir build** in `papercut/`: the same rules shown as a cut-paper diorama in 3D, with paper stones carrying generated emblems, lit by a red moon. See [papercut/PLAN.md](papercut/PLAN.md).

It ships with two looks, switched with the **Look** button in the top bar and remembered in your browser: **Papercut**, the default, is layered dark cut paper with a red moon and burning ground behind the board; **Classic** is the slate frame and wooden board.

## Play

```bash
./play.sh              # serve on http://127.0.0.1:8000 and open your browser
./play.sh --help       # all options
```

`play.sh` starts a local web server with `python3 -m http.server` and opens the game. Useful options:

| Option | What it does |
|---|---|
| `-p, --port PORT` | Port to listen on (default 8000, or `$PLAY_PORT`) |
| `-H, --host HOST` | Address to bind (default 127.0.0.1). Use `0.0.0.0` to play on a phone on the same network |
| `-n, --no-open` | Don't open a browser, just print the URL |
| `-f, --file` | Open `index.html` straight from disk, no server or Python needed |
| `-q, --quiet` | Hide the server's request log |

You can also just double-click `index.html`.

## How a run works

1. You start with 16 stones: 8 plain stones and 8 tier I element stones, two of each element.
2. You face three opponents in order: **Ren the Apprentice**, **Mirela the Adept** and **Ozu the Master**. They all use the same computer player. The only difference is their bag:

   | Opponent | Bag |
   |---|---|
   | Ren | 8 plain, 8× tier I element (same as yours) |
   | Mirela | 8 plain, 8× tier II element |
   | Ozu | 8 plain, 8× tier III element |

3. After each match you earn gold and visit **the Stonecutter**, where you can upgrade an element stone's tier, transmute its element, infuse a plain stone with an element, add plain stones, remove stones, or buy element stones from a market.
4. You have 2 lives. A loss costs one, and you rematch the same opponent after shopping.

## Rules

- On your turn, play one of the 3 stones in your hand on an empty point, then draw back up to 3. Used stones are reshuffled when the bag runs out.
- **At most half of every bag can be element stones.** The rest are plain stones: ordinary Go stones with no element. Plain stones can't be shattered, but Water can push them. Every 2 plain stones you add make room for 1 more element stone.
- Normal Go capture rules apply: a group with no liberties is captured, suicide is illegal, and ko applies.
- Each side gets 30 turns. Two passes in a row also end the match.
- Area scoring is used, and the opponent, who moves second, gets 2.5 komi.

### Clash

Fire beats Air, Air beats Earth, Earth beats Water and Water beats Fire. Place a stone next to an enemy stone of the element it beats **and a lower tier**, and that stone shatters. That's one shatter per placement. Tier I stones never shatter anything.

### Elements by tier

| | Tier I | Tier II | Tier III |
|---|---|---|---|
| **Fire** | Scorches adjacent empty points for 1 enemy turn | …for 2 enemy turns | Adjacent and diagonal points, 2 enemy turns |
| **Water** | Pushes adjacent enemy plain and tier I stones 1 point | Pushes enemy plain, tier I and tier II stones | Pushes any enemy stone up to 2 points |
| **Earth** | Its group survives 1 enemy turn when surrounded | 2 enemy turns | 3 enemy turns |
| **Air** | Connects diagonally | + across a one-point jump | + at a knight's move |

Scorched points block the enemy and don't count as their liberties. Earth armor comes back once the group can breathe again. Air links are real connections, so linked stones share liberties.

## Controls

- Hover over a point (or tap once on touch screens) to preview exactly what your move does. Click, or tap again, to place.
- `1` `2` `3` select a stone from your hand.
- When the board has focus, the arrow keys move the cursor and `Enter` places a stone.
- Pass needs a second click to confirm.

## Project layout

```
index.html        the classic game: screens, SVG board, input, the two looks (HTML, CSS and JavaScript)
engine.js         the rules: constants, geometry, captures, elements, scoring, the computer player, bags, the run and the shop
papercut/         the Papercut Noir build: index.html, app.js (screens), scene.js (Three.js diorama), assets/models/*.glb, PLAN.md
tests/            node --test tests/engine.test.mjs: determinism, replay and edge-rule contract
tools/shot.mjs    headless Edge screenshot of any page in the repo (node tools/shot.mjs --url papercut/index.html --out shot.png)
play.sh           local launcher with option parsing and --help
```

Both front ends load `engine.js` and share every rule. The engine uses no `Math.random` inside a match: shuffles, the computer player's tie-break noise and the market draw from seeded streams, so a match replays from its seed and move log to the same board hash. The result screen's **Save move log** writes that JSON; `SOTF.replayLog(log)` replays it.

To play the Papercut build, serve the folder (`./play.sh`) and open `http://127.0.0.1:8000/papercut/`. It needs a web server because it loads 3D models and ES modules, and it fetches Three.js from jsdelivr.

Your best result is kept in your browser's `localStorage`.
