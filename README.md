# Finca v0.7

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
| Click / tap a plant in the garden bed | Walk there and harvest it into the basket (shown under the hearts) |
| Click / tap Bruna with a carrot in the basket | Feed her the carrot: she munches happily and nearby guests get an extra heart |
| Click / tap the stove | Walk to the stove and open the cooking menu |
| Arrow keys / WASD | Walk as Biel (cancels a click path) |
| E | Talk to a nearby guest, pet or feed a nearby animal, harvest a nearby plant, open the cooking menu at the stove, or close the dialog |
| K | Cook: walk to the stove and open the cooking menu (press again to confirm) |
| In the cooking menu | 1, 2, 3 or tap a card to cook; arrow keys and E / Enter to choose; Esc or tap outside to go back |
| Round arrow button (top right) | Start over: a friendly question with two big picture buttons, "Nein" is preselected (arrows and Enter, or Esc to close) |
| M or speaker button (top right) | Music and sounds on or off (saved in the browser) |
| Fullscreen button (top right) | Fullscreen on or off |
| Sprechen / Kochen buttons | Big round buttons on phones and tablets, same as E and K |
| Enter / Space / tap | Close the dialog; after "Bona nit!" start the next day |
| Backquote (the key left of 1) | Toggle the debug overlay (FPS, seed, needs, paths) |

Music starts softly after the first click, tap or key press (browsers do not allow sound before that).

## Saved game and starting over
The game remembers where you were: day, clock time, hearts, basket, garden and the plates on the table are stored in the browser (localStorage, key `finca.spielstand`, with a format number so later versions can recognize old saves). It saves every 5 seconds, in the evening, at the new morning and when the tab is hidden. If you leave in the evening, the next visit starts directly with the next morning. Broken or unknown data is simply ignored and a fresh day starts. If the browser blocks storage (private window), the game still runs, it just does not remember.

"Neu anfangen" (round arrow button) asks first and then starts again at day 1. The sound setting (on or off) has its own key and stays as it was.

## Day length (from v0.7)
A game day lasts at most 15 real minutes of active play. The normal pace is about 40 seconds per game hour, so a day without pauses takes about 11 minutes. If the clock falls behind (an open question, a slow device), it gently speeds up so the evening always arrives in time. The time keeps counting in the cooking menu and in the start over question, it is saved with the game, and "Neu anfangen" or reloading does not reset it. A hidden tab counts as a pause. About 90 seconds before the limit (or from 21:30 game time) dusk comes: the sky in the day arc turns to night, the moon rises, windows and lanterns switch on one by one with a soft chime, and then a circle closes around Biel before the "Bona nit" scene.

## For children who cannot read yet
Everything important can be understood without reading:
- The top left shows pictures instead of text: a small day arc with the sun (or the moon at night), a face for every guest with five hearts below (a gold ring when all five are full) and the basket with the harvest.
- Every tap shows a small ring where the finger touched. Biel wears a straw hat and stands on a soft golden ring.
- If nothing happens for a few seconds, a pulsing pink arrow with a small picture bubble shows the next useful step (speech bubble for a guest, the fruit for a plant, a pot for the stove, a carrot for Bruna), with a soft ring on the ground and a quiet "pling" at most every 20 seconds. Targets off screen get a round badge with an arrow at the edge. The hint waits longer once a child has done that action a few times, and disappears on the next tap.
- In the cooking menu the dish that works best right now gets the arrow, dishes with missing ingredients look faded and cookable ones get a green check.
- If an ingredient is missing, Biel shows a thought bubble with the missing fruit and a questioning "hmm"; the arrow then points to the right plant. Tapping an unripe plant makes it wiggle with a little sprout in the bubble.
- Harvested fruit flies in an arc into the basket, the basket slot hops and goes "plopp".
- In the evening a golden sun pulses where to tap for the next day. Right after the evening starts, taps are ignored for 1.5 seconds so the moment is not skipped by accident.

## Touch and stability
- Bigger buttons on phones. A second finger or a quick double tap (within 280 ms at the same spot) does not count. Taps next to a guest, animal, plant or the stove still hit it.
- Small phones held sideways get the Sprechen and Kochen buttons in a row at the bottom right, safe areas (notch) are respected, the "turn your phone" hint is an animated picture.
- An error guard keeps the loop running: if something goes wrong in a frame, the game cleans up (closes menus, puts Biel back on a free spot) and continues.
- The static background (map and flowers) is drawn once into an offscreen canvas and copied each frame, only water and the table are redrawn live. This cuts drawing time per frame by about 40 percent.

