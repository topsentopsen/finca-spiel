# Finca v0.19

A small browser game with a handheld look, written in pure JavaScript. There is no build and no npm. Music and sounds are generated in code with WebAudio; from v0.13 the evening lullaby is one small MP3 in `assets/` (no other media files).

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
| E | Do the fitting action nearby: pick up an egg, talk to a nearby guest, pet or feed a nearby animal, harvest a nearby plant, open the cooking menu at the stove, or close the dialog |
| K | Cook: walk to the stove and open the cooking menu (press again to confirm) |
| In the cooking menu | 1, 2, 3 or tap a card to cook; arrow keys and E / Enter to choose; Esc or tap outside to go back |
| Gear button (top right, small and pale) | Parent area: hold it for 3 seconds (a ring fills up; Enter held for 3 seconds also works). A short tap does nothing, so children do not open it by accident. The game pauses while it is open |
| Click / tap the guitar, castanets or drum (courtyard) | Walk there and play a soft note that fits the chord of the music; notes float up, nearby guests get a little happiness |
| M or speaker button (top right) | Music and sounds on or off (saved in the browser) |
| Fullscreen button (top right) | Fullscreen on or off |
| Action button | One big round button on phones and tablets (bottom right). Its picture shows what it will do right now (egg, talk, pet, harvest, cook) and it does exactly that, same as E |
| Click / tap a hen or an egg | Walk there and collect the egg into the basket |
| Click / tap a fish in the sea | Bubbles and a little heart (from v0.19); fish swim on their own |
| Read aloud button (top right) | Only shown if the browser has a German voice. Short calm lines are read aloud; off when the sound is off, pressing it while muted turns the sound back on (saved in the browser) |
| B or book button (top right) | Open or close the picture book: recipe pages and the sticker album. Tap the right half or press the right arrow to turn forward, the left half or left arrow to turn back; the pot tab jumps to the recipes, the star tab to the album; the X, Esc, B or a tap next to the book closes it. The book button in the cooking menu opens the recipe of the selected dish |
| Enter / Space / tap | Close the dialog; after "Bona nit!" start the next day |
| Backquote (the key left of 1) | Toggle the debug overlay (FPS, seed, needs, paths) |

Music starts softly after the first click, tap or key press (browsers do not allow sound before that).

## Saved game and starting over
The game remembers where you were: day, clock time, hearts, basket, garden and the plates on the table are stored in the browser (localStorage, key `finca.spielstand`, with a format number so later versions can recognize old saves). It saves every 5 seconds, in the evening, at the new morning and when the tab is hidden. If you leave in the evening, the next visit starts directly with the next morning. Broken or unknown data is simply ignored and a fresh day starts. If the browser blocks storage (private window), the game still runs, it just does not remember.

"Neu anfangen" is in the parent area (from v0.10); it asks first and then starts again at day 1 for the current picture. It does not give back play time. The sound setting (on or off) has its own key and stays as it was.

## Pictures (profiles) and the daily time rule (from v0.10)
At the first start the game asks "Wer spielt?" with three big pictures (donkey, hen, gecko). Each picture has its own saved game, hearts and sticker album (keys `finca.spielstand.<picture>` and `finca.album.<picture>`; an old v0.9 save moves to the donkey).

Time rule (chosen and tested): **15 minutes per picture per calendar day**. Real play seconds are booked in `finca.zeitkonto` together with the date. Reloading, "Neu anfangen", switching pictures or `?neu=1` never give time back. Whoever played today comes straight back into their own picture after a reload. When a picture's day is over, the chooser shows "Schlafenszeit" — **only that picture sleeps**. Siblings who still have minutes stay tippable (from v0.18; earlier versions locked every picture). If every picture is done, a clear tip points to the parent gear (hold 3 seconds) or waiting until midnight. Gear, mute and read-aloud stay usable; the screen must not freeze. At midnight every picture gets a new 15 minutes; an open chooser notices this within 2 seconds.

From v0.11 parents can set the minutes per picture between 5 and 15 (stored in `finca.grenzen`). 15 is the hard upper limit and can never be exceeded. A lower limit counts immediately: if a picture has already played longer today, its evening starts right away. Raising the limit wakes a sleeping picture again if at least 30 seconds are left. The game clock goes a bit faster on a shorter day, so the evening still arrives in time.

