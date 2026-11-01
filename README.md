# Stones of the Four

A roguelite take on 9×9 Go. You draw Fire, Water, Earth and Air stones from a bag, each element bends the rules of Go in its own way, and each comes in three tiers. Beat three opponents in a row and upgrade your bag between matches.

The whole game is one self-contained file, `index.html`. It needs no build step and has no dependencies beyond two Google Fonts, and it falls back to system fonts when offline.

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

1. You start with 16 tier I stones, four of each element.
2. You face three opponents in order: **Ren the Apprentice**, **Mirela the Adept** and **Ozu the Master**. They all use the same computer player. The only difference is their bag:

   | Opponent | Bag |
   |---|---|
   | Ren | 16× tier I (same as yours) |
   | Mirela | 4× tier I, 12× tier II |
   | Ozu | 4× tier II, 12× tier III |

3. After each match you earn gold and visit **the Stonecutter**, where you can upgrade a stone's tier, transmute its element, remove it, or buy new stones from a market.
4. You have 2 lives. A loss costs one, and you rematch the same opponent after shopping.

## Rules

- On your turn, play one of the 3 stones in your hand on an empty point, then draw back up to 3. Used stones are reshuffled when the bag runs out.
- Normal Go capture rules apply: a group with no liberties is captured, suicide is illegal, and ko applies.
- Each side gets 30 turns. Two passes in a row also end the match.
- Area scoring is used, and the opponent, who moves second, gets 2.5 komi.

### Clash

Fire beats Air, Air beats Earth, Earth beats Water and Water beats Fire. Place a stone next to an enemy stone of the element it beats **and a lower tier**, and that stone shatters. That's one shatter per placement. Tier I stones never shatter anything.

### Elements by tier

| | Tier I | Tier II | Tier III |
|---|---|---|---|
| **Fire** | Scorches adjacent empty points for 1 enemy turn | …for 2 enemy turns | Adjacent and diagonal points, 2 enemy turns |
| **Water** | Pushes adjacent enemy tier I stones 1 point | Pushes enemy stones up to tier II | Pushes any enemy stone up to 2 points |
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
index.html   the game (HTML, CSS and JavaScript in one file)
play.sh      local launcher with option parsing and --help
```

Your best result is kept in your browser's `localStorage`.
