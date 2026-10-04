// Dream.js
// ---------------------------------------------------------------
// Il LUOGO DEL SOGNO: dove Marco Polo racconta le città a Kublai Khan.
// Una scena a parte (THREE.Scene propria, con il suo cielo e la sua nebbia),
// volutamente semplice e fuori dal tempo:
//   - un pavimento a scacchiera che sfuma nella nebbia chiara (nel libro il Khan
//     riduce il suo impero a una scacchiera)
//   - Kublai Khan seduto su un basamento di cuscini, tra due bracieri
//
// Tutto sta in un gruppo 'anchor' che la storia posa dove si trova il viaggiatore
// (setAnchor): così la camera non si muove e, durante la dissolvenza, cambia solo
// lo sfondo intorno a lui.
//
// KUBLAI è un modello gerarchico: base → busto → (testa → cappello) + spalle →
// braccia → avambracci → mani. Quando parla (speaking = true) alza il braccio destro
// e accompagna le parole con la mano; altrimenti respira e annuisce piano.
// ---------------------------------------------------------------
import * as THREE from 'three';

const BG = new THREE.Color('#ece0d2');

function checkerTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const n = 16, q = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? '#d8c9b6' : '#8f8fa8';
    g.fillRect(i * q, j * q, q, q);
  }
  // sfumatura radiale verso la trasparenza: la scacchiera "finisce" nella nebbia
  const id = g.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
    id.data[(y * S + x) * 4 + 3] = Math.max(0, Math.min(255, (1 - d) * 1.6 * 255));
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function glow() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(1, 'rgba(255,220,170,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- Kublai Khan, seduto ----
function makeKublai() {
  const m = (c, r = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const robe = m('#7a2e2a', 0.7), gold = m('#c9a14a', 0.4, { metalness: 0.5 }), skin = m('#c99a72', 0.7), hair = m('#3a3330', 0.9), fur = m('#d9cfc0', 1);
  const root = new THREE.Group();
  // basamento con i cuscini
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.28, 24), m('#5a4a6a', 0.9)); dais.position.y = 0.14; root.add(dais);
  for (const [x, z, s, c] of [[-0.55, -0.2, 0.42, '#c9a14a'], [0.6, -0.15, 0.38, '#8a3b32'], [0, 0.45, 0.5, '#3f6f73']]) {
    const cu = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), m(c, 0.9)); cu.scale.set(1, 0.35, 1); cu.position.set(x, 0.36, z); root.add(cu);
  }
  // corpo seduto a gambe incrociate: una veste larga alla base (superficie di rivoluzione)
  const base = new THREE.Group(); base.position.y = 0.32; root.add(base);
  const prof = [[0.0, 0], [0.62, 0.02], [0.66, 0.12], [0.5, 0.26], [0.34, 0.4]].map(([r, y]) => new THREE.Vector2(r, y));
  base.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 20), robe));
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 6, 20), gold); sash.rotation.x = Math.PI / 2; sash.position.y = 0.42; base.add(sash);
  const torso = new THREE.Group(); torso.position.y = 0.4; base.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.55, 14), robe); chest.position.y = 0.27; torso.add(chest);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 6, 16), gold); collar.rotation.x = Math.PI / 2; collar.position.y = 0.55; torso.add(collar);
  // testa → barba, cappello
  const neck = new THREE.Group(); neck.position.y = 0.58; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), skin); head.position.y = 0.15; neck.add(head);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 10), hair); beard.rotation.x = Math.PI; beard.position.set(0, 0.03, 0.08); neck.add(beard);
  for (const s of [-1, 1]) { const mu = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.006, 0.12, 5), hair); mu.rotation.z = s * 1.2; mu.position.set(s * 0.05, 0.1, 0.13); neck.add(mu); }
  const hat = new THREE.Group(); hat.position.y = 0.26; neck.add(hat);
  hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 14), gold));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), fur); rim.rotation.x = Math.PI / 2; rim.position.y = -0.05; hat.add(rim);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), m('#a8352c', 0.4)); knob.position.y = 0.11; hat.add(knob);
  // braccia
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.3, 0.5, 0); torso.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.3, 8), robe); upper.position.y = -0.15; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.27, 8), robe); fore.position.y = -0.13; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); hand.position.y = -0.29; elbow.add(hand);
    shoulder.rotation.set(-0.5, 0, s * 0.25); elbow.rotation.x = -1.1; // mani appoggiate in grembo
    arms.push({ shoulder, elbow, s });
  }
  return { root, torso, neck, arms, speaking: false, t: 0 };
}