Two minutes before the time is up Biel says once "Bald ist Abend. Noch ein bisschen spielen!" with a soft two note sound, and a small moon slowly fades in at the top right of the day arc (no blinking).

When a picture is chosen, its name is read aloud ("Esel!", "Huhn!", "Gecko!"), also when moving with the arrow keys; a sleeping picture says "Der Esel schläft. Morgen geht es weiter."

## Parent area (from v0.10)
Hold the gear button for 3 seconds. Shows the minutes played today per picture, the switch "Weniger Bewegung" (no hopping, glittering or pulsing, birds stay put; taken from the system setting the first time and saved in `finca.ruhig`), "Anderes Bild" and "Neu anfangen". Esc, the X or a tap outside closes it.

From v0.11 it also shows, per picture, minus and plus buttons for the daily minutes (5 to 15) and a small bar chart of the last 7 days (today darker, a dot for days without play; stored in `finca.woche`, at most 14 days kept). The button "Sichern" opens a window with a backup code (starts with `FINCA1-`, has a checksum). "Code kopieren" copies it; on another device paste it and press "Übernehmen", then the game restarts with the saved games, albums and settings of all pictures. The code never contains the play time of today (`finca.zeitkonto`), so it cannot be used to get extra minutes. A wrong or incomplete code is rejected with a short message and nothing changes.

## Phone zoom (from v0.10)
On small touch screens (shorter side under 500 px) the world is drawn 1.25 times bigger so Biel and the guests are easier to see; hearts, menus and the book keep their full size on their own layer. `?zoom=1` or `?zoom=1.25` forces it.

## Day length (from v0.7)
A game day lasts at most 15 real minutes of active play. The normal pace is about 40 seconds per game hour, so a day without pauses takes about 11 minutes. If the clock falls behind (an open question, a slow device), it gently speeds up so the evening always arrives in time. The time keeps counting in the cooking menu and in the start over question, it is saved with the game, and "Neu anfangen" or reloading does not reset it. A hidden tab counts as a pause. About 90 seconds before the limit (or from 21:30 game time) dusk comes: the sky in the day arc turns to night, the moon rises, windows and lanterns switch on one by one with a soft chime, and then a circle closes around Biel before the "Bona nit" scene.

