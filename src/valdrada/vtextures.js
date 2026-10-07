// vtextures.js
// ---------------------------------------------------------------
// Le texture di VALDRADA, tutte procedurali come quelle di Ottavia
// (stesso sistema: ogni texture è disegnata tre volte — colore, altezza,
// ruvidezza — e diventa map + normalMap + roughnessMap; vedi hanging/textures.js).
//
// In più qui ci sono due tipi nuovi:
//   - EMISSIVE MAP: le finestre accese delle facciate (si illuminano da sole,
//     anche nella nebbia del tardo pomeriggio)
//   - ALPHA: le bande di nebbia sopra il lago (solo trasparenza)
// e la normal map dell'ACQUA, che lo shader del lago fa scorrere per increspare
// il riflesso.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { proceduralTexture, heightToNormal, pick, gray, rng } from '../hanging/textures.js';

const canvas = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h); return c;
};
const tex = (c, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};

// INTONACO blu-grigio, consumato: macchie, piccole crepe, e in basso la riga
// scura dell'umidità (le case stanno sull'acqua). La parte bagnata è più lucida.
export function plaster(color = '#8796a6', seed = 1) {
  return proceduralTexture(256, 256, seed, (g, w, h, L, rnd) => {
    g.fillStyle = pick(L, color, gray(140), gray(225)); g.fillRect(0, 0, w, h);
    // macchie morbide (chiaro/scuro)
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 30, light = rnd() < 0.5, a = 0.03 + rnd() * 0.06;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = light ? '255,255,255' : '0,0,0';
      gr.addColorStop(0, `rgba(${c},${L === 'rough' ? a * 0.5 : L === 'height' ? a * 2.5 : a})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // granelli
    for (let i = 0; i < 1800; i++) {
      const x = rnd() * w, y = rnd() * h, d = rnd() < 0.5;
      g.fillStyle = pick(L, d ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)', d ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)');
      g.fillRect(x, y, 1, 1);
    }
    // crepe sottili
    g.strokeStyle = pick(L, 'rgba(40,45,55,0.35)', gray(105), gray(255)); g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 14; y += 4 + rnd() * 8; g.lineTo(x, y); }
      g.stroke();
    }
    // umidità in basso (la texture parte dall'alto: il basso è y = h)
    const gr = g.createLinearGradient(0, h * 0.78, 0, h);
    gr.addColorStop(0, 'rgba(20,30,40,0)'); gr.addColorStop(1, pick(L, 'rgba(20,30,40,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'));
    g.fillStyle = gr; g.fillRect(0, h * 0.78, w, h * 0.22);
  }, { normal: 1.0 });
}

// PIETRA a conci (lungolago, basamenti, gallerie): blocchi sfalsati, giunti incavati,
// ogni concio con una tinta leggermente diversa e la superficie scabra.
export function stoneBlocks(seed = 3, base = '#9aa3ab') {
  return proceduralTexture(256, 256, seed, (g, w, h, L, rnd) => {
    g.fillStyle = pick(L, '#5d656d', gray(40), gray(255)); g.fillRect(0, 0, w, h); // giunti
    const rows = 4, bh = h / rows;
    for (let r = 0; r < rows; r++) {
      const n = 3, bw = w / n, off = (r % 2) * bw * 0.5;
      for (let k = -1; k < n; k++) {
        const x = off + k * bw, l = rnd() * 0.12 - 0.06;
        const c = new THREE.Color(base).offsetHSL(0, 0, l);
        g.fillStyle = pick(L, '#' + c.getHexString(), gray(170 + rnd() * 30), gray(200 + rnd() * 40));
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    // scabrosità
    for (let i = 0; i < 2500; i++) {
      const x = rnd() * w, y = rnd() * h, d = rnd() < 0.5;
      g.fillStyle = pick(L, d ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)', d ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.04)');
      g.fillRect(x, y, 1 + rnd() * 2, 1);
    }
  }, { normal: 2.5 });
}

// ARDESIA dei tetti: file di lastre sovrapposte, scure e un po' lucide
export function slate(seed = 5) {
  return proceduralTexture(128, 128, seed, (g, w, h, L, rnd) => {
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const n = 6, tw = w / n, off = (r % 2) * tw / 2;
      for (let k = -1; k < n; k++) {
        const l = 18 + rnd() * 8;
        g.fillStyle = pick(L, `hsl(212, 14%, ${l}%)`, gray(120), gray(120 + rnd() * 60));
        g.fillRect(off + k * tw + 1, r * rh, tw - 2, rh);
        // il bordo basso di ogni lastra è più alto (si sovrappone a quella sotto)
        const gr = g.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
        gr.addColorStop(0, pick(L, 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'));
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(off + k * tw + 1, r * rh, tw - 2, rh);
      }
    }
  }, { normal: 2 });
}

// FACCIATA con finestre: intonaco, finestre con persiane, alcune accese.
// Restituisce la texture colore (con normal/roughness attaccate) e una EMISSIVE MAP
// in cui solo i vetri delle finestre accese sono chiari.
export function facade({ color = '#8796a6', shutter = '#4f6475', seed = 1, cols = 3, rows = 1, lit = 0.35 } = {}) {
  const W = 256, H = 128 * rows;
  const layout = [];
  const r0 = rng(seed + 100);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) layout.push({ r, c, on: r0() < lit, open: r0() < 0.5 });
  const draw = (g, w, h, L, rnd) => {
    g.fillStyle = pick(L, color, gray(140), gray(225)); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60 * rows; i++) {
      const x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 24, a = 0.03 + rnd() * 0.05, light = rnd() < 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r), c = light ? '255,255,255' : '0,0,0';
      gr.addColorStop(0, `rgba(${c},${L === 'height' ? a * 2 : a})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const cw = w / cols, rh = 128;
    for (const win of layout) {
      const x = win.c * cw + cw * 0.3, y = win.r * rh + rh * 0.22, ww = cw * 0.4, wh = rh * 0.62;
      // cornice in pietra (in rilievo)
      g.fillStyle = pick(L, '#c3c8cc', gray(200), gray(200)); g.fillRect(x - 5, y - 6, ww + 10, wh + 12);
      // vetro: buio, o caldo se acceso
      g.fillStyle = pick(L, win.on ? '#f0b46a' : '#1c2530', gray(60), gray(30)); g.fillRect(x, y, ww, wh);
      if (win.on && L === 'color') { g.fillStyle = 'rgba(120,60,20,0.35)'; g.fillRect(x + ww * 0.48, y, 2, wh); g.fillRect(x, y + wh * 0.45, ww, 2); }
      // persiane: chiuse a metà o aperte ai lati
      g.fillStyle = pick(L, shutter, gray(150), gray(170));
      if (win.open) { g.fillRect(x - ww * 0.55, y, ww * 0.5, wh); g.fillRect(x + ww * 1.05, y, ww * 0.5, wh); }
      else { g.fillRect(x, y, ww * 0.5 - 1, wh * (win.on ? 0.3 : 1)); g.fillRect(x + ww * 0.5 + 1, y, ww * 0.5 - 1, wh * (win.on ? 0.3 : 1)); }
      // stecche delle persiane
      g.fillStyle = pick(L, 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)');
      for (let s = 0; s < wh; s += 5) {
        if (win.open) { g.fillRect(x - ww * 0.55, y + s, ww * 0.5, 1); g.fillRect(x + ww * 1.05, y + s, ww * 0.5, 1); }
        else if (s < wh * (win.on ? 0.3 : 1)) g.fillRect(x, y + s, ww, 1);
      }
    }
  };
  const map = proceduralTexture(W, H, seed, draw, { normal: 2 });
  // EMISSIVE: nero ovunque, vetri accesi chiari
  const em = canvas(W, H, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = 128;
    for (const win of layout) if (win.on) {
      const x = win.c * cw + cw * 0.3, y = win.r * rh + rh * 0.22, ww = cw * 0.4, wh = rh * 0.62;
      g.fillStyle = '#ffd29a'; g.fillRect(x, y + (win.open ? 0 : wh * 0.3), ww, wh * (win.open ? 1 : 0.7));
    }
  });
  map.userData.emissiveMap = tex(em, true);
  return map;
}

// rumore liscio piastrellabile (somma di macchie morbide ripetute ai bordi)
function softNoise(size, seed, octaves) {
  return canvas(size, size, (g, w, h) => {
    const rnd = rng(seed);
    g.fillStyle = gray(128); g.fillRect(0, 0, w, h);
    for (const [cells, amp] of octaves) {
      const q = w / cells;
      for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
        const v = (rnd() - 0.5) * amp, x = (i + rnd()) * q, y = (j + rnd()) * q;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
          const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, q * 0.9);
          const c = v > 0 ? '255,255,255' : '0,0,0';
          gr.addColorStop(0, `rgba(${c},${Math.abs(v)})`); gr.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = gr; g.fillRect(x + ox - q, y + oy - q, 2 * q, 2 * q);
        }
      }
    }
  });
}

