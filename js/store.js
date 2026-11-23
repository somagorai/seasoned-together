// App state, scenario data and persistence. No DOM code here.

const STORAGE_KEY = "st:profile";

let DATA = null;

export const state = {
  scenarioId: null,
  conditionIds: [],        // what the user said makes cooking hard
  userName: "",
  cameraLinked: false,
  constraints: [],         // editable copy of the scenario's constraints
  recipes: [],             // scenario recipes + anything the user adds
  folder: "All",
  search: "",
  selected: new Set(),     // recipe ids picked for a cooking session
  currentRecipe: null,
  detailMode: "simplified",
  onboarding: freshOnboarding(),
  add: freshAdd(),
  session: null,           // see cooking.js
  fastTimers: true,        // demo pace: timers are sped up so a whole session lasts about 2 minutes
};

export function freshOnboarding(selected = []) {
  return { selected: new Set(selected), other: false, otherMode: "type", text: "", voice: "idle" };
}
export function freshAdd() {
  return { source: "manual", manual: "type", busy: "", voice: "idle", photo: null, draft: { title: "", ingredients: "", steps: "" } };
}

export const setData = (d) => { DATA = d; };
export const data = () => DATA;
export const scenario = () => (DATA ? DATA.scenarios.find((s) => s.id === state.scenarioId) : null);
export const recipeById = (id) => state.recipes.find((r) => r.id === id);
export const conditionById = (id) => DATA.conditions.find((c) => c.id === id);
export const firstName = () => (state.userName || scenario()?.persona.name || "friend").trim().split(/\s+/)[0];
export const hasCamera = () => !!state.cameraLinked;
export const prototypeNotes = () => !!DATA?.meta?.showPrototypeNotes;

/** Conditions mentioned in free text ("my knees hurt" → ["knee-pain"]). */
export function matchConditions(text) {
  const t = ` ${String(text || "").toLowerCase()} `;
  if (!t.trim()) return [];
  return Object.entries(DATA.otherInput.keywords)
    .filter(([, words]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(t)))
    .map(([id]) => id);
}

/** Everything the user has said makes cooking hard: ticked items plus anything matched from "Other". */
export function effectiveConditions() {
  const o = state.onboarding;
  const ids = new Set(o.selected);
  if (o.other) matchConditions(o.text).forEach((id) => ids.add(id));
  return DATA.conditions.map((c) => c.id).filter((id) => ids.has(id));
}

/**
 * Pick the scenario that best fits the selected conditions:
 * exact match first (Arthritis + Back pain → combined scenario), otherwise the one
 * covering the most selected conditions with the fewest extras.
 */
export function resolveScenario(conditionIds) {
  const want = new Set(conditionIds);
  let best = null;
  let bestScore = -Infinity;
  for (const s of DATA.scenarios) {
    const hit = s.conditions.filter((c) => want.has(c)).length;
    const extra = s.conditions.length - hit;
    const score = hit * 10 - extra * 11;
    if (hit > 0 && score > bestScore) { best = s; bestScore = score; }
  }
  return best ? best.id : DATA.scenarios[0].id;
}

export function applyScenario(id, conditionIds) {
  const s = DATA.scenarios.find((x) => x.id === id);
  if (!s) return;
  state.scenarioId = id;
  state.conditionIds = conditionIds && conditionIds.length ? conditionIds : [...s.conditions];
  state.constraints = s.constraints.map((c) => ({ ...c }));
  // If the user picked a condition this scenario doesn't cover, add its constraints too.
  for (const cid of state.conditionIds) {
    if (s.conditions.includes(cid)) continue;
    const donor = DATA.scenarios.find((x) => x.conditions.length === 1 && x.conditions[0] === cid);
    if (donor) state.constraints.push(...donor.constraints.map((c) => ({ ...c })));
  }
  state.recipes = s.recipes.map((r) => ({ ...r }));
  state.cameraLinked = false;
  state.selected.clear();
  state.session = null;
  state.folder = "All";
  state.search = "";
  persist();
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      scenarioId: state.scenarioId, conditionIds: state.conditionIds,
      userName: state.userName, cameraLinked: state.cameraLinked,
    }));
  } catch { /* storage unavailable: the prototype still works in memory */ }
}

export function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || !DATA.scenarios.some((s) => s.id === saved.scenarioId)) return false;
    state.userName = saved.userName || "";
    applyScenario(saved.scenarioId, saved.conditionIds);
    state.cameraLinked = !!saved.cameraLinked;
    return true;
  } catch { return false; }
}

export function resetAll() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  Object.assign(state, {
    scenarioId: null, conditionIds: [], userName: "", cameraLinked: false, constraints: [], recipes: [],
    folder: "All", search: "", currentRecipe: null, detailMode: "simplified",
    onboarding: freshOnboarding(), add: freshAdd(), session: null, fastTimers: true,
  });
  state.selected.clear();
}