## For children who cannot read yet
Everything important can be understood without reading:
- The top left shows pictures instead of text: a small day arc with the sun (or the moon at night), a face for every guest with five hearts below (a gold ring when all five are full) and the basket with the harvest.
- Instruments: tapping one instrument three times in a row plays a little tune; after a tune the music sticker is given in the evening (once in the album it stays there).
- Every tap shows a small ring where the finger touched. Biel wears a straw hat and stands on a soft golden ring.
- If nothing happens for a few seconds, a pulsing pink arrow with a small picture bubble shows the next useful step (speech bubble for a guest, the fruit for a plant, a pot for the stove, a carrot for Bruna), with a soft ring on the ground and a quiet "pling" at most every 20 seconds. Targets off screen get a round badge with an arrow at the edge. The hint waits longer once a child has done that action a few times, and disappears on the next tap.
- In the cooking menu the dish that works best right now gets the arrow, dishes with missing ingredients look faded and cookable ones get a green check.
- If an ingredient is missing, Biel shows a thought bubble with the missing fruit and a questioning "hmm"; the arrow then points to the right plant. Tapping an unripe plant makes it wiggle with a little sprout in the bubble.
- Harvested fruit flies in an arc into the basket, the basket slot hops and goes "plopp".
- In the evening a golden sun pulses where to tap for the next day. Right after the evening starts, taps are ignored for 4 seconds so the hearts and the sticker can be seen first.
- From v0.9 the cooking cards are pure pictures: the dish on a colored plate, the face of the guest who loves it, the ingredients (missing ones as a dashed circle) and the egg in its own golden slot. If something is missing the card wiggles with a soft "bloop" and the menu closes by itself, so the hint arrow can show the way to the right plant.
- From v0.9 "Bona nit" is a picture scene: a starry sky with the moon, string lights, the guests at a long table with their favorite dish. Their hearts count up one by one with a soft pling, then the sticker of the day pops up and flies into the book button. Only the words "Bona nit!" are written.
- The picture book shows each recipe as ingredients, an arrow and the plates you get, the egg bonus as an extra plate, and who loves the dish. The album has twelve round stickers (sun, donkey, egg, tomato, the three dishes, heart, hen, gecko, moon, star); missing ones are dashed outlines, the newest one glows, a dot on the book button shows a new sticker. The album is saved separately (`finca.album`) and stays when starting over.
- Guests show small thought clouds with a picture of what they want now and then (always when the hint points at them), and tired guests yawn now and then (at dusk everyone does), with a very quiet yawn sound.

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
- `index.html` loads the scripts in this order: rng, karte, pfad, kamera, eingabe, uhr, spieler, gerichte, garten, glueck, gaeste, tiere, speicher, sticker, hinweise, vorlesen, render, ton, profile, leben, main. Everything hangs on `globalThis.Dorf`.
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
- `js/sticker.js` – the twelve stickers, which one is earned today (one per day, things done today first), album saving
- `js/hinweise.js` – picture hints for children who cannot read yet (what to do next, when to show it)
- `js/render.js` – drawing (cached background, tiles, sprites, HUD, hints, dialog, debug)
- `js/ton.js` – WebAudio music (plucked guitar-like loop in A minor, 66 BPM, Karplus-Strong) and soft sound effects, evening variant with crossfade, crickets at night, mute toggle, iPhone playback session, lullaby file for "Bona nit"
- `assets/schlaflied-c.mp3` – Variante C lullaby (soft flute, pad, guitar), about 34 s, played once in the evening scene
- `js/vorlesen.js` – optional read aloud with the browser's built in speechSynthesis (German voice only, slow and calm, only after the first tap, silent when muted)
- `js/profile.js` – the three pictures (profiles), their save keys, the daily time account per picture and calendar day, "Weniger Bewegung" setting
- `js/leben.js` – background life: a few birds and butterflies (own random generator, at most six, gone in the evening)
- `js/main.js` – game loop with error guard, cooking menu, picture chooser, parent area, instruments, start over question, saving, buttons, fullscreen

From v0.12 the parent area also has three switches for reading aloud: "Namen" (short announcements like picture names), "Sätze" (speech bubbles and the evening book) and "Langsam" (about 20 percent slower). They are stored in `finca.vorleseart` and are part of the backup code. A week bar turns soft green when that day ended at least 30 seconds before the limit of that day; today only once it is over. There is no reward or message for it, it is only a quiet hint for parents. While the parent area is open the buttons at the top right are hidden.

## Evening book and lullaby (from v0.12, lullaby file from v0.13)
During "Bona nit" the picture book opens once by itself on a new page "Heute" (moon tab, only in the evening): today's sticker large on the left, up to six pictures of what happened today on the right (hearts goal, dishes, Bruna, harvest, egg, hen, gecko, song or music, birds). One calm sentence about it is read aloud if reading aloud is on. Closing it works as usual. At the same time a short lullaby (about 30 seconds of music) replaces the evening loop and stops by itself; afterwards only the crickets remain. From v0.13 this is Variante C as a rendered file (`assets/schlaflied-c.mp3`): soft flute over a warm pad and quiet guitar in waltz time, A minor with a bright A major ending. It plays once per evening and there is no button to repeat it.

## Sound on iPhone (from v0.13)
On iPhone the silent switch used to mute the game's WebAudio. The game now asks for a playback audio session (and on older iOS plays a tiny silent `<audio>` element once) so music and sounds keep playing when the switch is on. After the lock screen or a call the next tap wakes an interrupted audio context. On phones the overall level is a little louder so small speakers stay clear. The in-game mute button still works as before.

## Tests
```
node tests/run.js
```
Uses only Node's built-in `vm` module. Nothing has to be installed. 135 tests, including a ten day soak test with random taps, keys, start over questions and a save and load every day.

## Lemon trees and phone portrait (from v0.14)
Next to the orange tree grow lemon trees. Lemons are their own ingredient (`zitrone`) in the basket; Ensaïmada can use a lemon instead of an orange. On a phone (coarse pointer) the game prefers portrait: it tries the Screen Orientation API and, if the phone is held in landscape, shows a friendly “hold upright” tip. On desktop nothing about orientation changes.

