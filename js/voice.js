// Speech-to-text using the browser's Web Speech API (Chrome, Edge, Safari over HTTPS/localhost).
// onDone(text) on success; onDone(null, "unsupported") when the browser has no speech API
// (the caller then uses a sample phrase); onDone(null, "missed") when nothing was heard.

export function listen(onDone) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let finished = false;
  const done = (text, why) => { if (!finished) { finished = true; onDone(text, why); } };
  if (!SR) { setTimeout(() => done(null, "unsupported"), 1600); return; }
  try {
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => done(e.results?.[0]?.[0]?.transcript?.trim() || null, "missed");
    rec.onerror = () => done(null, "missed");
    rec.onend = () => setTimeout(() => done(null, "missed"), 400);
    rec.start();
    setTimeout(() => { try { rec.stop(); } catch { /* already stopped */ } }, 10000);
  } catch {
    setTimeout(() => done(null, "unsupported"), 1600);
  }
}
