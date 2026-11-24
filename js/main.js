// Entry point: load scenario data, restore the last session, wire events, render.

import { state, setData, restore, scenario } from "./store.js";
import { render } from "./router.js";
import { actions, refreshNeeds, captureDraft, addRecipe, makeRecipe } from "./actions.js";
import { recipeRow, emptyRecipes } from "./views.js";
import { snackbar } from "./ui.js";

// One click handler for the whole app: any element with data-action.
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.hasAttribute("disabled") || el.closest("md-dialog")) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn({ ...el.dataset }); }
});

document.addEventListener("input", (e) => {
  const id = e.target.id;
  if (id === "search") {
    state.search = e.target.value;
    const q = state.search.trim().toLowerCase();
    const list = state.recipes.filter((r) =>
      (state.folder === "All" || r.folder === state.folder) &&
      (!q || r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q))));
    document.getElementById("recipe-list").innerHTML = list.length ? list.map(recipeRow).join("") : emptyRecipes();
  } else if (id === "url") {
    state.add.url = e.target.value;
  } else if (id && id.startsWith("d-")) {
    captureDraft();
  } else if (id === "otherText") {
    state.onboarding.text = e.target.value;
    refreshNeeds();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "name") actions.saveName();
});

document.addEventListener("change", (e) => {
  const input = e.target;
  const file = input.files && input.files[0];
  if (!file) return;
  if (input.id === "photo") {
    captureDraft();
    state.add.photo = URL.createObjectURL(file);
    state.add.busy = "Reading your recipe card";
    render({ keepScroll: true });
    setTimeout(() => {
      const d = state.add.draft;
      state.add.busy = "";
      d.title = d.title || "Recipe from photo";
      d.ingredients = d.ingredients || "2 cups flour\n1 cup milk\n2 eggs\n1 tbsp sugar";
      d.steps = d.steps || "Stir everything together in a bowl\nRest the batter (10 min)\nCook spoonfuls in a pan (3 min)";
      snackbar("Text found. Check it, then save.", "document_scanner");
      render({ keepScroll: true });
    }, 1500);
  } else if (input.id === "vid") {
    state.add.busy = "Watching your video";
    render({ keepScroll: true });
    const base = scenario().recipes[2];
    setTimeout(() => addRecipe(makeRecipe({
      title: file.name.replace(/\.\w+$/, "").replace(/[-_]+/g, " ") || "Recipe from video",
      ingredients: base.ingredients, steps: base.steps.map((x) => ({ ...x })), photo: base.photo,
    })), 1800);
  }
});

async function boot() {
  const screen = document.getElementById("screen");
  try {
    const res = await fetch("data/scenarios.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setData(await res.json());
  } catch (err) {
    screen.innerHTML = `<div class="boot-error stack">
      <h2>Couldn't load the scenarios</h2>
      <p>Open this folder through a local server instead of double-clicking the file:</p>
      <p><code>python3 -m http.server 8137</code></p>
      <p>then visit <code>http://localhost:8137</code>.</p>
      <p class="muted">${String(err.message)}</p></div>`;
    return;
  }
  restore();
  render();

  // Material Web is bundled into vendor/material-web.js; warn clearly if it's missing.
  setTimeout(() => {
    if (customElements.get("md-filled-button")) return;
    screen.insertAdjacentHTML("afterbegin", `<div class="boot-error card filled stack-sm">
      <b>Material components didn't load.</b>
      <p>Run this once in the project folder, then reload:</p>
      <p><code>npm install && npm run vendor</code></p></div>`);
  }, 2500);
}

boot();