## Real phone portrait and Schlafenszeit escape (from v0.18)
On mobile the logical canvas is **320×400** (taller than wide) — a real portrait layout, not a landscape letterbox. Profile cards stack vertically with large tap targets. Desktop stays **320×176**. Landscape tip only when mobil + device landscape; overlays never swallow gear/mute/read-aloud.

## Sea and fish (from v0.19)
South of the gate the map grows a pastel beach and open sea (tiles `STRAND` / `MEER`). Paths, pool and buildings stay as they were; the gate is walkable onto the sand. Several small pixel fish swim calmly left and right; tapping one shows bubbles, a heart and a soft blub sound.

## Version history
- **v0.19** (24.10.2026): sea and beach south of the gate; swimming pastel fish; optional tap → bubble/heart/blubber; mobile portrait and desktop landscape unchanged.
- **v0.18** (24.10.2026): real mobile portrait canvas 320×400 (stacked chooser cards); desktop 320×176 unchanged; Schlafenszeit locks only finished pictures — siblings with minutes stay tippable; clear tip + parent gear when all are done; reload must not leave a dead screen.
- **v0.14** (24.10.2026): lemon trees in the garden (own fruit `zitrone` / llimona, yellow-green GBA style); Ensaïmada accepts lemon instead of orange; on phones only, portrait is preferred (`screen.orientation.lock('portrait')` when available, landscape shows a rotate-to-portrait tip). Desktop layout unchanged.

## Schlaflied choice and portrait polish (from v0.15)

- **v0.15** (24.10.2026): Elternbereich — choose lullaby A/B/C (Spieluhr/Gitarre, Sterne/Celesta, Flöte/Mallorca) with clear pastel icons; choice saved as `finca.schlaflied` (default C); all three MP3s in `assets/`. Mobile portrait: `.mobil`/`.quer` classes, orientation lock on gesture/fullscreen, landscape tip without hiding the game permanently. Desktop unchanged.
- **v0.16** (24.10.2026): quieter under the hood — throttle orientation lock, cap ~60 fps, touch targets ≥44px, pointer-capture on parent gear, lullaby load retries capped at 3.
- **v0.17** (24.10.2026): more feel — soft haptic on action (Android, not when calm), music fades ~1.5s into Bona nit, empty action button gives quiet pling+wiggle on touch, audio planner pauses in background, parent storage-full hint.



