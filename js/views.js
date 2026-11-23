// Screen templates. Each view returns an HTML string built from Material Web components.

import { state, data, scenario, recipeById, conditionById, firstName, prototypeNotes, matchConditions, effectiveConditions } from "./store.js";
import { esc, icon, photo, avatar, fmtMinutes, mmss } from "./ui.js";
import {
  currentStep, progress, stepKey, timerFor, waitFor, readout, minutesLeft, activeTags, timerMinutesFor, cameraPhoto, WAIT_KINDS,
} from "./cooking.js";

const LOGO_SIGNUP = "assets/logo-signup.svg";

// ---------- Shared pieces ----------
const note = (t) => (prototypeNotes() ? `<p class="md-typescale-body-small muted">${esc(t)}</p>` : "");

function topBar(title, backTo, trailing = "") {
  return `<header class="top-bar">
    <md-icon-button data-action="nav" data-to="${backTo}" aria-label="Back">${icon("arrow_back")}</md-icon-button>
    <h1 class="md-typescale-title-large">${esc(title)}</h1>
    ${trailing || '<span class="spacer"></span>'}
  </header>`;
}

function onboardingHead(step) {
  const bars = [1, 2, 3].map((i) => `<span class="${i <= step ? "on" : ""}"></span>`).join("");
  return `<img class="logo-signup sm" src="${LOGO_SIGNUP}" alt="Seasoned Together" />
    <div class="progress-steps" aria-label="Step ${step} of 3">${bars}</div>`;
}

const recipeMeta = (r) => [fmtMinutes(r.time), r.folder].filter(Boolean).map(esc).join(" · ");
const hasSimplified = (r) => !!r.simplified && state.constraints.length > 0;
const conditionsLabel = () => state.conditionIds.map((id) => conditionById(id)?.label).filter(Boolean).join(" + ").toLowerCase();
const smallIcon = (name, color = "") => icon(name, `style="--md-icon-size:18px;vertical-align:-4px;${color ? `color:${color}` : ""}"`);

function partOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function filteredRecipes() {
  const q = state.search.trim().toLowerCase();
  return state.recipes.filter((r) =>
    (state.folder === "All" || r.folder === state.folder) &&
    (!q || r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q))));
}

export function recipeRow(r) {
  const picked = state.selected.has(r.id);
  return `<div class="card flush recipe-row">
    <md-elevation></md-elevation>
    <button data-action="openRecipe" data-id="${r.id}">
      <md-ripple></md-ripple>
      ${photo(r.photo, r.title)}
      <span class="body">
        <span class="md-typescale-title-medium">${esc(r.title)}</span>
        <span class="md-typescale-body-small muted">${recipeMeta(r)}</span>
        ${hasSimplified(r) ? `<span class="seen md-typescale-label-medium">${icon("auto_awesome")}Simplified for you</span>` : ""}
      </span>
    </button>
    <div class="pick"><md-checkbox data-action="toggleSelect" data-id="${r.id}" ${picked ? "checked" : ""} aria-label="Cook ${esc(r.title)}"></md-checkbox></div>
  </div>`;
}

export const emptyRecipes = () => `<div class="empty">${icon("search_off")}<p class="md-typescale-body-large">No recipes match “${esc(state.search)}”.</p></div>`;

export function otherMatchSummary() {
  const o = state.onboarding;
  if (!o.text.trim()) return "";
  const ids = matchConditions(o.text);
  if (!ids.length) return `<p class="md-typescale-body-medium muted">We couldn't match that yet. Try words like hands, jars, back, bending or knees.</p>`;
  return `<div class="row md-typescale-body-medium">${icon("check_circle", 'style="color:var(--md-sys-color-tertiary)"')}
    <span>Sounds like ${ids.map((id) => `<b>${esc(conditionById(id).label)}</b>`).join(" and ")}. We've ticked it above.</span></div>`;
}

export function navBar(active) {
  const item = (id, label, name) => `<button class="nav-item" data-action="${id === "recipes" ? "navRecipes" : "nav"}" data-to="${id}" ${active === id ? 'aria-current="page"' : ""}>
      <span class="indicator"><md-ripple></md-ripple>${icon(name)}</span>
      <span class="label">${label}</span>
      ${id === "camera" && state.session ? '<span class="badge" aria-label="Cooking in progress"></span>' : ""}
      <md-focus-ring style="--md-focus-ring-shape: 16px"></md-focus-ring>
    </button>`;
  return item("home", "Home", "home") + item("recipes", "Recipes", "menu_book")
    + (state.cameraLinked ? item("camera", "Camera", "videocam") : "")
    + item("add", "Add", "add_circle") + item("profile", "Profile", "person");
}

