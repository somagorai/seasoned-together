// What every data-action does. Handlers receive the clicked element's dataset.

import {
  state, data, scenario, recipeById, conditionById, persist, resetAll, applyScenario, resolveScenario,
  effectiveConditions, matchConditions, freshOnboarding, freshAdd,
} from "./store.js";
import { snackbar, confirmDialog, formDialog } from "./ui.js";
import { go, rerender, currentView } from "./router.js";
import { startSession, endSession, toggleStep, startTimer, stopTimer, addMinute, currentStep } from "./cooking.js";
import { otherMatchSummary } from "./views.js";
import { listen } from "./voice.js";

const $ = (id) => document.getElementById(id);

export const actions = {
  // ----- Navigation -----
  nav({ to }) { go(to); },
  restart() { resetAll(); go("welcome"); },

  // ----- Onboarding -----
  saveName() {
    state.userName = ($("name")?.value || "").trim();
    state.onboarding.from = "signup";
    go("needs");
  },
  toggleCondition({ id }) {
    const sel = state.onboarding.selected;
    sel.has(id) ? sel.delete(id) : sel.add(id);
    rerender();
  },
  toggleOther() { state.onboarding.other = !state.onboarding.other; rerender(); },
  otherMode({ mode }) { state.onboarding.otherMode = mode; rerender(); },
  otherVoice() {
    const o = state.onboarding;
    if (o.voice === "listening") return;
    o.voice = "listening"; rerender();
    listen((text, why) => {
      if (text) { o.text = text; o.voice = "done"; }
      else if (why === "unsupported") { o.text = data().otherInput.voiceSample; o.voice = "done"; }
      else { o.voice = "missed"; }
      if (currentView() === "needs") rerender();
    });
  },
  confirmNeeds() {
    const ids = effectiveConditions();
    if (!ids.length) return;
    applyScenario(resolveScenario(ids), ids);
    state.onboarding = freshOnboarding();
    go(scenario().camera ? "camera-setup" : "home");
  },
  changeNeeds() {
    state.onboarding = freshOnboarding(state.conditionIds);
    state.onboarding.from = "profile";
    go("needs");
  },
  linkCamera({ next }) {
    state.cameraLinked = true;
    if (state.session) state.session.camera = true;
    persist();
    snackbar("Camera linked: Stove cam", "videocam");
    go(next || "home");
  },
  toggleCamera() {
    state.cameraLinked = !state.cameraLinked;
    if (state.session) state.session.camera = state.cameraLinked;
    persist();
    rerender();
  },

  // ----- Recipes -----
  openRecipe({ id }) { state.currentRecipe = id; state.detailMode = "simplified"; go("recipe"); },
  /** "Cooking in progress": straight to the cooking steps. */
  resumeCooking() { go(state.session?.recording ? "camera" : "cook"); },
  /** Recipes tab: while something is cooking, show that dish's recipe (simplified if they named a pain point). */
  navRecipes() {
    const s = state.session;
    if (!s || s.recording || !s.items.length) return go("recipes");
    state.currentRecipe = (currentStep() || { item: s.items[0] }).item.id;
    state.detailMode = state.constraints.length ? "simplified" : "original";
    go("recipe");
  },
  /** Start a recipe from the Camera tab and stay on the camera. */
  cookFromCamera({ id }) {
    state.detailMode = "simplified";
    startSession([id]);
    go("camera");
  },
  detailMode({ mode }) { state.detailMode = mode; rerender(); },
  folder({ f }) { state.folder = f; rerender(); },
  toggleSelect({ id }) {
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
    rerender();
  },

  // ----- Cooking -----
  startCook() {
    state.detailMode = "simplified";
    startSession([...state.selected]);
    go("cook");
  },
  cookOne({ id }) {
    startSession([...new Set([...state.selected, id])]);
    go("cook");
  },
  tickStep({ k }) { toggleStep(k); rerender(); },
  startTimer({ k }) { startTimer(k); rerender(); snackbar("Timer started", "timer"); },
  stopTimer({ k }) { stopTimer(k); rerender(); },
  addMinute({ k }) { addMinute(k); rerender(); snackbar("Added 1 minute", "more_time"); },
  fastTimers() { state.fastTimers = !state.fastTimers; rerender(); },
  finishCook() {
    const names = state.session.items.map((it) => recipeById(it.id).title).join(" and ");
    endSession();
    snackbar(`Nicely done! Enjoy your ${names}.`, "celebration");
    go("home");
  },
  endSession() { endSession(); snackbar("Cooking session ended", "close"); go("home"); },
  recordNew() {
    if (!state.cameraLinked) { state.cameraLinked = true; persist(); }
    startSession([], { recording: true });
    go("camera");
  },
  stopRecording() {
    const s = scenario();
    const minutes = Math.max(5, Math.round((Date.now() - state.session.startedAt) / 1000));
    endSession();
    addRecipe(makeRecipe({
      title: `New dish · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      ingredients: s.recipes[0].ingredients.slice(0, 4),
      steps: [
        { text: "Place the pot on the front burner and add oil", timerMinutes: 0 },
        { text: `Add ${s.recipes[0].ingredients[0]}`, timerMinutes: 0 },
        { text: "Add liquid and bring to a simmer", timerMinutes: Math.min(minutes, 30) },
        { text: "Lower the heat, cover and rest", timerMinutes: 5 },
      ],
      photo: s.recipes[0].photo,
    }));
  },

  // ----- Add a recipe -----
  addSource({ src }) { captureDraft(); state.add.source = src; rerender(); },
  addManual({ m }) { captureDraft(); state.add.manual = m; rerender(); },
  pickFile({ input }) { $(input)?.click(); },
  addVoice() {
    const a = state.add;
    if (a.voice === "listening") return;
    captureDraft();
    a.voice = "listening"; rerender();
    listen((text, why) => {
      a.voice = "idle";
      if (currentView() !== "add") return;
      const d = a.draft;
      if (text) {
        const parts = text.split(/(?:[.!?]\s+|,?\s+(?:and then|then|next|after that)\s+)/i).map((x) => x.trim()).filter(Boolean);
        d.steps = [d.steps, ...parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1))].filter(Boolean).join("\n");
        d.title = d.title || "My spoken recipe";
        snackbar("Got it. Check the steps below.", "mic");
      } else if (why === "unsupported") {
        Object.assign(d, {
          title: "Simple lentil soup",
          ingredients: "1 cup red lentils\n1 carton vegetable broth\n1 cup frozen diced onion\n1 tsp cumin",
          steps: "Add everything to the pot\nBring to a boil (8 min)\nSimmer with the lid on (20 min)\nBlend with a stick blender (1 min)",
        });
        snackbar("Got it. Check the details below.", "mic");
      } else {
        snackbar("Sorry, we didn't catch that. Try again or type it.", "mic_off");
      }
      rerender();
    });
  },
  saveManual() {
    captureDraft();
    const d = state.add.draft;
    if (!d.title.trim()) { snackbar("Give your recipe a name first", "edit"); $("d-title")?.focus(); return; }
    const r = makeRecipe({
      title: d.title.trim(),
      ingredients: d.ingredients.split("\n").map((x) => x.trim()).filter(Boolean),
      steps: parseSteps(d.steps),
      photo: state.add.photo,
    });
    state.add.busy = "Saving your recipe"; rerender();
    setTimeout(() => addRecipe(r), 1200);
  },
  importWeb() {
    const url = ($("url")?.value || "").trim();
    if (!url) { snackbar("Paste a recipe link first", "link"); return; }
    const slug = url.split(/[?#]/)[0].split("/").filter(Boolean).pop() || "imported-recipe";
    const title = slug.replace(/\.\w+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const s = scenario();
    const base = s.recipes[1] || s.recipes[0];
    state.add.busy = "Reading the recipe"; rerender();
    setTimeout(() => addRecipe(makeRecipe({ title, ingredients: base.ingredients, steps: base.steps.map((x) => ({ ...x })), photo: base.photo })), 1500);
  },

  // ----- Profile -----
  async addConstraint() {
    const v = await formDialog({ title: "Add something that's hard", fields: [
      { id: "title", label: "What's hard?" }, { id: "detail", label: "When does it hurt?", type: "textarea" }] });
    if (!v || !v.title) return;
    state.constraints.push({ id: `c-${Date.now()}`, title: v.title, detail: v.detail });
    snackbar("Added", "check"); rerender();
  },
  async editConstraint({ id }) {
    const c = state.constraints.find((x) => x.id === id);
    const v = await formDialog({ title: "Edit", fields: [
      { id: "title", label: "What's hard?", value: c.title }, { id: "detail", label: "When does it hurt?", type: "textarea", value: c.detail }] });
    if (!v || !v.title) return;
    Object.assign(c, v);
    snackbar("Updated", "check"); rerender();
  },
  async deleteConstraint({ id }) {
    const c = state.constraints.find((x) => x.id === id);
    const last = state.constraints.length === 1;
    const ok = await confirmDialog({
      title: `Delete “${c.title}”?`,
      body: last ? "This is the last one. Simplified recipes are linked to these, so they'll be turned off." : "Recipes simplified for this will be updated.",
    });
    if (!ok) return;
    state.constraints = state.constraints.filter((x) => x.id !== id);
    snackbar("Deleted", "delete"); rerender();
  },
};

// ---------- Helpers ----------
export function captureDraft() {
  const d = state.add.draft;
  if ($("d-title")) { d.title = $("d-title").value; d.ingredients = $("d-ing").value; d.steps = $("d-steps").value; }
}

function parseSteps(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/\((\d+)\s*(?:min|mins|minutes?)\)/i);
    return { text: l.replace(/\s*\(\d+\s*(?:min|mins|minutes?)\)/i, ""), timerMinutes: m ? +m[1] : 0 };
  });
}

export function makeRecipe({ title, ingredients, steps, photo }) {
  const s = scenario();
  const st = steps.length ? steps : [{ text: "Add your first step", timerMinutes: 0 }];
  return {
    id: `user-${Date.now()}`,
    title: title || "Untitled recipe",
    photo: photo || "",
    folder: "My additions",
    time: st.reduce((n, x) => n + (x.timerMinutes || 0), 0) || 15,
    servings: 2,
    ingredients: ingredients.length ? ingredients : ["(no ingredients listed)"],
    steps: st,
    generated: true,
    simplified: { summary: `Adapted for ${s.label.toLowerCase()}. ${s.tips[0]}`, steps: st.map((x) => ({ ...x })), swaps: [], prepAhead: s.tips.slice(1) },
  };
}

export function addRecipe(r) {
  state.recipes.unshift(r);
  state.currentRecipe = r.id;
  state.detailMode = "simplified";
  state.add = freshAdd();
  snackbar(`Saved “${r.title}” to My additions`, "check_circle");
  go("recipe");
}

/** Update the needs screen in place while the person types, so the text field keeps focus. */
export function refreshNeeds() {
  const o = state.onboarding;
  const chosen = new Set(effectiveConditions());
  const matched = new Set(matchConditions(o.text));
  document.querySelectorAll('md-list-item[data-action="toggleCondition"]').forEach((li) => {
    const id = li.dataset.id;
    const on = chosen.has(id);
    li.toggleAttribute("data-selected", on);
    const cb = li.querySelector("md-checkbox");
    if (cb) { cb.checked = on; cb.toggleAttribute("checked", on); }
    const sup = li.querySelector('[slot="supporting-text"]');
    if (sup) sup.textContent = matched.has(id) && !o.selected.has(id) ? "Added from what you told us" : conditionById(id).sub;
  });
  const box = $("otherMatch");
  if (box) box.innerHTML = otherMatchSummary();
  const btn = $("needsContinue");
  if (btn) btn.disabled = !chosen.size;
}