- **v0.13** (24.10.2026): lullaby Variante C (flute / pad / guitar) as `assets/schlaflied-c.mp3` during "Bona nit"; iPhone silent-switch fix (playback session, wake interrupted context, slightly louder on phones).
- **v0.12** (23.10.2026): evening book page "Heute" with today's sticker large and a calm sentence read aloud; short lullaby in "Bona nit" that ends by itself (no repeat button); week bars turn soft green when a day ended before the limit (no reward); read aloud switches for names, sentences and slower speech in the parent area; the top right buttons are hidden while the parent area is open.
- **v0.11** (23.10.2026): parents set minutes per picture (5 to 15, never above 15) with minus and plus, weekly review as pixel bars in the parent area, backup and transfer as a code ("Sichern"). Gentle sign two minutes before the end (Biel says it once, a moon fades in). Three taps on an instrument play a little tune and give a music sticker. Picture names are read aloud in the chooser. Album with 16 stickers (new: song, guitar, bird, moon, star, butterfly).
- **v0.10** (23.10.2026): pictures (profiles) for each child with their own save, hearts and album, chosen by tapping a picture; 15 minutes per picture per calendar day that cannot be bypassed by switching, reloading or starting over. Hidden parent area (hold the gear 3 seconds) with "Neu anfangen", "Weniger Bewegung" and picture switching; the start over button is gone from the children's view. Guitar, castanets and drum to tap, playing soft notes in the chord of the music. Birds and butterflies in the background (birds hop away when Biel comes close, all leave in the evening). Pixel digits for numbers. Phone zoom. New soft sounds (picture chosen, sleeping, parent area, birds). The edge badge sits further away from the hearts.
- **v0.9** (23.10.2026): "Bona nit" as a picture scene with a starry sky, string lights and the guests at the long table, hearts counting up, then the sticker of the day. Cooking cards and a picture recipe book without reading, the egg in a golden slot, a wiggle and bloop when something is missing. A small sticker album to look at. Decoration: bougainvillea on the walls, shutters at some windows, flower planters in the courtyard, at the arcade and the gate. Thought clouds over the guests and yawning when tired. Round hint badges at the screen edge that avoid the basket and the touch button. Own small favicon drawn inline. The 15 minute day limit stays and is tested again with book and menu use.
- **v0.8** (23.10.2026): redrawn figures with their own shapes (Mia small with pigtails, Jonas broad with glasses, Padrina with a bun, skirt and walking stick, Biel with a straw hat), a small hop while talking. Speech bubbles show only pictures, no names and no text, and pop in next to the speaker; the speaker's face at the top glows. One context button on touch devices whose picture shows the fitting action. Hearts fly from the guest up to their face before they count, and the basket in the bottom left visibly fills with the harvested items. Hens with a little coop lay eggs; an egg is a new ingredient that is never required: in Ensaïmada and Tumbet it adds one extra plate. Optional read aloud with the browser's own German voice. The 15 minute day limit stays and is tested again with hens, eggs and flying hearts.
- **v0.7** (23.10.2026): new look after a design review. Calmer pastel palette with darker, quieter ground and stronger character colors, outlines in the color of each object, silver green olive trees, a wooden frame around the garden bed, sparse courtyard stones and a stone ring around the well. Light is now multiplied with a color per time of day, and at dusk windows, five lanterns, the stove and a little lantern in Biel's hand glow. Text free HUD with day arc, guest faces and hearts. Biel with a straw hat and a ring under his feet, tap ring, rounded system font, round buttons with colored rims, a play triangle instead of a green cross on "Nein". Hard limit of 15 real minutes per game day with a visible dusk and a closing circle before "Bona nit".
- **v0.6** (23.10.2026): polish and stability. Saved game in the browser (day, hearts, basket, clock, garden, table) with a format number, gentle "Neu anfangen" button with a picture question, sound setting kept. Picture hints for children who cannot read yet: pulsing arrow with an icon bubble after a short pause, thought bubble for missing ingredients, fruit flying into the basket, wiggling unripe plants, pulsing sun in the evening, new soft sounds. Error guard so the loop never freezes, evening tap lock, double tap filter, bigger touch buttons and a layout for small phones held sideways. Background drawn once and cached. Rounder Padrina with a pink hair band. Ten day soak test.
- **v0.5** (23.10.2026): small garden bed with tomatoes and carrots plus an orange tree and olive trees, harvest by click, tap or E, plants grow back gently during the day and are all ripe again each morning. Dishes use ingredients but stay forgiving: Pa amb oli always works from a small basic stock, fresh ingredients give an extra plate. Feed Bruna carrots for a cute munching reaction and an extra heart for nearby guests. Third guest Padrina, a grandmother who loves the couch and Pa amb oli, with her own sayings; the daily goal now counts all three guests.
- **v0.4** (23.10.2026): hearts for every guest and a gentle daily goal "Alle Gäste glücklich" with a soft celebration in the evening scene, no failing. Bruna the donkey on a small fenced meadow and a gecko on the house wall, pet them by click, tap or E for a heart and a little sound. Evening music variant and quiet crickets at night, crossfading with the day loop.
- **v0.3** (23.10.2026): calm background music made in code (soft plucked guitar loop, slow tempo, low volume), starts after the first interaction. Mute with M or the speaker button, saved in the browser. Very quiet steps, a soft fountain and pool sound nearby, a cute chime when talking and cooking. Big Sprechen and Kochen buttons on phones and tablets, fullscreen button, hint to hold the phone sideways. Cooking menu with three dishes (Pa amb oli, Ensaïmada, Tumbet) with different effects; Mia and Jonas have favorite dishes.
- **v0.2** (23.10.2026): stronger pastel colors and rounder, cuter chibi figures with big eyes and soft outlines. Click or tap to walk, click a guest to talk. Rooms about 20 percent larger and furnished (couch, armchairs, rug, plants, corner bench, sideboard, bed). New need Ruhe: tired guests rest on the couch. Biel can cook pa amb oli at the stove, guests eat the plates at the table and get full twice as fast. Debug key moved from F1 to Backquote.
- **v0.1** (23.10.2026): first skeleton with map, Biel, two guests with needs, day clock and dialog.

## Note
This folder contains no passwords, tokens or other credentials.
