// Small HTML helpers built on Material Web components, plus snackbar and dialogs.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Material Symbols icon. */
export const icon = (name, attrs = "") => `<md-icon ${attrs} aria-hidden="true">${name}</md-icon>`;

/** A photo with no placeholder art: a plain surface shows until (or if) the image loads. */
export function photo(src, alt = "", cls = "") {
  return `<div class="photo ${cls}">${src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />` : ""}</div>`;
}

/** Material-style initial avatar (no photos of people). */
export function avatar(name, cls = "") {
  return `<div class="avatar ${cls}" aria-hidden="true">${esc((name || "?").trim().charAt(0).toUpperCase())}</div>`;
}

// Failed photos are removed, leaving the plain surface behind them.
document.addEventListener("error", (e) => {
  if (e.target instanceof HTMLImageElement) e.target.remove();
}, true);

export function fmtMinutes(min) {
  if (!min) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function mmss(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export const shorten = (t, n = 34) => (t.length > n ? t.slice(0, n - 1).trim() + "…" : t);

// ---------- Snackbar ----------
let snackTimer;
export function snackbar(message, iconName = "info", ms = 3200) {
  const el = document.getElementById("snackbar");
  el.innerHTML = `${icon(iconName)}<span class="md-typescale-body-medium">${esc(message)}</span>`;
  el.hidden = false;
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- Dialogs (md-dialog) ----------
function openDialog(inner, onClose) {
  const dlg = document.createElement("md-dialog");
  dlg.innerHTML = inner;
  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-value]");
    if (b) dlg.close(b.dataset.value);
  });
  dlg.addEventListener("closed", () => { onClose(dlg.returnValue, dlg); dlg.remove(); });
  document.body.appendChild(dlg);
  requestAnimationFrame(() => dlg.show());
  return dlg;
}

export function confirmDialog({ title, body, confirm = "Delete", iconName = "delete" }) {
  return new Promise((resolve) => {
    openDialog(`
      ${icon(iconName, 'slot="icon"')}
      <div slot="headline">${esc(title)}</div>
      <div slot="content">${esc(body)}</div>
      <div slot="actions">
        <md-text-button data-value="cancel">Cancel</md-text-button>
        <md-filled-button data-value="ok">${esc(confirm)}</md-filled-button>
      </div>`, (v) => resolve(v === "ok"));
  });
}

/** fields: [{ id, label, value, type: "text" | "textarea" }] → resolves to { id: value } or null. */
export function formDialog({ title, fields, confirm = "Save" }) {
  return new Promise((resolve) => {
    const dlg = openDialog(`
      <div slot="headline">${esc(title)}</div>
      <div slot="content" class="stack">
        ${fields.map((f) => `<md-outlined-text-field class="full" data-field="${f.id}" label="${esc(f.label)}"
            ${f.type === "textarea" ? 'type="textarea" rows="3"' : ""} value="${esc(f.value || "")}"></md-outlined-text-field>`).join("")}
      </div>
      <div slot="actions">
        <md-text-button data-value="cancel">Cancel</md-text-button>
        <md-filled-button data-value="ok">${esc(confirm)}</md-filled-button>
      </div>`, (v, d) => {
        if (v !== "ok") return resolve(null);
        const out = {};
        d.querySelectorAll("[data-field]").forEach((el) => { out[el.dataset.field] = el.value.trim(); });
        resolve(out);
      });
    setTimeout(() => dlg.querySelector("[data-field]")?.focus(), 200);
  });
}

export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.21);
    });
  } catch { /* audio not available */ }
}
