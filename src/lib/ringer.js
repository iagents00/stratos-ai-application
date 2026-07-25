// ringer.js — timbre de llamada entrante SINTETIZADO (WebAudio), sin assets ni archivos.
// Suena "ring-ring" en loop mientras hay una llamada entrante (solo tenants con el flag).
// Autoplay policy: el navegador bloquea el audio hasta un gesto del usuario → primeRinger()
// desbloquea en el primer click/tecla. Como el asesor está usando el CRM, ya suele haber gesto.
let ctx = null;
let timer = null;

function ac() {
  if (!ctx) {
    try { const AC = window.AudioContext || window.webkitAudioContext; ctx = AC ? new AC() : null; }
    catch { ctx = null; }
  }
  return ctx;
}

// Desbloquea el AudioContext en un gesto del usuario (cumple la política de autoplay).
export function primeRinger() {
  const c = ac();
  if (c && c.state === "suspended") { try { c.resume(); } catch { /* noop */ } }
}

function beep(c, at, freq, dur) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.22, at + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(c.destination);
  o.start(at); o.stop(at + dur + 0.02);
}

function ringOnce() {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") { try { c.resume(); } catch { /* noop */ } }
  const t = c.currentTime;
  beep(c, t, 480, 0.4);          // "ring"
  beep(c, t + 0.5, 440, 0.4);    // "ring"
}

export function startRing() {
  const c = ac();
  if (!c) return;
  stopRing();
  ringOnce();
  timer = setInterval(ringOnce, 2200);   // repite como un teléfono hasta contestar/rechazar
}

export function stopRing() {
  if (timer) { clearInterval(timer); timer = null; }
}
