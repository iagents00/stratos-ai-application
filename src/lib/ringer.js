// ringer.js — timbre de llamada entrante SINTETIZADO (WebAudio), sin assets ni archivos.
// Suena "ring-ring" en loop mientras hay una llamada entrante (solo tenants con el flag).
// Autoplay policy: el navegador bloquea el audio hasta un gesto del usuario → primeRinger()
// desbloquea en el primer click/tecla. Como el asesor está usando el CRM, ya suele haber gesto.
let ctx = null;
let timer = null;
let voices = [];   // osciladores vivos → permite cortar en seco al contestar

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

// Un "ring" son las DOS frecuencias SONANDO JUNTAS (440+480 Hz) — el timbre
// clásico de teléfono. Antes iban una tras otra y eso suena a "beep de
// notificación", no a llamada entrante (reporte de Ángel 27-jul).
function tone(c, at, dur) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.3, at + 0.04);
  g.gain.setValueAtTime(0.3, at + dur - 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(c.destination);
  for (const f of [440, 480]) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    o.start(at);
    o.stop(at + dur + 0.02);
    o.onended = () => { voices = voices.filter(v => v !== o); };
    voices.push(o);
  }
}

// Patrón de teléfono: ring · pausa corta · ring · silencio largo.
function ringOnce() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.02;
  tone(c, t, 0.42);
  tone(c, t + 0.62, 0.42);
}

export function startRing() {
  const c = ac();
  if (!c) return;
  stopRing();
  // resume() es ASÍNCRONO: arrancar antes de que resuelva dejaba el primer
  // "ring" mudo (y con la pestaña en segundo plano, prácticamente todos).
  const go = () => { ringOnce(); timer = setInterval(ringOnce, 2400); };
  if (c.state === "suspended") { try { c.resume().then(go, go); } catch { go(); } }
  else go();
}

export function stopRing() {
  if (timer) { clearInterval(timer); timer = null; }
  // Corta lo YA agendado: contestar tiene que silenciar al instante, no
  // esperar a que termine el ring en curso.
  for (const o of voices) { try { o.stop(); } catch { /* ya había terminado */ } }
  voices = [];
}
