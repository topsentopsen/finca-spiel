# Finca – Spielskelett

A small browser game with a handheld look, written in pure JavaScript. There is no build, no npm and there are no external assets.

## Start
Double-click `index.html`. The game runs directly over `file://`.

Optional: `index.html?seed=12345` uses a different seed for flowers and guest decisions. The default seed is 20261023.

## Controls
| Key | Action |
|---|---|
| Arrow keys / WASD | Walk as Biel |
| E | Talk to a nearby guest, or close the dialog |
| Enter / Space | Close the dialog; after "Bona nit!" start the next day |
| F1 | Toggle the debug overlay (FPS, seed, needs, paths) |

## Structure
- `index.html` loads the scripts in this order: rng, karte, pfad, kamera, eingabe, uhr, spieler, gaeste, render, main. Everything hangs on `globalThis.Dorf`.
- `js/rng.js` – mulberry32
- `js/karte.js` – 40x30 Finca map, collision, target locations
- `js/pfad.js` – A* (4 directions)
- `js/kamera.js` – lerp camera, clamped to the map
- `js/eingabe.js` – keyboard
- `js/uhr.js` – 06:00 to 23:00, 40 s per game hour, daylight tint
- `js/spieler.js` – Biel (16x24, 4 directions, walk animation)
- `js/gaeste.js` – Mia (7) and Jonas (41) with the needs Satt and Spielen
- `js/render.js` – drawing (tiles, sprites, HUD, dialog, debug)
- `js/main.js` – game loop

## Tests
```
node tests/run.js
```
Uses only Node's built-in `vm` module. Nothing has to be installed.

## Note
This folder contains no passwords, tokens or other credentials.