/** Small countdown ring; `key` links it to the live ticker. An idle ring has no `t`. */
function ring({ key = "", t = null }) {
  return `<div class="ring sm"><md-circular-progress ${t ? `data-ring="${key}"` : ""} value="${t ? readout(t).value : 0}" aria-hidden="true"></md-circular-progress></div>`;
}

/**
 * Compact one-line timer for the step list, modelled on the Android clock timer:
 * [ring] 09:59 ················ [+1:00] [■]
 */
function timerCard(key, step) {
  const w = waitFor(key);
  const t = timerFor(key);
  const minutes = timerMinutesFor(step);
  const row = (cls, ringHtml, time, label, actions) => `<div class="timer-row ${cls}">
      ${ringHtml}
      <span class="time" ${time.live ? `data-left="${key}"` : ""}>${time.text}</span>
      <span class="timer-label md-typescale-body-small">${label}</span>
      <span class="grow"></span>${actions}</div>`;
  const live = (x) => ({ text: readout(x).text, live: true });

  if (w) {
    const kind = WAIT_KINDS[w.kind];
    return row("running", ring({ key, t: w }), live(w), esc(kind.left),
      `<md-icon-button data-action="nav" data-to="camera" aria-label="Open camera">${icon("videocam")}</md-icon-button>`);
  }
  if (t && t.finished) {
    return row("done", ring({ key, t }), live(t), "Time's up",
      `<md-text-button data-action="addMinute" data-k="${key}">+1:00</md-text-button>
       <md-filled-button data-action="stopTimer" data-k="${key}">Done</md-filled-button>`);
  }
  if (t) {
    return row("running", ring({ key, t }), live(t), "",
      `<md-text-button data-action="addMinute" data-k="${key}" aria-label="Add 1 minute">+1:00</md-text-button>
       <md-icon-button data-action="stopTimer" data-k="${key}" aria-label="Stop timer">${icon("stop")}</md-icon-button>`);
  }
  return row("", ring({}), { text: mmss(minutes * 60000) }, "",
    `<md-filled-icon-button data-action="startTimer" data-k="${key}" aria-label="Start ${esc(fmtMinutes(minutes))} timer">${icon("play_arrow")}</md-filled-icon-button>`);
}

