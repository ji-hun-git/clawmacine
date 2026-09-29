# 깡통 뽑기 · Tin Can Roulette

A classroom picker built like an old tin toy. A tin roulette decides the order of the groups. Then a claw machine full of name cans picks one student from each group. If the picked student is absent, the claw gets another try.

## How a game goes

1. **Roster.** Add names, set the number of groups (2–8), paste a list, shuffle names into groups, or drag names between groups. Tap a name to mark that student away today, and they get no can.
2. **Spin order.** Flick the wheel or press **Spin**. A steel ball rides the track, bounces off the diamonds and rattles into a pocket. Each pocket is printed with a group number, and that group goes next. The last group left goes last automatically.
3. **Catch cans.** Each group's cans pour into the machine. Steer the claw and press **GRAB**, or use **Auto-aim**. When a can drops into the prize chute, mark the student **HERE** or **ABSENT**. An absent student's can is crushed and the claw gets one more chance with the cans that are left.

The prize tickets on the right record the order, each pick, and who was absent. **Copy results** puts them on the clipboard.

## Controls

| | Keyboard | Pointer / touch |
|---|---|---|
| Spin the wheel | Space | Drag and flick the wheel, or press Spin |
| Move the claw | ← → or A D | Drag the joystick |
| Grab | Space, ↓ or Enter | GRAB button |
| Roll call | H = here, X = absent | Buttons on the card |

**Hard claw** makes the grip weaker, so cans can slip on the way up, like a real arcade.

## Physics

- **Cans** are [Matter.js](https://brm.io/matter-js/) rigid bodies. They stack in a pyramid, topple, and ring when they collide.
- **The claw** hangs on a cable as a driven pendulum with a changing length. It swings when the gantry speeds up or brakes, and paying out cable bleeds the swing off. The prongs are kinematic bodies that push cans aside. A grabbed can hangs on a soft spring.
- **The roulette** uses polar-coordinate ball physics with sub-steps: track friction, a fall below the critical speed, diamond deflectors, and fret bounces in the pockets. In 800 simulated spins with 4 groups, the results were 190 / 218 / 203 / 189, so the order is fair.

## Run it

Open `index.html` in a browser. It needs no build step and no server, and Matter.js is vendored in `lib/`. Fonts load from Google Fonts and fall back to system fonts offline. The roster is saved in the browser's local storage.

```
index.html
css/style.css
js/sfx.js       synthesised sounds (Web Audio)
js/art.js       palette and tin-can drawing
js/roulette.js  tin roulette and ball physics
js/machine.js   claw machine (Matter.js)
js/roster.js    roster editor
js/game.js      game flow
lib/matter.min.js
```
