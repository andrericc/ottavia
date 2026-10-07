// textures.js
// ---------------------------------------------------------------
// Texture PROCEDURALI: disegnate con il Canvas 2D del browser e
// usate come CanvasTexture. Niente file immagine da caricare.
//
// Ogni texture è di TRE TIPI, disegnati dalla stessa funzione con gli stessi
// numeri casuali (così combaciano pixel per pixel):
//   - COLOR      → map            (il colore, in sRGB)
//   - HEIGHT     → normalMap      (un'immagine in grigi: chiaro = in rilievo,
//                                 scuro = incavato; la trasformo in normal map
//                                 calcolando la pendenza con l'operatore di Sobel)
//   - ROUGHNESS  → roughnessMap   (chiaro = opaco, scuro = lucido: è la versione
//                                 PBR della "specular map")
// La funzione di disegno riceve il livello (L) e sceglie i colori di conseguenza.
// Le mappe extra viaggiano attaccate alla texture colore (tex.userData.detail) e
// applyDetailMaps() le monta su tutti i materiali che usano quella texture: così
// gli oggetti che già scrivono { map: woodPlanks(...) } le ricevono senza modifiche.
//
// In più: ropeBump() (bumpMap per le funi), metalRoughness() (graffi e ruggine per
// il ferro), rockNormal() e grassNormal() (rilievo per pareti e colline).
// ---------------------------------------------------------------
import * as THREE from 'three';

// numeri casuali ripetibili (stesso seme → stessa sequenza)
export const rng = (seed) => { let s = seed > 0 ? seed : 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function finish(tex, srgb) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// texture colore semplice (usata anche da items.js per insegne, quadranti…)
export function canvasTexture(w, h, draw) {
  return finish(new THREE.CanvasTexture(makeCanvas(w, h, draw)), true);
}

// HEIGHT → NORMAL: per ogni pixel la pendenza in x e in y (Sobel, con i bordi che
// si ripetono, così la texture resta piastrellabile) diventa il vettore normale
// (-dx, -dy, 1) normalizzato e scritto nei canali RGB come (n + 1) / 2.
export function heightToNormal(canvas, strength = 2) {
  const w = canvas.width, h = canvas.height;
  const src = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) H[k] = src[k * 4] / 255;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const r0 = ((y + h - 1) % h) * w, r1 = y * w, r2 = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const x0 = (x + w - 1) % w, x2 = (x + 1) % w;
      const dx = (H[r0 + x2] + 2 * H[r1 + x2] + H[r2 + x2]) - (H[r0 + x0] + 2 * H[r1 + x0] + H[r2 + x0]);
      const dy = (H[r2 + x0] + 2 * H[r2 + x] + H[r2 + x2]) - (H[r0 + x0] + 2 * H[r0 + x] + H[r0 + x2]);
      const nx = -dx * strength, ny = dy * strength; // y del canvas va verso il basso, quella della texture verso l'alto
      const l = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const k = (r1 + x) * 4;
      d[k] = (nx * l * 0.5 + 0.5) * 255; d[k + 1] = (ny * l * 0.5 + 0.5) * 255; d[k + 2] = (l * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(new THREE.CanvasTexture(out), false);
}

// Disegna i tre livelli e restituisce la texture colore con le altre attaccate.
// draw(g, w, h, L, rnd)  con L = 'color' | 'height' | 'rough'
// Le texture con gli stessi parametri si generano una volta sola (cache): si
// restituisce un clone, che condivide l'immagine ma ha la sua ripetizione (repeat).
const CACHE = new Map();
function cached(key, make) {
  if (!CACHE.has(key)) CACHE.set(key, make());
  const base = CACHE.get(key), det = base.userData.detail;
  // (clone() copierebbe userData passando da JSON — con dentro delle texture sarebbe lentissimo)
  base.userData = {}; const map = base.clone(); base.userData = { detail: det };
  map.userData = { detail: { normalMap: det.normalMap.clone(), roughnessMap: det.roughnessMap.clone() } };
  return map;
}

export function proceduralTexture(w, h, seed, draw, { normal = 2 } = {}) {
  const layer = (L) => makeCanvas(w, h, (g) => draw(g, w, h, L, rng(seed)));
  const map = finish(new THREE.CanvasTexture(layer('color')), true);
  map.userData.detail = {
    normalMap: heightToNormal(layer('height'), normal),
    roughnessMap: finish(new THREE.CanvasTexture(layer('rough')), false),
  };
  return map;
}

// sceglie il valore giusto per il livello che si sta disegnando
export const pick = (L, color, height, rough) => (L === 'color' ? color : L === 'height' ? height : rough);
export const gray = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;

// Monta normalMap e roughnessMap su tutti i materiali che usano una texture
// procedurale. La ripetizione (repeat/offset) viene copiata dalla texture colore.
export function applyDetailMaps(root) {
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      const det = m.map && m.map.userData && m.map.userData.detail;
      if (!det || m.normalMap || !('normalMap' in m)) continue;
      for (const key of ['normalMap', 'roughnessMap']) {
        const t = det[key];
        t.repeat.copy(m.map.repeat); t.offset.copy(m.map.offset);
        m[key] = t;
      }
      m.roughness = 1; // con la roughnessMap il valore finale è roughness × mappa
      m.needsUpdate = true;
    }
  });
}