// ---------- Views ----------
export const views = {
  welcome() {
    const photos = ["arthritis-back-pain", "arthritis", "knee-pain"]
      .map((id) => data().scenarios.find((s) => s.id === id)?.recipes[0]).filter(Boolean);
    return `<div class="splash">
      <div class="splash-hero">
        <div class="splash-photos">${photos.map((r) => photo(r.photo, r.title)).join("")}</div>
        <div class="splash-logo"><img src="${LOGO_SIGNUP}" alt="Seasoned Together" /></div>
      </div>
      <div class="splash-body">
        <h1 class="md-typescale-headline-medium">Keep cooking the food you love</h1>
        <ul class="benefits md-typescale-body-large">
          <li><span class="chip-icon o">${icon("auto_awesome")}</span>Recipes simplified for your hands, back or knees</li>
          <li><span class="chip-icon g">${icon("videocam")}</span>A kitchen camera that keeps watch while you sit</li>
          <li><span class="chip-icon r">${icon("timer")}</span>Big, clear timers you won't miss</li>
        </ul>
        <div class="splash-actions"><md-filled-button class="full" data-action="nav" data-to="signup">Get started</md-filled-button></div>
      </div>
    </div>`;
  },

  signup() {
    return `${topBar("Create account", "welcome")}
      <div class="stack">
        ${onboardingHead(1)}
        <h2 class="md-typescale-headline-medium">Nice to meet you</h2>
        <p class="md-typescale-body-large muted">What should we call you?</p>
        <md-outlined-text-field id="name" class="full" label="First name" autocomplete="given-name" value="${esc(state.userName)}"></md-outlined-text-field>
        ${note("Leave blank to use the persona's name from the scenario.")}
        <md-filled-button class="full" data-action="saveName">Continue</md-filled-button>
      </div>`;
  },

  needs() {
    const o = state.onboarding;
    const matched = new Set(o.other ? matchConditions(o.text) : []);
    const chosen = new Set(effectiveConditions());
    const item = (c) => {
      const on = chosen.has(c.id);
      return `<md-list-item type="button" data-action="toggleCondition" data-id="${c.id}" ${on ? "data-selected" : ""}>
        ${icon(c.icon, 'slot="start"')}
        <div slot="headline">${esc(c.label)}</div>
        <div slot="supporting-text">${matched.has(c.id) && !o.selected.has(c.id) ? "Added from what you told us" : esc(c.sub)}</div>
        <md-checkbox slot="end" touch-target="none" tabindex="-1" aria-hidden="true" ${on ? "checked" : ""}></md-checkbox>
      </md-list-item>`;
    };
    let other = "";
    if (o.other) {
      const chip = (mode, label, name) => `<md-filter-chip label="${label}" data-action="otherMode" data-mode="${mode}" ${o.otherMode === mode ? "selected" : ""}>${icon(name, 'slot="icon"')}</md-filter-chip>`;
      const field = `<md-outlined-text-field id="otherText" class="full" type="textarea" rows="3" label="What makes cooking hard?" value="${esc(o.text)}"></md-outlined-text-field>`;
      const voice = `<div class="stack center">
          <p class="md-typescale-body-large">${{ listening: "Listening… speak now.", done: "Here's what we heard. You can fix any words.", missed: "Sorry, we didn't catch that. Tap to try again." }[o.voice] || "Tap the microphone and tell us in your own words."}</p>
          <div class="mic ${o.voice === "listening" ? "listening" : ""}"><md-filled-icon-button data-action="otherVoice" aria-label="Start speaking">${icon("mic")}</md-filled-icon-button></div>
          ${["done", "missed"].includes(o.voice) ? field : ""}
        </div>`;
      other = `<div class="card outlined stack">
          <md-chip-set aria-label="How would you like to tell us?">${chip("type", "Type it", "keyboard")}${chip("voice", "Say it", "mic")}</md-chip-set>
          ${o.otherMode === "type" ? field : voice}
          <div id="otherMatch">${otherMatchSummary()}</div>
        </div>`;
    }
    return `${topBar("Your needs", o.from || "signup")}
      <div class="stack">
        ${onboardingHead(2)}
        <h2 class="md-typescale-headline-medium">What makes cooking hard?</h2>
        <p class="md-typescale-body-large muted">Select all that apply. We'll simplify recipes around them.</p>
        <md-list class="choice-list" aria-label="Conditions">
          ${data().conditions.map(item).join("")}
          <md-list-item type="button" data-action="toggleOther" ${o.other ? "data-selected" : ""}>
            ${icon("edit_note", 'slot="start"')}
            <div slot="headline">Something else</div>
            <div slot="supporting-text">Tell us in your own words</div>
            <md-checkbox slot="end" touch-target="none" tabindex="-1" aria-hidden="true" ${o.other ? "checked" : ""}></md-checkbox>
          </md-list-item>
        </md-list>
        ${other}
        <div class="sticky-cta"><md-filled-button id="needsContinue" class="full" data-action="confirmNeeds" ${chosen.size ? "" : "disabled"}>Continue</md-filled-button></div>
      </div>`;
  },

  "camera-setup"() {
    return `${topBar("Kitchen camera", "needs")}
      <div class="stack">
        ${onboardingHead(3)}
        <h2 class="md-typescale-headline-medium">Link your kitchen camera</h2>
        <p class="md-typescale-body-large muted">Prop a phone or tablet near the stove. Seasoned Together follows along as you cook, so you can sit down between steps.</p>
        <md-list class="card filled">
          <md-list-item>${icon("checklist", 'slot="start"')}<div slot="headline">Ticks off each step for you</div></md-list-item>
          <md-list-item>${icon("local_fire_department", 'slot="start"')}<div slot="headline">Tells you how long until it boils</div></md-list-item>
          <md-list-item>${icon("lock", 'slot="start"')}<div slot="headline">Video never leaves your device</div></md-list-item>
        </md-list>
        <md-filled-button class="full" data-action="linkCamera" data-next="home">${icon("videocam", 'slot="icon"')}Link camera</md-filled-button>
        <md-text-button class="full" data-action="nav" data-to="home">Not now</md-text-button>
      </div>`;
  },

  home() {
    const s = scenario();
    return `<div class="stack-lg" style="padding-top:16px">
        <div class="row">
          ${avatar(firstName())}
          <div class="grow"><p class="md-typescale-body-medium muted">Good ${partOfDay()},</p>
          <h2 class="md-typescale-headline-small">What are you cooking today, ${esc(firstName())}?</h2></div>
        </div>
        ${state.session ? `<button class="card primary row" data-action="resumeCooking"><md-ripple></md-ripple>${icon("skillet")}
            <span class="grow"><span class="md-typescale-title-medium">Cooking in progress</span><br /><span class="md-typescale-body-medium">${esc(sessionTitle())}</span></span>${icon("chevron_right")}</button>` : ""}
        <div class="stack-sm">
          <button class="card tile primary" data-action="nav" data-to="recipes"><md-ripple></md-ripple>${icon("menu_book")}
            <span class="md-typescale-title-large">Select from My Recipes</span>
            <span class="md-typescale-body-medium">${state.recipes.length} recipes, simplified for you</span></button>
          <button class="card tile secondary" data-action="nav" data-to="add"><md-ripple></md-ripple>${icon("add_circle")}
            <span class="md-typescale-title-large">Add a new recipe</span>
            <span class="md-typescale-body-medium">From a website, by voice, photo or video</span></button>
        </div>
        <section class="stack-sm">
          <div class="spread"><h3 class="md-typescale-title-medium">Easy on your ${esc(s.shortLabel.toLowerCase())}</h3>
            <md-text-button data-action="nav" data-to="recipes">See all</md-text-button></div>
          <div class="carousel">${state.recipes.slice(0, 6).map((r) => `
            <button class="card flush" data-action="openRecipe" data-id="${r.id}"><md-elevation></md-elevation><md-ripple></md-ripple>
              ${photo(r.photo, r.title)}
              <span class="body stack-sm" style="display:block"><span class="md-typescale-title-medium" style="display:block">${esc(r.title)}</span>
              <span class="md-typescale-body-small muted">${esc(fmtMinutes(r.time))}</span></span>
            </button>`).join("")}</div>
        </section>
      </div>`;
  },

  recipes() {
    const folders = ["All", ...new Set(state.recipes.map((r) => r.folder))];
    const list = filteredRecipes();
    const n = state.selected.size;
    return `${topBar("My Recipes", "home", `<md-icon-button data-action="nav" data-to="add" aria-label="Add a recipe">${icon("add")}</md-icon-button>`)}
      <div class="stack">
        ${state.session && !state.session.recording ? `<button class="card primary row" data-action="resumeCooking"><md-ripple></md-ripple>${icon("skillet")}
          <span class="grow md-typescale-title-medium">Cooking in progress</span>${icon("chevron_right")}</button>` : ""}
        <md-outlined-text-field id="search" class="full" label="Search recipes or ingredients" type="search" value="${esc(state.search)}">${icon("search", 'slot="leading-icon"')}</md-outlined-text-field>
        <div class="chips-scroll"><md-chip-set aria-label="Folders">${folders.map((f) =>
          `<md-filter-chip label="${esc(f)}" data-action="folder" data-f="${esc(f)}" ${state.folder === f ? "selected" : ""}></md-filter-chip>`).join("")}</md-chip-set></div>
        <p class="md-typescale-body-medium muted">Tap a recipe to open it, or tick a few to cook them together.</p>
        <div id="recipe-list" class="stack-sm">${list.length ? list.map(recipeRow).join("") : emptyRecipes()}</div>
        ${n ? `<div class="sticky-cta"><md-filled-button class="full" data-action="startCook">${icon("skillet", 'slot="icon"')}Start cooking ${n} ${n === 1 ? "recipe" : "recipes"}</md-filled-button></div>` : ""}
      </div>`;
  },

  recipe() {
    const r = recipeById(state.currentRecipe);
    const s = scenario();
    const canSimplify = hasSimplified(r);
    const mode = canSimplify ? state.detailMode : "original";
    const steps = mode === "simplified" ? r.simplified.steps : r.steps;
    const picked = state.selected.has(r.id);
    const inSession = !!state.session && state.session.items.some((it) => it.id === r.id);
    const simplifiedBlock = mode !== "simplified" ? "" : `
      <div class="card tertiary stack-sm">
        <span class="md-typescale-label-large">${smallIcon("auto_awesome")} Adapted for ${esc(conditionsLabel() || s.label.toLowerCase())}</span>
        <p class="md-typescale-body-large">${esc(r.simplified.summary)}</p>
        ${r.generated ? note("Placeholder. The real app's AI would rewrite these steps.") : ""}
      </div>
      ${r.simplified.swaps.length ? `<section class="stack-sm"><h3 class="md-typescale-title-medium">Easy swaps</h3>
        <div class="card outlined">${r.simplified.swaps.map((w) => `<div class="swap md-typescale-body-medium">
          <span class="from">${esc(w.from)}</span>${icon("arrow_forward", 'style="color:var(--st-primary-strong)"')}<b>${esc(w.to)}</b><span class="why md-typescale-body-small">${esc(w.why)}</span></div>`).join("")}</div></section>` : ""}
      <section class="stack-sm"><h3 class="md-typescale-title-medium">Tools that help</h3>
        <md-list class="card outlined">${s.tools.map((t) => `<md-list-item>${icon("handyman", 'slot="start"')}<div slot="headline">${esc(t.name)}</div><div slot="supporting-text">${esc(t.why)}</div></md-list-item>`).join("")}</md-list></section>`;

    const stepChips = (st) => [
      st.watch ? `<md-assist-chip label="About ${st.watch.minutes} min ${esc(WAIT_KINDS[st.watch.kind].left)}">${icon("local_fire_department", 'slot="icon"')}</md-assist-chip>` : "",
      st.timerMinutes ? `<md-assist-chip label="${esc(fmtMinutes(st.timerMinutes))} timer">${icon("timer", 'slot="icon"')}</md-assist-chip>` : "",
    ].join("");

    return `<div class="hero">${photo(r.photo, r.title)}
        <div class="hero-actions">
          <md-filled-icon-button data-action="nav" data-to="recipes" aria-label="Back">${icon("arrow_back")}</md-filled-icon-button>
          <md-filled-icon-button data-action="toggleSelect" data-id="${r.id}" aria-label="${picked ? "Remove from" : "Add to"} cooking session">${icon(picked ? "playlist_add_check" : "playlist_add")}</md-filled-icon-button>
        </div></div>
      <div class="sheet stack-lg">
        <div class="stack-sm">
          <span class="md-typescale-label-large" style="color:var(--st-primary-text)">${esc(r.folder)}</span>
          <h1 class="md-typescale-headline-medium">${esc(r.title)}</h1>
          <div class="meta-chips">
            <md-assist-chip label="${esc(fmtMinutes(r.time))}">${icon("schedule", 'slot="icon"')}</md-assist-chip>
            <md-assist-chip label="Serves ${r.servings}">${icon("group", 'slot="icon"')}</md-assist-chip>
          </div>
        </div>
        ${canSimplify ? `<md-tabs aria-label="Recipe version">
            <md-primary-tab data-action="detailMode" data-mode="simplified" ${mode === "simplified" ? "active" : ""}>${icon("auto_awesome", 'slot="icon"')}Simplified for you</md-primary-tab>
            <md-primary-tab data-action="detailMode" data-mode="original" ${mode === "original" ? "active" : ""}>${icon("menu_book", 'slot="icon"')}Original</md-primary-tab>
          </md-tabs>` : `<div class="card primary md-typescale-body-medium">Simplified versions are linked to what makes cooking hard for you. Add one in Profile to see this recipe adapted.</div>`}
        ${simplifiedBlock}
        <section class="stack-sm"><h3 class="md-typescale-title-medium">Ingredients</h3>
          <md-list class="card outlined">${r.ingredients.map((i) => `<md-list-item><div slot="headline">${esc(i)}</div></md-list-item>`).join("")}</md-list></section>
        <section class="stack-sm"><h3 class="md-typescale-title-medium">Steps</h3>
          <ol class="steps">${steps.map((st) => `<li><div class="stack-sm"><span class="md-typescale-body-large">${esc(st.text)}</span>
            ${st.timerMinutes || st.watch ? `<div class="meta-chips">${stepChips(st)}</div>` : ""}</div></li>`).join("")}</ol></section>
        ${mode === "simplified" && r.simplified.prepAhead.length ? `<div class="card primary stack-sm"><span class="md-typescale-label-large">Prep ahead</span>
          ${r.simplified.prepAhead.map((x) => `<p class="md-typescale-body-medium">• ${esc(x)}</p>`).join("")}</div>` : ""}
        <div class="sticky-cta">${inSession
          ? `<md-filled-button class="full" data-action="nav" data-to="cook">${icon("checklist", 'slot="icon"')}Continue cooking</md-filled-button>`
          : `<md-filled-button class="full" data-action="cookOne" data-id="${r.id}">${icon("skillet", 'slot="icon"')}Start cooking</md-filled-button>`}</div>
      </div>`;
  },

  add() {
    const a = state.add;
    const tab = (id, label, name) => `<md-primary-tab data-action="addSource" data-src="${id}" ${a.source === id ? "active" : ""}>${icon(name, 'slot="icon"')}${label}</md-primary-tab>`;
    let body;
    if (a.busy) {
      body = `<div class="card filled stack center" style="padding:40px 16px"><md-circular-progress indeterminate style="margin:0 auto"></md-circular-progress>
        <p class="md-typescale-title-medium">${esc(a.busy)}…</p><p class="md-typescale-body-medium muted">Simplifying it for ${esc(conditionsLabel())}</p></div>`;
    } else if (a.source === "web") {
      body = `<div class="stack">
        <md-outlined-text-field id="url" class="full" type="url" label="Recipe website link" placeholder="https://…">${icon("link", 'slot="leading-icon"')}</md-outlined-text-field>
        <md-filled-button class="full" data-action="importWeb">Import recipe</md-filled-button></div>`;
    } else if (a.source === "video") {
      body = `<div class="stack">
        <md-list class="card filled">
          <md-list-item>${icon("videocam", 'slot="start"')}<div slot="headline">Record or upload yourself cooking</div></md-list-item>
          <md-list-item>${icon("visibility", 'slot="start"')}<div slot="headline">We spot each ingredient going in</div></md-list-item>
          <md-list-item>${icon("timer", 'slot="start"')}<div slot="headline">We time every boil and simmer</div></md-list-item>
          <md-list-item>${icon("description", 'slot="start"')}<div slot="headline">A recipe is written for you</div></md-list-item>
        </md-list>
        ${state.cameraLinked ? `<md-filled-button class="full" data-action="recordNew">${icon("radio_button_checked", 'slot="icon"')}Record while I cook</md-filled-button>` : ""}
        <md-outlined-button class="full" data-action="pickFile" data-input="vid">${icon("upload", 'slot="icon"')}Upload a cooking video</md-outlined-button>
        <input id="vid" type="file" accept="video/*" hidden />
      </div>`;
    } else {
      const d = a.draft;
      const chip = (m, label, name) => `<md-filter-chip label="${label}" data-action="addManual" data-m="${m}" ${a.manual === m ? "selected" : ""}>${icon(name, 'slot="icon"')}</md-filter-chip>`;
      body = `<div class="stack">
        <md-chip-set aria-label="How do you want to add it?">${chip("type", "Type it", "keyboard")}${chip("voice", "Say it", "mic")}${chip("photo", "Photo", "photo_camera")}</md-chip-set>
        ${a.manual === "voice" ? `<div class="stack-sm center"><div class="mic ${a.voice === "listening" ? "listening" : ""}"><md-filled-icon-button data-action="addVoice" aria-label="Say your recipe">${icon("mic")}</md-filled-icon-button></div>
            <p class="md-typescale-body-medium muted">${a.voice === "listening" ? "Listening… say each step." : "Say the steps, ingredients and cooking times."}</p></div>` : ""}
        ${a.manual === "photo" ? `${a.photo ? `<div class="card flush">${photo(a.photo, "Your recipe photo")}</div>` : ""}
            <md-outlined-button class="full" data-action="pickFile" data-input="photo">${icon("add_a_photo", 'slot="icon"')}${a.photo ? "Choose another photo" : "Photo of a recipe card or cookbook"}</md-outlined-button>
            <input id="photo" type="file" accept="image/*" hidden />` : ""}
        <md-outlined-text-field id="d-title" class="full" label="Recipe name" value="${esc(d.title)}"></md-outlined-text-field>
        <md-outlined-text-field id="d-ing" class="full" type="textarea" rows="4" label="Ingredients" supporting-text="One per line" value="${esc(d.ingredients)}"></md-outlined-text-field>
        <md-outlined-text-field id="d-steps" class="full" type="textarea" rows="5" label="Steps" supporting-text="One per line. Add “(10 min)” for a timer." value="${esc(d.steps)}"></md-outlined-text-field>
        <md-filled-button class="full" data-action="saveManual">Save & simplify</md-filled-button>
      </div>`;
    }
    return `${topBar("Add a recipe", "home")}
      <div class="stack">
        <md-tabs aria-label="Where is the recipe from?">${tab("web", "Website", "link")}${tab("manual", "Manual", "edit")}${tab("video", "Video", "videocam")}</md-tabs>
        ${body}
      </div>`;
  },

  cook: () => cookChecklist(),

  camera() {
    if (!state.cameraLinked) {
      return `${topBar("Kitchen camera", "home")}
        <div class="card filled stack center" style="padding:32px 20px">${icon("videocam_off", 'style="--md-icon-size:48px;margin:0 auto"')}
          <h2 class="md-typescale-headline-small">Camera not linked</h2>
          <p class="md-typescale-body-large muted">Link a phone or tablet by the stove and it will follow along as you cook.</p>
          <md-filled-button class="full" data-action="linkCamera" data-next="camera">${icon("videocam", 'slot="icon"')}Link camera</md-filled-button></div>`;
    }
    const ses = state.session;
    if (!ses) return cameraIdle();
    if (ses.recording) return cameraRecording();
    return cameraWatching();
  },

  profile() {
    const s = scenario();
    return `${topBar("Profile", "home")}
      <div class="stack-lg">
        <div class="profile-head">
          ${avatar(firstName(), "lg")}
          <h2 class="md-typescale-headline-small">${esc(state.userName || s.persona.name)}</h2>
          <md-chip-set aria-label="What makes cooking hard">${state.conditionIds.map((id) => {
            const c = conditionById(id);
            return `<md-assist-chip label="${esc(c.label)}">${icon(c.icon, 'slot="icon"')}</md-assist-chip>`;
          }).join("")}</md-chip-set>
          <p class="md-typescale-body-medium muted">${esc(s.persona.bio)}</p>
        </div>
        <section class="stack-sm">
          <div class="spread"><h3 class="md-typescale-title-medium">What makes cooking hard</h3>
            <md-text-button data-action="addConstraint">${icon("add", 'slot="icon"')}Add</md-text-button></div>
          ${state.constraints.length ? `<md-list class="card outlined">${state.constraints.map((c) => `
            <md-list-item class="constraint">
              <div slot="headline">${esc(c.title)}</div>
              <div slot="supporting-text">${esc(c.detail)}</div>
              <div slot="end" class="row" style="gap:0">
                <md-icon-button data-action="editConstraint" data-id="${c.id}" aria-label="Edit ${esc(c.title)}">${icon("edit")}</md-icon-button>
                <md-icon-button data-action="deleteConstraint" data-id="${c.id}" aria-label="Delete ${esc(c.title)}">${icon("delete")}</md-icon-button>
              </div>
            </md-list-item>`).join("")}</md-list>`
            : `<div class="card filled empty">${icon("info")}<p class="md-typescale-body-large">Nothing listed. Simplified recipes are turned off until you add something.</p></div>`}
        </section>
        <section class="stack-sm"><h3 class="md-typescale-title-medium">Kitchen camera</h3>
          <md-list class="card outlined"><md-list-item>
            ${icon(state.cameraLinked ? "videocam" : "videocam_off", 'slot="start"')}
            <div slot="headline">${state.cameraLinked ? "Linked: Stove cam" : "Not linked"}</div>
            <div slot="supporting-text">${state.cameraLinked ? "Steps are ticked off for you while you cook" : "You tick off steps yourself"}</div>
            <md-switch slot="end" data-action="toggleCamera" ${state.cameraLinked ? "selected" : ""} aria-label="Kitchen camera"></md-switch>
          </md-list-item></md-list></section>
        <section class="stack-sm"><h3 class="md-typescale-title-medium">Tools that help</h3>
          <md-list class="card outlined">${s.tools.map((t) => `<md-list-item>${icon("handyman", 'slot="start"')}<div slot="headline">${esc(t.name)}</div><div slot="supporting-text">${esc(t.why)}</div></md-list-item>`).join("")}</md-list></section>
        <div class="stack-sm">
          <md-outlined-button class="full" data-action="changeNeeds">Change what makes cooking hard</md-outlined-button>
          <md-text-button class="full" data-action="restart">Log out & restart demo</md-text-button>
        </div>
      </div>`;
  },
};

