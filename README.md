# Seasoned Together: clickable prototype

A no-database prototype of the Seasoned Together flow, built with **Material Web (Material 3)** components. Everything the app shows comes from `data/scenarios.json`.

## One-time setup

Material Web is bundled into a single local file, so the site has no CDN dependency on test day:

```bash
cd ~/Documents/seasoned-together
npm install && npm run vendor      # creates vendor/material-web.js
```

Commit `vendor/material-web.js`. `node_modules/` is git-ignored.

## Run locally

```bash
python3 -m http.server 8137        # or: npm start
# open http://localhost:8137
```

## Put it on GitHub Pages

1. Push this folder to a GitHub repo, including `vendor/material-web.js`.
2. Open the repo on GitHub, go to **Settings → Pages → Deploy from a branch**, pick **main** and **/ (root)**, and save.
3. The site appears at `https://<your-username>.github.io/<repo>/`. HTTPS also makes real voice input work.

## Project layout

```
index.html               app shell (phone frame on desktop, full screen on phones)
styles/theme.css         M3 colour roles, type scale and component tokens
styles/app.css           layout only: cards, bars and snackbar built from M3 tokens
js/main.js               boot and event wiring
js/router.js             hash routes (#home, #recipes, #cook …)
js/views.js              every screen, as Material Web markup
js/actions.js            what each button does
js/store.js              state, scenario matching, persistence
js/cooking.js            cooking sessions, timers, camera tracking and boil/pressure/preheat waits
js/voice.js              speech-to-text (Web Speech API)
assets/logo-signup.svg   logo on the splash and sign-up steps (from Figma 660:1504)
assets/logo-mark.svg     browser tab icon (from Figma 663:1529)
data/scenarios.json      all content and photos
vendor/material-web.js   bundled Material Web (generated)
```

## Theme

| Role | Colour | Where |
|---|---|---|
| Primary | `#EE7801` | Borders of primary buttons and the Recipes tile, the active-tab pill and timer rings |
| Primary fill | `#FFE3CC` | Primary buttons and the Recipes tile, with near-black text: 14:1 (AAA) |
| Secondary | `#B11B1B` | Border of the "Add a new recipe" tile, the microphone, the live dot |
| Secondary fill | `#FDECEC` | "Add a new recipe" tile, with near-black text: 15:1 (AAA) |
| Accent | `#2E7930` | Adapted-recipe cards, focused fields |
| Orange text | `#7A3A00` | Text buttons, labels, running timers: 8.4:1 (AAA) |
| Green text | `#1F5C22` | "Ticked by the camera", swap reasons: 7.8:1 (AAA) |
| Indicators | `#A14E00` | Checkboxes, switches, progress, tabs: 5.7:1 (needs 3:1) |
| Neutrals | Greys `#FCFCFC` → `#1C1B1B` | Surfaces and body text (secondary text is 8.6:1 or more) |

Brand colours appear as borders around light fills, so every text pair meets WCAG AAA. Type and buttons are larger than the M3 defaults because the users are older adults. People are shown as initial avatars, not photos. Recipes carry no difficulty labels.

## Scenarios

The splash leads straight to sign-up (there is no log-in flow). At sign-up, people tick everything that makes cooking hard (multi-select). **Something else** reveals **Type it / Say it**, and their words tick the matching conditions automatically.

| Selection | Scenario | Persona | Camera |
|---|---|---|---|
| Arthritis | `arthritis` | Margaret, 72 | Off: ticks steps herself |
| Back pain | `back-pain` | Robert, 68 | Off: ticks steps himself |
| Knee pain | `knee-pain` | Dorothy, 70 | **On** |
| Arthritis + Back pain | `arthritis-back-pain` | Evelyn, 71 | **On** |

Other combinations (for example Arthritis + Knee) use the closest scenario and add the extra condition's constraints to the profile.

**Navigation.** Home · Recipes · **Camera** · Add · Profile. The Camera tab appears only when a camera is linked (Evelyn and Dorothy by default, or anyone who links one in Profile).

**Cooking works the same for everyone.** **Start cooking** opens the step checklist, with one-line timers (▶ start, +1:00, ■ stop, red **Done** at zero; modelled on the Android clock). **Cooking in progress** (on Home and Recipes) goes straight to the cooking steps. While something is cooking, the **Recipes** tab opens that dish's recipe: simplified if they named a pain point, otherwise the original. Its back arrow leads to the full list.

**Only the Camera tab is extra.** When nothing is cooking, it lists the recipes, so people can start one right there and stay on the camera. It shows just the live view of the scenario's stove (`cameraPhoto` in the JSON), with running timers as small floating tags such as **"Boiling: 10 min"**. Behind the scenes, the camera works the same checklist:
- **Untimed steps:** it ticks them when it "sees" them done.
- **Timed steps:** it starts the timer when a step begins.
- **Boils, pressure and preheating** (a step's `watch`): it waits for them, then beeps with "It's boiling!".
- **When a timer ends:** it beeps with a check-in, e.g. *"Simmering is done. You might want to check the broth!"*.

## Before each test session

- Go to **Profile → Log out & restart demo** between participants.
- **Demo pace** is on by default: timers are sped up so a whole cooking session, even two recipes together, plays out in **about 2 minutes** for people to act out. Without a camera, switch off **2-min demo** on the checklist for real-time timers.
- Facilitator hints are hidden. Set `meta.showPrototypeNotes` to `true` in the JSON to show them.

## What's mocked

Sign-in, the camera feed (a recipe photo with live overlays), step detection, recording a new dish, importing from a website/photo/video, and AI simplification (pre-written in the JSON). Voice input is real wherever the browser supports speech recognition. Elsewhere it uses a sample phrase.

## Photos

All recipe and persona photos are free Unsplash images, each confirmed on its unsplash.com page. While a photo loads, its space shows a plain grey surface with no placeholder art. Swap any `photo` in the JSON for another URL or a local path.
