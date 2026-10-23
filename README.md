# Finca v0.4

A small browser game with a handheld look, written in pure JavaScript. There is no build, no npm and there are no external assets. Music and sounds are generated in code with WebAudio.

## Start
Double-click `index.html`. The game runs directly over `file://`.

Optional: `index.html?seed=12345` uses a different seed for flowers and guest decisions. The default seed is 20261023.

## Controls
| Input | Action |
|---|---|
| Mouse click / tap | Walk there (A* path, a little heart marks the target) |
| Click / tap a guest | Walk next to the guest and talk |
| Click / tap Bruna the donkey or the gecko | Walk to the animal (Bruna trots to the fence) and pet it: a heart and a little sound |
| Click / tap the stove | Walk to the stove and open the cooking menu |
| Arrow keys / WASD | Walk as Biel (cancels a click path) |
| E | Talk to a nearby guest, pet a nearby animal, open the cooking menu at the stove, or close the dialog |
| K | Cook: walk to the stove and open the cooking menu (press again to confirm) |
| In the cooking menu | 1, 2, 3 or tap a card to cook; arrow keys and E / Enter to choose; Esc or tap outside to go back |
| M or speaker button (top right) | Music and sounds on or off (saved in the browser) |
| Fullscreen button (top right) | Fullscreen on or off |
| Sprechen / Kochen buttons | Big round buttons on phones and tablets, same as E and K |
| Enter / Space / tap | Close the dialog; after "Bona nit!" start the next day |
| Backquote (the key left of 1) | Toggle the debug overlay (FPS, seed, needs, paths) |

Music starts softly after the first click, tap or key press (browsers do not allow sound before that).

## Dishes
| Dish | Plates | Cooking time | Effect at the table |
|---|---|---|---|
| Pa amb oli | 3 | 5 s | fills up fastest |
| Ensaïmada | 2 | 4 s | sweet, guests also get more Spielen (Mia's favorite) |
| Tumbet | 4 | 8 s | warm and cozy, guests also get more Ruhe (Jonas's favorite) |

## Happiness and daily goal
Every guest has five little hearts (shown top left). Guests get happier when you talk to them, when they eat (their favorite dish gives the most), after a swim in the pool or a rest on the couch, and when you pet an animal close to them. The gentle daily goal is "Alle Gäste glücklich" (all guests have five hearts). Hearts never go down, there is no failing: in the evening the scene celebrates with floating hearts if the goal was reached, otherwise it simply says goodbye until tomorrow. Every new day starts fresh with one heart per guest.

In the evening the music changes to a sparser, warmer lullaby variant of the same chords (crossfading from 18:30), and from 20:30 very quiet crickets chirp.

The table holds at most 6 plates. Guests take their favorite dish when it is there.

Developer helpers: `?start=x,y` places Biel on a tile, `?debug=1` opens the debug overlay, `?touch=1` shows the touch buttons on a desktop, `?menue=1` opens the cooking menu right away, `?uhr=20` sets the clock to 20:00, `?abend=1` jumps to the evening scene, `?herzen=1` makes all guests almost happy.

## Structure
- `index.html` loads the scripts in this order: rng, karte, pfad, kamera, eingabe, uhr, spieler, gerichte, glueck, gaeste, tiere, render, ton, main. Everything hangs on `globalThis.Dorf`.
- `js/rng.js` – mulberry32
- `js/karte.js` – 40x30 Finca map with kitchen, living room and guest house, furniture, collision, target locations
- `js/pfad.js` – A* (4 directions)
- `js/kamera.js` – lerp camera, clamped to the map
- `js/eingabe.js` – keyboard and pointer (mouse, touch, pen)
- `js/uhr.js` – 06:00 to 23:00, 40 s per game hour, daylight tint
- `js/spieler.js` – Biel (4 directions, walk animation, click to walk along an A* path)
- `js/gerichte.js` – the three dishes (plates, cooking time, effects, colors)
- `js/glueck.js` – hearts per guest and the daily goal (never decreasing, reset each day)
- `js/gaeste.js` – Mia (7) and Jonas (41) with the needs Satt, Spielen and Ruhe
- `js/tiere.js` – Bruna the donkey on her fenced meadow and the gecko on the house wall (own random generator)
- `js/render.js` – drawing (tiles, sprites, HUD, dialog, debug)
- `js/ton.js` – WebAudio music (plucked guitar-like loop in A minor, 66 BPM, Karplus-Strong) and soft sound effects, evening variant with crossfade, crickets at night, mute toggle
- `js/main.js` – game loop, cooking menu, buttons, fullscreen

## Tests
```
node tests/run.js
```
Uses only Node's built-in `vm` module. Nothing has to be installed.

## Version history
- **v0.4** (23.10.2026): hearts for every guest and a gentle daily goal "Alle Gäste glücklich" with a soft celebration in the evening scene, no failing. Bruna the donkey on a small fenced meadow and a gecko on the house wall, pet them by click, tap or E for a heart and a little sound. Evening music variant and quiet crickets at night, crossfading with the day loop.
- **v0.3** (23.10.2026): calm background music made in code (soft plucked guitar loop, slow tempo, low volume), starts after the first interaction. Mute with M or the speaker button, saved in the browser. Very quiet steps, a soft fountain and pool sound nearby, a cute chime when talking and cooking. Big Sprechen and Kochen buttons on phones and tablets, fullscreen button, hint to hold the phone sideways. Cooking menu with three dishes (Pa amb oli, Ensaïmada, Tumbet) with different effects; Mia and Jonas have favorite dishes.
- **v0.2** (23.10.2026): stronger pastel colors and rounder, cuter chibi figures with big eyes and soft outlines. Click or tap to walk, click a guest to talk. Rooms about 20 percent larger and furnished (couch, armchairs, rug, plants, corner bench, sideboard, bed). New need Ruhe: tired guests rest on the couch. Biel can cook pa amb oli at the stove, guests eat the plates at the table and get full twice as fast. Debug key moved from F1 to Backquote.
- **v0.1** (23.10.2026): first skeleton with map, Biel, two guests with needs, day clock and dialog.

## Note
This folder contains no passwords, tokens or other credentials.