// ---------- Cooking screens ----------
function sessionTitle() {
  const s = state.session;
  if (!s) return "";
  if (s.recording) return "Recording a new dish";
  return s.items.map((it) => recipeById(it.id).title).join(" + ");
}

function feed(label, live = "LIVE") {
  return `<div class="feed">${photo(cameraPhoto(), "Live stove camera")}
    <div class="hud"><span class="live"><span class="dot"></span>${live} <span data-elapsed>00:00</span></span></div>
    ${label ? `<div class="status"><span class="live">${esc(label)}</span></div>` : ""}
  </div>`;
}

function cameraIdle() {
  return `${topBar("Kitchen camera", "home")}
    <div class="stack">
      <div class="feed">${photo(cameraPhoto(), "Stove camera")}<div class="hud"><span class="live">${smallIcon("videocam")}Stove cam · ready</span></div></div>
      <p class="md-typescale-body-large muted">The camera follows along as you cook: it ticks off steps and tells you how long until things boil.</p>
      <h3 class="md-typescale-title-medium">Cook a recipe</h3>
      <md-list class="choice-list">
        ${state.recipes.map((r) => `<md-list-item type="button" data-action="cookFromCamera" data-id="${r.id}">
          <div slot="start">${photo(r.photo, r.title, "thumb")}</div><div slot="headline">${esc(r.title)}</div>${icon("play_arrow", 'slot="end"')}</md-list-item>`).join("")}
      </md-list>
      <md-list class="choice-list">
        <md-list-item type="button" data-action="recordNew">${icon("radio_button_checked", 'slot="start" style="color:var(--md-sys-color-secondary)"')}
          <div slot="headline">Record a new dish</div><div slot="supporting-text">Cooking something new? Save it as a recipe.</div>${icon("chevron_right", 'slot="end"')}</md-list-item>
      </md-list>
    </div>`;
}

