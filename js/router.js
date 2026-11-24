// Hash router: #welcome, #home, #recipes … (plain names only, so links work on GitHub Pages).

import { views, navBar } from "./views.js";
import { state, scenario, data } from "./store.js";

const PUBLIC = new Set(["welcome", "signup", "needs"]);
const FLUSH = new Set(["recipe", "welcome"]);
const tabFor = (view) => ({
  home: "home", recipes: "recipes", recipe: "recipes", add: "add", profile: "profile", camera: "camera",
  cook: "recipes",
}[view]);

export const currentView = () => (location.hash || "").slice(1) || "welcome";

// Each tab remembers where the user was (view, open recipe, scroll), so switching tabs never loses their place.
const ROOT = { home: "home", recipes: "recipes", add: "add", profile: "profile", camera: "camera" };
const memory = {};   // tab → { view, recipe, mode, scroll, at }
let shown = null;    // { view, tab } currently on screen
let pendingScroll = null;

const cooking = () => state.session && !state.session.recording && state.session.items.length;

/** Bottom-bar tap: return to what the user was doing in that tab. Tapping the tab you're on goes to its top. */
export function goTab(tab) {
  if (shown && shown.tab === tab) {
    // While cooking, the Recipes tab's "top" is the cooking steps.
    const top = tab === "recipes" && cooking() && shown.view !== "cook" ? "cook" : ROOT[tab];
    return go(top);
  }
  let mem = memory[tab];
  // Recipes during a cook: straight to the steps, unless they've browsed the tab since cooking began.
  if (tab === "recipes" && cooking() && (!mem || mem.at < state.session.startedAt)) mem = { view: "cook", scroll: 0 };
  if (!mem) return go(ROOT[tab]);
  if (mem.view === "recipe") { state.currentRecipe = mem.recipe; state.detailMode = mem.mode; }
  pendingScroll = mem.scroll || 0;
  go(mem.view);
}

export function go(view) {
  if (currentView() === view) render();
  else location.hash = view;
}

function resolveView() {
  let v = currentView();
  if (!views[v]) v = "welcome";
  if (!PUBLIC.has(v) && !scenario() && v !== "camera-setup") v = "welcome";
  if (v === "camera-setup" && !scenario()) v = "welcome";
  if (v === "recipe" && !state.recipes.some((r) => r.id === state.currentRecipe)) v = "recipes";
  if (v === "cook" && (!state.session || state.session.recording)) v = state.session ? "camera" : "recipes";
  // No "Continue cooking" page: the dish being cooked always opens as the cooking steps.
  if (v === "recipe" && cooking() && state.session.items.some((it) => it.id === state.currentRecipe)) v = "cook";
  return v;
}

export function render({ keepScroll = false } = {}) {
  if (!data()) return;
  const view = resolveView();
  const screen = document.getElementById("screen");
  const y = screen.scrollTop;
  if (shown?.tab && memory[shown.tab]) memory[shown.tab].scroll = y;
  screen.className = "screen" + (FLUSH.has(view) ? " flush" : "");
  screen.innerHTML = `<div class="page">${views[view]()}</div>`;
  screen.scrollTop = keepScroll ? y : (pendingScroll ?? 0);
  pendingScroll = null;
  if (keepScroll) screen.firstElementChild.style.animation = "none";

  const nav = document.getElementById("nav");
  const tab = tabFor(view);
  nav.hidden = !tab;
  if (tab) nav.innerHTML = navBar(tab);
  if (tab) memory[tab] = { view, recipe: state.currentRecipe, mode: state.detailMode, scroll: screen.scrollTop, at: Date.now() };
  shown = { view, tab };

}

export const rerender = () => render({ keepScroll: true });

window.addEventListener("hashchange", () => render());
