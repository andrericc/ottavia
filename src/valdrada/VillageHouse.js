// VillageHouse.js
// ---------------------------------------------------------------
// Le CASE DEL VILLAGGIO di Valdrada: tre tipi, costruiti nel codice, ognuno con
// le sue stranezze. Legno grigio non dipinto, solo porte e persiane colorate e
// stinte; tetti di paglia o di scandole con il muschio; piani storti, sporgenze,
// aggiunte, scale a pioli, reti stese, fumo dai camini.
//
//   casaStorta  il piano di sopra SPORGE su quello sotto (retto da mensole) e i due
//               piani pendono in versi opposti; tetto di paglia ripido, finestrella
//               tonda, balconcino laterale con la scala a pioli, casotto addossato
//   casaTorre   una torre stretta di VERANDE UNA SOPRA L'ALTRA: ogni piano ruota un
//               poco rispetto a quello sotto; tetto a padiglione con le falde che si
//               allargano in fondo, carrucola con il secchio, piccionaia
//   casaLunga   bassa e larga, il timpano verso il lago con le tavole intagliate,
//               il portico sull'acqua, l'abbaino, la legna accatastata
//
// Ogni casa è un gruppo nel suo sistema locale: facciata principale verso +z (il
// lago), pavimento del piano terra a y = 0 (la quota della passerella).
// chimneys: [{ obj, p }] = punto di uscita del fumo nel sistema dell'oggetto obj.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { clapboard, shingles, thatch, netTexture, puffTexture } from './vtextures.js';
import { woodPlanks, rng } from '../hanging/textures.js';

// BoxGeometry con le UV in metri
export function box(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return g;
}
// inclina una geometria: x += y·k (un muro che pende)
function lean(geo, k) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + p.getY(i) * k);
  geo.computeVertexNormals();
  return geo;
}

// Il FUMO dei camini: piccoli sbuffi (sprite) che salgono, si allargano, sbiadiscono
export class Smoke {
  constructor(scene) {
    this.scene = scene; this.puffs = [];
    this.mat = new THREE.SpriteMaterial({ map: puffTexture(), color: '#b9bec4', transparent: true, depthWrite: false, opacity: 0.5 });
  }
  add(worldPos, n = 14) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.mat.clone());
      this.scene.add(s);
      this.puffs.push({ s, origin: worldPos.clone(), t: (i / n) * 6, life: 6 });
    }
  }
  update(dt) {
    for (const p of this.puffs) {
      p.t += dt; if (p.t > p.life) p.t -= p.life;
      const k = p.t / p.life;
      p.s.position.set(p.origin.x + k * 1.6 + Math.sin(p.t * 1.3) * 0.15, p.origin.y + k * 3.5, p.origin.z + Math.cos(p.t) * 0.12);
      const sc = 0.4 + k * 1.8; p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = 0.45 * Math.sin(Math.PI * k);
    }
  }
}