function cameraRecording() {
  return `${topBar("Recording new dish", "home")}
    <div class="stack">
      ${feed("", "REC")}
      <div class="card filled stack-sm"><span class="md-typescale-label-large">Spotted so far</span><ul class="md-typescale-body-medium" data-detected style="margin:0;padding-left:20px"></ul></div>
      <md-filled-button class="full" data-action="stopRecording">${icon("stop_circle", 'slot="icon"')}Stop & save as recipe</md-filled-button>
      <md-text-button class="full" data-action="endSession">Cancel recording</md-text-button>
    </div>`;
}

/** Camera tab during a session: only the live view, with running timers as small floating tags. */
function cameraWatching() {
  const allDone = !currentStep();
  const tags = activeTags().map((g) => `<span class="float-tag ${g.done ? "done" : ""}">${icon(g.icon)}${esc(g.label)}: <span data-left="${g.key}" data-fmt="min">${minutesLeft(g.t)}</span></span>`).join("")
    + (allDone ? `<span class="float-tag">${icon("check_circle")}All done</span>` : "");
  return `<div class="cam-page">
    ${topBar("Stove camera", "home", allDone
      ? `<md-text-button data-action="finishCook">Finish</md-text-button>`
      : `<md-text-button data-action="endSession">End</md-text-button>`)}
    <div class="feed big">${photo(cameraPhoto(), "Live stove camera")}
      <div class="hud"><span class="live"><span class="dot"></span>LIVE</span></div>
      <div class="float-tags" aria-live="polite">${tags}</div>
    </div>
  </div>`;
}

