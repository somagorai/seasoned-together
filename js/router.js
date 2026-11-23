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
  return v;
}

export function render({ keepScroll = false } = {}) {
  if (!data()) return;
  const view = resolveView();
  const screen = document.getElementById("screen");
  const y = screen.scrollTop;
  screen.className = "screen" + (FLUSH.has(view) ? " flush" : "");
  screen.innerHTML = `<div class="page">${views[view]()}</div>`;
  screen.scrollTop = keepScroll ? y : 0;
  if (keepScroll) screen.firstElementChild.style.animation = "none";

  const nav = document.getElementById("nav");
  const tab = tabFor(view);
  nav.hidden = !tab;
  if (tab) nav.innerHTML = navBar(tab);

}

export const rerender = () => render({ keepScroll: true });

window.addEventListener("hashchange", () => render());