export function makeHouseKit(seed = 5) {
  const R = rng(seed);
  const RL = rng(seed + 99); // a parte, per non cambiare il resto del villaggio: quali finestre restano accese
  // ---------------- materiali ----------------
  const grey = (() => { const t = woodPlanks(31, 6); return new THREE.MeshStandardMaterial({ map: t, color: '#9a958e' }); })(); // assi verticali, legno grigio
  const boards = (c, s) => { const t = clapboard(c, s); t.repeat.set(0.4, 0.4); return new THREE.MeshStandardMaterial({ map: t }); };
  const M = {
    grey,
    dark: boards('#57524c', 41), tar: boards('#3c3936', 49), blue: boards('#5f6c78', 43), ochre: boards('#857048', 47), weathered: boards('#77716a', 53),
    thatch: (() => { const t = thatch(); t.repeat.set(0.45, 0.45); return new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide }); })(),
    moss: (() => { const t = shingles('#4c4843', 13, 1); t.repeat.set(0.7, 0.7); return new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide }); })(),
    rust: (() => { const t = shingles('#5a3f37', 15, 0.6); t.repeat.set(0.7, 0.7); return new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide }); })(),
    deck: (() => { const t = woodPlanks(23, 5); return new THREE.MeshStandardMaterial({ map: t, color: '#8f8a83' }); })(),
    post: new THREE.MeshStandardMaterial({ color: '#3d3631', roughness: 0.95 }),
    rail: new THREE.MeshStandardMaterial({ color: '#5f564c', roughness: 0.9 }),
    stone: new THREE.MeshStandardMaterial({ color: '#5c5c5a', roughness: 1, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ color: '#1a1f24', roughness: 0.25 }),
    lit: new THREE.MeshStandardMaterial({ color: '#f0bd78', emissive: '#ffae5c', emissiveIntensity: 1.0 }),   // accese nel lago dopo la lanterna (Story.js)
    litOn: new THREE.MeshStandardMaterial({ color: '#f0bd78', emissive: '#ffae5c', emissiveIntensity: 1.0 }), // le poche sempre accese
    frame: new THREE.MeshStandardMaterial({ color: '#8a847b', roughness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: '#7d3e35', roughness: 0.85 }),
    blueP: new THREE.MeshStandardMaterial({ color: '#4f6475', roughness: 0.85 }),
    ochreP: new THREE.MeshStandardMaterial({ color: '#9a7a3e', roughness: 0.85 }),
    greenP: new THREE.MeshStandardMaterial({ color: '#4d5e4a', roughness: 0.85 }),
    rope: new THREE.MeshStandardMaterial({ color: '#a08a66', roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2f3338', roughness: 0.5, metalness: 0.6 }),
    net: new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }),
    cork: new THREE.MeshStandardMaterial({ color: '#b8a27a', roughness: 1 }),
    log: new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 1 }),
    logEnd: new THREE.MeshStandardMaterial({ color: '#b09474', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#4f6648', roughness: 1, flatShading: true }),
    lamp: new THREE.MeshStandardMaterial({ color: '#ffd9a8', emissive: '#ffb064', emissiveIntensity: 1.6 }),
    fish: new THREE.MeshStandardMaterial({ color: '#9aa0a3', roughness: 0.5, metalness: 0.3 }),
  };
  M.net.map.repeat.set(2, 1.5);

  // ---------------- pezzi comuni ----------------
  const add = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const pole = (g, x, y0, y1, z, r = 0.11) => add(g, new THREE.CylinderGeometry(r * 0.85, r, y1 - y0, 6), M.post, x, (y0 + y1) / 2, z, (R() - 0.5) * 0.05, 0, (R() - 0.5) * 0.05);
  // parapetto di legno da a a b (alla quota del pavimento)
  function railing(g, a, b, h = 0.9) {
    const len = a.distanceTo(b), dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    for (const [y, t] of [[h, 0.08], [h * 0.45, 0.05]]) {
      const m = new THREE.Mesh(box(len, t, 0.08), M.rail); m.position.copy(a).addScaledVector(dir, len / 2); m.position.y += y; m.quaternion.copy(q); g.add(m);
    }
    for (let s = 0; s <= len + 0.01; s += Math.max(0.9, len / Math.ceil(len / 1.1))) {
      const p = a.clone().addScaledVector(dir, Math.min(s, len));
      add(g, box(0.09, h + 0.05, 0.09), M.rail, p.x, p.y + h / 2, p.z);
    }
  }
  // finestra: cornice, vetro (buio o acceso), persiane (aperte o chiuse) o nessuna
  function win(g, x, y, z, w, h, { lit = false, shutter = null, open = true, ry = 0 } = {}) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    add(f, box(w + 0.14, h + 0.14, 0.05), M.frame, 0, 0, 0.02);
    add(f, new THREE.PlaneGeometry(w, h), lit ? (RL() < 0.2 ? M.litOn : M.lit) : M.glass, 0, 0, 0.05);
    add(f, box(0.035, h, 0.03), M.frame, 0, 0, 0.06);
    add(f, box(w + 0.22, 0.06, 0.12), M.frame, 0, -h / 2 - 0.08, 0.06); // davanzale
    if (shutter) for (const s of [-1, 1]) {
      if (open) add(f, box(w / 2, h, 0.04), shutter, s * (w * 0.75 + 0.08), 0, 0.04, 0, s * 0.35, 0);
      else add(f, box(w / 2 - 0.01, h, 0.04), shutter, s * w / 4, 0, 0.08);
    }
    return f;
  }
  function roundWin(g, x, y, z, r, ry = 0, lit = false) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    add(f, new THREE.TorusGeometry(r, 0.06, 6, 16), M.frame, 0, 0, 0.03);
    add(f, new THREE.CircleGeometry(r, 16), lit ? (RL() < 0.2 ? M.litOn : M.lit) : M.glass, 0, 0, 0.02);
    add(f, box(r * 2, 0.03, 0.03), M.frame, 0, 0, 0.05); add(f, box(0.03, r * 2, 0.03), M.frame, 0, 0, 0.05);
  }
  function door(g, x, z, mat, ry = 0, y = 0) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    add(f, box(1.06, 2.12, 0.05), M.frame, 0, 1.06, 0.02);
    add(f, box(0.9, 2.0, 0.05), mat, 0, 1.0, 0.05);
    for (const yy of [0.5, 1.5]) add(f, box(0.92, 0.07, 0.03), M.post, 0, yy, 0.09); // traverse
    add(f, new THREE.SphereGeometry(0.035, 6, 4), M.metal, 0.32, 1.0, 0.1);
  }
  // tetto a capanna come guscio estruso. alongZ = colmo perpendicolare alla facciata
  function roofGeo(span, length, rise, thick = 0.16, flare = 0) {
    const a = span / 2, s = new THREE.Shape();
    s.moveTo(-a - flare, flare * 0.5);
    s.quadraticCurveTo(-a * 0.5, 0.02 + rise * 0.42, 0, rise);
    s.quadraticCurveTo(a * 0.5, 0.02 + rise * 0.42, a + flare, flare * 0.5);
    s.lineTo(a + flare - 0.05, flare * 0.5 - thick);
    s.quadraticCurveTo(a * 0.5, rise * 0.42 - thick, 0, rise - thick * 1.4);
    s.quadraticCurveTo(-a * 0.5, rise * 0.42 - thick, -a - flare + 0.05, flare * 0.5 - thick);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -length / 2);
    return g; // profilo nel piano XY, colmo lungo Z
  }
  function gableGeo(span, rise) {
    const s = new THREE.Shape(); s.moveTo(-span / 2, 0); s.quadraticCurveTo(-span / 4, rise * 0.45, 0, rise * 0.94); s.quadraticCurveTo(span / 4, rise * 0.45, span / 2, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }); g.translate(0, 0, -0.05); return g;
  }
  // scala a pioli da (x, 0, z) alta h, inclinata verso -z
  function ladder(g, x, z, h, ry = 0) {
    const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = ry; f.rotation.x = -0.18; g.add(f);
    for (const s of [-0.22, 0.22]) add(f, box(0.06, h + 0.4, 0.06), M.post, s, (h + 0.4) / 2, 0);
    for (let y = 0.3; y < h + 0.2; y += 0.32) add(f, box(0.46, 0.04, 0.05), M.post, 0, y, 0);
  }
  // rete da pesca appesa, con i galleggianti di sughero
  function net(g, x, y, z, w, h, ry = 0) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    add(f, new THREE.PlaneGeometry(w, h), M.net, 0, -h / 2, 0, 0.05, 0, 0);
    for (let k = 0; k < 6; k++) add(f, new THREE.SphereGeometry(0.06, 6, 4), M.cork, -w / 2 + (k + 0.5) * w / 6, -0.02, 0.02);
  }
  function lantern(g, x, y, z) {
    add(g, new THREE.CylinderGeometry(0.1, 0.09, 0.26, 6), M.lamp, x, y - 0.18, z);
    add(g, new THREE.ConeGeometry(0.15, 0.12, 6), M.metal, x, y, z);
  }

  // ======================================================================
  // CASA STORTA
  // ======================================================================
  // opzioni: low/high = materiali dei due piani, roof = paglia o scandole, shed = casotto
  function casaStorta({ low = M.grey, high = M.dark, roof: roofMat = M.thatch, shed = true } = {}) {
    const g = new THREE.Group(), chimneys = [];
    const w0 = 5, d0 = 5, h0 = 2.7, w1 = 5.9, d1 = 5.8, h1 = 2.5, over = 0.6;
    // palafitte
    for (const x of [-2.2, 0, 2.2]) for (const z of [-0.3, -2.5, -4.7]) pole(g, x, -4, 0.02, z, 0.13);
    add(g, box(w0 + 0.3, 0.2, d0 + 0.3), M.deck, 0, -0.1, -d0 / 2); // pavimento sulle palafitte
    // piano terra, che pende un po' a destra
    add(g, lean(box(w0, h0, d0), 0.035), low, 0, h0 / 2, -d0 / 2);
    // travetti in vista e mensole sotto lo sporto del piano di sopra
    for (let k = 0; k < 7; k++) add(g, box(0.16, 0.16, 0.7), M.post, -w0 / 2 + 0.3 + k * (w0 - 0.6) / 6, h0 + 0.05, 0.25);
    for (const x of [-1.9, 0, 1.9]) add(g, box(0.12, 0.9, 0.12), M.post, x + 0.06, h0 - 0.4, 0.28, 0.62, 0, 0);
    // piano di sopra: più largo, sporge in avanti, pende dall'altra parte
    add(g, lean(box(w1, h1, d1), -0.03), high, 0.1, h0 + 0.15 + h1 / 2, -d1 / 2 + over);
    // tetto di paglia ripido, colmo lungo x (le falde guardano il lago)
    const rise = 3.4;
    const roof = add(g, roofGeo(d1 + 1.2, w1 + 0.9, rise, roofMat === M.thatch ? 0.38 : 0.16, 0.1), roofMat, 0.1, h0 + 0.15 + h1 - 0.1, -d1 / 2 + over);
    roof.rotation.y = Math.PI / 2;
    add(g, new THREE.CylinderGeometry(0.26, 0.26, w1 + 1.0, 8), M.tar, 0.1, h0 + 0.15 + h1 + rise - 0.42, -d1 / 2 + over, 0, 0, Math.PI / 2); // colmo
    for (const sx of [-1, 1]) {
      const gb = add(g, gableGeo(d1, rise), M.weathered, 0.1 + sx * (w1 / 2 - 0.02), h0 + 0.15 + h1 - 0.1, -d1 / 2 + over);
      gb.rotation.y = Math.PI / 2;
      roundWin(g, 0.1 + sx * (w1 / 2 + 0.04), h0 + 0.15 + h1 + 1.1, -d1 / 2 + over, 0.32, sx * Math.PI / 2, sx > 0);
    }
    // facciata: porta rossa stinta, finestre diverse tra loro
    door(g, -1.3, 0, M.red);
    win(g, 1.25, 1.55, 0, 0.62, 0.72, { shutter: M.blueP, open: true });
    win(g, -1.5, h0 + 1.35, over, 1.1, 0.55, { shutter: null, lit: true });
    win(g, 1.4, h0 + 1.3, over, 0.5, 0.5, { shutter: M.blueP, open: false });
    // balconcino sul fianco destro, con la porticina e la scala a pioli
    const bx = w1 / 2 + 0.75, bz = -1.4;
    add(g, box(1.4, 0.14, 2.6), M.deck, bx, h0 + 0.08, bz);
    for (const z of [bz - 1.2, bz + 1.2]) pole(g, bx + 0.6, -4, h0 + 0.05, z, 0.09);
    railing(g, new THREE.Vector3(bx + 0.65, h0 + 0.15, bz - 1.25), new THREE.Vector3(bx + 0.65, h0 + 0.15, bz + 1.25));
    railing(g, new THREE.Vector3(bx - 0.65, h0 + 0.15, bz - 1.25), new THREE.Vector3(bx + 0.65, h0 + 0.15, bz - 1.25));
    door(g, w1 / 2 + 0.12, bz, M.blueP, Math.PI / 2, h0 + 0.15);
    ladder(g, bx + 0.1, bz + 1.6, h0 + 0.2, 0);
    net(g, bx + 0.7, h0 + 1.05, bz, 2.4, 1.3, Math.PI / 2);
    // casotto addossato a sinistra, con il tetto a una falda
    if (shed) {
      add(g, lean(box(1.7, 2.0, 3.0), 0.05), M.tar, -(w0 / 2 + 0.85), 1.0, -2.4);
      const sh = add(g, box(2.1, 0.08, 3.4), M.rust, -(w0 / 2 + 0.85), 2.15, -2.4); sh.rotation.z = 0.3;
      win(g, -(w0 / 2 + 1.72), 1.2, -2.4, 0.4, 0.4, { ry: -Math.PI / 2 });
    }
    // comignolo di pietra
    add(g, box(0.7, 2.6, 0.7), M.stone, -1.3, h0 + h1 + 1.8, -d1 / 2 + over - 0.6);
    chimneys.push({ obj: g, p: new THREE.Vector3(-1.3, h0 + h1 + 3.2, -d1 / 2 + over - 0.6) });
    // vita: un cesto, un vaso
    add(g, new THREE.CylinderGeometry(0.3, 0.24, 0.4, 10), M.log, 2.2, 0.2, 0.5);
    add(g, new THREE.IcosahedronGeometry(0.35, 0), M.leaf, -2.3, 0.35, 0.5);
    // ingombri in x (per affiancare le case): left/right al piano terra e al primo piano
    return { group: g, chimneys, type: 'storta', left: shed ? -4.3 : -3.0, right: 4.4, upLeft: -2.9, upRight: 4.4, upY: h0 + 0.15 };
  }

  // ======================================================================
  // CASA TORRE: verande una sopra l'altra
  // ======================================================================
  // opzioni: wall = materiale di tutti i piani, top = quello dell'ultimo (di solito lo stesso), floors = 3…5
  function casaTorre({ wall = M.weathered, top = null, floors = 4 } = {}) {
    const g = new THREE.Group(), chimneys = [];
    const H = 2.5, N = floors;
    for (const x of [-1.6, 1.6]) for (const z of [-0.2, -3.4]) pole(g, x, -4, 0.02, z, 0.14);
    for (const x of [2.6]) for (const z of [0.9, -1.8]) pole(g, x, -4, 0.02, z, 0.12);
    let f = g, rot = 0;
    for (let k = 0; k < N; k++) {
      const s = 3.5 - k * 0.18;
      // ogni piano è figlio del precedente, ruotato un poco: la torre si attorciglia
      const fl = new THREE.Group(); fl.position.set(k ? (R() - 0.5) * 0.2 : 0, k ? H : 0, k ? (R() - 0.5) * 0.2 : 0); fl.rotation.y = k ? (k % 2 ? 0.07 : -0.05) : 0; f.add(fl); f = fl;
      add(fl, box(s, H, s), k === N - 1 && top ? top : wall, 0, H / 2, -s / 2);
      add(fl, box(s + 0.12, 0.14, s + 0.12), M.post, 0, 0.07, -s / 2);
      // veranda a L: davanti e sul fianco destro
      const dd = 1.1;
      add(fl, box(s + dd, 0.12, dd), M.deck, dd / 2, 0.06, dd / 2);
      add(fl, box(dd, 0.12, s), M.deck, s / 2 + dd / 2, 0.06, -s / 2);
      if (k > 0) {
        railing(fl, new THREE.Vector3(-s / 2, 0.12, dd - 0.05), new THREE.Vector3(s / 2 + dd - 0.05, 0.12, dd - 0.05));
        railing(fl, new THREE.Vector3(s / 2 + dd - 0.05, 0.12, dd - 0.05), new THREE.Vector3(s / 2 + dd - 0.05, 0.12, -s));
      }
      // pali d'angolo che reggono la veranda di sopra
      if (k < N - 1) for (const [x, z] of [[-s / 2 + 0.05, dd - 0.05], [s / 2 + dd - 0.05, dd - 0.05], [s / 2 + dd - 0.05, -s + 0.05]]) add(fl, box(0.12, H, 0.12), M.post, x, H / 2, z);
      // finestre e porta sulla veranda
      door(fl, -s / 2 + 0.75, 0, k % 2 ? M.greenP : M.red, 0, 0.12);
      win(fl, s / 2 - 0.75, 1.5, 0, 0.55, 0.65, { shutter: k % 2 ? M.ochreP : M.blueP, open: R() < 0.6, lit: k === 2 });
      win(fl, s / 2, 1.5, -s / 2, 0.55, 0.65, { shutter: M.greenP, open: false, ry: Math.PI / 2 });
      if (k > 0) lantern(fl, s / 2 + dd - 0.12, H - 0.1, dd - 0.12);
      // vasi sulle verande
      if (k > 0 && R() < 0.8) { add(fl, new THREE.CylinderGeometry(0.18, 0.14, 0.28, 8), M.log, -s / 2 + 0.4, 0.26, dd - 0.35); add(fl, new THREE.IcosahedronGeometry(0.32, 0), M.leaf, -s / 2 + 0.4, 0.62, dd - 0.35); }
      if (k === N - 1) {
        // tetto a padiglione con le falde che si allargano in fondo (due coni d'ardesia)
        const top = add(fl, new THREE.ConeGeometry(s * 0.95, 2.4, 4, 1, true), M.moss, 0, H + 1.45, -s / 2, 0, Math.PI / 4, 0);
        const skirt = add(fl, new THREE.CylinderGeometry(s * 0.72, s * 1.2, 0.55, 4, 1, true), M.moss, 0, H + 0.12, -s / 2, 0, Math.PI / 4, 0);
        add(fl, new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), M.metal, 0, H + 3.0, -s / 2);
        add(fl, new THREE.SphereGeometry(0.11, 8, 6), M.metal, 0, H + 3.45, -s / 2);
        // trave con carrucola e secchio che scende fino all'acqua
        add(fl, box(0.14, 0.14, 1.9), M.post, -s / 2 + 0.4, H - 0.2, 1.0);
        add(fl, new THREE.TorusGeometry(0.12, 0.03, 6, 12), M.metal, -s / 2 + 0.4, H - 0.42, 1.85, 0, Math.PI / 2, 0);
        const yTotal = H * (N - 1) + H - 0.5;
        add(fl, new THREE.CylinderGeometry(0.012, 0.012, yTotal - 0.6, 4), M.rope, -s / 2 + 0.4, H - 0.5 - (yTotal - 0.6) / 2, 1.85);
        add(fl, new THREE.CylinderGeometry(0.2, 0.16, 0.3, 10, 1, true), M.log, -s / 2 + 0.4, H - 0.5 - (yTotal - 0.6), 1.85);
        // piccionaia su un palo, accanto alla veranda
        const dv = new THREE.Group(); dv.position.set(s / 2 + dd + 0.4, H * 0.5, -s + 0.3); fl.add(dv);
        add(dv, new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), M.post, 0, 0, 0);
        add(dv, box(0.7, 0.55, 0.55), M.weathered, 0, 1.35, 0);
        for (const x of [-0.17, 0.17]) add(dv, new THREE.CircleGeometry(0.08, 10), M.glass, x, 1.38, 0.28);
        add(dv, new THREE.ConeGeometry(0.6, 0.4, 4), M.rust, 0, 1.82, 0, 0, Math.PI / 4, 0);
        // tubo della stufa
        add(fl, new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), M.metal, s * 0.25, H + 1.6, -s * 0.7);
        chimneys.push({ obj: fl, p: new THREE.Vector3(s * 0.25, H + 2.45, -s * 0.7) }); // nel sistema del piano più alto
      }
    }
    return { group: g, chimneys, type: 'torre', left: -1.9, right: 2.9, upLeft: -1.9, upRight: 2.9, upY: H };
  }

  // ======================================================================
  // CASA LUNGA: bassa e larga, timpano intagliato verso il lago, portico sull'acqua
  // ======================================================================
  // opzioni: w = larghezza, walls, roof
  function casaLunga({ w = 8, walls = M.grey, roof: roofMat = M.rust } = {}) {
    const g = new THREE.Group(), chimneys = [];
    const d = 6.5, h = 2.9, porch = 2.3;
    for (let k = 0; k < 4; k++) for (const z of [porch - 0.15, -0.2, -3.2, -6.2]) pole(g, -w / 2 + 0.3 + k * (w - 0.6) / 3, -4, 0.02, z, 0.14);
    // croci di San Andrea tra i pali sotto il portico
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const x = -w / 2 + 0.3 + (k + 0.5) * (w - 0.6) / 3;
      add(g, box((w - 0.6) / 3 * 1.15, 0.1, 0.08), M.post, x, -1.2, porch - 0.15, 0, 0, s * 0.5);
    }
    add(g, box(w + 0.3, 0.2, d + 0.3), M.deck, 0, -0.1, -d / 2);
    add(g, box(w, h, d), walls, 0, h / 2, -d / 2);
    // tetto con il colmo perpendicolare alla facciata: il timpano guarda il lago
    const rise = 2.6, ry = h - 0.05;
    add(g, roofGeo(w + 1.0, d + 1.3, rise, 0.18, 0.15), roofMat, 0, ry, -d / 2 + 0.35);
    add(g, gableGeo(w, rise), M.weathered, 0, ry, 0.03);
    // tavole intagliate lungo il timpano, e il pinnacolo in cima
    for (const sx of [-1, 1]) {
      const len = Math.hypot(w / 2 + 0.5, rise), ang = Math.atan2(rise, w / 2 + 0.5);
      const bb = add(g, box(len, 0.3, 0.06), M.ochreP, sx * (w / 2 + 0.5) / 2, ry + rise / 2 + 0.05, 0.98, 0, 0, -sx * ang);
      for (let k = 1; k < 9; k++) { // denti dell'intaglio
        const t = k / 9, x = sx * (w / 2 + 0.5) * (1 - t), y = ry + rise * t;
        add(g, new THREE.ConeGeometry(0.07, 0.18, 4), M.ochreP, x, y - 0.12, 0.98, Math.PI, 0, 0);
      }
    }
    add(g, new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), M.ochreP, 0, ry + rise + 0.3, 0.98);
    add(g, new THREE.SphereGeometry(0.12, 8, 6), M.ochreP, 0, ry + rise + 0.85, 0.98);
    add(g, new THREE.ConeGeometry(0.1, 0.35, 6), M.ochreP, 0, ry - 0.05, 0.98, Math.PI, 0, 0); // pendaglio
    // nel timpano: finestrella del sottotetto e trave con carrucola per issare
    win(g, 0, ry + 1.0, 0.05, 0.7, 0.6, { shutter: M.ochreP, open: true, lit: true });
    add(g, box(0.14, 0.14, 1.2), M.post, 0, ry + 1.75, 0.6);
    add(g, new THREE.CylinderGeometry(0.012, 0.012, 1.5, 4), M.rope, 0, ry + 0.95, 1.15);
    // abbaino sulla falda sinistra
    const dm = new THREE.Group(); dm.position.set(-w / 4 - 0.2, ry + rise * 0.42, -d / 2); g.add(dm);
    add(dm, box(1.3, 1.1, 1.3), M.grey, -0.2, 0.3, 0);
    const dmr = add(dm, roofGeo(1.6, 1.6, 0.7, 0.1, 0.05), M.rust, -0.2, 0.85, 0); dmr.rotation.y = Math.PI / 2;
    win(dm, -0.86, 0.3, 0, 0.5, 0.5, { ry: -Math.PI / 2 });
    // facciata sotto il portico: porta, finestre, panca, legna
    door(g, -0.6, 0, M.red);
    win(g, -2.6, 1.6, 0, 0.8, 0.8, { shutter: M.ochreP, open: true });
    win(g, 1.6, 1.6, 0, 0.8, 0.8, { shutter: M.ochreP, open: true, lit: true });
    win(g, 3.2, 1.6, 0, 0.45, 0.6, { shutter: M.ochreP, open: false });
    // portico: pavimento, pali, tettoia, parapetto
    add(g, box(w + 0.2, 0.14, porch), M.deck, 0, 0.07, porch / 2);
    for (let k = 0; k < 4; k++) add(g, box(0.14, 2.35, 0.14), M.post, -w / 2 + 0.2 + k * (w - 0.4) / 3, 1.2, porch - 0.15);
    const pr = add(g, box(w + 0.6, 0.09, porch + 0.6), roofMat, 0, 2.55, porch / 2 + 0.05, 0.22, 0, 0);
    railing(g, new THREE.Vector3(-w / 2 + 0.2, 0.14, porch - 0.15), new THREE.Vector3(-1.2, 0.14, porch - 0.15));
    railing(g, new THREE.Vector3(1.2, 0.14, porch - 0.15), new THREE.Vector3(w / 2 - 0.2, 0.14, porch - 0.15));
    lantern(g, -1.0, 2.3, porch - 0.4); lantern(g, 1.0, 2.3, porch - 0.4);
    add(g, box(1.6, 0.08, 0.4), M.deck, 2.8, 0.5, 0.35); for (const x of [2.1, 3.5]) add(g, box(0.08, 0.45, 0.35), M.post, x, 0.25, 0.35); // panca
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6 - r; c++) { // legna accatastata
      const lg = add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.9, 7), M.log, -w / 2 + 0.5 + c * 0.21 + r * 0.1, 0.22 + r * 0.18, 1.2, Math.PI / 2, 0, 0);
      add(g, new THREE.CircleGeometry(0.09, 7), M.logEnd, -w / 2 + 0.5 + c * 0.21 + r * 0.1, 0.22 + r * 0.18, 1.66);
    }
    net(g, w / 2 + 0.05, 2.2, -1.6, 2.6, 1.6, Math.PI / 2);
    // comignolo di pietra sul retro
    add(g, box(0.8, 3.2, 0.8), M.stone, 2.2, h + 1.6, -d + 1.0);
    chimneys.push({ obj: g, p: new THREE.Vector3(2.2, h + 3.3, -d + 1.0) });
    return { group: g, chimneys, type: 'lunga', w, porch, left: -w / 2 - 0.5, right: w / 2 + 0.5, porchPosts: [0, 1, 2, 3].map((k) => -w / 2 + 0.2 + k * (w - 0.4) / 3) };
  }


  // ======================================================================
  // CASA ROTONDA: una capanna tonda, tetto conico di paglia, veranda tutt'intorno
  // ======================================================================
  function casaRotonda({ walls = M.weathered, roof: roofMat = M.thatch, r = 2.5 } = {}) {
    const g = new THREE.Group(), chimneys = [];
    const cz = -1.3 - (r - 2.5), h = 2.7, rv = r + 1.1;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pole(g, Math.sin(a) * (rv - 0.15), -4, 0.02, cz + Math.cos(a) * (rv - 0.15), 0.12); }
    pole(g, 0, -4, 0.02, cz, 0.18);
    add(g, new THREE.CylinderGeometry(rv, rv, 0.14, 16), M.deck, 0, -0.07, cz);
    // muro tondo di tavole (la texture va ripetuta lungo la circonferenza)
    const src = walls.map, det = src.userData.detail;
    src.userData = {}; const t = src.clone(); src.userData = { detail: det }; // (vedi cached() in textures.js)
    t.repeat.set(2 * Math.PI * r * 0.4, h * 0.4);
    if (det) t.userData = { detail: { normalMap: det.normalMap.clone(), roughnessMap: det.roughnessMap.clone() } };
    const wm = new THREE.MeshStandardMaterial({ map: t });
    add(g, new THREE.CylinderGeometry(r, r * 1.03, h, 20, 1), wm, 0, h / 2, cz);
    // tetto conico di paglia, con il pomo in cima e l'anello del colmo
    add(g, new THREE.ConeGeometry(r + 1.25, 3.3, 20, 1, true), roofMat, 0, h + 1.5, cz);
    add(g, new THREE.CylinderGeometry(0.22, 0.32, 0.5, 10), M.tar, 0, h + 3.1, cz);
    add(g, new THREE.SphereGeometry(0.16, 8, 6), M.ochreP, 0, h + 3.45, cz);
    // veranda tutt'intorno: pali, parapetto a otto lati con il varco verso la passerella
    for (let k = 0; k < 8; k++) {
      const a0 = (k + 0.5) / 8 * Math.PI * 2, a1 = (k + 1.5) / 8 * Math.PI * 2;
      const pA = new THREE.Vector3(Math.sin(a0) * (rv - 0.1), 0, cz + Math.cos(a0) * (rv - 0.1)), pB = new THREE.Vector3(Math.sin(a1) * (rv - 0.1), 0, cz + Math.cos(a1) * (rv - 0.1));
      add(g, box(0.12, 2.4, 0.12), M.post, pA.x, 1.2, pA.z);
      if (k !== 7) railing(g, pA, pB, 0.85); // il tratto davanti (verso +z) resta aperto
    }
    // tettoia ad anello sopra la veranda
    add(g, new THREE.CylinderGeometry(r + 0.2, rv + 0.3, 0.6, 16, 1, true), roofMat, 0, 2.55, cz);
    // porta e finestre disposte intorno
    door(g, 0, cz + r - 0.02, M.red);
    for (const a of [1.1, -1.2, 2.4, -2.5]) {
      const lit = R() < 0.3;
      win(g, Math.sin(a) * r, 1.6, cz + Math.cos(a) * r, 0.5, 0.6, { ry: a, shutter: M.greenP, open: R() < 0.5, lit });
    }
    // fumo dal colmo
    chimneys.push({ obj: g, p: new THREE.Vector3(0, h + 3.6, cz) });
    // vita: vasi e una panca sulla veranda
    add(g, new THREE.CylinderGeometry(0.2, 0.15, 0.32, 8), M.log, rv - 0.5, 0.2, cz + 0.6);
    add(g, new THREE.IcosahedronGeometry(0.35, 0), M.leaf, rv - 0.5, 0.55, cz + 0.6);
    return { group: g, chimneys, type: 'rotonda', left: -rv - 0.2, right: rv + 0.2, z0: 0 };
  }

  // ======================================================================
  // CASA A PONTE: il piano di sopra scavalca la passerella (ci si passa sotto)
  // ======================================================================
  function casaPonte({ low = M.grey, high = M.weathered, roof: roofMat = M.moss } = {}) {
    const g = new THREE.Group(), chimneys = [];
    const w = 6.2, d0 = 5, h0 = 2.9, h1 = 2.6, zf = 5.0; // il piano alto arriva fino a z = 5 (sopra l'acqua)
    for (const x of [-2.6, 0, 2.6]) for (const z of [-0.3, -2.6, -4.8]) pole(g, x, -4, 0.02, z, 0.13);
    add(g, box(w + 0.3, 0.2, d0 + 0.3), M.deck, 0, -0.1, -d0 / 2);
    add(g, box(w, h0, d0), low, 0, h0 / 2, -d0 / 2);
    // pali che reggono lo sporto sopra la passerella (ai lati: si cammina in mezzo)
    for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) for (const z of [2.45, zf - 0.35]) add(g, box(0.2, h0, 0.2), M.post, x, h0 / 2, z);
    for (const z of [2.45, zf - 0.35]) add(g, box(w, 0.22, 0.24), M.post, 0, h0 - 0.11, z); // architravi
    // il piano alto, lungo da z = -5 a z = 5
    const d1 = d0 + zf;
    add(g, box(w + 0.3, h1, d1), high, 0, h0 + h1 / 2, -d0 + d1 / 2);
    for (let k = 0; k < 9; k++) add(g, box(w, 0.12, 0.14), M.post, 0, h0 - 0.02, 0.3 + k * 0.55); // travetti del soffitto del passaggio
    // tetto a capanna, colmo perpendicolare al lago
    const rise = 2.4;
    add(g, roofGeo(w + 1.1, d1 + 1.1, rise, 0.17, 0.12), roofMat, 0, h0 + h1 - 0.05, -d0 + d1 / 2);
    add(g, gableGeo(w + 0.3, rise), high, 0, h0 + h1 - 0.05, zf + 0.02);
    roundWin(g, 0, h0 + h1 + 0.9, zf + 0.05, 0.3, 0, true);
    // facciata sul lago: finestre e un balconcino sospeso sull'acqua
    win(g, -1.6, h0 + 1.3, zf + 0.01, 0.8, 0.7, { shutter: M.ochreP, open: true, lit: true });
    win(g, 1.6, h0 + 1.3, zf + 0.01, 0.8, 0.7, { shutter: M.ochreP, open: false });
    door(g, 0, zf + 0.01, M.blueP, 0, h0 + 0.02);
    add(g, box(2.2, 0.12, 1.0), M.deck, 0, h0 + 0.06, zf + 0.5);
    for (const sx of [-1, 1]) add(g, box(0.1, 0.6, 0.1), M.post, sx * 1.0, h0 - 0.25, zf + 0.9, -0.6, 0, 0); // mensole
    railing(g, new THREE.Vector3(-1.05, h0 + 0.12, zf + 0.95), new THREE.Vector3(1.05, h0 + 0.12, zf + 0.95), 0.85);
    // sotto il passaggio: porta della casa, finestra, lanterna
    door(g, -1.4, 0, M.red);
    win(g, 1.5, 1.55, 0, 0.7, 0.7, { shutter: M.blueP, open: true });
    lantern(g, 0, h0 - 0.15, 3.6);
    // comignolo
    add(g, box(0.7, 2.4, 0.7), M.stone, 1.8, h0 + h1 + 1.4, -d0 + 1.0);
    chimneys.push({ obj: g, p: new THREE.Vector3(1.8, h0 + h1 + 2.7, -d0 + 1.0) });
    return { group: g, chimneys, type: 'ponte', left: -w / 2 - 0.4, right: w / 2 + 0.4, upLeft: -w / 2 - 0.2, upRight: w / 2 + 0.2, upY: h0, posts: [[-w / 2 + 0.15, 2.45], [w / 2 - 0.15, 2.45], [-w / 2 + 0.15, zf - 0.35], [w / 2 - 0.15, zf - 0.35]] };
  }

  // ======================================================================
  // DETTAGLI DI VITA
  // ======================================================================
  // il TRABUCCO: una macchina da pesca di pali che sporge sul lago, con la rete
  // quadrata appesa alle punte; la rete sale e scende piano (userData.dynamic)
  function trabucco() {
    const g = new THREE.Group();
    add(g, box(2.4, 0.14, 2.0), M.deck, 0, -0.07, 1.0);
    for (const x of [-1.05, 1.05]) for (const z of [0.15, 1.85]) pole(g, x, -4, -0.1, z, 0.1);
    // due antenne lunghe che si allungano sull'acqua, controventate
    const tips = [];
    for (const sx of [-1, 1]) {
      const a = new THREE.Vector3(sx * 0.9, 0.1, 1.6), b = new THREE.Vector3(sx * 2.6, 4.2, 9.5);
      const len = a.distanceTo(b), m = add(g, new THREE.CylinderGeometry(0.06, 0.1, len, 6), M.post, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      tips.push(b);
    }
    add(g, new THREE.CylinderGeometry(0.05, 0.05, 5.4, 6), M.post, 0, 4.2, 9.5, 0, 0, Math.PI / 2); // traversa in punta
    add(g, new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6), M.post, 0, 2.2, 5.6, 0, 0, Math.PI / 2);
    // argano sulla piattaforma
    add(g, new THREE.CylinderGeometry(0.22, 0.22, 1.4, 10), M.log, 0, 0.6, 0.9, 0, 0, Math.PI / 2);
    for (const sx of [-0.75, 0.75]) add(g, box(0.1, 0.8, 0.5), M.post, sx, 0.4, 0.9);
    // la rete, appesa per i quattro angoli
    const netG = new THREE.Group(); netG.position.set(0, 1.0, 9.5); netG.userData.dynamic = true; g.add(netG);
    const nm = add(netG, new THREE.PlaneGeometry(4.2, 4.2, 6, 6), M.net, 0, 0, 0, -Math.PI / 2, 0, 0);
    const p = nm.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -0.6 * (1 - (x * x + y * y) / 17.6)); } // la rete fa sacca
    nm.geometry.computeVertexNormals();
    const ropes = [];
    for (const [x, z] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) {
      const r = add(netG, new THREE.CylinderGeometry(0.012, 0.012, 1, 4), M.rope, x * 0.6, 0.5, z * 0.6); ropes.push(r);
    }
    return { group: g, net: netG, ropes, topY: 4.2 };
  }
  // rastrelliera con i pesci messi a seccare
  function fishRack(g, x, y, z, ry = 0) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    for (const sx of [-1, 1]) { add(f, box(0.08, 1.9, 0.08), M.post, sx * 1.0, 0.95, -0.25, 0.25, 0, 0); add(f, box(0.08, 1.9, 0.08), M.post, sx * 1.0, 0.95, 0.25, -0.25, 0, 0); }
    for (const y2 of [1.15, 1.6]) {
      add(f, new THREE.CylinderGeometry(0.03, 0.03, 2.1, 5), M.post, 0, y2, 0, 0, 0, Math.PI / 2);
      for (let k = 0; k < 9; k++) { const fish = add(f, new THREE.SphereGeometry(0.1, 6, 4), M.fish, -0.85 + k * 0.21, y2 - 0.2, 0); fish.scale.set(0.35, 1.6, 0.6); }
    }
  }
  function barrel(g, x, y, z) {
    const prof = [[0.0, 0], [0.26, 0], [0.31, 0.3], [0.26, 0.62], [0.0, 0.62]].map(([a, b]) => new THREE.Vector2(a, b));
    add(g, new THREE.LatheGeometry(prof, 12), M.log, x, y, z);
    for (const yy of [0.12, 0.5]) add(g, new THREE.TorusGeometry(0.29, 0.015, 4, 14), M.metal, x, y + yy, z, Math.PI / 2, 0, 0);
  }
  function crate(g, x, y, z, s = 0.55, ry = 0) { add(g, box(s, s * 0.8, s), M.deck, x, y + s * 0.4, z, 0, ry, 0); }
  function oars(g, x, y, z, ry = 0) {
    for (let k = 0; k < 2; k++) { const o = add(g, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), M.post, x + k * 0.25, y + 1.15, z, 0.18, ry, 0.08 * (k ? 1 : -1)); add(g, box(0.16, 0.5, 0.03), M.post, x + k * 0.25, y + 0.25, z - 0.2, 0.18, ry, 0); }
  }
  // canna da pesca appoggiata al parapetto, con la lenza fino all'acqua
  function fishingRod(g, x, z, y = 1.0) {
    const r = add(g, new THREE.CylinderGeometry(0.012, 0.025, 3.2, 5), M.post, x, y + 1.5, z + 0.9, 0.95, 0, 0);
    add(g, new THREE.CylinderGeometry(0.004, 0.004, y + 2.3, 3), M.rope, x, (y + 2.3) / 2 - 0.1, z + 2.15);
    add(g, new THREE.SphereGeometry(0.05, 6, 4), M.red, x, 0.03, z + 2.15);
  }
  // piccolo altare su un palo, con la lucina accesa
  function shrine(g, x, y, z, ry = 0) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    add(f, box(0.1, 1.4, 0.1), M.post, 0, 0.7, 0);
    add(f, box(0.5, 0.5, 0.4), M.weathered, 0, 1.6, 0);
    add(f, new THREE.ConeGeometry(0.45, 0.35, 4), M.rust, 0, 2.02, 0, 0, Math.PI / 4, 0);
    add(f, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6), M.lamp, 0, 1.45, 0.12);
    add(f, new THREE.IcosahedronGeometry(0.06, 0), M.red, -0.12, 1.42, 0.12); add(f, new THREE.IcosahedronGeometry(0.06, 0), M.ochreP, 0.12, 1.42, 0.12); // fiori
  }
  // treccia d'aglio / mazzo d'erbe appeso accanto a una porta
  function herbs(g, x, y, z) {
    for (let k = 0; k < 5; k++) add(g, new THREE.SphereGeometry(0.07, 6, 4), k % 2 ? M.logEnd : M.leaf, x + (k % 2) * 0.05, y - k * 0.11, z);
  }

  return { casaStorta, casaTorre, casaLunga, casaRotonda, casaPonte, trabucco, fishRack, barrel, crate, oars, fishingRod, shrine, herbs, lantern, materials: M, railing, box };
}