function updateKublai(k, dt) {
  k.t += dt;
  const t = k.t, talk = k.speaking ? 1 : 0;
  k.blend = (k.blend ?? 0) + (talk - (k.blend ?? 0)) * Math.min(1, dt * 3);
  const b = k.blend;
  k.torso.rotation.x = 0.03 * Math.sin(t * 1.3) - 0.05 * b;               // respiro, e si sporge un po' quando parla
  k.neck.rotation.x = 0.05 * Math.sin(t * 0.7) + b * 0.08 * Math.sin(t * 3.1);
  k.neck.rotation.y = 0.1 * Math.sin(t * 0.4);
  const [L, R] = k.arms;
  // braccio destro: dal grembo a un gesto aperto che accompagna le parole
  R.shoulder.rotation.x = -0.5 - b * (0.7 + 0.15 * Math.sin(t * 2.3));
  R.shoulder.rotation.z = R.s * (0.25 + b * 0.35);
  R.elbow.rotation.x = -1.1 + b * (0.5 + 0.2 * Math.sin(t * 3.7));
  L.shoulder.rotation.x = -0.5 - b * 0.1;
}

export class Dream {
  constructor() {
    const scene = new THREE.Scene();
    scene.background = BG.clone();
    scene.fog = new THREE.FogExp2(BG, 0.045);
    scene.add(new THREE.HemisphereLight('#fff6ea', '#9a8fb0', 1.1));
    const key = new THREE.DirectionalLight('#ffd9b0', 1.2); key.position.set(-4, 8, 6); scene.add(key);
    this.scene = scene;

    const anchor = new THREE.Group(); scene.add(anchor);
    this.anchor = anchor;

    // pavimento a scacchiera che sfuma
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ map: checkerTexture(), transparent: true, roughness: 0.9, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, 4); anchor.add(floor);

    // Kublai, a 3,2 m davanti al viaggiatore, rivolto verso di lui
    this.kublai = makeKublai();
    this.kublai.root.position.set(0.5, 0, 3.4); this.kublai.root.rotation.y = Math.PI - 0.15; this.kublai.root.scale.setScalar(1.15);
    anchor.add(this.kublai.root);

    // due bracieri con le braci e una fiammella
    this.flames = [];
    const iron = new THREE.MeshStandardMaterial({ color: '#3b3a38', metalness: 0.6, roughness: 0.5 });
    const ember = new THREE.MeshStandardMaterial({ color: '#ff9a4a', emissive: '#ff6a1a', emissiveIntensity: 1.6 });
    const glowMat = new THREE.SpriteMaterial({ map: glow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(0.5 + sx * 2.0, 0, 3.0); anchor.add(g);
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), iron); leg.position.set(Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15); leg.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); g.add(leg); }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.15, 0.16, 12, 1, true), iron); bowl.position.y = 0.85; g.add(bowl);
      const coals = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), ember); coals.rotation.x = -Math.PI / 2; coals.position.y = 0.9; g.add(coals);
      const fl = new THREE.Sprite(glowMat); fl.position.y = 1.1; fl.scale.set(0.6, 0.9, 1); g.add(fl);
      this.flames.push(fl);
    }

    this.t = 0;
  }

  // posa il sogno dove sta il viaggiatore, con il Khan davanti a lui (facing = dove guarda)
  setAnchor(position, facing) {
    this.anchor.position.copy(position);
    this.anchor.rotation.y = facing;
  }

  update(dt) {
    this.t += dt;
    updateKublai(this.kublai, dt);
    this.flames.forEach((f, k) => f.scale.set(0.6 + 0.06 * Math.sin(this.t * 9 + k), 0.9 + 0.12 * Math.sin(this.t * 13 + k * 2), 1));
  }
}