## Dishes
| Dish | Plates | Cooking time | Effect at the table |
|---|---|---|---|
| Pa amb oli | 3 | 5 s | fills up fastest |
| Ensaïmada | 2 | 4 s | sweet, guests also get more Spielen (Mia's favorite) |
| Tumbet | 4 | 8 s | warm and cozy, guests also get more Ruhe (Jonas's favorite) |

## Garden and ingredients
Next to the house there is a small garden bed with tomatoes (tomàtiga) and carrots (pastanaga), plus an orange tree (taronja) and two olive trees (oliva). Click a ripe plant to harvest it into the basket (up to 9 of each). A harvested plant gently grows back within one and a half to two game hours, and every new day everything is ripe again.

Dishes use ingredients: Pa amb oli wants 1 tomato and 1 olive, Ensaïmada 1 orange, Tumbet 2 tomatoes. It stays forgiving: Pa amb oli always works from a small basic stock, even with an empty basket, so nobody ever gets stuck. With fresh ingredients from the basket it gives one extra plate. If something is missing for Ensaïmada or Tumbet, Biel kindly says what he still needs from the garden. The cooking menu shows the ingredients on each card.

Carrots are for Bruna: with a carrot in the basket, clicking her feeds her instead of petting. She munches with the carrot in her mouth, and guests nearby get a whole extra heart.

## Guests
| Guest | Age | Favorite dish | Likes |
|---|---|---|---|
| Mia | 7 | Ensaïmada | playing and the pool |
| Jonas | 41 | Tumbet | quiet time on the couch |
| Padrina | 78 | Pa amb oli | the couch, little walks to Bruna's fence, Mallorcan sayings like "Poc a poc" |

Padrina is the grandmother of the house: grey bun, glasses, walks slowly and needs more rest. Her favorite is Pa amb oli, the dish that always works, so every guest has a different favorite.

## Happiness and daily goal
Every guest has five little hearts (shown top left). Guests get happier when you talk to them, when they eat (their favorite dish gives the most), after a swim in the pool or a rest on the couch, when you pet an animal close to them, and a lot when you feed Bruna a carrot close to them. The gentle daily goal is "Alle Gäste glücklich" (all guests have five hearts). Hearts never go down, there is no failing: in the evening the scene celebrates with floating hearts if the goal was reached, otherwise it simply says goodbye until tomorrow. Every new day starts fresh with one heart per guest.

In the evening the music changes to a sparser, warmer lullaby variant of the same chords (crossfading from 18:30), and from 20:30 very quiet crickets chirp.

The table holds at most 6 plates. Guests take their favorite dish when it is there.

Developer helpers: `?start=x,y` places Biel on a tile, `?debug=1` opens the debug overlay, `?touch=1` shows the touch buttons on a desktop, `?menue=1` opens the cooking menu right away, `?uhr=20` sets the clock to 20:00, `?abend=1` jumps to the evening scene, `?herzen=1` makes all guests almost happy, `?korb=1` puts three of every ingredient in the basket, `?neu=1` deletes the saved game. With any developer helper except `?neu=1` the saved game is neither loaded nor overwritten.

## Structure
- `index.html` loads the scripts in this order: rng, karte, pfad, kamera, eingabe, uhr, spieler, gerichte, garten, glueck, gaeste, tiere, speicher, hinweise, render, ton, main. Everything hangs on `globalThis.Dorf`.
- `js/rng.js` – mulberry32
- `js/karte.js` – 40x30 Finca map with kitchen, living room and guest house, furniture, collision, target locations
- `js/pfad.js` – A* (4 directions)
- `js/kamera.js` – lerp camera, clamped to the map
- `js/eingabe.js` – keyboard and pointer (mouse, touch, pen)
- `js/uhr.js` – 06:00 to 23:00, 40 s per game hour, daylight tint
- `js/spieler.js` – Biel (4 directions, walk animation, click to walk along an A* path)
- `js/gerichte.js` – the three dishes (plates, cooking time, effects, colors, ingredients)
- `js/garten.js` – garden bed and fruit trees, harvesting, gentle regrowth, basket, ingredient check
- `js/glueck.js` – hearts per guest and the daily goal (never decreasing, reset each day)
- `js/gaeste.js` – Mia (7), Jonas (41) and Padrina (78) with the needs Satt, Spielen and Ruhe
- `js/tiere.js` – Bruna the donkey on her fenced meadow and the gecko on the house wall (own random generator)
- `js/speicher.js` – saved game in localStorage with format number, checking and clamping all values
- `js/hinweise.js` – picture hints for children who cannot read yet (what to do next, when to show it)
- `js/render.js` – drawing (cached background, tiles, sprites, HUD, hints, dialog, debug)
- `js/ton.js` – WebAudio music (plucked guitar-like loop in A minor, 66 BPM, Karplus-Strong) and soft sound effects, evening variant with crossfade, crickets at night, mute toggle
- `js/main.js` – game loop with error guard, cooking menu, start over question, saving, buttons, fullscreen

## Tests
```
node tests/run.js
```
Uses only Node's built-in `vm` module. Nothing has to be installed. 85 tests, including a ten day soak test with random taps, keys, start over questions and a save and load every day.

## Version history
- **v0.7** (23.10.2026): new look after a design review. Calmer pastel palette with darker, quieter ground and stronger character colors, outlines in the color of each object, silver green olive trees, a wooden frame around the garden bed, sparse courtyard stones and a stone ring around the well. Light is now multiplied with a color per time of day, and at dusk windows, five lanterns, the stove and a little lantern in Biel's hand glow. Text free HUD with day arc, guest faces and hearts. Biel with a straw hat and a ring under his feet, tap ring, rounded system font, round buttons with colored rims, a play triangle instead of a green cross on "Nein". Hard limit of 15 real minutes per game day with a visible dusk and a closing circle before "Bona nit".
- **v0.6** (23.10.2026): polish and stability. Saved game in the browser (day, hearts, basket, clock, garden, table) with a format number, gentle "Neu anfangen" button with a picture question, sound setting kept. Picture hints for children who cannot read yet: pulsing arrow with an icon bubble after a short pause, thought bubble for missing ingredients, fruit flying into the basket, wiggling unripe plants, pulsing sun in the evening, new soft sounds. Error guard so the loop never freezes, evening tap lock, double tap filter, bigger touch buttons and a layout for small phones held sideways. Background drawn once and cached. Rounder Padrina with a pink hair band. Ten day soak test.
- **v0.5** (23.10.2026): small garden bed with tomatoes and carrots plus an orange tree and olive trees, harvest by click, tap or E, plants grow back gently during the day and are all ripe again each morning. Dishes use ingredients but stay forgiving: Pa amb oli always works from a small basic stock, fresh ingredients give an extra plate. Feed Bruna carrots for a cute munching reaction and an extra heart for nearby guests. Third guest Padrina, a grandmother who loves the couch and Pa amb oli, with her own sayings; the daily goal now counts all three guests.
- **v0.4** (23.10.2026): hearts for every guest and a gentle daily goal "Alle Gäste glücklich" with a soft celebration in the evening scene, no failing. Bruna the donkey on a small fenced meadow and a gecko on the house wall, pet them by click, tap or E for a heart and a little sound. Evening music variant and quiet crickets at night, crossfading with the day loop.
- **v0.3** (23.10.2026): calm background music made in code (soft plucked guitar loop, slow tempo, low volume), starts after the first interaction. Mute with M or the speaker button, saved in the browser. Very quiet steps, a soft fountain and pool sound nearby, a cute chime when talking and cooking. Big Sprechen and Kochen buttons on phones and tablets, fullscreen button, hint to hold the phone sideways. Cooking menu with three dishes (Pa amb oli, Ensaïmada, Tumbet) with different effects; Mia and Jonas have favorite dishes.
- **v0.2** (23.10.2026): stronger pastel colors and rounder, cuter chibi figures with big eyes and soft outlines. Click or tap to walk, click a guest to talk. Rooms about 20 percent larger and furnished (couch, armchairs, rug, plants, corner bench, sideboard, bed). New need Ruhe: tired guests rest on the couch. Biel can cook pa amb oli at the stove, guests eat the plates at the table and get full twice as fast. Debug key moved from F1 to Backquote.
- **v0.1** (23.10.2026): first skeleton with map, Biel, two guests with needs, day clock and dialog.

## Note
This folder contains no passwords, tokens or other credentials.
