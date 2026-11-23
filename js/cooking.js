// Cooking sessions: step checklist, timers and, when a camera is linked, automatic step tracking.
//
// Camera flow for the current step:
//   1. "See" phase: after a moment, the camera notices the step has begun.
//   2. Wait phase (steps with `watch`): a camera-estimated wait, shown as a small tag ("Boils in 5:30").
//   3. Timer phase (steps with `timerMinutes`): the camera starts the timer ("Simmering · 12:00"),
//      then beeps and suggests a check ("You might want to check the broth!") and ticks the step.
//   Steps with neither are ticked once the camera has "seen" them done.
// Without a camera, the person starts timers and ticks steps themselves.

import { state, recipeById, scenario } from "./store.js";
import { snackbar, mmss, shorten, beep, esc } from "./ui.js";
import { rerender, currentView } from "./router.js";

const SEE_START_MS = 2500;   // camera notices a timed step has begun
const SEE_ACTION_MS = 7000;  // camera "sees" an untimed step done
const DEMO_SESSION_MS = 120000; // demo pace: a whole session plays out in about 2 minutes

export const WAIT_KINDS = {
  boil: { tag: "Boiling", left: "until boiling", done: "It's boiling!" },
  pressure: { tag: "Pressure", left: "until it's at pressure", done: "It's at pressure." },
  preheat: { tag: "Preheating", left: "until it's hot", done: "It's hot." },
};

/** What a step is doing: floating-tag label and what to check when its timer ends. */
const ACTIVITIES = [
  [/preheat/i, "Preheating", "the oven"],
  [/cook on low|slow cooker/i, "Slow cooking", "the slow cooker"],
  [/release/i, "Releasing pressure", "the pressure cooker"],
  [/pressure/i, "Pressure cooking", "the pressure cooker"],
  [/simmer/i, "Simmering", "the pot"],
  [/boil/i, "Boiling", "the pot"],
  [/air[- ]?fr/i, "Air frying", "the air fryer"],
  [/roast/i, "Roasting", "the oven"],
  [/bake|oven/i, "Baking", "the oven"],
  [/microwave/i, "Microwaving", "the microwave"],
  [/skillet|stir|fry|brown/i, "Cooking", "the pan"],
  [/rest/i, "Resting", "the dish"],
  [/steam/i, "Steaming", "the pot"],
];

export function activityOf(step) {
  const hit = ACTIVITIES.find(([re]) => re.test(step.text));
  return hit ? hit[1] : "Cooking";
}
function checkMessage(step, recipe) {
  const hit = ACTIVITIES.find(([re]) => re.test(step.text));
  let what = hit ? hit[2] : "the pot";
  if (["the pot", "the pressure cooker", "the slow cooker"].includes(what) && /soup|stew|chili|broth/i.test(recipe.title)) what = "the broth";
  if (what === "the pot" && /pasta/i.test(recipe.title)) what = "the pasta";
  return `${hit ? hit[1] : "Cooking"} is done. You might want to check ${what}!`;
}

/** The scenario's own stove (data/scenarios.json → scenario.cameraPhoto), the same for the whole session. */
export const cameraPhoto = () => scenario()?.cameraPhoto || "";

export const stepKey = (recipeId, i) => `${recipeId}__${i}`;

const speed = () => (state.fastTimers ? (state.session?.factor || 60) : 1);

/** How much to speed timers up so the whole session lasts about 2 minutes, leaving time for untimed steps. */
function demoFactor(steps, camera) {
  const minutes = steps.reduce((n, st) => n + (st.watch?.minutes || 0) + (st.timerMinutes || 0), 0);
  if (!minutes) return 60;
  const untimed = steps.filter((st) => !st.watch && !st.timerMinutes).length;
  const timed = steps.length - untimed;
  const budget = Math.max(30000, DEMO_SESSION_MS - untimed * (camera ? SEE_ACTION_MS : 6000) - timed * (camera ? SEE_START_MS : 3000));
  return Math.max(1, (minutes * 60000) / budget);
}