// NORMAL MAP dell'acqua: increspature fini e allungate
export function waterNormal() {
  return heightToNormal(softNoise(256, 31, [[8, 0.5], [16, 0.45], [32, 0.35]]), 2.2);
}

// NEBBIA: una texture di sola trasparenza, a sbuffi, sfumata ai bordi
export function mistTexture() {
  const n = softNoise(256, 47, [[3, 0.9], [6, 0.7], [12, 0.4]]);
  const c = canvas(256, 256, (g, w, h) => {
    const src = n.getContext('2d').getImageData(0, 0, w, h).data;
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4, v = src[k] / 255;
      const ex = Math.min(x, w - 1 - x) / (w * 0.5), ey = Math.min(y, h - 1 - y) / (h * 0.5); // bordi sfumati
      const edge = Math.min(1, ex * 2.2) * Math.min(1, ey * 2.2);
      d[k] = d[k + 1] = d[k + 2] = 255;
      d[k + 3] = Math.max(0, Math.min(255, (v - 0.35) * 2.2 * edge * 255));
    }
    g.putImageData(img, 0, 0);
  });
  const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// SCANDOLE di legno per i tetti: file di tavolette sfalsate, ogni tavoletta con
// una tinta un po' diversa; il bordo basso di ognuna fa ombra su quella sotto.
export function shingles(base = '#5d5550', seed = 9, moss = 0) {
  return proceduralTexture(128, 128, seed, (g, w, h, L, rnd) => {
    const rows = 8, rh = h / rows;
    g.fillStyle = pick(L, '#2a2624', gray(40), gray(255)); g.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      const n = 5, tw = w / n, off = (r % 2) * tw / 2;
      for (let k = -1; k < n; k++) {
        const c = new THREE.Color(base).offsetHSL((rnd() - 0.5) * 0.02, 0, (rnd() - 0.5) * 0.12);
        g.fillStyle = pick(L, '#' + c.getHexString(), gray(150 + rnd() * 40), gray(200 + rnd() * 50));
        g.fillRect(off + k * tw + 1, r * rh, tw - 2, rh - 1);
        const gr = g.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
        gr.addColorStop(0, pick(L, 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'));
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(off + k * tw + 1, r * rh, tw - 2, rh - 1);
      }
    }
    // muschio: macchie verdi morbide, più fitte in basso (dove l'acqua ristagna)
    for (let i = 0; i < 60 * moss; i++) {
      const x = rnd() * w, y = h * (0.3 + 0.7 * rnd()), rr = 4 + rnd() * 14;
      const gm = g.createRadialGradient(x, y, 0, x, y, rr);
      gm.addColorStop(0, pick(L, 'rgba(92,110,62,0.75)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.5)')); gm.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gm; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
  }, { normal: 2.2 });
}

// TAVOLE ORIZZONTALI dipinte (le pareti delle case del villaggio): ogni tavola
// sporge un poco su quella sotto (riga d'ombra), la vernice è stinta a chiazze
// larghe e qua e là è saltata, lasciando vedere il legno grigio.
export function clapboard(color = '#9c4f3f', seed = 1) {
  return proceduralTexture(256, 256, seed, (g, w, h, L, rnd) => {
    const n = 10, bh = h / n;
    for (let k = 0; k < n; k++) {
      const c = new THREE.Color(color).offsetHSL(0, -0.03 + rnd() * 0.06, -0.05 + rnd() * 0.1);
      g.fillStyle = pick(L, '#' + c.getHexString(), gray(150), gray(170 + rnd() * 30));
      g.fillRect(0, k * bh, w, bh);
      // ombra sotto il bordo della tavola di sopra, luce sul labbro in basso
      const gr = g.createLinearGradient(0, k * bh, 0, (k + 1) * bh);
      gr.addColorStop(0, pick(L, 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)'));
      gr.addColorStop(0.25, 'rgba(0,0,0,0)');
      gr.addColorStop(0.92, pick(L, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.35)', 'rgba(0,0,0,0)'));
      gr.addColorStop(1, pick(L, 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)'));
      g.fillStyle = gr; g.fillRect(0, k * bh, w, bh);
      // giunta tra due tavole
      const jx = rnd() * w; g.fillStyle = pick(L, 'rgba(0,0,0,0.25)', gray(60), gray(255)); g.fillRect(jx, k * bh, 2, bh);
    }
    // venatura sottile
    g.strokeStyle = pick(L, 'rgba(0,0,0,0.07)', 'rgba(0,0,0,0.15)', 'rgba(255,255,255,0.1)'); g.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const y = rnd() * h, x = rnd() * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + rnd() * 60, y + (rnd() - 0.5) * 2); g.stroke(); }
    // chiazze di vernice stinta (grandi e morbide)
    for (let i = 0; i < 10; i++) {
      const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, pick(L, 'rgba(235,230,220,0.12)', 'rgba(0,0,0,0)', 'rgba(255,255,255,0.15)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // qualche scrostatura: legno grigio sotto la vernice
    for (let i = 0; i < 7; i++) {
      const x = rnd() * w, y = Math.floor(rnd() * n) * bh + bh * 0.35, ww = 6 + rnd() * 20, hh = 3 + rnd() * 6;
      g.fillStyle = pick(L, '#7d746a', gray(110), gray(240)); g.fillRect(x, y, ww, hh);
    }
  }, { normal: 2.4 });
}


// PAGLIA del tetto: fili sottili, tutti nella stessa direzione (lungo la falda),
// a ciuffi sovrapposti; scura e un po' marcia in basso, ruvida ovunque.
export function thatch(seed = 21) {
  return proceduralTexture(256, 256, seed, (g, w, h, L, rnd) => {
    g.fillStyle = pick(L, '#6d6046', gray(110), gray(240)); g.fillRect(0, 0, w, h);
    const rows = 6, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      // ogni fila di ciuffi copre la parte alta di quella sotto
      const gr = g.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
      gr.addColorStop(0, pick(L, 'rgba(30,25,15,0.45)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0)')); gr.addColorStop(0.3, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, r * rh, w, rh);
      for (let i = 0; i < 260; i++) {
        const x = rnd() * w, y = r * rh + rnd() * rh * 0.4, len = rh * (0.6 + rnd() * 0.6);
        const l = 30 + rnd() * 25;
        g.strokeStyle = pick(L, `hsla(40, 22%, ${l}%, 0.55)`, rnd() < 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', 'rgba(255,255,255,0.2)');
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + len); g.stroke();
      }
    }
  }, { normal: 2.8 });
}

// RETE da pesca: maglie a rombo, trasparente tra un filo e l'altro
export function netTexture() {
  const c = canvas(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(70,64,56,0.95)'; g.lineWidth = 1.6;
    for (let k = -w; k < w * 2; k += 14) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke();
      g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke();
    }
  });
  return tex(c, true);
}

// alone morbido per il fumo dei camini
export function puffTexture() {
  const c = canvas(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