// Tessuto a righe per le amache
export function stripedFabric(colors = ['#b8412f', '#e8dcc0', '#2f5d7c', '#e8dcc0']) {
  return cached('fabric' + colors, () => proceduralTexture(128, 128, 3, (g, w, h, L) => {
    const band = w / (colors.length * 2);
    g.fillStyle = pick(L, '#000', gray(128), gray(245)); g.fillRect(0, 0, w, h);
    if (L === 'color') for (let x = 0; x < w; x += band) {
      g.fillStyle = colors[Math.floor(x / band) % colors.length];
      g.fillRect(x, 0, band, h);
    }
    // trama del tessuto: righine orizzontali (fili in rilievo) e verticali più leggere
    g.fillStyle = pick(L, 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.3)');
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    if (L === 'height') { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h); }
  }, { normal: 1.5 }));
}

// Tela di sacco rattoppata per le case a sacco
export function burlap(seed = 1) {
  return cached('burlap' + seed, () => proceduralTexture(256, 256, seed, (g, w, h, L, rnd) => {
    g.fillStyle = pick(L, '#9c8358', gray(128), gray(240));
    g.fillRect(0, 0, w, h);
    // trama incrociata: i fili sono in rilievo
    if (L === 'height') { g.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = 0; k < w; k += 4) { g.fillRect(k, 0, 1, h); g.fillRect(0, k + 2, w, 1); } }
    for (let i = 0; i < 4000; i++) {
      const dark = rnd() < 0.5;
      g.fillStyle = pick(L, dark ? 'rgba(60,40,20,0.10)' : 'rgba(255,240,200,0.08)', dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)');
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1);
    }
    // toppe di stoffe diverse, cucite sopra: un po' più alte, con la cucitura incavata
    const patches = ['#7a5c3a', '#b39a6a', '#6d6a4e', '#8e4f3a', '#5c6b73'];
    for (let i = 0; i < 7; i++) {
      const pw = 30 + rnd() * 50, ph = 30 + rnd() * 50, px = rnd() * (w - pw), py = rnd() * (h - ph);
      g.setLineDash([]);
      g.fillStyle = pick(L, patches[i % patches.length], gray(160), gray(215));
      g.fillRect(px, py, pw, ph);
      g.strokeStyle = pick(L, 'rgba(30,20,10,0.7)', gray(60), gray(255));
      g.setLineDash([4, 3]);
      g.lineWidth = 1.5;
      g.strokeRect(px + 3, py + 3, pw - 6, ph - 6);
    }
    g.setLineDash([]);
  }, { normal: 2.5 }));
}

// Assi di legno affiancate. Le venature sono linee ondulate (leggermente incavate);
// ogni asse ha una tinta diversa; le fughe tra le assi sono solchi; i chiodi
// sporgono e sono di metallo (lucidi nella roughness).
export function woodPlanks(seed = 1, planks = 6) {
  return cached(`wood${seed}/${planks}`, () => proceduralTexture(256, 256, seed, (g, w, h, L, rnd) => {
    const pw = w / planks;
    for (let k = 0; k < planks; k++) {
      const l = 30 + rnd() * 12;
      g.fillStyle = pick(L, `hsl(28, 38%, ${l}%)`, gray(150), gray(200 + rnd() * 40));
      g.fillRect(k * pw, 0, pw, h);
      // venature
      g.strokeStyle = pick(L, 'rgba(40,22,10,0.35)', 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.4)');
      g.lineWidth = 1;
      for (let v = 0; v < 5; v++) {
        const x0 = k * pw + 4 + rnd() * (pw - 8), a = 1 + rnd() * 3, f = 0.02 + rnd() * 0.04;
        g.beginPath();
        for (let y = 0; y <= h; y += 8) g.lineTo(x0 + Math.sin(y * f + v) * a, y);
        g.stroke();
      }
      // fuga scura tra un'asse e l'altra, e due chiodi
      g.fillStyle = pick(L, 'rgba(20,10,5,0.6)', gray(20), gray(255));
      g.fillRect(k * pw, 0, 2, h);
      g.fillStyle = pick(L, 'rgba(30,30,30,0.8)', gray(230), gray(70));
      g.fillRect(k * pw + pw / 2 - 2, 10, 4, 4);
      g.fillRect(k * pw + pw / 2 - 2, h - 14, 4, 4);
    }
  }, { normal: 2.5 }));
}