export function startSession(recipeIds, { recording = false } = {}) {
  state.session = {
    items: recipeIds.map((id) => {
      const r = recipeById(id);
      const simplified = state.constraints.length > 0 && r.simplified && state.detailMode !== "original";
      return { id, mode: simplified ? "simplified" : "original", steps: simplified ? r.simplified.steps : r.steps };
    }),
    done: {},     // key → "camera" | "you"
    timers: {},   // key → { endsAt, total, factor, label, finished, cleared }
    waits: {},    // key → { kind, endsAt, total, factor, finished }
    watch: null,  // { key, since }: what the camera is looking at
    camera: state.cameraLinked,
    recording,
    startedAt: Date.now(),
  };
  const s = state.session;
  s.factor = demoFactor(s.items.flatMap((it) => it.steps), s.camera);
  state.selected.clear();
}

export const endSession = () => { state.session = null; };

export function allSteps() {
  const s = state.session;
  if (!s) return [];
  return s.items.flatMap((it) => it.steps.map((step, i) => ({ item: it, step, i, key: stepKey(it.id, i) })));
}
export const currentStep = () => allSteps().find((x) => !state.session.done[x.key]) || null;
export const nextStepAfter = (key) => {
  const all = allSteps();
  const i = all.findIndex((x) => x.key === key);
  return all.slice(i + 1).find((x) => !state.session.done[x.key]) || null;
};
export function progress() {
  const steps = allSteps();
  const done = steps.filter((x) => state.session.done[x.key]).length;
  return { done, total: steps.length, value: steps.length ? done / steps.length : 0 };
}
const stepOf = (key) => {
  const [id, i] = key.split("__");
  return { recipe: recipeById(id), step: state.session.items.find((it) => it.id === id).steps[+i], i: +i };
};

/** Minutes a manual timer should run: the step's timer, or its estimated wait when there's no camera. */
export const timerMinutesFor = (step) => step.timerMinutes || step.watch?.minutes || 0;

export function toggleStep(key) {
  const s = state.session;
  if (s.done[key]) delete s.done[key];
  else {
    s.done[key] = "you";
    if (s.timers[key]) s.timers[key].cleared = true;
    if (s.waits[key]) s.waits[key].finished = true;
  }
  s.watch = null;
}

export function startTimer(key) {
  const s = state.session;
  const { recipe, step } = stepOf(key);
  const f = speed();
  const total = (timerMinutesFor(step) * 60000) / f;
  s.timers[key] = { endsAt: Date.now() + total, total, factor: f, label: `${shorten(step.text, 30)} · ${recipe.title}`, finished: false, cleared: false };
}
export function addMinute(key) {
  const t = state.session.timers[key];
  if (!t) return;
  const extra = 60000 / t.factor;
  t.endsAt = Math.max(t.endsAt, Date.now()) + extra;
  t.total += extra;
  t.finished = false;
}
export function stopTimer(key) {
  const s = state.session;
  const t = s.timers[key];
  if (!t) return;
  t.cleared = true;
  if (t.finished) s.done[key] = s.done[key] || "you";
}
export const timerFor = (key) => { const t = state.session?.timers[key]; return t && !t.cleared ? t : null; };
export const waitFor = (key) => { const w = state.session?.waits[key]; return w && !w.finished ? w : null; };

/** Whole minutes left, for the camera's floating tags: "10 min". */
export const minutesLeft = (t, now = Date.now()) => `${Math.max(1, Math.ceil((Math.max(0, t.endsAt - now) * t.factor) / 60000))} min`;

