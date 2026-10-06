# Roll Call Crane

A classroom picker for a projector. First the order of the groups is set, by an old roulette wheel or by a race of endangered animals. Then a crane picks one student's can from each group. The teacher marks the student present or absent. If the student is absent, their cans leave the machine and the crane picks again.

Live: https://ji-hun-git.github.io/clawmacine/

## A round

1. **Roster.** Add names, set the number of groups (up to 8), paste a list (a line such as `Group 2` starts a new group), shuffle names into groups, or drag a name to another group. Tap a name to mark it absent before the game starts. Each group picks its animal here.
2. **Order.** Choose **Wheel** or **Race** on the left.
   - **Wheel:** a steel ball rides the track, drops past the diamonds and rattles into a pocket. The pocket's number is the next group.
   - **Race:** the groups' animals run one lane each. The finishing order is the group order.
3. **Crane.** The group's animal rides the crane. After a short countdown the crane moves on its own, stops over one can, and drops. Nobody steers it.
4. **Roll call.** The name takes the whole screen. Press **P** for present or **A** for absent. **Z** undoes the last mark.

## Board mode

A third game, separate from the crane. Every name sits on a tile of a lit board. Press **Light up** (or Space) and a light chases across the tiles, slows down and stops on one name. Mark the student present or absent. Either way the name is marked on the board and sits out every later pick; after an absent mark the lights run again by themselves. **Z** takes back the last mark.

**Shuffle** (or S) moves the tiles to new places with one of five animations picked at random: scatter, swirl, tornado, card flip or rain. It only changes where tiles sit, never the odds. A picked name flies off the board into the **Picked** tray beside it, numbered in order, with absent names listed below; the board closes up around the gap.

Under the board: **Edit names** (type a name on the last tile, or press × on a tile to remove it), **Clear marks**, **Load roster** (replace the board with the roster's names) and **Copy picks**. The board's names and marks are saved in the browser. The winner is drawn uniformly from the names still unmarked before the first light; in a test of 3,200 picks over 16 names every name came up between 183 and 224 times.

## Keys

| Key | What it does |
|---|---|
| Space | Spin the wheel, start the race, start the crane now, go to the next group |
| P / A | Present / absent |
| Z | Undo the last mark |
| F | Full screen |
| M | Sound on or off |
| R | Roster (before the order is set) |
| S | Shuffle the board |
| [ / ] | Slower / faster |
| ? | Show the keys |

## Speed

The **Speed** slider in the top-right corner (0.5× to 3×, also [ and ]) speeds up or slows down every game: the wheel, the race, the crane and the board, and the pauses between beats. The time you get to mark a student present or absent never drops below 1.5 seconds.

## The animals

| Animal | IUCN status | How it runs |
|---|---|---|
| Great hammerhead shark | Critically Endangered | Flops. It still finishes. |
| Hawksbill sea turtle | Critically Endangered | Both front flippers at once, slow and steady |
| Axolotl | Critically Endangered | A wiggling sprawl walk, gills streaming |
| Red panda | Endangered | Bounds, tail streaming |
| Sunda pangolin | Critically Endangered | On its hind legs, like real pangolins; curls into a ball at speed |

## Fair by construction

- **Wheel:** the result comes from the ball physics. In 800 simulated spins with 4 groups, every group came up about equally often.
- **Race:** the finishing order is drawn uniformly at random before the start. The animals' speed curves are then shaped to arrive in that order, with lead changes and sometimes a photo finish. Re-rolling the curves never changes the order, so no animal is favoured.
- **Crane:** the crane first draws a student uniformly from the names still in the machine, then aims at that student's most reachable can. Every student has the same number of cans. Physics decides whether the grab holds. The claw may knock a neighbouring can loose, and whatever falls into the chute is the pick.

## Run it

Open `index.html` in a browser. There is no build step and no server. Matter.js is vendored in `lib/`. Fonts load from Google Fonts and fall back to system fonts offline. The roster and the chosen order mode are saved in the browser.

```
index.html
css/style.css
js/game.js        director: acts, lighting, reveal, keys, undo
js/roulette.js    the wheel and its ball physics
js/race.js        the animal race
js/board.js       the light board (Board mode)
js/machine.js     the crane (Matter.js cans, pendulum claw, camera)
js/art.js         palette and the lit tin can
js/animals/*.js   the five animals (kit.js is the shared drawing kit)
js/roster.js      roster editor
js/sfx.js         synthesised sound
tools/animal-smoke.js  smoke test for an animal module
tools/animals.html     every animal in every pose
tools/cans.html        can preview
tools/claw.html        claw close-up preview
```