// Legno DIPINTO e scrostato: assi parallele coperte di vernice, con scaglie mancanti
// da cui si vede il legno sotto. La vernice è più alta e più lucida del legno nudo.
export function paintedWood(color = '#3f6f73', seed = 1, planks = 8) {
  return cached(`paint${color}/${seed}/${planks}`, () => proceduralTexture(256, 256, seed, (g, w, h, L, rnd) => {
    const pw = w / planks;
    for (let k = 0; k < planks; k++) {
      // vernice, con una tinta leggermente diversa per ogni asse
      g.fillStyle = pick(L, color, gray(170), gray(140));
      g.fillRect(k * pw, 0, pw, h);
      const tint = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rnd() * 0.08})`;
      if (L === 'color') { g.fillStyle = tint; g.fillRect(k * pw, 0, pw, h); }
      // scaglie di vernice saltata: si vede il legno (più in basso e opaco)
      for (let c = 0; c < 14; c++) {
        g.fillStyle = pick(L, `hsl(28, 35%, ${32 + rnd() * 12}%)`, gray(95), gray(235));
        const cx = k * pw + rnd() * pw, cy = rnd() * h, r = 2 + rnd() * 7;
        g.beginPath();
        for (let a = 0; a < 7; a++) {
          const ang = (a / 7) * Math.PI * 2, rr = r * (0.5 + rnd() * 0.6);
          g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 1.8);
        }
        g.fill();
      }
      // fuga tra le assi
      g.fillStyle = pick(L, 'rgba(15,10,5,0.55)', gray(30), gray(255));
      g.fillRect(k * pw, 0, 2, h);
    }
  }, { normal: 3 }));
}

// ---- mappe singole (solo rilievo o solo lucentezza) ----

// BUMP MAP per le funi: trefoli avvolti a elica (strisce diagonali). La bumpMap è
// un'immagine in grigi che three.js usa direttamente come altezza.
export function ropeBump() {
  const c = makeCanvas(64, 64, (g, w, h) => {
    g.fillStyle = gray(90); g.fillRect(0, 0, w, h);
    for (let k = -h; k < w + h; k += 16) {
      const gr = g.createLinearGradient(k, 0, k + 12, 0);
      gr.addColorStop(0, gray(60)); gr.addColorStop(0.5, gray(235)); gr.addColorStop(1, gray(60));
      g.save(); g.translate(k, 0); g.transform(1, 0, 0.6, 1, 0, 0); g.fillStyle = gr; g.fillRect(0, 0, 12, h); g.restore();
    }
  });
  return finish(new THREE.CanvasTexture(c), false);
}

// ROUGHNESS + NORMAL per il ferro: lucido dove è consumato dall'uso, opaco dove
// c'è ruggine (macchie) e graffi sottili.
export function metalDetail(seed = 7) {
  const draw = (L) => makeCanvas(128, 128, (g, w, h) => {
    const rnd = rng(seed);
    g.fillStyle = pick(L, '', gray(128), gray(110)); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, pick(L, '', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.9)')); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = pick(L, '', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.5)'); g.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h, a = rnd() * Math.PI, l = 4 + rnd() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  });
  return { roughnessMap: finish(new THREE.CanvasTexture(draw('rough')), false), normalMap: heightToNormal(draw('height'), 1.5) };
}

// rumore liscio piastrellabile disegnato su canvas (per roccia ed erba)
function noiseCanvas(size, seed, octaves) {
  return makeCanvas(size, size, (g, w, h) => {
    const rnd = rng(seed);
    g.fillStyle = gray(128); g.fillRect(0, 0, w, h);
    for (const [cells, amp] of octaves) {
      const q = w / cells;
      for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
        const v = (rnd() - 0.5) * amp, x = i * q + q / 2, y = j * q + q / 2;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { // ripetuto ai bordi: piastrellabile
          const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, q);
          const c = v > 0 ? '255,255,255' : '0,0,0';
          gr.addColorStop(0, `rgba(${c},${Math.abs(v)})`); gr.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = gr; g.fillRect(x + ox - q, y + oy - q, q * 2, q * 2);
        }
      }
    }
  });
}

// NORMAL MAP della roccia delle pareti: grandi bozze, crepe orizzontali (strati)
export function rockNormal() {
  const c = noiseCanvas(256, 11, [[4, 0.5], [8, 0.4], [16, 0.35], [32, 0.25]]);
  const g = c.getContext('2d'), rnd = rng(5);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) { // crepe lungo gli strati
    const y0 = rnd() * 256; g.beginPath();
    for (let x = -10; x <= 266; x += 12) g.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 4 + (rnd() - 0.5) * 3);
    g.stroke();
  }
  return heightToNormal(c, 3);
}

// NORMAL MAP leggera per l'erba delle colline: tante piccole gobbe
export function grassNormal() {
  return heightToNormal(noiseCanvas(128, 23, [[16, 0.35], [32, 0.3]]), 2);
}