/** Remaining time shown to the person (in recipe time), and progress 0..1 for rings. */
export function readout(t, now = Date.now()) {
  const left = Math.max(0, t.endsAt - now);
  return { text: mmss(left * t.factor), value: t.total ? 1 - left / t.total : 1, leftMs: left * t.factor };
}
/** Every running wait/timer as a small tag for the camera view: { key, icon, label, t, done }. */
export function activeTags() {
  const s = state.session;
  if (!s) return [];
  const tags = [];
  for (const [key, w] of Object.entries(s.waits)) {
    if (!w.finished) tags.push({ key, icon: "local_fire_department", label: WAIT_KINDS[w.kind].tag, t: w });
  }
  for (const [key, t] of Object.entries(s.timers)) {
    if (!t.cleared) tags.push({ key, icon: "timer", label: activityOf(stepOf(key).step), t, done: t.finished });
  }
  return tags;
}

// ---------- Ticker ----------
function tick() {
  const s = state.session;
  if (!s) return;
  const now = Date.now();
  let changed = false;

  for (const [key, t] of Object.entries(s.timers)) {
    if (t.cleared) continue;
    if (t.endsAt - now <= 0 && !t.finished) {
      t.finished = true;
      beep();
      const { step, recipe } = stepOf(key);
      if (s.camera) { t.cleared = true; s.done[key] = "camera"; }
      snackbar(checkMessage(step, recipe), "notifications_active", 6000);
      changed = true;
    }
  }

  for (const [key, w] of Object.entries(s.waits)) {
    if (w.finished || w.endsAt - now > 0) continue;
    w.finished = true; beep();
    const { step } = stepOf(key);
    if (step.timerMinutes > 0) startTimer(key);
    else s.done[key] = "camera";
    snackbar(WAIT_KINDS[w.kind].done, "local_fire_department");
    changed = true;
  }

  if (s.camera && !s.recording && s.items.length) changed = watchCurrentStep(now) || changed;

  // Live readouts (no full re-render needed)
  document.querySelectorAll("[data-left]").forEach((el) => {
    const t = s.timers[el.dataset.left] || s.waits[el.dataset.left];
    if (t) el.textContent = el.dataset.fmt === "min" ? minutesLeft(t, now) : readout(t, now).text;
  });
  document.querySelectorAll("[data-ring]").forEach((el) => {
    const t = s.timers[el.dataset.ring] || s.waits[el.dataset.ring];
    if (t) el.value = readout(t, now).value;
  });
  const elapsed = document.querySelector("[data-elapsed]");
  if (elapsed) elapsed.textContent = mmss((now - s.startedAt) * speed());
  const detected = document.querySelector("[data-detected]");
  if (detected && s.recording) detected.innerHTML = recordingLog(now - s.startedAt);

  if (changed && ["cook", "camera"].includes(currentView())) rerender();
}

function watchCurrentStep(now) {
  const s = state.session;
  const cur = currentStep();
  if (!cur) return false;
  if (!s.watch || s.watch.key !== cur.key) { s.watch = { key: cur.key, since: now }; return true; }
  const seen = now - s.watch.since;
  const { step } = cur;
  if (step.watch && !s.waits[cur.key] && !s.timers[cur.key]) {
    if (seen < SEE_START_MS) return false;
    const f = speed();
    const total = (step.watch.minutes * 60000) / f;
    s.waits[cur.key] = { kind: step.watch.kind, endsAt: now + total, total, factor: f, finished: false };
    return true;
  }
  if (step.watch) return false; // waiting, or timer running after the wait
  if (step.timerMinutes > 0) {
    if (!s.timers[cur.key] && seen > SEE_START_MS) {
      startTimer(cur.key);
      return true;
    }
    return false;
  }
  if (seen > SEE_ACTION_MS) {
    s.done[cur.key] = "camera";
    return true;
  }
  return false;
}

function recordingLog(ms) {
  const first = scenario().recipes[0].ingredients[0];
  const seen = ["Pot placed on the front burner", "Oil added", `Ingredient spotted: ${first}`, "Liquid added, simmer started", "Lid on, heat lowered"];
  return seen.slice(0, Math.min(seen.length, 1 + Math.floor(ms / 3000))).map((x) => `<li>${esc(x)}</li>`).join("");
}

setInterval(tick, 250);