/** Step checklist (manual and camera sessions). */
function cookChecklist() {
  const s = state.session;
  const { done, total, value } = progress();
  const cur = currentStep();
  const header = `<div class="card filled row md-typescale-body-medium">${icon("touch_app")}<span>Tick each step when you finish it. Start a timer when a step begins.</span></div>`;

  const stepRow = (it, st, i) => {
    const key = stepKey(it.id, i);
    const by = s.done[key];
    const isCur = cur && cur.key === key;
    const needsTimer = !by && (timerMinutesFor(st) > 0);
    return `<div class="cook-step ${by ? "done" : ""} ${isCur ? "current" : ""}">
      <md-checkbox data-action="tickStep" data-k="${key}" ${by ? "checked" : ""} aria-label="Step ${i + 1} done"></md-checkbox>
      <div class="stack-sm"><span class="text md-typescale-body-large">${esc(st.text)}</span>
        ${by === "camera" ? `<span class="seen md-typescale-label-medium">${icon("videocam")}Ticked by the camera</span>` : ""}
        ${needsTimer ? timerCard(key, st) : ""}</div>
    </div>`;
  };

  return `${topBar("Cooking", "home", `<md-icon-button data-action="endSession" aria-label="End session">${icon("close")}</md-icon-button>`)}
    <div class="stack">
      ${header}
      <div class="spread"><span class="md-typescale-title-medium">${done} of ${total} steps done</span>
        <label class="row md-typescale-body-small muted" style="gap:8px">2-min demo <md-switch data-action="fastTimers" ${state.fastTimers ? "selected" : ""} aria-label="Speed timers up so cooking takes about 2 minutes"></md-switch></label></div>
      <md-linear-progress value="${value}" aria-label="Progress"></md-linear-progress>
      ${s.items.map((it) => {
        const r = recipeById(it.id);
        return `<section class="stack-sm">
          <div class="row">${photo(r.photo, r.title, "thumb")}<div><h3 class="md-typescale-title-medium">${esc(r.title)}</h3>
          <span class="md-typescale-body-small muted">${it.mode === "simplified" ? "Simplified version" : "Original version"}</span></div></div>
          ${it.steps.map((st, i) => stepRow(it, st, i)).join("")}
        </section>`;
      }).join("")}
      <div class="sticky-cta"><md-filled-button class="full" data-action="finishCook">${done === total ? icon("celebration", 'slot="icon"') : ""}Finish cooking</md-filled-button></div>
    </div>`;
}
