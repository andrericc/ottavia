// Sound.js
// ---------------------------------------------------------------
// Le NOTE delle funi, sintetizzate al momento con la Web Audio API.
//
// Una fune pizzicata è simulata con l'algoritmo di KARPLUS-STRONG:
// un breve rumore bianco entra in una "linea di ritardo" lunga quanto
// un periodo della nota; a ogni giro il segnale viene mediato con il
// campione vicino (un filtro passa-basso), così gli acuti si spengono
// prima dei bassi, esattamente come in una corda vera.
// Il risultato è un buffer audio che viene suonato una volta.
// Niente file audio da caricare.
// ---------------------------------------------------------------

let ctx = null, master = null;
const cache = new Map();

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    // un po' di eco: la città è sospesa sul vuoto
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    master.connect(ctx.destination);
    master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Karplus-Strong: freq in Hz, durata in secondi, damping 0..1 (più alto = suona più a lungo)
function pluckBuffer(freq, seconds = 2.2, damping = 0.996) {
  const key = `${Math.round(freq)}-${seconds}-${damping}`;
  if (cache.has(key)) return cache.get(key);
  const ac = audio(), rate = ac.sampleRate;
  const N = Math.max(2, Math.round(rate / freq));
  const out = new Float32Array(Math.floor(rate * seconds));
  const ring = new Float32Array(N);
  for (let k = 0; k < N; k++) ring[k] = Math.random() * 2 - 1; // il "pizzico": rumore
  let idx = 0;
  for (let k = 0; k < out.length; k++) {
    const next = (idx + 1) % N;
    const v = 0.5 * (ring[idx] + ring[next]) * damping; // media dei due campioni → passa-basso
    out[k] = ring[idx];
    ring[idx] = v;
    idx = next;
  }
  // piccola dissolvenza in chiusura
  for (let k = 0; k < 2000 && k < out.length; k++) out[out.length - 1 - k] *= k / 2000;
  const buf = ac.createBuffer(1, out.length, rate);
  buf.copyToChannel(out, 0);
  cache.set(key, buf);
  return buf;
}

// Suona una fune pizzicata. pan: -1 (sinistra) … 1 (destra)
export function pluck(freq, { gain = 0.6, pan = 0, delay = 0, seconds = 2.2, damping = 0.996 } = {}) {
  try {
    const ac = audio();
    const src = ac.createBufferSource();
    src.buffer = pluckBuffer(freq, seconds, damping);
    const g = ac.createGain(); g.gain.value = gain;
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    src.connect(g);
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); } else g.connect(master);
    src.start(ac.currentTime + delay);
  } catch (e) { /* audio non disponibile: si gioca in silenzio */ }
}

// Scala pentatonica (re minore): le risposte delle case suonano sempre "intonate" tra loro
export const SCALE = [146.8, 174.6, 196.0, 220.0, 261.6, 293.7, 349.2, 392.0, 440.0, 523.3];

// La nota di una fune dipende da quanto è tesa: più è tesa, più è acuta.
// stress = allungamento relativo (circa 0 … 0.03). Una fune sovraccarica suona bassa e "spenta".
export function ropeFreq(stress, overloaded = false) {
  if (overloaded) return 82;
  const f = 130 * Math.pow(2, Math.min(2.2, Math.max(0, stress) / 0.008));
  // la avvicino alla nota della scala più vicina: la rete "canta" invece di stonare
  let best = SCALE[0];
  for (const s of SCALE) if (Math.abs(Math.log(s / f)) < Math.abs(Math.log(best / f))) best = s;
  return best;
}
