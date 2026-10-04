// items.js
// ---------------------------------------------------------------
// Gli oggetti appesi sotto Ottavia. Dal testo di Calvino:
//   "Tutto il resto, invece d'elevarsi sopra, sta appeso sotto: scale di corda,
//    amache, case fatte a sacco, attaccapanni, terrazzi come navicelle, otri d'acqua,
//    becchi del gas, girarrosti, cesti appesi a spaghi, montacarichi, docce, trapezi
//    e anelli per i giochi, teleferiche, lampadari, vasi con piante dal fogliame pendulo."
//
// Ogni funzione crea un oggetto e restituisce:
//   { name, bodies, loads, object, update(dt, time) }
// - i/j indicano il nodo della rete (colonna, fila) a cui è legato
// - le funi sono VerletBody: l'oggetto dondola da solo quando la rete si muove
// - i modelli sono GERARCHICI: ogni parte è figlia della parte che la regge
// ---------------------------------------------------------------
import * as THREE from 'three';
import { VerletBody, netPin, netPinBetween } from './VerletBody.js';
import { stripedFabric, burlap, woodPlanks, paintedWood, canvasTexture, ropeBump, metalDetail } from './textures.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

const ROPE_BUMP = ropeBump(); ROPE_BUMP.repeat.set(2, 24);
const MAT = {
  brass: new THREE.MeshStandardMaterial({ color: '#b08d48', metalness: 0.7, roughness: 0.35 }),
  // ferro: roughnessMap (consumato = lucido, ruggine = opaco) + normalMap dei graffi
  iron: new THREE.MeshStandardMaterial({ color: '#3b3a38', metalness: 0.6, roughness: 0.8, ...metalDetail() }),
  wax: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.8 }),
  flame: new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffae3d', emissiveIntensity: 2 }),
  leather: new THREE.MeshStandardMaterial({ color: '#7b5433', roughness: 0.75, flatShading: true }),
  wicker: new THREE.MeshStandardMaterial({ color: '#a47c46', roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
  terracotta: new THREE.MeshStandardMaterial({ color: '#b5603c', roughness: 0.9, flatShading: true }),
  soil: new THREE.MeshStandardMaterial({ color: '#3d2b1f', roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }),
  // fune: bumpMap con i trefoli avvolti a elica
  rope: new THREE.MeshStandardMaterial({ color: '#8a7556', roughness: 1, bumpMap: ROPE_BUMP, bumpScale: 3 }),
  dark: new THREE.MeshStandardMaterial({ color: '#1b1510', roughness: 1 }),
  window: new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb45a', emissiveIntensity: 1.5 }),
};

function nodePos(net, n) {
  return new THREE.Vector3(net.pos[n * 3], net.pos[n * 3 + 1], net.pos[n * 3 + 2]);
}

// Mette 'object' nel punto 'to' e lo orienta lungo la fune (da 'from' a 'to').
// yaw = rotazione extra attorno alla fune (per girare porte, finestre…)
function hangAlong(object, from, to, yaw = 0) {
  object.position.copy(to);
  _v.subVectors(to, from).normalize();
  object.quaternion.setFromUnitVectors(DOWN, _v);
  if (yaw) object.quaternion.multiply(_q.setFromAxisAngle(UP, yaw));
}

// Tre spaghi dal gancio (0,0,0) al bordo di un contenitore, come linee fisse nel modello
function strings(radius, y, count = 3) {
  const pts = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    pts.push(0, 0, 0, Math.cos(a) * radius, y, Math.sin(a) * radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#8a7556' }));
}

// Una fune semplice: dal nodo (i, j) scende per 'length' metri
function simpleRope(net, i, j, length, segments, bodyOpts) {
  const n = net.index(i, j);
  const body = new VerletBody(bodyOpts);
  const top = body.addParticle(nodePos(net, n), netPin(net, n));
  const idx = body.chain(top, length, segments);
  return { body, idx, n };
}

// ===============================================================
// LAMPADARIO: ottone, sei candele, un anello che ruota piano.
// Contiene una PointLight vera: illumina gli oggetti vicini.
// ===============================================================
// lit = false: un lampadario spento da anni (niente fiamme e niente luce: costa anche meno)
export function chandelier(net, { i, j, length = 2.5, intensity = 6, lit = true, damping = 0.995 }) {
  const { body, idx, n } = simpleRope(net, i, j, length, 6, { damping });

  const root = new THREE.Group(); root.name = 'lampadario';
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), MAT.brass);
  rod.position.y = -0.125;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), MAT.brass);
  hub.position.y = -0.28;
  const ring = new THREE.Group(); ring.position.y = -0.36;       // l'anello ruota
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.018, 6, 32), MAT.brass);
  torus.rotation.x = Math.PI / 2;
  ring.add(torus);
  const flames = [];
  for (let k = 0; k < 6; k++) {
    const arm = new THREE.Group(); arm.rotation.y = (k / 6) * Math.PI * 2; // un braccio ogni 60°
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 5), MAT.brass);
    bar.rotation.z = Math.PI / 2; bar.position.x = 0.225;
    const candle = new THREE.Group(); candle.position.x = 0.45;
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), MAT.wax);
    wax.position.y = 0.07;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), MAT.flame);
    flame.position.y = 0.16;
    candle.add(wax);
    if (lit) { candle.add(flame); flames.push(flame); }
    arm.add(bar, candle); ring.add(arm);
  }
  root.add(rod, hub, ring);
  const light = lit ? new THREE.PointLight('#ffb866', intensity, 12, 1.6) : null;
  if (light) { light.position.y = -0.2; root.add(light); }

  return {
    name: 'lampadario', bodies: [body], loads: [{ node: n, weight: 40 }], object: root,
    update(dt, t) {
      const end = body.pos[idx[idx.length - 1]], before = body.pos[idx[idx.length - 2]];
      hangAlong(root, before, end);
      if (!lit) return;
      ring.rotation.y += dt * 0.25;
      // fiammelle che tremolano: ognuna con una fase diversa
      flames.forEach((f, k) => { f.scale.y = 1 + 0.25 * Math.sin(t * 17 + k * 1.9) * Math.sin(t * 5.3 + k); });
      light.intensity = intensity * (0.92 + 0.05 * Math.sin(t * 13) + 0.03 * Math.sin(t * 29));
    },
  };
}

// ===============================================================
// OTRE D'ACQUA: una sacca di cuoio che "ballonzola" (molla sulla scala).
// ===============================================================
// cord = colore del cordino al collo (il frammento ha un cordino rosso)
export function waterskin(net, { i, j, length = 1.2, cord = null }) {
  const { body, idx, n } = simpleRope(net, i, j, length, 3);
  const root = new THREE.Group(); root.name = 'otre';
  const cordMat = cord ? new THREE.MeshStandardMaterial({ color: cord, roughness: 0.8 }) : MAT.rope;
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.055, cord ? 0.026 : 0.02, 5, 8), cordMat);
  knot.rotation.x = Math.PI / 2; knot.position.y = -0.05;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.14, 7), MAT.leather);
  neck.position.y = -0.12;
  const bag = new THREE.Group(); bag.position.y = -0.2;           // il perno della sacca è in alto
  const skin = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), MAT.leather);
  skin.scale.set(0.26, 0.34, 0.22); skin.position.y = -0.3;
  bag.add(skin);
  root.add(knot, neck, bag);

  // molla smorzata: quando la fune dà uno strattone l'acqua dentro si allunga e si schiaccia
  const jiggle = { s: 0, v: 0, prevVy: 0 };
  return {
    name: 'otre', bodies: [body], loads: [{ node: n, weight: 30 }], object: root,
    update(dt) {
      const e = idx[idx.length - 1], end = body.pos[e], before = body.pos[idx[idx.length - 2]];
      hangAlong(root, before, end);
      if (dt > 0) {
        const vy = (end.y - body.prev[e].y) / (1 / 120);
        const acc = (vy - jiggle.prevVy) / dt; jiggle.prevVy = vy;
        jiggle.v += (-120 * jiggle.s - 6 * jiggle.v - THREE.MathUtils.clamp(acc, -60, 60) * 0.02) * dt;
        jiggle.s = THREE.MathUtils.clamp(jiggle.s + jiggle.v * dt, -0.25, 0.25);
      }
      bag.scale.set(1 - jiggle.s * 0.5, 1 + jiggle.s, 1 - jiggle.s * 0.5); // volume quasi costante
    },
  };
}

// ===============================================================
// CESTO APPESO A SPAGHI, con la frutta dentro
// ===============================================================
export function basket(net, { i, j, length = 1.8 }) {
  const { body, idx, n } = simpleRope(net, i, j, length, 4);
  const root = new THREE.Group(); root.name = 'cesto';
  root.add(strings(0.32, -0.5));
  const b = new THREE.Group(); b.position.y = -0.64;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.28, 12, 1, true), MAT.wicker);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), MAT.wicker);
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.14;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 5, 16), MAT.wicker);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.14;
  b.add(wall, bottom, rim);
  const fruitColors = ['#d9822b', '#9bb33c', '#b8332c', '#e0b43a', '#d9822b', '#7a3a6b'];
  fruitColors.forEach((c, k) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (k % 3) * 0.01, 8, 6), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    const a = k * 1.1;
    f.position.set(Math.cos(a) * 0.14 * (k % 2 ? 1 : 0.4), 0.1 + (k > 3 ? 0.07 : 0), Math.sin(a) * 0.14 * (k % 2 ? 1 : 0.4));
    b.add(f);
  });
  root.add(b);
  return {
    name: 'cesto', bodies: [body], loads: [{ node: n, weight: 25 }], object: root,
    update() { hangAlong(root, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]]); },
  };
}

// ===============================================================
// VASO CON PIANTE DAL FOGLIAME PENDULO
// Le fronde sono piccole funi Verlet legate al bordo del vaso,
// che a sua volta dondola: movimento secondario "a cascata".
// ===============================================================
export function plantPot(net, { i, j, length = 1.2, fronds = 7, seed = 1 }) {
  const { body, idx, n } = simpleRope(net, i, j, length, 3);
  const root = new THREE.Group(); root.name = 'vaso';
  root.add(strings(0.2, -0.36));
  const pot = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.12, -0.2), new THREE.Vector2(0.17, -0.05), new THREE.Vector2(0.22, 0.1), new THREE.Vector2(0.23, 0.14)], 12),
    MAT.terracotta);
  pot.position.y = -0.52;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.21, 12), MAT.soil);
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.1;
  pot.add(soil);
  root.add(pot);

  // posiziono subito il vaso, così le fronde nascono nel posto giusto
  hangAlong(root, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]]);
  root.updateMatrixWorld(true);

  // Le fronde: la prima particella è fissata a un punto del bordo del vaso
  const leafBody = new VerletBody({ damping: 0.97, iterations: 6 });
  const PER = 7, SEG = 0.12;
  const strands = [];
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + seed;
    const rimLocal = new THREE.Vector3(Math.cos(a) * 0.22, -0.4, Math.sin(a) * 0.22);
    const pinPos = new THREE.Vector3();
    const pin = () => pinPos.copy(rimLocal).applyMatrix4(root.matrixWorld);
    const first = leafBody.addParticle(pin(), pin);
    const len = SEG * (PER - 1) * (0.6 + ((f * 7 + seed * 3) % 5) / 10);
    strands.push(leafBody.chain(first, len, PER - 1, { color: '#4d6b2e' }));
  }
  // foglie: un'unica InstancedMesh, due foglie per ogni tratto di fronda
  const leafGeo = new THREE.SphereGeometry(0.05, 5, 3); leafGeo.scale(1, 0.25, 1.7);
  const leafCount = fronds * (PER - 1) * 2;
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }), leafCount);
  leaves.frustumCulled = false;
  const c = new THREE.Color();
  for (let k = 0; k < leafCount; k++) leaves.setColorAt(k, c.setHSL(0.24 + Math.random() * 0.06, 0.45, 0.25 + Math.random() * 0.12));

  const Z = new THREE.Vector3(0, 0, 1), roll = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
  // le foglie hanno coordinate del mondo: stanno accanto al vaso, non dentro
  const holder = new THREE.Group(); holder.add(root, leaves);
  return {
    name: 'vaso', bodies: [body, leafBody], loads: [{ node: n, weight: 20 }], object: holder,
    update() {
      hangAlong(root, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]]);
      root.updateMatrixWorld(true);
      let k = 0;
      for (const s of strands) {
        for (let q = 0; q < s.length - 1; q++) {
          const a = leafBody.pos[s[q]], b = leafBody.pos[s[q + 1]];
          _v.subVectors(b, a).normalize();
          for (const side of [-1, 1]) {
            _q.setFromUnitVectors(Z, _v);
            _q.multiply(roll.setFromAxisAngle(Z, side * 0.9)); // foglie alternate ai due lati
            _w.lerpVectors(a, b, side < 0 ? 0.3 : 0.75);
            _m.compose(_w, _q, scale);
            leaves.setMatrixAt(k++, _m);
          }
        }
      }
      leaves.instanceMatrix.needsUpdate = true;
    },
  };
}

// ===============================================================
// AMACA: una catena legata a due nodi, coperta da un telo a righe.
// Il telo è una striscia di triangoli ricalcolata a ogni frame.
// ===============================================================
export function hammock(net, { i1, j1, i2, j2, sag = 1.2, width = 0.9, drop = 0.8 }) {
  const nA = net.index(i1, j1), nB = net.index(i2, j2);
  const A = nodePos(net, nA), B = nodePos(net, nB);
  const body = new VerletBody({ damping: 0.99 });
  // due funi corte dai nodi della rete agli estremi del telo
  const pinA = body.addParticle(A, netPin(net, nA));
  const pinB = body.addParticle(B, netPin(net, nB));
  const N = 12;
  const idx = [];
  for (let k = 0; k < N; k++) {
    const p = new THREE.Vector3().lerpVectors(A, B, k / (N - 1));
    p.y -= drop;
    idx.push(body.addParticle(p));
  }
  body.addConstraint(pinA, idx[0], { len: drop });
  body.addConstraint(pinB, idx[N - 1], { len: drop });
  const seg = (A.distanceTo(B) * sag) / (N - 1);
  for (let k = 1; k < N; k++) body.addConstraint(idx[k - 1], idx[k], { len: seg, visible: false });

  // geometria del telo: 2 vertici per particella (i due bordi)
  const pos = new Float32Array(N * 2 * 3), uv = new Float32Array(N * 2 * 2), index = [];
  for (let k = 0; k < N; k++) {
    uv.set([0, k / (N - 1) * 2, 1, k / (N - 1) * 2], k * 4);
    if (k < N - 1) { const a = k * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: stripedFabric(), side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.frustumCulled = false;
  cloth.name = 'amaca';

  const side = new THREE.Vector3(), along = new THREE.Vector3();
  return {
    name: 'amaca', bodies: [body], loads: [{ node: nA, weight: 20 }, { node: nB, weight: 20 }], object: cloth,
    update() {
      along.subVectors(body.pos[idx[N - 1]], body.pos[idx[0]]);
      side.crossVectors(UP, along).normalize();
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1), p = body.pos[idx[k]];
        const w = width * 0.5 * Math.sqrt(Math.sin(Math.PI * t)); // il telo si stringe verso i nodi
        pos.set([p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w], k * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

// ===============================================================
// TRAPEZIO: due funi e una sbarra rigida tra le loro estremità
// ===============================================================
export function trapeze(net, { i, j, length = 2.2 }) {
  const nA = net.index(i, j), nB = net.index(i + 1, j);
  const body = new VerletBody({ damping: 0.995 });
  const a0 = body.addParticle(nodePos(net, nA), netPin(net, nA));
  const b0 = body.addParticle(nodePos(net, nB), netPin(net, nB));
  const left = body.chain(a0, length, 5), right = body.chain(b0, length, 5);
  const la = left[left.length - 1], rb = right[right.length - 1];
  body.addConstraint(la, rb, { rigid: true, visible: false }); // la sbarra non si piega

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), MAT.wood);
  bar.name = 'trapezio';
  return {
    name: 'trapezio', bodies: [body], loads: [{ node: nA, weight: 10 }, { node: nB, weight: 10 }], object: bar,
    update() {
      const a = body.pos[la], b = body.pos[rb];
      bar.position.lerpVectors(a, b, 0.5);
      bar.quaternion.setFromUnitVectors(UP, _v.subVectors(b, a).normalize());
      bar.scale.y = a.distanceTo(b) + 0.1;
    },
  };
}

// ===============================================================
// ANELLI PER I GIOCHI: due funi indipendenti, ognuna con un anello
// ===============================================================
export function rings(net, { i, j, length = 1.8 }) {
  const nA = net.index(i, j), nB = net.index(i + 1, j);
  const body = new VerletBody({ damping: 0.995 });
  const root = new THREE.Group(); root.name = 'anelli';
  const ends = [];
  for (const t of [0.25, 0.75]) {
    const top = body.addParticle(nodePos(net, nA).lerp(nodePos(net, nB), t), netPinBetween(net, nA, nB, t));
    const idx = body.chain(top, length, 4);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 6, 16), MAT.wood);
    const holder = new THREE.Group(); ring.position.y = -0.11; holder.add(ring);
    root.add(holder);
    ends.push({ idx, holder });
  }
  return {
    name: 'anelli', bodies: [body], loads: [{ node: nA, weight: 6 }, { node: nB, weight: 6 }], object: root,
    update() { for (const { idx, holder } of ends) hangAlong(holder, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]]); },
  };
}

// ===============================================================
// SCALA DI CORDA: due funi laterali unite da pioli rigidi
// ===============================================================
export function ropeLadder(net, { i, j, length = 6, rungs = 12 }) {
  const nA = net.index(i, j), nB = net.index(i + 1, j);
  const body = new VerletBody({ damping: 0.99, iterations: 16 });
  const lTop = body.addParticle(nodePos(net, nA).lerp(nodePos(net, nB), 0.25), netPinBetween(net, nA, nB, 0.25));
  const rTop = body.addParticle(nodePos(net, nA).lerp(nodePos(net, nB), 0.75), netPinBetween(net, nA, nB, 0.75));
  const L = body.chain(lTop, length, rungs), R = body.chain(rTop, length, rungs);
  for (let k = 1; k <= rungs; k++) body.addConstraint(L[k], R[k], { rigid: true, visible: false });

  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), MAT.wood, rungs);
  mesh.frustumCulled = false; mesh.name = 'scala di corda';
  const s = new THREE.Vector3();
  return {
    name: 'scala', bodies: [body], loads: [{ node: nA, weight: 25 }, { node: nB, weight: 25 }], object: mesh,
    update() {
      for (let k = 1; k <= rungs; k++) {
        const a = body.pos[L[k]], b = body.pos[R[k]];
        _w.lerpVectors(a, b, 0.5);
        _q.setFromUnitVectors(UP, _v.subVectors(b, a).normalize());
        _m.compose(_w, _q, s.set(1, a.distanceTo(b) + 0.08, 1));
        mesh.setMatrixAt(k - 1, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ===============================================================
// CASA FATTA A SACCO: appesa a quattro nodi della rete.
//
// - il SACCO è una superficie di rivoluzione (LatheGeometry) da cui tolgo i
//   triangoli dove ci sono la porta e le finestre: sono BUCHI veri, da cui si
//   vede dentro. Fuori tela di sacco rattoppata, dentro la stessa tela più scura
//   e calda (un secondo mesh con side = BackSide, leggermente luminoso).
// - PORTA di legno dipinto, socchiusa, con il suo telaio; un PIANEROTTOLO di assi
//   fuori dalla porta e una SCALA DI CORDA che sale fino alla rete (fisica Verlet:
//   in alto è legata ai nodi, in basso segue la casa che dondola).
// - FINESTRE (1–3) con telaio, vetri caldi, scuri aperti e a volte una fioriera.
// - DENTRO: pavimento di assi, un lume appeso, e qualche oggetto scelto a caso
//   (letto, tavolo con candela, sgabelli, mensola con i vasetti, tappeto, baule).
// Ogni casa è diversa (seed).
// ===============================================================
const DOOR_COLORS = ['#3f6f73', '#8a3b32', '#b88a3b', '#4a5f86', '#5a4a3a'];
const SHUTTER_COLORS = ['#3f6f73', '#7a9a5a', '#a8352c', '#d9a43a', '#4a5f86'];

// doors: angoli (locali, 0 = +Z) delle porte, ognuna col suo pianerottolo; ladder: scala dalla prima porta alla rete
export function sackHouse(net, { i, j, size = 2, drop = 1.2, yaw = 0, seed = 1, doors = [0], ladder: withLadder = true }) {
  let rs = seed * 5303 + 17;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  rnd(); rnd();
  const corners = [[i, j], [i + size, j], [i, j + size], [i + size, j + size]].map(([a, b]) => net.index(a, b));
  const body = new VerletBody({ damping: 0.99, iterations: 16 });
  const center = new THREE.Vector3();
  const pins = corners.map((n) => { const p = nodePos(net, n); center.add(p); return body.addParticle(p, netPin(net, n)); });
  center.divideScalar(4); center.y -= drop;
  const knot = body.addParticle(center);
  for (const p of pins) body.addConstraint(p, knot); // quattro funi tese fino al nodo centrale
  const idx = body.chain(knot, 0.8, 2);

  // dove sta la casa in questo istante (stessa regola di hangAlong), calcolato dalle particelle
  const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const xfPos = new THREE.Vector3(), xfQ = new THREE.Quaternion(), _d = new THREE.Vector3();
  const houseXf = () => {
    const from = body.pos[idx[idx.length - 2]], to = body.pos[idx[idx.length - 1]];
    xfPos.copy(to);
    xfQ.setFromUnitVectors(DOWN, _d.subVectors(to, from).normalize()).multiply(yawQ);
  };

  const root = new THREE.Group(); root.name = 'casa a sacco';

  // --- profilo del sacco, ricampionato fitto (servono triangoli piccoli per ritagliare i buchi)
  const P0 = [[0.12, 0], [0.2, -0.15], [0.7, -0.5], [1.1, -1.0], [1.25, -1.6], [1.2, -2.2], [0.95, -2.7], [0.5, -3.0], [0.001, -3.08]];
  const radiusAt = (y) => {
    for (let k = 1; k < P0.length; k++) {
      const [ra, ya] = P0[k - 1], [rb, yb] = P0[k];
      if (y <= ya && y >= yb) return ra + ((y - ya) / (yb - ya)) * (rb - ra);
    }
    return 0.1;
  };
  const prof = [];
  for (let y = 0; y > -3.0; y -= 0.1) prof.push(new THREE.Vector2(radiusAt(y), y));
  prof.push(new THREE.Vector2(0.5, -3.0), new THREE.Vector2(0.001, -3.08));

  // --- porta e finestre: dove sono (angolo attorno al sacco: 0 = +Z, la facciata)
  const FLOOR = -2.15;
  const doorList = doors.map((a) => ({ a, w: 0.72, y0: FLOOR, y1: FLOOR + 0.98 }));
  const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const farFromDoors = (a, min) => doorList.every((d) => angDist(a, d.a) > min);
  const nWin = 1 + Math.floor(rnd() * 3);
  const windows = [];
  const winAngles = [-1.15, 1.2, 2.6, -2.4, 0.6, -0.6].map((a) => a + doors[0]).filter((a) => farFromDoors(a, 0.75));
  for (let k = 0; k < Math.min(nWin, winAngles.length); k++) windows.push({ a: winAngles[k] + (rnd() - 0.5) * 0.3, y: -1.25 - rnd() * 0.25, w: 0.38, h: 0.38 });
  const inHole = (ang, y) => {
    const near = (a, half, r) => Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a))) * r < half;
    for (const door of doorList) if (near(door.a, door.w / 2, radiusAt(y)) && y > door.y0 && y < door.y1) return true;
    for (const w of windows) if (near(w.a, w.w / 2, radiusAt(y)) && Math.abs(y - w.y) < w.h / 2) return true;
    return false;
  };
  const geo = new THREE.LatheGeometry(prof, 44);
  { // tolgo i triangoli che cadono dentro porta e finestre
    const pos = geo.attributes.position, ind = geo.index.array, keep = [];
    for (let t = 0; t < ind.length; t += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let q = 0; q < 3; q++) { cx += pos.getX(ind[t + q]); cy += pos.getY(ind[t + q]); cz += pos.getZ(ind[t + q]); }
      if (!inHole(Math.atan2(cx, cz), cy / 3)) keep.push(ind[t], ind[t + 1], ind[t + 2]);
    }
    geo.setIndex(keep);
  }
  const tex = burlap(seed); tex.repeat.set(3, 2);
  const outer = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, flatShading: true }));
  const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: '#8a7058', emissive: '#4a2c12', emissiveIntensity: 0.35, roughness: 1, side: THREE.BackSide }));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12), MAT.rope);
  tie.rotation.x = Math.PI / 2; tie.position.y = -0.08;
  const band1 = new THREE.Mesh(new THREE.TorusGeometry(1.11, 0.04, 5, 24), MAT.rope);
  band1.rotation.x = Math.PI / 2; band1.position.y = -1.0;
  root.add(outer, inner, tie, band1);

  // un gruppo appoggiato alla parete all'angolo a e altezza y (+Z locale = verso fuori)
  const onWall = (a, y, out = 0.02) => {
    const g = new THREE.Group(), r = radiusAt(y) + out;
    g.position.set(Math.sin(a) * r, y, Math.cos(a) * r); g.rotation.y = a;
    root.add(g); return g;
  };
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const plain = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

  // --- PORTE: telaio, battente socchiuso (incernierato a sinistra), maniglia, pianerottolo
  for (const door of doorList) {
    const g = onWall(door.a, (door.y0 + door.y1) / 2, 0.03);
    const H = door.y1 - door.y0, W = door.w;
    const frameMat = MAT.wood;
    g.add(box(0.07, H + 0.07, 0.08, frameMat, -W / 2 - 0.02, 0.02, 0), box(0.07, H + 0.07, 0.08, frameMat, W / 2 + 0.02, 0.02, 0), box(W + 0.18, 0.08, 0.1, frameMat, 0, H / 2 + 0.05, 0.01));
    const doorMat = new THREE.MeshStandardMaterial({ map: paintedWood(DOOR_COLORS[Math.floor(rnd() * DOOR_COLORS.length)], seed + 5, 5), roughness: 0.85 });
    const hinge = new THREE.Group(); hinge.position.set(-W / 2 + 0.01, 0, 0.02); g.add(hinge);
    const leaf = box(W - 0.04, H - 0.03, 0.04, doorMat, (W - 0.04) / 2, -0.015, 0); hinge.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), MAT.brass); knob.position.set(W - 0.12, -0.05, 0.04); hinge.add(knob);
    for (const y of [-H / 3, H / 3]) hinge.add(box(0.2, 0.025, 0.012, MAT.iron, 0.1, y, 0.025)); // cardini
    hinge.rotation.y = 0.7 + rnd() * 0.6; // socchiusa, verso dentro (fuori c'è il ponticello)
    // pianerottolo di assi davanti alla porta, con due paletti
    const deck = onWall(door.a, FLOOR - 0.03, 0);
    const planks = new THREE.MeshStandardMaterial({ map: woodPlanks(seed + 9, 4), roughness: 0.9 });
    deck.add(box(1.0, 0.05, 0.55, planks, 0, 0, 0.2));
    // paletti agli angoli e ringhiere sui due lati: il davanti resta aperto (ci si attacca il ponticello)
    for (const x of [-0.47, 0.47]) {
      deck.add(box(0.04, 0.55, 0.04, MAT.wood, x, 0.27, 0.45), box(0.04, 0.55, 0.04, MAT.wood, x, 0.27, -0.02));
      deck.add(box(0.03, 0.03, 0.5, MAT.wood, x, 0.53, 0.21));
    }
  }

  // --- FINESTRE: telaio, croce, vetro caldo, scuri aperti, a volte la fioriera
  const glass = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb45a', emissiveIntensity: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const shutterMat = new THREE.MeshStandardMaterial({ map: paintedWood(SHUTTER_COLORS[Math.floor(rnd() * SHUTTER_COLORS.length)], seed + 13, 3), roughness: 0.85 });
  for (const w of windows) {
    const g = onWall(w.a, w.y, 0.03);
    const W = w.w, H = w.h, t = 0.04;
    g.add(box(W + 2 * t, t, 0.06, MAT.wood, 0, H / 2 + t / 2, 0), box(W + 2 * t, t, 0.06, MAT.wood, 0, -H / 2 - t / 2, 0));
    g.add(box(t, H, 0.06, MAT.wood, -W / 2 - t / 2, 0, 0), box(t, H, 0.06, MAT.wood, W / 2 + t / 2, 0, 0));
    g.add(box(0.02, H, 0.03, MAT.wood, 0, 0, 0), box(W, 0.02, 0.03, MAT.wood, 0, 0, 0));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glass); pane.position.z = -0.01; g.add(pane);
    for (const s of [-1, 1]) { // scuri aperti contro la parete
      const h = new THREE.Group(); h.position.set(s * (W / 2 + t), 0, 0.02); h.rotation.y = s * (1.9 + rnd() * 0.5); g.add(h);
      h.add(box(W / 2, H + 0.02, 0.025, shutterMat, s * W / 4, 0, 0));
    }
    if (rnd() < 0.6) { // fioriera con qualche ciuffo
      g.add(box(W + 0.1, 0.09, 0.12, MAT.terracotta, 0, -H / 2 - 0.09, 0.07));
      for (let k = 0; k < 5; k++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.045 + rnd() * 0.03, 6, 5), plain(rnd() < 0.3 ? '#c94f6a' : '#4f7a3a', 1));
        leaf.position.set(-W / 2 + 0.05 + (k / 4) * (W - 0.1), -H / 2 - 0.02 + rnd() * 0.04, 0.07); g.add(leaf);
      }
    }
  }

  // --- DENTRO
  const floorR = radiusAt(FLOOR) - 0.04;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(floorR, 24), new THREE.MeshStandardMaterial({ map: woodPlanks(seed + 2, 6), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; root.add(floor);
  // il lume appeso al centro: è lui che "illumina" l'interno (materiale luminoso, niente luci vere)
  const lampCord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 3), MAT.rope); lampCord.position.y = -0.75; root.add(lampCord);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), MAT.window); lamp.position.y = -1.22; root.add(lamp);
  const lampCap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.06, 8), MAT.iron); lampCap.position.y = -1.15; root.add(lampCap);
  const furniture = {
    bed(g) { // letto basso con la coperta a righe
      g.add(box(0.95, 0.18, 0.55, MAT.wood, 0, 0.09, 0));
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.56), new THREE.MeshStandardMaterial({ map: stripedFabric(['#a8352c', '#e8dcc0', '#3f6f73', '#e8dcc0']), roughness: 1 }));
      blanket.position.set(0.07, 0.21, 0); g.add(blanket);
      g.add(box(0.18, 0.08, 0.4, plain('#e8dcc0', 1), -0.36, 0.22, 0));
    },
    table(g) { // tavolino con la candela
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 14), MAT.wood); top.position.y = 0.55;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.55, 8), MAT.wood); leg.position.y = 0.27;
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8), MAT.wax); wax.position.set(0.08, 0.62, 0);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 6), MAT.flame); fl.position.set(0.08, 0.7, 0);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 8), MAT.terracotta); cup.position.set(-0.1, 0.6, 0.05);
      g.add(top, leg, wax, fl, cup);
    },
    stools(g) {
      for (const x of [-0.25, 0.25]) {
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10), MAT.wood); seat.position.set(x, 0.35, 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.35, 6), MAT.wood); leg.position.set(x, 0.17, 0);
        g.add(seat, leg);
      }
    },
    shelf(g) { // mensola appesa con vasetti e un libro
      g.add(box(0.6, 0.03, 0.16, MAT.wood, 0, 1.0, -0.05));
      ['#3d6e5a', '#b5603c', '#d9a43a', '#4a5f86'].forEach((c, k) => {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.09 + rnd() * 0.06, 8), plain(c, 0.4));
        jar.position.set(-0.22 + k * 0.13, 1.07, -0.05); g.add(jar);
      });
    },
    rug(g) {
      const rug = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshStandardMaterial({ map: stripedFabric(['#8a3b32', '#d9b7a0', '#4a5f86', '#d9b7a0']), roughness: 1 }));
      rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; g.add(rug);
    },
    chest(g) { // baule con le borchie
      g.add(box(0.55, 0.32, 0.34, MAT.leather, 0, 0.16, 0));
      g.add(box(0.57, 0.04, 0.36, MAT.brass, 0, 0.3, 0));
    },
  };
  const kinds = Object.keys(furniture).sort(() => rnd() - 0.5).slice(0, 4);
  // attorno alla parete, lontano dalle porte (il quarto oggetto va al centro)
  const slots = [Math.PI, Math.PI - 1.4, Math.PI + 1.4, Math.PI - 0.7, Math.PI + 0.7, 1.4, -1.4].map((a) => a + doors[0]).filter((a) => farFromDoors(a, 0.8));
  kinds.forEach((k, q) => {
    const g = new THREE.Group();
    const central = k === 'rug' || q === 3 || q >= slots.length;
    const a = (central ? 0 : slots[q]) + (rnd() - 0.5) * 0.3;
    const r = central ? 0 : floorR - 0.4;
    g.position.set(Math.sin(a) * r, FLOOR, Math.cos(a) * r);
    g.rotation.y = a + Math.PI; // guardano verso il centro
    furniture[k](g); root.add(g);
  });

  // --- SCALA DI CORDA dal pianerottolo alla rete
  const ladder = new VerletBody({ damping: 0.99, iterations: 16 });
  houseXf();
  const toWorld = (v, out) => out.copy(v).applyQuaternion(xfQ).add(xfPos);
  const RP = radiusAt(FLOOR);
  let best = -1, RUNGS = 1, rungMesh = null, chainL = [], chainR = [];
  const rotY = (v, a) => v.applyAxisAngle(UP, a);
  if (withLadder) {
    // la scala sale dal lato sinistro del pianerottolo (il davanti serve al ponticello)
    const porchL = rotY(new THREE.Vector3(-0.42, FLOOR + 0.03, RP + 0.08), doors[0]), porchR = rotY(new THREE.Vector3(-0.42, FLOOR + 0.03, RP + 0.4), doors[0]);
    const bL = toWorld(porchL, new THREE.Vector3()), bR = toWorld(porchR, new THREE.Vector3());
    // il nodo della rete più vicino, sopra il pianerottolo
    let bd = Infinity; best = 0;
    for (let n = 0; n < net.count; n++) {
      const dx = net.pos[n * 3] - (bL.x + bR.x) / 2, dz = net.pos[n * 3 + 2] - (bL.z + bR.z) / 2, d = dx * dx + dz * dz;
      if (d < bd && !net.pinned[n]) { bd = d; best = n; }
    }
    const top = nodePos(net, best);
    const side = new THREE.Vector3().subVectors(bR, bL).setY(0).normalize().multiplyScalar(0.3);
    const tL = top.clone().sub(side), tR = top.clone().add(side);
    RUNGS = Math.max(6, Math.round((top.y - bL.y) / 0.32));
    const mkPinBottom = (local) => { const v = new THREE.Vector3(); return () => { houseXf(); return toWorld(local, v); }; };
    chainL = [ladder.addParticle(tL, netPin(net, best, side.clone().negate()))]; chainR = [ladder.addParticle(tR, netPin(net, best, side.clone()))];
    for (let k = 1; k <= RUNGS; k++) {
      const last = k === RUNGS;
      chainL.push(ladder.addParticle(new THREE.Vector3().lerpVectors(tL, bL, k / RUNGS), last ? mkPinBottom(porchL) : null));
      chainR.push(ladder.addParticle(new THREE.Vector3().lerpVectors(tR, bR, k / RUNGS), last ? mkPinBottom(porchR) : null));
      const len = (tL.distanceTo(bL) * 1.02) / RUNGS;
      ladder.addConstraint(chainL[k - 1], chainL[k], { len }); ladder.addConstraint(chainR[k - 1], chainR[k], { len });
      if (!last) ladder.addConstraint(chainL[k], chainR[k], { rigid: true, visible: false });
    }
    rungMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), MAT.wood, RUNGS - 1);
    rungMesh.frustumCulled = false;
  }
  const holder = new THREE.Group(); holder.add(root); if (rungMesh) holder.add(rungMesh);
  const sc = new THREE.Vector3(1, 1, 1);

  // punti del bordo anteriore del pianerottolo (per legarci un ponticello): side = -1 | 1, high = ringhiera
  // k = quale porta (indice in doors)
  const porch = (side, high = false, k = 0) => {
    const local = rotY(new THREE.Vector3(side * 0.42, FLOOR + (high ? 0.55 : 0.0), RP + 0.47), doors[k]), v = new THREE.Vector3();
    return () => { houseXf(); return toWorld(local, v); };
  };
  // attraversare la casa da una porta all'altra: pianerottolo → soglia → centro → soglia → pianerottolo
  const through = (kFrom, kTo) => {
    const L = (x, y, z, a) => { const local = rotY(new THREE.Vector3(x, y, z), a), v = new THREE.Vector3(); return () => { houseXf(); return toWorld(local, v); }; };
    const a = doors[kFrom], b = doors[kTo];
    return [L(0, FLOOR + 0.03, RP + 0.42, a), L(0, FLOOR + 0.02, RP - 0.1, a), L(0, FLOOR + 0.02, 0, 0), L(0, FLOOR + 0.02, RP - 0.1, b), L(0, FLOOR + 0.03, RP + 0.42, b)];
  };
  // dove sta la casa (per le luci della storia)
  const centerPoint = () => { houseXf(); return toWorld(new THREE.Vector3(0, -1.4, 0), new THREE.Vector3()); };
  return {
    name: 'casa', bodies: withLadder ? [body, ladder] : [body], object: holder, porch, through, centerPoint,
    loads: [...corners.map((node) => ({ node, weight: 70 })), ...(withLadder ? [{ node: best, weight: 15 }] : [])],
    update() {
      hangAlong(root, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]], yaw);
      if (!rungMesh) return;
      for (let k = 1; k < RUNGS; k++) {
        const a = ladder.pos[chainL[k]], b = ladder.pos[chainR[k]];
        _w.lerpVectors(a, b, 0.5);
        _q.setFromUnitVectors(UP, _v.subVectors(b, a).normalize());
        rungMesh.setMatrixAt(k - 1, _m.compose(_w, _q, sc.set(1, a.distanceTo(b) + 0.08, 1)));
      }
      rungMesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ===============================================================
// TERRAZZO COME NAVICELLA "alla Jules Verne": una barca di legno dipinto con
// oblò e borchie d'ottone, un'elica di tela che gira col vento, due pinne,
// un cannocchiale puntato al cielo e una tettoia. Ognuna è diversa (seed).
//
// FISICA: il ponte è un CORPO RIGIDO di 4 particelle (gli anelli d'ottone a prua
// e a poppa) unite da 6 aste rigide (4 lati + 2 diagonali). Ogni anello pende da
// un nodo della rete con la sua fune: la barca dondola e si inclina, ma non si
// deforma. Ogni frame il modello si orienta come il quadrato dei 4 anelli.
//
// SISTEMA LOCALE del modello: +Z = prua, +Y = su, origine al centro del bordo.
// ===============================================================
const HULL_COLORS = ['#3f6f73', '#b88a3b', '#8a3b32', '#4a5f86'];
const AWNING_COLORS = [['#e8dcc0', '#b8412f'], ['#e8dcc0', '#2f5d7c'], ['#d9c27a', '#6b4a2f'], ['#e8dcc0', '#4f6e35']];

// Profilo dello scafo: u va da -1 (poppa) a +1 (prua)
const hull = {
  L: 2.8, W: 1.5, D: 0.7,
  hw(u) { return Math.max(0.02, (this.W / 2) * Math.pow(1 - u * u, 0.6)); }, // mezza larghezza: appuntita agli estremi
  top(u) { return 0.12 * u * u; },                                          // il bordo si alza verso prua e poppa
  depth(u) { return this.D * (0.55 + 0.45 * (1 - u * u)); },                // più profonda al centro
};

// Lo scafo come geometria "loftata": sezioni a U una dopo l'altra lungo la barca
function hullGeometry(N = 18, M = 12) {
  const pos = [], uv = [], index = [];
  for (let s = 0; s <= N; s++) {
    const u = -1 + (2 * s) / N, z = (u * hull.L) / 2;
    const hw = hull.hw(u), top = hull.top(u), d = hull.depth(u);
    for (let m = 0; m <= M; m++) {
      const th = (Math.PI * m) / M; // da un bordo all'altro passando per la chiglia
      pos.push(hw * Math.cos(th), top - d * Math.pow(Math.sin(th), 0.8), z);
      uv.push(m / M, (u + 1) * 1.5);
    }
  }
  for (let s = 0; s < N; s++) for (let m = 0; m < M; m++) {
    const a = s * (M + 1) + m, b = a + M + 1;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Un punto sul fianco dello scafo (side = +1 dritta, -1 sinistra) e la sua normale
function hullPoint(u, th, side, outPos, outNormal) {
  const hw = hull.hw(u), d = hull.depth(u);
  outPos.set(side * hw * Math.cos(th), hull.top(u) - d * Math.pow(Math.sin(th), 0.8), (u * hull.L) / 2);
  outNormal.set(side * Math.cos(th) * d, -Math.sin(th) * hw, 0).normalize();
}

export function gondola(net, { i, j, drop = 1.6, yaw = 0, seed = 1 }) {
  let rs = seed * 9973 + 7;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;   // casuale ma ripetibile
  const { L } = hull;
  const nodes = [[i, j], [i + 2, j], [i, j + 2], [i + 2, j + 2]].map(([a, b]) => net.index(a, b));
  const body = new VerletBody({ damping: 0.992, iterations: 16 });

  // --- I 4 anelli d'ottone (in coordinate locali): due a poppa, due a prua
  const ringU = 0.72, ringZ = (ringU * L) / 2, ringX = hull.hw(ringU) * 0.8, ringY = hull.top(ringU) + 0.06;
  const ringsLocal = [[-ringX, -ringZ], [ringX, -ringZ], [-ringX, ringZ], [ringX, ringZ]];

  const center = new THREE.Vector3();
  nodes.forEach((n) => center.add(nodePos(net, n)));
  center.divideScalar(4); center.y -= drop;
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const corners = ringsLocal.map(([x, z]) => body.addParticle(new THREE.Vector3(center.x + x * c + z * sn, center.y, center.z - x * sn + z * c)));

  // le quattro funi: dal nodo all'anello più vicino, in 3 tratti
  nodes.forEach((n) => {
    const top = body.addParticle(nodePos(net, n), netPin(net, n));
    const near = corners.reduce((best, ci) => (body.pos[ci].distanceTo(body.pos[top]) < body.pos[best].distanceTo(body.pos[top]) ? ci : best));
    let prev = top;
    for (let q = 1; q < 3; q++) {
      const mid = body.addParticle(new THREE.Vector3().lerpVectors(body.pos[top], body.pos[near], q / 3));
      body.addConstraint(prev, mid);
      prev = mid;
    }
    body.addConstraint(prev, near);
  });
  const [a, b, d, e] = corners;
  for (const [p, q] of [[a, b], [b, e], [e, d], [d, a], [a, e], [b, d]]) body.addConstraint(p, q, { rigid: true, visible: false });

  // --- Materiali di questa navicella
  const k = Math.floor(rnd() * HULL_COLORS.length);
  const paint = new THREE.MeshStandardMaterial({ map: paintedWood(HULL_COLORS[k], seed), roughness: 0.85, side: THREE.DoubleSide });
  const deckMat = new THREE.MeshStandardMaterial({ map: woodPlanks(seed + 3), roughness: 0.9 });
  const brass = MAT.brass;
  const canvas = new THREE.MeshStandardMaterial({ color: '#e6dcc4', roughness: 1, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d3a40', metalness: 0.9, roughness: 0.08 });

  // root = la barca intera; offset sposta il modello in modo che l'origine sia al centro degli anelli
  const root = new THREE.Group(); root.name = 'navicella';
  const boat = new THREE.Group(); boat.position.y = -ringY; root.add(boat);

  // --- Scafo, ponte, bordo, borchie
  boat.add(new THREE.Mesh(hullGeometry(), paint));
  const deckY = -0.28, du = 0.8, outline = [];
  for (let q = 0; q <= 12; q++) { const u = -du + (2 * du * q) / 12; outline.push([hull.hw(u) * 0.93, (u * L) / 2]); }
  const shape = new THREE.Shape();
  outline.forEach(([x, z], q) => (q ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  for (let q = outline.length - 1; q >= 0; q--) shape.lineTo(-outline[q][0], -outline[q][1]);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(shape), deckMat);
  deck.rotation.x = -Math.PI / 2; deck.position.y = deckY;
  boat.add(deck);

  const railPts = [];
  for (let q = 0; q <= 24; q++) { const u = -1 + q / 12; railPts.push(new THREE.Vector3(hull.hw(u), hull.top(u) + 0.02, (u * L) / 2)); }
  for (let q = 23; q > 0; q--) { const u = -1 + q / 12; railPts.push(new THREE.Vector3(-hull.hw(u), hull.top(u) + 0.02, (u * L) / 2)); }
  boat.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, true), 96, 0.03, 6, true), MAT.wood));

  const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 5, 4), brass, 36);
  const P = new THREE.Vector3(), Nrm = new THREE.Vector3(), M4 = new THREE.Matrix4();
  for (let q = 0; q < 36; q++) {
    const side = q < 18 ? 1 : -1, u = -0.85 + ((q % 18) / 17) * 1.7;
    hullPoint(u, 0.16, side, P, Nrm);
    rivets.setMatrixAt(q, M4.makeTranslation(P.x + Nrm.x * 0.01, P.y, P.z));
  }
  boat.add(rivets);

  // --- Oblò d'ottone: tre per lato
  for (const side of [1, -1]) for (const u of [-0.38, 0, 0.38]) {
    hullPoint(u, 0.5, side, P, Nrm);
    const port = new THREE.Group();
    port.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 16), brass));
    port.add(new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), glass));
    port.position.copy(P).addScaledVector(Nrm, 0.012);
    port.lookAt(P.clone().add(Nrm));
    boat.add(port);
  }

  // --- Anelli d'ottone dove arrivano le funi
  for (const [x, z] of ringsLocal) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 12), brass);
    ring.position.set(x, ringY, z);
    boat.add(ring);
  }

  // --- Elica di tela a poppa (gira col vento): supporto → mozzo (ruota) → 4 pale
  const prop = new THREE.Group(); prop.position.set(0, hull.top(-1) - 0.05, -L / 2);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.38, 8), brass);
  shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.17;
  const hub = new THREE.Group(); hub.position.z = -0.38;
  hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), brass));
  for (let q = 0; q < 4; q++) {
    const blade = new THREE.Group(); blade.rotation.z = (q / 4) * Math.PI * 2;
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 4), MAT.wood);
    spar.position.y = 0.25;
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.36), canvas);
    sail.position.set(0.06, 0.28, 0); sail.rotation.y = 0.5; // pala inclinata: il vento la fa girare
    blade.add(spar, sail); hub.add(blade);
  }
  prop.add(shaft, hub); boat.add(prop);

  // --- Due pinne di tela su un'intelaiatura di legno, come ali
  const fins = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * hull.hw(0.1) * 0.98, hull.top(0.1) - 0.04, (0.1 * L) / 2);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, 0, 0, -0.4, side * 0.85, 0.05, -0.32], 3));
    tri.computeVertexNormals();
    const sailMesh = new THREE.Mesh(tri, canvas);
    const sparA = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.86, 4), MAT.wood);
    sparA.rotation.z = Math.PI / 2; sparA.position.set(side * 0.42, 0.025, -0.36); sparA.rotation.y = side * 0.05;
    pivot.add(sailMesh, sparA);
    boat.add(pivot);
    fins.push({ pivot, side });
  }

  // --- Cannocchiale d'ottone a prua, puntato al cielo (ruota lentamente: cerca le stelle)
  const scope = new THREE.Group(); scope.position.set(0, deckY, L * 0.27);
  for (let q = 0; q < 3; q++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), MAT.wood);
    const t = (q / 3) * Math.PI * 2;
    leg.position.set(Math.cos(t) * 0.08, 0.24, Math.sin(t) * 0.08);
    leg.rotation.set(Math.sin(t) * 0.25, 0, -Math.cos(t) * 0.25);
    scope.add(leg);
  }
  const scopeHead = new THREE.Group(); scopeHead.position.y = 0.48;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.55, 10), brass);
  tube.rotation.x = -0.8; // inclinato verso l'alto
  scopeHead.add(tube); scope.add(scopeHead); boat.add(scope);

  // --- Tettoia a poppa: 4 pali e una tela a righe che si muove col vento
  const aw = { x: 0.42, z0: -1.0, z1: -0.3, h: 1.0 };
  for (const [x, z] of [[-aw.x, aw.z0], [aw.x, aw.z0], [-aw.x, aw.z1], [aw.x, aw.z1]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, aw.h, 5), MAT.wood);
    pole.position.set(x, deckY + aw.h / 2, z);
    boat.add(pole);
  }
  const clothGeo = new THREE.PlaneGeometry(aw.x * 2 + 0.12, aw.z1 - aw.z0 + 0.12, 6, 6);
  clothGeo.rotateX(-Math.PI / 2);
  const cols = AWNING_COLORS[Math.floor(rnd() * AWNING_COLORS.length)];
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: stripedFabric(cols), side: THREE.DoubleSide, roughness: 1 }));
  cloth.position.set(0, deckY + aw.h, (aw.z0 + aw.z1) / 2);
  boat.add(cloth);
  const clothPos = clothGeo.attributes.position, clothRest = clothPos.array.slice();

  // lanterna appesa al bordo della tettoia (luce finta: materiale luminoso, niente PointLight)
  const lanternPivot = new THREE.Group(); lanternPivot.position.set(0.2, deckY + aw.h - 0.02, aw.z1);
  const lanternBody = new THREE.Group(); lanternBody.position.y = -0.16;
  lanternBody.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 6), MAT.window));
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.04, 6), MAT.iron); lanternCap.position.y = 0.065;
  lanternBody.add(lanternCap);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 3), MAT.iron); hook.position.y = -0.06;
  lanternPivot.add(hook, lanternBody); boat.add(lanternPivot);

  // --- Oggetti personali: ogni navicella ne ha 5, scelti a caso tra 10.
  // Gli oggetti "da ponte" occupano uno dei posti liberi (così non si compenetrano);
  // gli altri si appendono alla tettoia o sporgono dal bordo.
  const SLOTS = [[-0.25, 0.15], [0.28, 0.35], [0.3, -0.02], [-0.27, -0.55], [0.26, -0.62], [-0.3, 0.48]];
  const DECK = ['tea', 'books', 'lemon', 'globe', 'rope', 'crates', 'barrel'];
  const options = ['tea', 'books', 'cage', 'lemon', 'globe', 'rope', 'crates', 'laundry', 'fishing', 'barrel'];
  const extras = [];
  for (let q = 0; q < 5; q++) extras.push(options.splice(Math.floor(rnd() * options.length), 1)[0]);
  const slots = SLOTS.slice().sort(() => rnd() - 0.5);
  const animated = []; // piccoli pendoli e oggetti che si muovono: aggiornati in update()
  const plainMat = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const woodBox = new THREE.MeshStandardMaterial({ map: woodPlanks(seed + 11, 4), roughness: 0.9 });

  for (const what of extras) {
    const at = DECK.includes(what) ? slots.pop() : null;
    const g = new THREE.Group();
    if (at) g.position.set(at[0], deckY, at[1]);

    if (what === 'tea') {
      // tavolino con teiera e due tazze
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), MAT.wood); top.position.y = 0.4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.4, 6), MAT.wood); leg.position.y = 0.2;
      const china = plainMat('#f1ece0', 0.4);
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), china); pot.scale.set(1, 0.85, 1); pot.position.set(0.03, 0.47, 0);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.08, 5), china); spout.position.set(0.1, 0.49, 0); spout.rotation.z = -0.9;
      g.add(top, leg, pot, spout);
      for (const [x, z] of [[-0.1, 0.08], [-0.08, -0.1]]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.04, 8), china); cup.position.set(x, 0.435, z); g.add(cup);
      }
    } else if (what === 'books') {
      ['#7a2e2a', '#2f4f6b', '#6b5a2a', '#3e5a3a'].forEach((col, q) => {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.15), plainMat(col));
        book.position.y = 0.025 + q * 0.05; book.rotation.y = (rnd() - 0.5) * 0.7; g.add(book);
      });
    } else if (what === 'lemon') {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 8), MAT.terracotta); pot.position.y = 0.1;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 5), MAT.wood); trunk.position.y = 0.35;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: '#3f6b2e', roughness: 0.9, flatShading: true }));
      crown.position.y = 0.58;
      g.add(pot, trunk, crown);
      for (let q = 0; q < 5; q++) {
        const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), plainMat('#e8c93a', 0.5));
        lemon.position.set(Math.cos(q * 1.3) * 0.17, 0.55 + (q % 2) * 0.08, Math.sin(q * 1.3) * 0.17); g.add(lemon);
      }
    } else if (what === 'globe') {
      // mappamondo su piedistallo: la sfera gira lentamente sul suo asse inclinato
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 10), MAT.wood); foot.position.y = 0.02;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5), brass); stem.position.y = 0.19;
      const axis = new THREE.Group(); axis.position.y = 0.42; axis.rotation.z = 0.41; // asse terrestre inclinato
      const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 4, 20, Math.PI * 1.4), brass); meridian.rotation.z = -0.7 * Math.PI;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ map: stripedFabric(['#3e6b7a', '#c9b48a', '#3e6b7a', '#7a9a5a']), roughness: 0.6 }));
      axis.add(meridian, ball); g.add(foot, stem, axis);
      animated.push((dt, tt) => { ball.rotation.y += dt * 0.4; });
    } else if (what === 'rope') {
      // rotolo di corda: anelli impilati
      for (let q = 0; q < 4; q++) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.13 - q * 0.012, 0.025, 6, 16), MAT.rope);
        coil.rotation.x = Math.PI / 2; coil.position.y = 0.025 + q * 0.045; g.add(coil);
      }
    } else if (what === 'crates') {
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.26), woodBox); c1.position.y = 0.12; c1.rotation.y = 0.2;
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.2), woodBox); c2.position.set(0.02, 0.33, 0.01); c2.rotation.y = -0.35;
      g.add(c1, c2);
    } else if (what === 'barrel') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), woodBox); barrel.position.y = 0.16;
      barrel.scale.set(1.08, 1, 1.08);
      g.add(barrel);
      for (const y of [0.05, 0.27]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.008, 4, 16), MAT.iron); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; g.add(hoop);
      }
    } else if (what === 'cage') {
      // gabbia con uccellino, appesa alla tettoia: un pendolo dentro una barca che dondola
      g.position.set(-0.22, deckY + aw.h - 0.02, (aw.z0 + aw.z1) / 2);
      const body2 = new THREE.Group(); body2.position.y = -0.3;
      const wire = new THREE.MeshStandardMaterial({ color: '#b08d48', wireframe: true });
      body2.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10, 1, true), wire));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), wire); dome.position.y = 0.11;
      const floor = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), brass); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.11;
      const bird = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), plainMat('#e0b43a', 0.6)); bird.position.y = -0.03; bird.scale.set(1, 1, 1.3);
      body2.add(dome, floor, bird);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.18, 3), MAT.iron); string.position.y = -0.09;
      g.add(string, body2);
      animated.push((dt, tt, wind) => { g.rotation.x = 0.1 * Math.sin(tt * 1.9 + 1); g.rotation.z = 0.15 * Math.sin(tt * 1.3) - 0.3 * wind; });
    } else if (what === 'laundry') {
      // filo con i panni stesi tra i due pali di prua della tettoia: ogni panno ondeggia per conto suo
      g.position.set(0, deckY + aw.h - 0.12, aw.z0); // tra i pali di poppa (a prua c'è la lanterna)
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, aw.x * 2, 3), MAT.rope); line.rotation.z = Math.PI / 2;
      g.add(line);
      const cloths = ['#c94f3d', '#e8dcc0', '#4a6f9a'];
      cloths.forEach((col, q) => {
        const pin = new THREE.Group(); pin.position.x = -0.25 + q * 0.25;
        const piece = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.22), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 1 }));
        piece.position.y = -0.11; pin.add(piece); g.add(pin);
        animated.push((dt, tt, wind) => { pin.rotation.x = 0.15 * Math.sin(tt * 2.3 + q * 1.7) + 0.6 * Math.abs(wind); });
      });
    } else if (what === 'fishing') {
      // canna da pesca che sporge dal fianco: il filo pende nel vuoto con un galleggiante
      const side = rnd() < 0.5 ? 1 : -1;
      g.position.set(side * hull.hw(0.35) * 0.9, hull.top(0.35) + 0.02, (0.35 * L) / 2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 1.3, 5), MAT.wood);
      rod.rotation.z = -side * 1.0; rod.position.set(side * 0.54, 0.36, 0);
      const tip = new THREE.Group(); tip.position.set(side * 1.08, 0.7, 0);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 1.6, 3), new THREE.MeshBasicMaterial({ color: '#d8d0c0' }));
      fl.position.y = -0.8;
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), plainMat('#c0392b', 0.5)); bob.position.y = -1.6;
      tip.add(fl, bob); g.add(rod, tip);
      animated.push((dt, tt, wind) => { tip.rotation.z = 0.08 * Math.sin(tt * 1.4) - 0.4 * wind; tip.rotation.x = 0.06 * Math.sin(tt * 1.1 + 2); });
    }
    boat.add(g);
  }

  // --- Aggiornamento
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), m = new THREE.Matrix4();
  let spin = 0, phase = rnd() * 10;
  return {
    name: 'navicella', bodies: [body], loads: nodes.map((node) => ({ node, weight: 50 })), object: root,
    update(dt, t) {
      const Pp = body.pos;
      // orientamento dai 4 anelli: X = larghezza, Z = lunghezza (verso prua), Y = verticale
      X.subVectors(Pp[b], Pp[a]).add(_v.subVectors(Pp[e], Pp[d])).normalize();
      Z.subVectors(Pp[d], Pp[a]).add(_v.subVectors(Pp[e], Pp[b])).normalize();
      Y.crossVectors(Z, X).normalize();
      Z.crossVectors(X, Y);
      root.quaternion.setFromRotationMatrix(m.makeBasis(X, Y, Z));
      root.position.set(0, 0, 0);
      for (const ci of corners) root.position.add(Pp[ci]);
      root.position.multiplyScalar(0.25);

      const tt = t + phase, wind = VerletBody.wind.x / 3.5; // -1..1
      // elica: gira piano sempre, più forte col vento
      spin += dt * (0.6 + 9 * Math.abs(wind));
      hub.rotation.z = spin;
      // pinne: un lento battito, che si apre col vento
      for (const f of fins) f.pivot.rotation.z = f.side * (0.12 + 0.06 * Math.sin(tt * 1.1) + 0.25 * Math.abs(wind));
      // cannocchiale: scruta lentamente il cielo
      scopeHead.rotation.y = 0.7 * Math.sin(tt * 0.12);
      // tettoia: la tela si gonfia e ondeggia (di più col vento)
      const g = 1 + 3 * Math.abs(wind);
      for (let q = 0; q < clothPos.count; q++) {
        const x = clothRest[q * 3], z = clothRest[q * 3 + 2];
        clothPos.array[q * 3 + 1] = -0.05 * (1 - (x / (aw.x + 0.06)) ** 2) + 0.015 * g * Math.sin(tt * 3 * g + x * 6 + z * 9);
      }
      clothPos.needsUpdate = true;
      // lanterna e gabbia: piccoli pendoli
      lanternPivot.rotation.x = 0.12 * Math.sin(tt * 2.2) + 0.3 * wind;
      lanternPivot.rotation.z = 0.08 * Math.sin(tt * 1.7);
      for (const f of animated) f(dt, tt, wind);
    },
  };
}

// ===============================================================
// GIRARROSTO A CONTRAPPESO: il meccanismo delle cucine di una volta.
//
//   peso che scende → la corda si srotola dal TAMBURO → il tamburo fa girare
//   l'INGRANAGGIO piccolo → che fa girare l'INGRANAGGIO dello SPIEDO
//
// È un'animazione gerarchica "cinematica": ogni pezzo è calcolato dal
// precedente con il suo rapporto (angolo tamburo = corda srotolata / raggio,
// angolo spiedo = angolo tamburo × raggio piccolo / raggio grande).
// Quando il peso arriva in fondo, si ricarica in 2 secondi.
//
// Sotto c'è un braciere con le braci che pulsano, e il fumo (un piccolo
// sistema di particelle) sale verso la rete e si piega col vento.
// ===============================================================
function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function roaster(net, { i, j, length = 1.5, seed = 1 }) {
  let rs = seed * 7919 + 3;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const { body, idx, n } = simpleRope(net, i, j, length, 3);

  const root = new THREE.Group(); root.name = 'girarrosto';
  const iron = MAT.iron;
  const RIM = -0.6, R = 0.33;              // altezza e raggio del bordo del braciere

  // tre catene dal gancio al bordo del braciere
  root.add(strings(R, RIM));
  // braciere: una ciotola di ferro (Lathe)
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.04, -0.86], [0.24, -0.81], [0.32, -0.68], [R, RIM]].map(([r, y]) => new THREE.Vector2(r, y)), 14),
    new THREE.MeshStandardMaterial({ color: '#2d2b29', metalness: 0.6, roughness: 0.6, side: THREE.DoubleSide }));
  root.add(bowl);
  // braci: pezzetti luminosi che pulsano (il materiale è condiviso, così cambio un valore solo)
  const emberMat = new THREE.MeshStandardMaterial({ color: '#3a1a0a', emissive: '#ff5a12', emissiveIntensity: 1.6, flatShading: true });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.27, 14), new THREE.MeshStandardMaterial({ color: '#1a0a04', emissive: '#ff7a2a', emissiveIntensity: 0.9 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.71;
  root.add(glow);
  for (let q = 0; q < 14; q++) {
    const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035 + rnd() * 0.03, 0), emberMat);
    const a = rnd() * Math.PI * 2, r = rnd() * 0.22;
    e.position.set(Math.cos(a) * r, -0.69 + rnd() * 0.03, Math.sin(a) * r);
    e.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    root.add(e);
  }
  // due montanti con la forcella che regge lo spiedo
  const SPIT_Y = -0.3;
  for (const x of [-R, R]) {
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, RIM - SPIT_Y + 0.04, 5), iron);
    up.position.set(x, (RIM + SPIT_Y) / 2, 0);
    const fork = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 4, 8, Math.PI), iron);
    fork.position.set(x, SPIT_Y - 0.01, 0); fork.rotation.set(0, Math.PI / 2, Math.PI);
    root.add(up, fork);
  }

  // --- LO SPIEDO (ruota attorno all'asse X): asta, pollo, spiedini, ingranaggio grande
  const spit = new THREE.Group(); spit.position.y = SPIT_Y;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.95, 5), iron); rod.rotation.z = Math.PI / 2;
  spit.add(rod);
  const roast = new THREE.MeshStandardMaterial({ color: '#8a4a22', roughness: 0.55, flatShading: true });
  const chicken = new THREE.Group(); chicken.position.x = -0.1;
  const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), roast); torso.scale.set(0.15, 0.1, 0.11);
  chicken.add(torso);
  for (const z of [-0.06, 0.06]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.08, 2, 6), roast);
    leg.position.set(0.12, -0.03, z); leg.rotation.z = 1.2; chicken.add(leg);
  }
  spit.add(chicken);
  const veg = [plainColor('#b8332c'), plainColor('#e8dcc0'), plainColor('#4f7a2e')];
  for (let q = 0; q < 5; q++) {
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), veg[q % 3]);
    chunk.position.x = 0.12 + q * 0.045; chunk.rotation.set(q, q * 0.7, 0); spit.add(chunk);
  }
  // ingranaggio grande, solidale con lo spiedo
  const BIG = 0.075, SMALL = 0.04;
  const bigGear = gear(BIG, 14, iron); bigGear.position.x = 0.44; spit.add(bigGear);
  root.add(spit);

  // --- LA TRASMISSIONE: ingranaggio piccolo + tamburo sullo stesso asse, sotto quello grande
  const drive = new THREE.Group(); drive.position.set(0.44, SPIT_Y - BIG - SMALL - 0.005, 0);
  const smallGear = gear(SMALL, 8, iron);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10), MAT.wood);
  drum.rotation.z = Math.PI / 2; drum.position.x = 0.06;
  drive.add(smallGear, drum);
  root.add(drive);
  // supporto dell'asse della trasmissione
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.02, drive.position.y - RIM, 0.02), iron);
  bracket.position.set(0.55, (RIM + drive.position.y) / 2, 0); root.add(bracket);

  // --- IL CONTRAPPESO: una pietra legata a una corda che si srotola dal tamburo
  const DRUM_R = 0.035, TOP = drive.position.y - 0.05, BOTTOM = -1.7;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 3), MAT.rope);
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: '#6d6861', roughness: 1, flatShading: true }));
  root.add(cord, stone);
  // la corda scende tangente al tamburo (che ruota attorno a X): esce dal suo bordo in Z
  const cordX = 0.5, cordZ = DRUM_R;

  // --- IL FUMO: particelle nel sistema del MONDO (salgono sempre verso l'alto, anche se il braciere dondola)
  const N = 36;
  const smokePos = new Float32Array(N * 3), smokeCol = new Float32Array(N * 3);
  const parts = Array.from({ length: N }, (_, q) => ({ age: (q / N) * 4, life: 4, v: new THREE.Vector3() }));
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute('color', new THREE.BufferAttribute(smokeCol, 3));
  const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ size: 0.45, map: smokeTexture(), vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
  smoke.frustumCulled = false;
  const dark = new THREE.Color('#4a4642'), sky = new THREE.Color('#9fb0bf'), col = new THREE.Color();
  const holder = new THREE.Group(); holder.add(root, smoke);
  const source = new THREE.Vector3(0, -0.6, 0), tmp = new THREE.Vector3();

  let tLoad = rnd() * 30; // dove si trova il peso nel suo ciclo
  return {
    name: 'girarrosto', bodies: [body], loads: [{ node: n, weight: 60 }], object: holder,
    update(dt, t) {
      hangAlong(root, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]]);
      root.updateMatrixWorld(true);

      // ciclo del contrappeso: 30 s di discesa, 2 s di ricarica
      tLoad = (tLoad + dt) % 32;
      const u = tLoad < 30 ? tLoad / 30 : 1 - (tLoad - 30) / 2;
      const wy = TOP - 0.15 + (BOTTOM - TOP + 0.15) * u;          // altezza della pietra
      const unwound = TOP - wy;                                     // corda srotolata
      const drumAngle = unwound / DRUM_R;                           // angolo = arco / raggio
      drive.rotation.x = drumAngle;
      spit.rotation.x = -drumAngle * (SMALL / BIG);                 // rapporto di trasmissione
      stone.position.set(cordX, wy - 0.06, cordZ); stone.rotation.y = drumAngle * 0.05;
      cord.position.set(cordX, (TOP + wy) / 2, cordZ); cord.scale.y = Math.max(0.01, TOP - wy);

      // braci che respirano
      emberMat.emissiveIntensity = 1.4 + 0.35 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + seed) + 0.15 * Math.sin(t * 11);

      // fumo: nasce sulle braci, sale, si allarga, si piega col vento e sfuma nel cielo
      for (let q = 0; q < N; q++) {
        const p = parts[q];
        p.age += dt;
        if (p.age >= p.life) {
          p.age = 0;
          tmp.copy(source).applyMatrix4(root.matrixWorld);
          smokePos.set([tmp.x + (rnd() - 0.5) * 0.15, tmp.y, tmp.z + (rnd() - 0.5) * 0.15], q * 3);
          p.v.set((rnd() - 0.5) * 0.08, 0.35 + rnd() * 0.15, (rnd() - 0.5) * 0.08);
        }
        smokePos[q * 3] += (p.v.x + VerletBody.wind.x * 0.25) * dt;
        smokePos[q * 3 + 1] += p.v.y * dt;
        smokePos[q * 3 + 2] += p.v.z * dt;
        col.copy(dark).lerp(sky, Math.min(1, p.age / p.life));
        smokeCol.set([col.r, col.g, col.b], q * 3);
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.attributes.color.needsUpdate = true;
    },
  };
}

// Un materiale semplice di un colore
function plainColor(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true }); }

// Un ingranaggio: un disco con i denti (ruota attorno all'asse X)
function gear(radius, teeth, material) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.015, teeth * 2), material);
  disc.rotation.z = Math.PI / 2; g.add(disc);
  const toothGeo = new THREE.BoxGeometry(0.015, 0.018, 0.014);
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    const tooth = new THREE.Mesh(toothGeo, material);
    tooth.position.set(0, Math.cos(a) * (radius + 0.007), Math.sin(a) * (radius + 0.007));
    tooth.rotation.x = -a;
    g.add(tooth);
  }
  return g;
}


// ===============================================================
// FILO DA BUCATO: una fune tesa tra due nodi della rete, con i panni stesi.
//
// - il FILO è una catena Verlet che si incurva al centro
// - le GRUCCE sono triangoli rigidi agganciati a una particella del filo: dondolano
// - i capi senza gruccia sono pinzati al filo con le MOLLETTE
// - ogni capo è STOFFA SIMULATA (griglia di particelle) e la sua SAGOMA è DISEGNATA
//   su un canvas: colletto, maniche, bottoni, tasche, orli. La griglia segue il
//   disegno (le celle completamente vuote vengono tolte) e la trasparenza della
//   texture (alphaTest) ritaglia il contorno preciso, senza scalini.
// ===============================================================

const PALETTE = ['#e8dcc0', '#c9d6df', '#a8352c', '#3f6f73', '#d9a43a', '#4a5f86', '#5a2e2a', '#7a9a5a', '#d9b7a0', '#2f2f35', '#8a6d9a', '#c46a3c'];
const CELL = 0.07; // lato della cella di stoffa, in metri

// --- piccoli strumenti di disegno (coordinate in metri, y verso il basso) ---
function poly(g, pts, fresh = true) { if (fresh) g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); }
function stroke(g, pts, width, color, closed = false) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
  if (closed) g.closePath();
  g.lineWidth = width; g.strokeStyle = color; g.stroke();
}
function seam(g, pts, color = 'rgba(0,0,0,0.35)') { g.setLineDash([0.012, 0.008]); stroke(g, pts, 0.004, color); g.setLineDash([]); }
function buttons(g, x, y0, y1, n, color = '#ece6d6') {
  for (let k = 0; k < n; k++) { g.beginPath(); g.arc(x, y0 + ((y1 - y0) * k) / (n - 1), 0.009, 0, Math.PI * 2); g.fillStyle = color; g.fill(); }
}
// riempie la sagoma corrente (già usata come clip) con la stoffa scelta
function fillFabric(g, W, H, fab) {
  g.fillStyle = fab.a; g.fillRect(0, 0, W, H);
  if (fab.kind === 'stripes') {
    g.fillStyle = fab.b; for (let x = 0; x < W; x += fab.size * 2) g.fillRect(x, 0, fab.size, H);
  } else if (fab.kind === 'checks') {
    g.globalAlpha = 0.5; g.fillStyle = fab.b;
    for (let x = 0; x < W; x += fab.size * 2) g.fillRect(x, 0, fab.size, H);
    for (let y = 0; y < H; y += fab.size * 2) g.fillRect(0, y, W, fab.size);
    g.globalAlpha = 1;
  } else if (fab.kind === 'dots') {
    g.fillStyle = fab.b;
    for (let y = 0.02; y < H; y += fab.size) for (let x = ((y / fab.size) % 2) * fab.size * 0.5; x < W; x += fab.size) { g.beginPath(); g.arc(x, y, fab.size * 0.18, 0, Math.PI * 2); g.fill(); }
  }
  // trama del tessuto e un po' di sporco/usura
  g.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < H; y += 0.006) g.fillRect(0, y, W, 0.002);
}

// Ogni capo: dimensioni (W × H metri), come si appende, dove sono le mollette
// (frazioni della larghezza) e due funzioni di disegno: la sagoma e i dettagli.
const GARMENTS = {
  // Sulle grucce le spalle del capo arrivano alle punte della gruccia (half = metà larghezza)
  // e le maniche pendono dritte lungo i fianchi, come succede davvero.
  shirt: { // camicia a maniche lunghe
    W: 0.5, H: 0.8, mount: 'hanger', half: 0.24, fabrics: ['plain', 'stripes', 'checks'],
    shape: (g) => poly(g, [[0.18, 0], [0.0, 0.03], [0.0, 0.62], [0.085, 0.63], [0.09, 0.2], [0.105, 0.2], [0.105, 0.76], [0.25, 0.79],
      [0.395, 0.76], [0.395, 0.2], [0.41, 0.2], [0.415, 0.63], [0.5, 0.62], [0.5, 0.03], [0.32, 0], [0.25, 0.045]]),
    details: (g, fab) => {
      poly(g, [[0.18, 0], [0.25, 0.045], [0.32, 0], [0.34, 0.05], [0.26, 0.09], [0.24, 0.09], [0.16, 0.05]]); g.fillStyle = fab.trim; g.fill(); // colletto
      stroke(g, [[0.25, 0.06], [0.25, 0.78]], 0.004, 'rgba(0,0,0,0.3)');
      buttons(g, 0.262, 0.12, 0.7, 6);
      stroke(g, [[0.13, 0.17], [0.2, 0.17], [0.2, 0.25], [0.165, 0.27], [0.13, 0.25]], 0.004, 'rgba(0,0,0,0.35)', true); // taschino
      seam(g, [[0.0, 0.56], [0.087, 0.57]]); seam(g, [[0.5, 0.56], [0.413, 0.57]]); // polsini
      seam(g, [[0.09, 0.03], [0.095, 0.2]]); seam(g, [[0.41, 0.03], [0.405, 0.2]]);
      seam(g, [[0.105, 0.74], [0.25, 0.77], [0.395, 0.74]]);
    },
  },
  tshirt: { // maglietta a maniche corte
    W: 0.5, H: 0.66, mount: 'hanger', half: 0.24, fabrics: ['plain', 'stripes', 'dots'],
    shape: (g) => poly(g, [[0.18, 0], [0.0, 0.035], [0.0, 0.25], [0.08, 0.25], [0.095, 0.18], [0.095, 0.66], [0.405, 0.66],
      [0.405, 0.18], [0.42, 0.25], [0.5, 0.25], [0.5, 0.035], [0.32, 0], [0.25, 0.06]]),
    details: (g, fab) => {
      stroke(g, [[0.18, 0.005], [0.21, 0.045], [0.25, 0.062], [0.29, 0.045], [0.32, 0.005]], 0.016, fab.trim); // girocollo
      seam(g, [[0.0, 0.23], [0.082, 0.23]]); seam(g, [[0.5, 0.23], [0.418, 0.23]]);
      seam(g, [[0.09, 0.03], [0.095, 0.18]]); seam(g, [[0.41, 0.03], [0.405, 0.18]]);
      seam(g, [[0.095, 0.64], [0.405, 0.64]]);
    },
  },
  coat: { // cappotto lungo con revers, due file di bottoni e tasche
    W: 0.56, H: 1.05, mount: 'hanger', half: 0.27, fabrics: ['plain', 'plain', 'checks'],
    shape: (g) => poly(g, [[0.2, 0], [0, 0.035], [0, 0.7], [0.09, 0.71], [0.1, 0.22], [0.115, 0.22], [0.1, 1.05], [0.46, 1.05],
      [0.445, 0.22], [0.46, 0.22], [0.47, 0.71], [0.56, 0.7], [0.56, 0.035], [0.36, 0], [0.28, 0.1]]),
    details: (g, fab) => {
      poly(g, [[0.2, 0], [0.28, 0.1], [0.36, 0], [0.39, 0.08], [0.32, 0.3], [0.28, 0.34], [0.24, 0.3], [0.17, 0.08]]); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fill(); // revers
      stroke(g, [[0.28, 0.34], [0.28, 1.04]], 0.004, 'rgba(0,0,0,0.4)');
      buttons(g, 0.235, 0.4, 0.7, 3, fab.trim); buttons(g, 0.325, 0.4, 0.7, 3, fab.trim);
      for (const x of [0.13, 0.33]) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 0.68, 0.1, 0.035); } // patte delle tasche
      seam(g, [[0.0, 0.62], [0.092, 0.63]]); seam(g, [[0.56, 0.62], [0.468, 0.63]]);
      seam(g, [[0.1, 0.035], [0.105, 0.22]]); seam(g, [[0.46, 0.035], [0.455, 0.22]]);
      seam(g, [[0.1, 1.02], [0.46, 1.02]]);
    },
  },
  dress: { // vestito con spalline, vita stretta e gonna svasata con l'orlo a onde
    W: 0.62, H: 1.0, mount: 'hanger', half: 0.16, fabrics: ['plain', 'dots', 'stripes'],
    shape: (g) => {
      g.beginPath(); g.moveTo(0.19, 0); g.lineTo(0.22, 0); g.lineTo(0.24, 0.12); g.lineTo(0.38, 0.12); g.lineTo(0.4, 0); g.lineTo(0.43, 0);
      g.lineTo(0.45, 0.14); g.quadraticCurveTo(0.47, 0.26, 0.43, 0.38); g.quadraticCurveTo(0.56, 0.7, 0.62, 0.96);
      for (let k = 0; k < 6; k++) { const x = 0.62 - (k + 1) * (0.62 / 6); g.quadraticCurveTo(x + 0.05, 1.03, x, 0.96); }
      g.quadraticCurveTo(0.06, 0.7, 0.19, 0.38); g.quadraticCurveTo(0.15, 0.26, 0.17, 0.14); g.closePath();
    },
    details: (g, fab) => {
      g.fillStyle = fab.trim; g.fillRect(0.18, 0.36, 0.26, 0.035); // cintura
      seam(g, [[0.31, 0.4], [0.31, 0.95]], 'rgba(0,0,0,0.15)');
      seam(g, [[0.25, 0.4], [0.18, 0.93]], 'rgba(0,0,0,0.15)'); seam(g, [[0.37, 0.4], [0.44, 0.93]], 'rgba(0,0,0,0.15)');
    },
  },
  trousers: { // pantaloni appesi per la vita: cintura con passanti, patta, due gambe
    W: 0.44, H: 0.95, mount: 'pegs', pegs: [0.04, 0.5, 0.96], fabrics: ['plain', 'plain', 'stripes'],
    shape: (g) => poly(g, [[0, 0], [0.44, 0], [0.43, 0.3], [0.41, 0.95], [0.245, 0.95], [0.225, 0.32], [0.215, 0.32], [0.195, 0.95], [0.03, 0.95], [0.01, 0.3]]),
    details: (g, fab) => {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 0.44, 0.06); // cintura
      for (const x of [0.06, 0.16, 0.27, 0.37]) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 0.012, 0.07); }
      seam(g, [[0.22, 0.06], [0.22, 0.24]]); seam(g, [[0.255, 0.06], [0.255, 0.22], [0.225, 0.26]]);
      seam(g, [[0.03, 0.08], [0.1, 0.16]]); seam(g, [[0.41, 0.08], [0.34, 0.16]]); // tasche
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0.03, 0.89, 0.165, 0.06); g.fillRect(0.245, 0.89, 0.165, 0.06); // risvolti
    },
  },
  towel: { // asciugamano con due bande e le frange
    W: 0.5, H: 0.72, mount: 'pegs', pegs: [0.05, 0.95], fabrics: ['plain'],
    shape: (g) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(0.5, 0); g.lineTo(0.5, 0.68); for (let x = 0.5; x > 0; x -= 0.025) { g.lineTo(x - 0.006, 0.72); g.lineTo(x - 0.012, 0.68); } g.lineTo(0, 0.68); g.closePath(); },
    details: (g, fab) => {
      g.fillStyle = fab.b; g.fillRect(0, 0.08, 0.5, 0.04); g.fillRect(0, 0.56, 0.5, 0.04);
      g.fillStyle = fab.trim; g.fillRect(0, 0.13, 0.5, 0.012); g.fillRect(0, 0.54, 0.5, 0.012);
    },
  },
  sheet: { // lenzuolo grande con orlo ricamato e bordo a smerlo
    W: 0.96, H: 0.86, mount: 'pegs', pegs: [0.03, 0.5, 0.97], fabrics: ['sheet'],
    shape: (g) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(0.96, 0); g.lineTo(0.96, 0.82); for (let k = 0; k < 12; k++) { const x = 0.96 - (k + 1) * 0.08; g.quadraticCurveTo(x + 0.04, 0.88, x, 0.82); } g.closePath(); },
    details: (g, fab) => {
      seam(g, [[0, 0.1], [0.96, 0.1]], fab.trim); seam(g, [[0, 0.13], [0.96, 0.13]], fab.trim);
      for (let x = 0.04; x < 0.96; x += 0.08) { g.beginPath(); g.arc(x, 0.115, 0.01, 0, Math.PI * 2); g.fillStyle = fab.trim; g.fill(); } // ricamo
      seam(g, [[0, 0.79], [0.96, 0.79]], 'rgba(0,0,0,0.2)');
    },
  },
  socks: { // un paio di calzini, con tallone e punta di un altro colore
    W: 0.34, H: 0.44, mount: 'pegs', pegs: [0.08, 0.38, 0.62, 0.92], fabrics: ['plain', 'stripes'],
    shape: (g) => {
      g.beginPath(); // due sagome nello stesso tracciato
      for (const x0 of [0, 0.19]) poly(g, [[x0, 0], [x0 + 0.13, 0], [x0 + 0.13, 0.3], [x0 + 0.15, 0.38], [x0 + 0.13, 0.44], [x0 + 0.06, 0.43], [x0 + 0.01, 0.36], [x0, 0.3]], false);
    },
    details: (g, fab) => {
      for (const x0 of [0, 0.19]) {
        g.fillStyle = fab.trim; g.fillRect(x0, 0, 0.13, 0.04); // elastico
        g.beginPath(); g.arc(x0 + 0.02, 0.37, 0.045, 0, Math.PI * 2); g.fill(); // tallone
        g.beginPath(); g.arc(x0 + 0.13, 0.41, 0.04, 0, Math.PI * 2); g.fill(); // punta
      }
    },
  },
};

// sceglie colori e motivo di un capo (tutti diversi grazie al generatore casuale)
function pickFabric(type, rnd) {
  const pick = () => PALETTE[Math.floor(rnd() * PALETTE.length)];
  const def = GARMENTS[type];
  const kind = def.fabrics[Math.floor(rnd() * def.fabrics.length)];
  let a = pick(), b = pick(); while (b === a) b = pick();
  if (kind === 'sheet') return { kind: 'plain', a: rnd() < 0.6 ? '#ece6d6' : '#d7e1e6', b: '#ffffff', trim: pick(), size: 0.05 };
  return { kind, a, b: kind === 'stripes' && rnd() < 0.5 ? '#ece6d6' : b, trim: rnd() < 0.5 ? b : '#ece6d6', size: 0.02 + rnd() * 0.03 };
}

// disegna la texture del capo e ne ricava la "maschera" della griglia
function drawGarment(type, fab) {
  const def = GARMENTS[type], PX = 320; // pixel per metro
  const w = Math.ceil(def.W * PX), h = Math.ceil(def.H * PX);
  const tex = canvasTexture(w, h, (g) => {
    g.scale(PX, PX);
    def.shape(g);
    g.save(); g.clip(); fillFabric(g, def.W, def.H, fab); def.details(g, fab); g.restore();
    // un'ombra leggera lungo il bordo dà spessore alla stoffa
    def.shape(g); g.lineWidth = 0.006; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const data = tex.image.getContext('2d').getImageData(0, 0, w, h).data;
  // una cella ha stoffa se almeno un pixel al suo interno è opaco
  const cols = Math.round(def.W / CELL) + 1, rows = Math.round(def.H / CELL) + 1;
  const covered = (r, c) => {
    const x0 = Math.floor((c / (cols - 1)) * w), x1 = Math.ceil(((c + 1) / (cols - 1)) * w);
    const y0 = Math.floor((r / (rows - 1)) * h), y1 = Math.ceil(((r + 1) / (rows - 1)) * h);
    for (let y = y0; y < Math.min(y1, h); y += 2) for (let x = x0; x < Math.min(x1, w); x += 2) if (data[(y * w + x) * 4 + 3] > 100) return true;
    return false;
  };
  return { tex, cols, rows, covered };
}

// Un capo di stoffa. origin: punto in alto al centro; axis: direzione del filo.
// yOff(x): abbassamento della riga in alto (le spalle della gruccia sono inclinate)
// pinFor(c, x) restituisce la funzione-perno della particella in alto alla colonna c (o null)
function garmentCloth(type, fab, origin, axis, yOff, pinFor) {
  const def = GARMENTS[type];
  const { tex, cols, rows, covered } = drawGarment(type, fab);
  const cellOn = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) cellOn[r * cols + c] = covered(r, c);
  const on = (r, c) => r >= 0 && c >= 0 && r < rows - 1 && c < cols - 1 && cellOn[r * cols + c];

  const body = new VerletBody({ damping: 0.985, iterations: 5, windScale: 1.8 });
  const id = new Array(rows * cols).fill(-1), uv = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!(on(r, c) || on(r - 1, c) || on(r, c - 1) || on(r - 1, c - 1))) continue; // particella solo se tocca stoffa
    const x = (c / (cols - 1) - 0.5) * def.W, y = (r / (rows - 1)) * def.H;
    const p = origin.clone().addScaledVector(axis, x); p.y -= y + yOff(x);
    id[r * cols + c] = body.addParticle(p, r === 0 ? pinFor(c, x) : null);
    uv.push(c / (cols - 1), 1 - r / (rows - 1));
  }
  const P = (r, c) => (r >= 0 && c >= 0 && r < rows && c < cols ? id[r * cols + c] : -1);
  const link = (a, b, rigid = false) => { if (a >= 0 && b >= 0) body.addConstraint(a, b, { visible: false, rigid }); };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = P(r, c);
    if (a < 0) continue;
    // trama: RIGIDA (resiste anche a essere compressa), così la stoffa non si accartoccia
    // in larghezza sotto il proprio peso e la gonna resta svasata
    if (on(r, c) || on(r - 1, c)) link(a, P(r, c + 1), true);
    if (on(r, c) || on(r, c - 1)) link(a, P(r + 1, c));          // ordito
    if (on(r, c)) { link(a, P(r + 1, c + 1)); link(P(r, c + 1), P(r + 1, c)); } // taglio
    if (on(r, c) && on(r + 1, c)) link(a, P(r + 2, c));          // piega: resiste un po' al piegarsi
    if (on(r, c) && on(r, c + 1)) link(a, P(r, c + 2));
  }
  const index = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    if (!on(r, c)) continue;
    const k = P(r, c), b = P(r, c + 1), d = P(r + 1, c), e = P(r + 1, c + 1);
    index.push(k, d, b, b, d, e);
  }
  const n = body.pos.length, pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }));
  mesh.frustumCulled = false;
  return {
    body, mesh,
    update() {
      for (let k = 0; k < n; k++) { const p = body.pos[k]; pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

export function clothesline(net, { i1, j1, i2, j2, drop = 0.7, sag = 1.012, seed = 1 }) {
  let rs = seed * 4513 + 11;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const nA = net.index(i1, j1), nB = net.index(i2, j2);
  const A = nodePos(net, nA), B = nodePos(net, nB);
  const axis = new THREE.Vector3().subVectors(B, A).setY(0).normalize();
  // molte iterazioni: una catena lunga di particelle, con poche, si allungherebbe sotto il suo peso
  const body = new VerletBody({ damping: 0.99, iterations: 40 });

  // due funi corte dai nodi della rete, poi il filo vero e proprio (N particelle)
  const pinA = body.addParticle(A, netPin(net, nA)), pinB = body.addParticle(B, netPin(net, nB));
  const N = 20, line = [];
  // i due capi del filo sono FISSI sotto i nodi: se pendessero liberi si avvicinerebbero
  // tra loro e il filo si affloscerebbe troppo
  const down = new THREE.Vector3(0, -drop, 0);
  for (let k = 0; k < N; k++) {
    const p = new THREE.Vector3().lerpVectors(A, B, k / (N - 1)); p.y -= drop;
    const pin = k === 0 ? netPin(net, nA, down) : k === N - 1 ? netPin(net, nB, down) : null;
    line.push(body.addParticle(p, pin));
  }
  body.addConstraint(pinA, line[0], { len: drop });
  body.addConstraint(pinB, line[N - 1], { len: drop });
  const seg = (A.distanceTo(B) * sag) / (N - 1);
  for (let k = 1; k < N; k++) body.addConstraint(line[k - 1], line[k], { len: seg });
  const lineLen = A.distanceTo(B);

  // un punto sul filo a frazione t (0..1), interpolando tra le due particelle vicine
  const lineAt = (t) => {
    const v = new THREE.Vector3(), f = Math.min(N - 1.001, Math.max(0, t * (N - 1)));
    const k = Math.floor(f), u = f - k;
    return () => v.lerpVectors(body.pos[line[k]], body.pos[line[k + 1]], u);
  };

  const holder = new THREE.Group(); holder.name = 'filo da bucato';
  const garments = [], hangers = [], pegs = [];
  const pegGeo = new THREE.BoxGeometry(0.018, 0.07, 0.03);
  const pegMat = new THREE.MeshStandardMaterial({ color: '#c8a46e', roughness: 0.8 });

  // riempio il filo con capi scelti a caso, uno accanto all'altro, senza ripetere il precedente
  const types = Object.keys(GARMENTS);
  let x = 0.3, last = null; // metri dal capo sinistro del filo
  while (true) {
    let type; do type = types[Math.floor(rnd() * types.length)]; while (type === last);
    const def = GARMENTS[type];
    if (x + def.W > lineLen - 0.3) { if (def.W > 0.5) { last = type; continue; } break; } // prova un capo più piccolo
    last = type;
    const fab = pickFabric(type, rnd);
    const center = x + def.W / 2, tc = center / lineLen;

    if (def.mount === 'hanger') {
      // gruccia: due "spalle" legate in modo rigido alla particella del filo e tra loro
      const k = Math.round(tc * (N - 1)), hook = line[k];
      const half = def.half, hy = 0.15, rise = 0.05; // metà larghezza, distanza dal gancio, curva delle spalle
      const sL = body.addParticle(body.pos[hook].clone().addScaledVector(axis, -half).setY(body.pos[hook].y - hy));
      const sR = body.addParticle(body.pos[hook].clone().addScaledVector(axis, half).setY(body.pos[hook].y - hy));
      for (const [a, b] of [[hook, sL], [hook, sR], [sL, sR]]) body.addConstraint(a, b, { rigid: true, visible: false });
      // il punto centrale della gruccia, più in alto delle spalle
      const C = new THREE.Vector3();
      const top = () => C.lerpVectors(body.pos[sL], body.pos[sR], 0.5).addScaledVector(_w.subVectors(body.pos[hook], C).normalize(), rise);
      const pinFor = (c, px) => {
        if (Math.abs(px) > half) return null;
        const v = new THREE.Vector3(), ctr = new THREE.Vector3(), t = Math.abs(px) / half;
        return () => v.lerpVectors(ctr.copy(top()), body.pos[px < 0 ? sL : sR], t);
      };
      const origin = body.pos[hook].clone(); origin.y -= hy - rise;
      const g = garmentCloth(type, fab, origin, axis, (px) => (Math.min(Math.abs(px), half) / half) * rise + Math.max(0, Math.abs(px) - half) * 0.3, pinFor);
      garments.push(g); holder.add(g.mesh);
      const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), MAT.wood);
      const barR = barL.clone();
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), MAT.iron);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 4, 8, Math.PI * 1.4), MAT.iron);
      holder.add(barL, barR, wire, ring);
      hangers.push({ hook, sL, sR, top, barL, barR, wire, ring });
    } else {
      // mollette: alcune particelle in alto seguono il filo nel punto corrispondente
      const cols = Math.round(def.W / CELL) + 1;
      const pegCols = def.pegs.map((f) => Math.round(f * (cols - 1)));
      const pinFor = (c, px) => (pegCols.includes(c) ? lineAt((center + px) / lineLen) : null);
      const g = garmentCloth(type, fab, lineAt(tc)().clone().setY(A.y - drop - 0.01), axis, () => 0, pinFor);
      garments.push(g); holder.add(g.mesh);
      for (const c of pegCols) {
        const peg = new THREE.Mesh(pegGeo, pegMat);
        holder.add(peg);
        pegs.push({ peg, at: lineAt((center + (c / (cols - 1) - 0.5) * def.W) / lineLen) });
      }
    }
    x += def.W + 0.1 + rnd() * 0.15;
  }

  const m = new THREE.Vector3();
  const place = (mesh, p, q, extra = 0) => {
    mesh.position.lerpVectors(p, q, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, _v.subVectors(q, p).normalize());
    mesh.scale.y = p.distanceTo(q) + extra;
  };
  return {
    name: 'filo da bucato', bodies: [body, ...garments.map((g) => g.body)],
    loads: [{ node: nA, weight: 25 }, { node: nB, weight: 25 }], object: holder,
    update() {
      for (const g of garments) g.update();
      for (const h of hangers) {
        m.copy(h.top());
        place(h.barL, m, body.pos[h.sL], 0.03);
        place(h.barR, m, body.pos[h.sR], 0.03);
        place(h.wire, body.pos[h.hook], m);
        h.ring.position.copy(body.pos[h.hook]); h.ring.position.y += 0.012;
      }
      for (const p of pegs) { p.peg.position.copy(p.at()); p.peg.position.y -= 0.012; }
    },
  };
}

// ===============================================================
// DOCCIA A SECCHIO BASCULANTE: una doccia che funziona da sola.
//
//   l'IMBUTO di tela in alto raccoglie le gocce che colano dalla rete
//   → gocciolano nel SECCHIO, che si riempie piano piano
//   → quando è pieno il peso dell'acqua lo fa RIBALTARE sul suo perno
//   → l'acqua cade nell'imbuto di rame → scende nel tubo → esce dal SOFFIONE
//   → il CONTRAPPESO riporta il secchio dritto (oscillazione smorzata) e si ricomincia
//
// Il ribaltamento è una piccola simulazione dell'angolo del secchio
// (accelerazione angolare = coppia del peso; al ritorno molla + attrito).
// L'acqua è un sistema di particelle: gocce che cadono con la gravità,
// si piegano col vento, rimbalzano sulla pedana di listelli o passano
// tra i listelli e finiscono nell'abisso.
// La tenda è stoffa simulata, appesa con gli anellini all'anello di ferro.
//
//   rete ──funi──▶ ANELLO (triangolo rigido + pedana sotto: un unico corpo rigido)
//                    ├── imbuto di tela, secchio sul perno, imbuto di rame, tubo, soffione
//                    ├── tenda (stoffa) e anellini
//                    └── catene ──▶ PEDANA
// ===============================================================
const CURTAIN_COLORS = [['#e8dcc0', '#3f6f73'], ['#f0e6d2', '#a8352c'], ['#dfe8ea', '#4a5f86'], ['#efe2c6', '#7a9a5a']];

function curtainTexture(rnd) {
  const [base, ink] = CURTAIN_COLORS[Math.floor(rnd() * CURTAIN_COLORS.length)];
  const kind = ['stripes', 'waves', 'fish', 'checks'][Math.floor(rnd() * 4)];
  const tex = canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = ink; g.strokeStyle = ink;
    if (kind === 'stripes') {
      for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 18, h);
    } else if (kind === 'waves') {
      g.lineWidth = 3;
      for (let y = 30; y < h - 20; y += 26) {
        g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, y + Math.sin(x * 0.08 + y) * 5); g.stroke();
      }
    } else if (kind === 'fish') {
      for (let k = 0; k < 40; k++) { // pesciolini: un'ellisse e un triangolo per coda
        const x = rnd() * w, y = 20 + rnd() * (h - 50), s = 6 + rnd() * 4, d = rnd() < 0.5 ? 1 : -1;
        g.beginPath(); g.ellipse(x, y, s * 1.6, s, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(x - d * s * 1.4, y); g.lineTo(x - d * s * 2.6, y - s); g.lineTo(x - d * s * 2.6, y + s); g.fill();
      }
    } else {
      g.globalAlpha = 0.45;
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 16, h);
      for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 16);
      g.globalAlpha = 1;
    }
    // orlo in fondo e bordino in alto con gli occhielli
    g.globalAlpha = 1; g.fillStyle = ink; g.fillRect(0, h - 14, w, 10);
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, w, 12);
    g.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// coordinate baricentriche di (x, z) rispetto al triangolo a, b, c (in 2D)
function bary(x, z, a, b, c) {
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d;
  const l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d;
  return [l1, l2, 1 - l1 - l2];
}

export function shower(net, { i, j, drop = 1.6, seed = 1 }) {
  let rs = seed * 7919 + 3;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const R = 0.5, FLOOR = 2.1; // raggio dell'anello, distanza della pedana sotto l'anello
  const nodes = [[i, j], [i + 2, j], [i + 1, j + 2]].map(([a, b]) => net.index(a, b));
  const body = new VerletBody({ damping: 0.993, iterations: 16 });

  // --- Corpo rigido: 3 punti sull'anello + il centro della pedana (un tetraedro rigido)
  const center = new THREE.Vector3();
  nodes.forEach((n) => center.add(nodePos(net, n)));
  center.divideScalar(3); center.y -= drop;
  const corners = nodes.map((n) => {
    const p = nodePos(net, n), a = Math.atan2(p.z - center.z, p.x - center.x);
    return { n, a };
  });
  // gli angoli veri dei nodi sono quasi a 120°: li rendo esatti partendo dal primo
  const a0 = corners[0].a;
  const ids = corners.map((cn) => {
    const k = Math.round((((cn.a - a0) / ((Math.PI * 2) / 3)) % 3 + 3) % 3);
    const a = a0 + (k * Math.PI * 2) / 3;
    return body.addParticle(new THREE.Vector3(center.x + Math.cos(a) * R, center.y, center.z + Math.sin(a) * R));
  });
  const D = body.addParticle(new THREE.Vector3(center.x, center.y - FLOOR, center.z));
  const [A, B, C] = ids;
  for (const [p, q] of [[A, B], [B, C], [C, A], [A, D], [B, D], [C, D]]) body.addConstraint(p, q, { rigid: true, visible: false });
  // le funi: dal nodo all'angolo corrispondente, in 3 tratti
  nodes.forEach((n, k) => {
    const top = body.addParticle(nodePos(net, n), netPin(net, n));
    let prev = top;
    for (let q = 1; q < 3; q++) {
      const mid = body.addParticle(new THREE.Vector3().lerpVectors(body.pos[top], body.pos[ids[k]], q / 3));
      body.addConstraint(prev, mid); prev = mid;
    }
    body.addConstraint(prev, ids[k]);
  });

  // --- Sistema di riferimento locale (O = centro dell'anello, Y = su, Z verso l'angolo A)
  const O = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  const frame = () => {
    const P = body.pos;
    O.copy(P[A]).add(P[B]).add(P[C]).divideScalar(3);
    Y.subVectors(O, P[D]).normalize();
    Z.subVectors(P[A], O); Z.addScaledVector(Y, -Z.dot(Y)).normalize();
    X.crossVectors(Y, Z);
  };
  const toWorld = (x, y, z, out) => out.copy(O).addScaledVector(X, x).addScaledVector(Y, y).addScaledVector(Z, z);
  frame();
  const local = (idx) => { const d = _v.subVectors(body.pos[idx], O); return [d.dot(X), d.dot(Z)]; };
  const LA = local(A), LB = local(B), LC = local(C);
  // un punto fisso sul piano dell'anello come combinazione dei 3 angoli: segue il corpo rigido esattamente
  const ringPin = (x, z) => {
    const [l1, l2, l3] = bary(x, z, LA, LB, LC), v = new THREE.Vector3();
    return () => v.set(0, 0, 0).addScaledVector(body.pos[A], l1).addScaledVector(body.pos[B], l2).addScaledVector(body.pos[C], l3);
  };

  // --- Modello (coordinate locali)
  const root = new THREE.Group(); root.name = 'doccia';
  const copper = new THREE.MeshStandardMaterial({ color: '#b8734a', metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
  const zinc = new THREE.MeshStandardMaterial({ color: '#9aa3a6', metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  const bucketMat = rnd() < 0.5 ? copper : zinc;
  const canvasMat = new THREE.MeshStandardMaterial({ color: '#d8cdb2', roughness: 1, side: THREE.DoubleSide });

  // anello e raggiera
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.016, 6, 40), MAT.iron); ring.rotation.x = Math.PI / 2; root.add(ring);
  const rod = (from, to, r, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6), mat);
    m.position.lerpVectors(from, to, 0.5); m.scale.y = from.distanceTo(to);
    m.quaternion.setFromUnitVectors(UP, _w.subVectors(to, from).normalize()); return m;
  };
  const hub = new THREE.Vector3(0, 0.02, 0);
  for (const [x, z] of [LA, LB, LC]) root.add(rod(new THREE.Vector3(x, 0, z), hub, 0.01, MAT.iron));

  // imbuto di tela in alto, retto da tre aste: raccoglie le gocce della rete
  const catchY = 1.05, catchR = 0.36;
  const catcher = new THREE.Mesh(new THREE.CylinderGeometry(catchR, 0.03, 0.3, 16, 1, true), canvasMat);
  catcher.position.set(0, catchY, -0.1); root.add(catcher);
  for (const [x, z] of [LA, LB, LC]) {
    const k = catchR / R;
    root.add(rod(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * k, catchY + 0.15, z * k - 0.1), 0.007, MAT.iron));
  }
  const catcherRim = new THREE.Mesh(new THREE.TorusGeometry(catchR, 0.008, 4, 24), MAT.iron);
  catcherRim.rotation.x = Math.PI / 2; catcherRim.position.set(0, catchY + 0.15, -0.1); root.add(catcherRim);
  const spout = new THREE.Vector3(0, catchY - 0.18, -0.1);

  // il secchio sul suo perno (ruota attorno all'asse X)
  const PIV = new THREE.Vector3(0, 0.6, -0.1);
  for (const sx of [-0.2, 0.2]) root.add(rod(new THREE.Vector3(sx, 0.02, 0), new THREE.Vector3(sx, PIV.y + 0.02, PIV.z), 0.012, MAT.iron));
  const axle = rod(new THREE.Vector3(-0.21, PIV.y, PIV.z), new THREE.Vector3(0.21, PIV.y, PIV.z), 0.008, MAT.iron); root.add(axle);
  const bucket = new THREE.Group(); bucket.position.copy(PIV); root.add(bucket);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.28, 18, 1, true), bucketMat); shell.position.y = -0.02;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.12, 18), bucketMat); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.16;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 4, 18), bucketMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.12;
  for (const y of [-0.1, 0.04]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.135 + (y + 0.16) * 0.09, 0.006, 4, 18), MAT.iron); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; bucket.add(hoop); }
  const lip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4, 1, true), bucketMat); lip.rotation.x = Math.PI / 2; lip.position.set(0, 0.11, 0.17);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 18), new THREE.MeshStandardMaterial({ color: '#5d8a96', metalness: 0.3, roughness: 0.15, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  // contrappeso: una sfera di piombo su un braccio, dietro al secchio
  const arm = rod(new THREE.Vector3(0, -0.05, -0.12), new THREE.Vector3(0, -0.2, -0.26), 0.008, MAT.iron);
  const lead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), MAT.iron); lead.position.set(0, -0.2, -0.26);
  bucket.add(shell, bottom, rim, lip, water, arm, lead);

  // imbuto di rame, tubo e soffione
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.025, 0.16, 16, 1, true), copper); funnel.position.set(0, 0.2, 0); root.add(funnel);
  const ROSE = new THREE.Vector3(0, -0.3, 0);
  root.add(rod(new THREE.Vector3(0, 0.13, 0), new THREE.Vector3(0, ROSE.y + 0.04, 0), 0.016, copper));
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.03, 0.06, 18, 1, true), copper); rose.position.copy(ROSE); root.add(rose);
  const roseFace = new THREE.Mesh(new THREE.CircleGeometry(0.1, 18), new THREE.MeshStandardMaterial({
    map: canvasTexture(64, 64, (g, w) => { g.fillStyle = '#b8734a'; g.fillRect(0, 0, w, w); g.fillStyle = '#2a1a10'; for (let r = 6; r < 30; r += 7) for (let a = 0; a < 6.28; a += 7 / r) { g.beginPath(); g.arc(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 1.6, 0, 6.3); g.fill(); } }),
    metalness: 0.7, roughness: 0.4 }));
  roseFace.rotation.x = Math.PI / 2; roseFace.position.set(0, ROSE.y - 0.031, 0); root.add(roseFace);

  // pedana di listelli, appesa con tre catene
  const deck = new THREE.Group(); deck.position.y = -FLOOR; root.add(deck);
  const slatMat = new THREE.MeshStandardMaterial({ map: woodPlanks(seed + 11, 3), roughness: 0.9 });
  for (let x = -0.42; x <= 0.43; x += 0.12) {
    const len = 2 * Math.sqrt(Math.max(0, 0.5 * 0.5 - x * x));
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, len), slatMat); slat.position.x = x; deck.add(slat);
  }
  const deckRim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 4, 32), MAT.wood); deckRim.rotation.x = Math.PI / 2; deck.add(deckRim);
  const chainMat = new THREE.MeshStandardMaterial({ color: '#4a4744', metalness: 0.6, roughness: 0.5, wireframe: true });
  for (const [x, z] of [LA, LB, LC]) root.add(rod(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, -FLOOR, z), 0.012, chainMat));

  // --- Oggetti del bagno: 3 a caso
  const animated = [];
  const plain = (color, r = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: r });
  const EXTRAS = ['soap', 'brush', 'sponge', 'towel', 'duck', 'stool', 'mirror'];
  const picks = [];
  while (picks.length < 3) { const e = EXTRAS[Math.floor(rnd() * EXTRAS.length)]; if (!picks.includes(e)) picks.push(e); }
  // la tenda si apre verso il centro della rete (dove passa la passerella), con un po' di caso
  const toMid = new THREE.Vector3(-center.x, 0, 0).normalize();
  const gapAng = Math.atan2(toMid.dot(Z), toMid.dot(X)) + (rnd() - 0.5) * 0.8; // angolo nel piano X-Z locale
  const inside = (ang, r, y) => new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r);
  picks.forEach((what, q) => {
    const ang = gapAng + Math.PI + (q - 1) * 1.1; // sul lato opposto all'apertura
    const g = new THREE.Group();
    if (what === 'soap') { // mensolina appesa all'anello con il sapone e una bottiglietta
      g.position.copy(inside(ang, R - 0.08, -0.55)); g.rotation.y = -ang;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.2), MAT.wood);
      const soap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.07), plain('#e9d9b0', 0.4)); soap.position.set(0, 0.02, -0.04);
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.1, 8), new THREE.MeshStandardMaterial({ color: '#3d6e5a', metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.8 }));
      bottle.position.set(0, 0.06, 0.05);
      const cord = rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.55, 0), 0.003, MAT.rope);
      g.add(shelf, soap, bottle, cord);
    } else if (what === 'brush') { // spazzola per la schiena, appesa a un gancio: dondola
      g.position.copy(inside(ang, R - 0.05, -0.02));
      const pend = new THREE.Group(); g.add(pend);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.42, 6), MAT.wood); handle.position.y = -0.23;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.03), MAT.wood); head.position.y = -0.48;
      const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.02), plain('#d8c08a', 1)); bristle.position.set(0, -0.48, 0.024);
      pend.add(handle, head, bristle);
      const ph = rnd() * 6;
      animated.push((dt, t, w) => { pend.rotation.x = 0.1 * Math.sin(t * 1.9 + ph) + 0.4 * w; pend.rotation.z = 0.07 * Math.sin(t * 1.4 + ph); });
    } else if (what === 'sponge') { // spugna di luffa su uno spago
      g.position.copy(inside(ang, R - 0.06, -0.02));
      const pend = new THREE.Group(); g.add(pend);
      pend.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.3, 0), 0.002, MAT.rope));
      const sp = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.1, 4, 8), plain('#d9c27a', 1)); sp.position.y = -0.37; pend.add(sp);
      const ph = rnd() * 6;
      animated.push((dt, t, w) => { pend.rotation.x = 0.15 * Math.sin(t * 2.4 + ph) + 0.5 * w; pend.rotation.z = 0.1 * Math.sin(t * 1.7 + ph); });
    } else if (what === 'towel') { // asciugamano piegato sull'anello, fuori dalla tenda vicino all'apertura
      const a = gapAng + 0.75;
      g.position.copy(inside(a, R + 0.02, 0)); g.rotation.y = -a + Math.PI / 2;
      const towelMat = new THREE.MeshStandardMaterial({ map: stripedFabric(['#c9d6df', '#e8dcc0', '#a8352c', '#e8dcc0']), side: THREE.DoubleSide, roughness: 1 });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.5), towelMat); front.position.set(0, -0.25, 0.03);
      const back = front.clone(); back.position.z = -0.03; back.scale.y = 0.7; back.position.y = -0.175;
      g.add(front, back);
      const ph = rnd() * 6;
      animated.push((dt, t, w) => { g.rotation.z = 0.03 * Math.sin(t * 1.3 + ph) + 0.15 * w; });
    } else if (what === 'duck') { // una paperella sulla pedana
      g.position.copy(inside(ang, 0.25, -FLOOR + 0.05));
      const yellow = plain('#e8c33a', 0.4);
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), yellow); b1.scale.set(1.3, 0.8, 1);
      const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), yellow); h1.position.set(0.04, 0.05, 0);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), plain('#d0602a')); beak.rotation.z = -Math.PI / 2; beak.position.set(0.075, 0.05, 0);
      g.add(b1, h1, beak); g.rotation.y = rnd() * 6;
    } else if (what === 'stool') { // sgabello di legno
      g.position.copy(inside(ang, 0.22, -FLOOR + 0.015));
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 12), MAT.wood); seat.position.y = 0.32;
      g.add(seat);
      for (let k = 0; k < 3; k++) { const la = (k / 3) * Math.PI * 2; g.add(rod(new THREE.Vector3(Math.cos(la) * 0.1, 0.31, Math.sin(la) * 0.1), new THREE.Vector3(Math.cos(la) * 0.13, 0, Math.sin(la) * 0.13), 0.012, MAT.wood)); }
    } else if (what === 'mirror') { // specchietto tondo appeso all'interno
      g.position.copy(inside(ang, R - 0.05, -0.02));
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.12, 0), 0.002, MAT.rope));
      const frameM = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 18), MAT.brass); frameM.position.y = -0.2;
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 18), new THREE.MeshStandardMaterial({ color: '#cfdde0', metalness: 1, roughness: 0.05, side: THREE.DoubleSide })); glass.position.y = -0.2;
      g.add(frameM, glass); g.rotation.y = -ang + Math.PI / 2;
    }
    root.add(g);
  });

  // --- Tenda: stoffa simulata, pieghettata, appesa agli anellini
  const COLS = 15, ROWS = 10, DY = 0.17, gap = 1.0; // gap = ampiezza dell'apertura (radianti)
  const curtain = new VerletBody({ damping: 0.985, iterations: 6, windScale: 1.4 });
  const cid = [], uv = [];
  const ringletGeo = new THREE.TorusGeometry(0.02, 0.004, 4, 8);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ang = gapAng + gap / 2 + (c / (COLS - 1)) * (Math.PI * 2 - gap);
    const rr = R - 0.03 + (c % 2 ? 0.035 : -0.035); // pieghe: un dentro e un fuori
    const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
    const p = toWorld(x, -0.04 - r * DY, z, new THREE.Vector3());
    cid.push(curtain.addParticle(p, r === 0 ? ringPin(x, z) : null));
    uv.push(c / (COLS - 1), 1 - r / (ROWS - 1));
    if (r === 0) { const rl = new THREE.Mesh(ringletGeo, MAT.brass); rl.position.set(x, -0.015, z); rl.rotation.y = -ang; root.add(rl); }
  }
  const CI = (r, c) => (r < ROWS && c < COLS ? cid[r * COLS + c] : -1);
  const ln = (a, b) => { if (a >= 0 && b >= 0) curtain.addConstraint(a, b, { visible: false }); };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ln(CI(r, c), CI(r, c + 1)); ln(CI(r, c), CI(r + 1, c)); ln(CI(r, c), CI(r + 1, c + 1)); ln(CI(r, c + 1), CI(r + 1, c)); ln(CI(r, c), CI(r + 2, c));
  }
  const cIndex = [];
  for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS - 1; c++) { const k = r * COLS + c; cIndex.push(k, k + COLS, k + 1, k + 1, k + COLS, k + COLS + 1); }
  const cPos = new Float32Array(ROWS * COLS * 3);
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3).setUsage(THREE.DynamicDrawUsage));
  cGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  cGeo.setIndex(cIndex);
  const cMesh = new THREE.Mesh(cGeo, new THREE.MeshStandardMaterial({ map: curtainTexture(rnd), side: THREE.DoubleSide, roughness: 1 }));
  cMesh.frustumCulled = false;

  // --- Acqua: gocce come trattini (LineSegments) in coordinate del mondo
  const NW = 340;
  const drops = Array.from({ length: NW }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), kind: 0, killY: 0, through: false }));
  const wPos = new Float32Array(NW * 6);
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3).setUsage(THREE.DynamicDrawUsage));
  const waterLines = new THREE.LineSegments(wGeo, new THREE.LineBasicMaterial({ color: '#d4e8ef', transparent: true, opacity: 0.75 }));
  waterLines.frustumCulled = false;
  let nextDrop = 0;
  // kind: 0 = goccia dall'imbuto al secchio, 1 = getto dal secchio all'imbuto, 2 = soffione
  const emit = (pos, vel, kind, killY) => {
    for (let k = 0; k < NW; k++) {
      const d = drops[(nextDrop + k) % NW];
      if (d.alive) continue;
      nextDrop = (nextDrop + k + 1) % NW;
      d.alive = true; d.p.copy(pos); d.v.copy(vel); d.kind = kind; d.killY = killY; d.through = false;
      return;
    }
  };

  const holder = new THREE.Group(); holder.add(root, cMesh, waterLines);

  // --- Stato della doccia
  let level = rnd() * 0.8, theta = 0, omega = 0, state = 'fill', fillTime = 10 + rnd() * 6;
  let flow = 0, flowTimer = 0, dripAcc = 0, roseAcc = 0, pourAcc = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), vel = new THREE.Vector3();
  const LIP = new THREE.Vector3(0, 0.12, 0.17);
  const WATER_BOTTOM = -0.15, WATER_TOP = 0.09;
  const m4 = new THREE.Matrix4();

  return {
    name: 'doccia', bodies: [body, curtain], loads: nodes.map((node) => ({ node, weight: 40 })), object: holder,
    focusPoint: () => body.pos[A],
    update(dt, t) {
      dt = Math.min(dt, 0.05);
      frame();
      root.position.copy(O);
      root.quaternion.setFromRotationMatrix(m4.makeBasis(X, Y, Z));
      const wind = VerletBody.wind.x / 3.5;

      // 1) il secchio: si riempie, si ribalta, torna su
      if (state === 'fill') {
        level = Math.min(1, level + dt / fillTime);
        const target = 0.12 * level; // pieno si inclina un po'
        omega += (-(theta - target) * 30 - omega * 6) * dt;
        if (level >= 1) state = 'tip';
      } else if (state === 'tip') {
        omega += 14 * Math.sin(theta + 0.35) * dt; // il peso dell'acqua, fuori dal perno, lo fa cadere
        if (theta > 1.9) { theta = 1.9; omega = -omega * 0.25; } // sbatte contro il fermo
        if (theta > 1.1) { level = Math.max(0, level - dt / 0.9); flowTimer = 3.2; }
        if (level <= 0) state = 'back';
      } else { // il contrappeso lo riporta dritto, con un'oscillazione smorzata
        omega += (-10 * Math.sin(theta) - 2.2 * omega) * dt;
        if (Math.abs(theta) < 0.01 && Math.abs(omega) < 0.03) { state = 'fill'; fillTime = 10 + rnd() * 6; }
      }
      theta += omega * dt;
      bucket.rotation.x = theta;
      // la superficie dell'acqua dentro il secchio
      water.visible = level > 0.02;
      const wy = WATER_BOTTOM + (WATER_TOP - WATER_BOTTOM) * level;
      water.position.y = wy; water.scale.setScalar(0.12 + 0.04 * ((wy - WATER_BOTTOM) / 0.28));

      // 2) le gocce dall'imbuto di tela al secchio (mentre si riempie)
      if (state === 'fill') {
        dripAcc += dt * 4;
        while (dripAcc > 1) {
          dripAcc -= 1;
          toWorld(spout.x, spout.y, spout.z, tmp);
          toWorld(PIV.x, PIV.y + wy, PIV.z, tmp2);
          emit(tmp, vel.set(0, -0.3, 0), 0, tmp2.y);
        }
      }
      // 3) il getto quando il secchio è ribaltato
      if (state === 'tip' && theta > 1.1 && level > 0) {
        pourAcc += dt * 90;
        const lipW = LIP.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), theta).add(PIV);
        toWorld(lipW.x, lipW.y, lipW.z, tmp);
        toWorld(0, 0.24, 0, tmp2);
        while (pourAcc > 1) {
          pourAcc -= 1;
          vel.copy(Z).multiplyScalar(0.25 + rnd() * 0.2).addScaledVector(X, (rnd() - 0.5) * 0.3);
          emit(tmp.clone().addScaledVector(X, (rnd() - 0.5) * 0.04), vel, 1, tmp2.y);
        }
      }
      // 4) il soffione: parte poco dopo il getto e va ancora per un po'
      flowTimer = Math.max(0, flowTimer - dt);
      flow += ((flowTimer > 0 ? 1 : 0) - flow) * Math.min(1, dt * (flowTimer > 0 ? 3 : 0.9));
      roseAcc += dt * 210 * flow;
      while (roseAcc > 1) {
        roseAcc -= 1;
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.09;
        toWorld(Math.cos(a) * r, ROSE.y - 0.035, Math.sin(a) * r, tmp);
        vel.copy(Y).multiplyScalar(-1.4 * flow - 0.2).addScaledVector(X, Math.cos(a) * r * 4 * flow).addScaledVector(Z, Math.sin(a) * r * 4 * flow);
        emit(tmp, vel, 2, body.pos[D].y - 7);
      }

      // 5) muovo le gocce
      const deckY = body.pos[D].y + 0.03;
      for (let k = 0; k < NW; k++) {
        const d = drops[k];
        if (d.alive) {
          d.v.y -= 9.81 * dt;
          d.v.x += VerletBody.wind.x * 0.5 * dt;
          const yBefore = d.p.y;
          d.p.addScaledVector(d.v, dt);
          if (d.kind === 2 && !d.through && yBefore >= deckY && d.p.y < deckY) {
            const dx = d.p.x - body.pos[D].x, dz = d.p.z - body.pos[D].z;
            d.through = true;
            if (dx * dx + dz * dz < 0.25 && rnd() < 0.55) { // colpisce un listello: piccolo schizzo
              d.p.y = deckY; d.v.set((rnd() - 0.5) * 1.2, 0.6 + rnd() * 0.8, (rnd() - 0.5) * 1.2);
            }
          }
          if (d.p.y < d.killY) d.alive = false;
        }
        const o = k * 6;
        if (d.alive) {
          const len = Math.min(0.06, d.v.length() * 0.012) + 0.012;
          tmp.copy(d.v).normalize().multiplyScalar(len);
          wPos[o] = d.p.x; wPos[o + 1] = d.p.y; wPos[o + 2] = d.p.z;
          wPos[o + 3] = d.p.x - tmp.x; wPos[o + 4] = d.p.y - tmp.y; wPos[o + 5] = d.p.z - tmp.z;
        } else wPos.fill(0, o, o + 6);
      }
      wGeo.attributes.position.needsUpdate = true;
      wGeo.computeBoundingSphere();

      // 6) tenda e oggetti
      for (let k = 0; k < cid.length; k++) { const p = curtain.pos[cid[k]]; cPos[k * 3] = p.x; cPos[k * 3 + 1] = p.y; cPos[k * 3 + 2] = p.z; }
      cGeo.attributes.position.needsUpdate = true;
      cGeo.computeVertexNormals();
      for (const f of animated) f(dt, t, wind);
    },
  };
}

// ===============================================================
// BECCO DEL GAS: un piccolo GASOMETRO appeso accanto a ogni casa, con il suo becco acceso.
//
// - il gasometro è come quelli delle città dell'Ottocento, in piccolo: una vasca d'acqua
//   e dentro una CAMPANA di rame che sale e scende con la pressione del gas. Tre
//   CONTRAPPESI, su catene che passano sulle carrucole in cima, si muovono al contrario
//   della campana; un MANOMETRO segna la pressione.
// - dal rubinetto in basso un tubo a collo d'oca sale fino al BECCO: la fiamma
//   (due piani incrociati con una texture a goccia, blending additivo) e il suo alone.
//   Tremola, si piega col vento e cresce con la pressione.
// - una RAFFICA può spegnerla; quando il vento cala si riaccende con un guizzo.
// ===============================================================
function flameTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.5);
    grad.addColorStop(0, 'rgba(140,180,255,1)');   // base azzurra: il gas che brucia
    grad.addColorStop(0.18, 'rgba(255,240,190,1)');
    grad.addColorStop(0.45, 'rgba(255,170,60,0.9)');
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    g.fillStyle = grad;
    g.beginPath(); // sagoma a goccia
    g.moveTo(w / 2, 4);
    g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.85, h * 0.92, w / 2, h * 0.92);
    g.bezierCurveTo(w * 0.15, h * 0.92, w * 0.05, h * 0.45, w / 2, 4);
    g.fill();
  });
}
function haloTexture() {
  return canvasTexture(64, 64, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,200,120,0.9)'); grad.addColorStop(0.3, 'rgba(255,160,70,0.35)'); grad.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
}
let FLAME_MAT = null, HALO_MAT = null;

export function gasBurner(net, { i, j, length = 1.5, seed = 1 }) {
  let rs = seed * 6007 + 5;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  if (!FLAME_MAT) {
    FLAME_MAT = new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    HALO_MAT = new THREE.SpriteMaterial({ map: haloTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  const { body, idx, n } = simpleRope(net, i, j, length, 5, { damping: 0.995 });
  // il becco guarda verso il centro della rete, dove passa la passerella
  const yaw = Math.sign(nodePos(net, n).x || 1) * Math.PI / 2;

  const root = new THREE.Group(); root.name = 'becco del gas';
  const TANK_R = 0.3, TANK_H = 0.45, TOP = -0.5; // la vasca va da TOP-TANK_H a TOP
  root.add(strings(TANK_R, TOP, 4));
  const tankMat = new THREE.MeshStandardMaterial({ map: paintedWood(['#3b4a3f', '#4a3b32', '#2f4a5a'][Math.floor(rnd() * 3)], seed + 21, 10), metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 20, 1, true), tankMat); tank.position.y = TOP - TANK_H / 2;
  const tankBottom = new THREE.Mesh(new THREE.CircleGeometry(TANK_R, 20), tankMat); tankBottom.rotation.x = Math.PI / 2; tankBottom.position.y = TOP - TANK_H;
  const water = new THREE.Mesh(new THREE.RingGeometry(0.24, TANK_R - 0.01, 20), new THREE.MeshStandardMaterial({ color: '#2f4f55', metalness: 0.4, roughness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = TOP - 0.05;
  root.add(tank, tankBottom, water);
  for (const y of [TOP - 0.02, TOP - TANK_H + 0.02]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(TANK_R + 0.006, 0.01, 4, 24), MAT.iron); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; root.add(hoop); }
  // la campana (sale e scende)
  const bell = new THREE.Group(); root.add(bell);
  const copper = new THREE.MeshStandardMaterial({ color: '#b8734a', metalness: 0.75, roughness: 0.35 });
  const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.36, 20), copper);
  const bellCap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), copper); bellCap.scale.y = 0.35; bellCap.position.y = 0.18;
  for (const y of [-0.08, 0.08]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.237, 0.006, 4, 20), MAT.brass); b.rotation.x = Math.PI / 2; b.position.y = y; bell.add(b); }
  bell.add(bellBody, bellCap);
  // tre montanti con le carrucole in cima; i contrappesi pendono all'esterno
  const POST_TOP = TOP + 0.62, OUT = TANK_R + 0.075;
  const posts = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 2, cx = Math.cos(a), cz = Math.sin(a); // nessun montante davanti al becco (-Z)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, POST_TOP - (TOP - TANK_H), 5), MAT.iron);
    post.position.set(cx * (TANK_R + 0.03), (POST_TOP + TOP - TANK_H) / 2, cz * (TANK_R + 0.03));
    const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 5, 12), MAT.brass);
    pulley.position.set(cx * (TANK_R + 0.03), POST_TOP, cz * (TANK_R + 0.03)); pulley.rotation.y = -a + Math.PI / 2;
    const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), MAT.iron);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 3), MAT.iron);
    root.add(post, pulley, weight, chain);
    posts.push({ cx, cz, pulley, weight, chain });
  }
  // manometro: quadrante disegnato e lancetta (sul fianco, ben visibile)
  const dial = new THREE.Group(); dial.position.set(-(TANK_R + 0.012) * 0.7, TOP - TANK_H * 0.55, -(TANK_R + 0.012) * 0.7); dial.rotation.y = -Math.PI * 0.75; root.add(dial);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), new THREE.MeshStandardMaterial({ roughness: 0.5, map: canvasTexture(64, 64, (g) => {
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(32, 32, 31, 0, 6.3); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 2;
    for (let k = 0; k <= 8; k++) { const a = Math.PI * (0.75 + (1.5 * k) / 8); g.beginPath(); g.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); g.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); g.stroke(); }
    g.strokeStyle = '#a8352c'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 25, Math.PI * 0.75, Math.PI * 1.05); g.stroke(); // zona rossa
  }) }));
  const dialRim = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 5, 20), MAT.brass);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.003), MAT.dark); needle.geometry.translate(0, 0.022, 0.004);
  dial.add(face, dialRim, needle);

  // tubo a collo d'oca: dal rubinetto in basso sale fino al becco, accanto alla vasca
  const BZ = -(TANK_R + 0.16), BY = TOP + 0.14; // dove sta il becco
  const neck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, TOP - TANK_H + 0.07, -TANK_R), new THREE.Vector3(0, TOP - TANK_H + 0.07, -(TANK_R + 0.1)),
    new THREE.Vector3(0, TOP - TANK_H + 0.2, BZ), new THREE.Vector3(0, BY - 0.15, BZ), new THREE.Vector3(0, BY, BZ),
  ]);
  root.add(new THREE.Mesh(new THREE.TubeGeometry(neck, 24, 0.014, 6), copper));
  const tap = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 10), MAT.brass); tap.position.set(0.03, TOP - TANK_H + 0.07, -(TANK_R + 0.06)); tap.rotation.y = Math.PI / 2;
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.01), MAT.brass); key.position.set(0, BY - 0.1, BZ);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.04, 8), MAT.brass); tip.position.set(0, BY + 0.02, BZ);
  root.add(tap, key, tip);
  const type = ['fishtail', 'globe', 'bat'][Math.floor(rnd() * 3)];
  const flame = new THREE.Group(); flame.position.set(0, BY + 0.04, BZ); root.add(flame);
  const wide = type === 'globe' ? 1 : 1.6;
  for (const r of [0, Math.PI / 2]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.08 * (r ? 1 : wide), 0.17), FLAME_MAT);
    pl.geometry.translate(0, 0.072, 0); pl.rotation.y = r; flame.add(pl);
  }
  if (type === 'globe') { // globo di vetro col collare d'ottone
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: '#e8f2f0', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false }));
    glass.position.set(0, BY + 0.11, BZ);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 4, 12), MAT.brass); collar.rotation.x = Math.PI / 2; collar.position.set(0, BY + 0.03, BZ);
    root.add(glass, collar);
  } else if (type === 'bat') { // piattino riflettente dietro la fiamma
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.12, 18), new THREE.MeshStandardMaterial({ color: '#d9c48a', metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide }));
    disc.position.set(0, BY + 0.1, BZ + 0.09); root.add(disc);
  }
  const halo = new THREE.Sprite(HALO_MAT.clone()); halo.scale.setScalar(0.9); halo.position.set(0, BY + 0.1, BZ); root.add(halo);

  const place = (mesh, p, q) => {
    mesh.position.lerpVectors(p, q, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, _v.subVectors(q, p).normalize());
    mesh.scale.y = p.distanceTo(q);
  };
  const top = new THREE.Vector3();
  let lit = true, life = 1, pop = 0, calm = 0;
  const phase = rnd() * 100;
  return {
    name: 'becco del gas', bodies: [body], loads: [{ node: n, weight: 60 }], object: root,
    update(dt, t) {
      dt = Math.min(dt, 0.05);
      hangAlong(root, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]], yaw);
      const tt = t + phase, wind = VerletBody.wind.x / 3.5, aw = Math.abs(wind);
      // pressione che "respira": la campana sale e scende, i contrappesi al contrario
      const pressure = 0.55 + 0.3 * Math.sin(tt * 0.07) + 0.1 * Math.sin(tt * 0.23);
      bell.position.y = TOP - 0.2 + pressure * 0.28;
      for (const p of posts) {
        p.pulley.rotation.z = pressure * 8;
        p.weight.position.set(p.cx * OUT, POST_TOP - 0.12 - pressure * 0.28, p.cz * OUT);
        place(p.chain, top.set(p.cx * OUT, POST_TOP, p.cz * OUT), _w.copy(p.weight.position).setY(p.weight.position.y + 0.05));
      }
      needle.rotation.z = Math.PI * 0.75 - Math.PI * 1.5 * ((pressure - 0.15) / 0.85) - Math.PI / 2;
      // la raffica può spegnere la fiamma; con la calma si riaccende
      if (lit && aw > 0.6 && rnd() < dt * 1.2 * aw) lit = false;
      calm = aw < 0.12 ? calm + dt : 0;
      if (!lit && calm > 1.5) { lit = true; pop = 1; }
      life += ((lit ? 1 : 0) - life) * Math.min(1, dt * (lit ? 5 : 10));
      pop = Math.max(0, pop - dt * 3);
      const fl = Math.sin(tt * 17) * Math.sin(tt * 6.3 + 1);
      const size = life * (0.6 + 0.55 * pressure) * (1 - 0.35 * aw) * (1 + 0.1 * fl) + pop * 0.7;
      flame.visible = halo.visible = size > 0.03;
      flame.scale.set(size, size * (1 + 0.08 * fl), size);
      // il vento soffia lungo X del mondo: nel sistema del modello (ruotato di yaw) è lungo Z
      flame.rotation.x = -wind * 0.8 * Math.sign(Math.sin(yaw)) + 0.05 * fl;
      halo.material.opacity = Math.min(1, size) * (0.85 + 0.1 * fl);
    },
  };
}

// ===============================================================
// FUNI D'ANCORAGGIO: la rete non è appesa solo ai bordi delle due creste.
// Come i fili "di telaio" di una ragnatela, grandi funi partono a raggiera dai
// lati della rete e vanno a legarsi alle pareti di roccia delle due creste.
// Tra una fune e la successiva corrono fili più sottili (come la spirale della
// ragnatela). Le funi grosse sono cilindri istanziati (InstancedMesh: un solo
// disegno per tutti i tratti), aggiornati ogni frame dalle particelle Verlet.
// Sono funi vere: pendono un po', dondolano col vento, seguono la rete.
// ===============================================================
export function anchors(net, { seed = 1 } = {}) {
  let rs = seed * 4111 + 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const W = ((net.cols - 1) * net.spacing) / 2, L = (net.rows - 1) * net.spacing;
  const body = new VerletBody({ damping: 0.99, iterations: 10, windScale: 0.4 });
  const holder = new THREE.Group(); holder.name = 'ancoraggi';
  // --- Elenco delle funi: [nodo della rete, punto sulla roccia]
  const list = [];
  for (const s of [-1, 1]) {
    const ie = s < 0 ? 0 : net.cols - 1;
    // verso le pareti delle creste, a ventaglio
    [[2, 15, -3], [5, 19, -6], [8, 25, -9]].forEach(([j, x, y]) => {
      list.push({ n: net.index(ie, j), to: new THREE.Vector3(s * (x + rnd() * 2), y + rnd() * 2, 0), side: s, end: 0 });
      list.push({ n: net.index(ie, net.rows - 1 - j), to: new THREE.Vector3(s * (x + rnd() * 2), y + rnd() * 2, L), side: s, end: 1 });
    });
    // dalla parte centrale dei lati: funi lunghe e oblique fino alle pareti, più lontano e più in basso
    [[12, 24, -12], [16, 28, -16]].forEach(([j, x, y]) => {
      list.push({ n: net.index(ie, j), to: new THREE.Vector3(s * (x + rnd() * 3), y + rnd() * 3, 0), side: s, end: 0 });
      list.push({ n: net.index(ie, net.rows - 1 - j), to: new THREE.Vector3(s * (x + rnd() * 3), y + rnd() * 3, L), side: s, end: 1 });
    });
  }
  // stralli corti dalla prima e dall'ultima fila alla cima delle creste, vicino all'ingresso
  for (const i of [2, 6, 18, 22]) {
    list.push({ n: net.index(i, 1), to: new THREE.Vector3(net.x0 + i * net.spacing + (rnd() - 0.5), 0.05, -2.5 - rnd() * 2), short: true });
    list.push({ n: net.index(i, net.rows - 2), to: new THREE.Vector3(net.x0 + i * net.spacing + (rnd() - 0.5), 0.05, L + 2.5 + rnd() * 2), short: true });
  }

  // --- Le funi come catene Verlet: un capo sul nodo, l'altro fisso nella roccia
  const segs = []; // coppie di particelle da disegnare come cilindri
  const chains = [];
  const ringGeo = new THREE.TorusGeometry(0.12, 0.03, 5, 10), plateGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8);
  for (const a of list) {
    const from = nodePos(net, a.n), to = a.to;
    const d = from.distanceTo(to), N = Math.max(4, Math.min(16, Math.round(d / 1.3)));
    const fixed = to.clone();
    const ids = [body.addParticle(from, netPin(net, a.n))];
    for (let k = 1; k < N; k++) ids.push(body.addParticle(new THREE.Vector3().lerpVectors(from, to, k / N)));
    ids.push(body.addParticle(to, () => fixed));
    const seg = (d * 1.01) / N;
    for (let k = 1; k <= N; k++) { body.addConstraint(ids[k - 1], ids[k], { len: seg, visible: false }); segs.push([ids[k - 1], ids[k]]); }
    chains.push({ ...a, ids });
    // nella roccia: una piastra e un anello di ferro
    const plate = new THREE.Mesh(plateGeo, MAT.iron);
    const ring = new THREE.Mesh(ringGeo, MAT.iron);
    plate.position.copy(to); ring.position.copy(to);
    if (a.short) { ring.rotation.x = Math.PI / 2; plate.position.y -= 0.03; }
    else { plate.rotation.x = Math.PI / 2; plate.lookAt(from); plate.rotateX(Math.PI / 2); ring.lookAt(from); }
    holder.add(plate, ring);
  }
  // fili sottili tra funi vicine dello stesso lato (la "spirale" della ragnatela)
  const bySide = (s, end) => chains.filter((c) => c.side === s && c.end === end);
  for (const s of [-1, 1]) for (const end of [0, 1]) {
    const cs = bySide(s, end);
    for (let k = 1; k < cs.length; k++) {
      for (const f of [0.3, 0.55, 0.8]) {
        const a = cs[k - 1].ids, b = cs[k].ids;
        const pa = a[Math.round(f * (a.length - 1))], pb = b[Math.round(f * (b.length - 1))];
        body.addConstraint(pa, pb, { len: body.pos[pa].distanceTo(body.pos[pb]) * 1.03, visible: true, color: '#b8a888' });
      }
    }
  }

  // --- Cilindri istanziati per le funi grosse
  const cable = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), MAT.rope, segs.length);
  cable.frustumCulled = false;
  holder.add(cable);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), mid = new THREE.Vector3();
  const update = () => {
    const P = body.pos;
    segs.forEach(([a, b], k) => {
      mid.lerpVectors(P[a], P[b], 0.5);
      _v.subVectors(P[b], P[a]); sc.y = _v.length();
      q.setFromUnitVectors(UP, _v.normalize());
      cable.setMatrixAt(k, m.compose(mid, q, sc));
    });
    cable.instanceMatrix.needsUpdate = true;
  };
  update();
  return { name: 'ancoraggi', bodies: [body], loads: [], object: holder, update };
}

// ===============================================================
// PONTICELLO DI CORDA tra due pianerottoli (di solito tra due case).
// Due funi per il piano di calpestio con le assi (corpo Verlet: ogni coppia di
// particelle è unita da un vincolo rigido = un'asse), due funi più in alto come
// corrimano, e tanti cordini verticali che le legano. I quattro capi sono "pin"
// che seguono i pianerottoli: se le case dondolano, il ponte si tende e si allenta.
// a, b: funzioni (side, high) → funzione-perno (vedi sackHouse.porch, cableway.porch, walkwayEnd)
// ===============================================================
const _up4 = new THREE.Vector3(0, 0.04, 0);
export function ropeBridge(a, b, { sag = 1.04, planks = 9, seed = 1 } = {}) {
  let rs = seed * 2207 + 3;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const body = new VerletBody({ damping: 0.99, iterations: 14 });
  // abbino i lati in modo che il ponte non si attorcigli: il capo sinistro di 'a'
  // va legato al capo di 'b' che gli sta più vicino
  const flip = a(-1)().distanceTo(b(1)()) <= a(-1)().distanceTo(b(-1)()) ? -1 : 1;
  const ends = {
    deckL: [a(-1), b(-flip)], deckR: [a(1), b(flip)],
    railL: [a(-1, true), b(-flip, true)], railR: [a(1, true), b(flip, true)],
  };
  const N = planks + 1;
  const chain = ([pa, pb]) => {
    const A = pa().clone(), B = pb().clone(), ids = [];
    for (let k = 0; k <= N; k++) ids.push(body.addParticle(new THREE.Vector3().lerpVectors(A, B, k / N), k === 0 ? pa : k === N ? pb : null));
    const len = (A.distanceTo(B) * sag) / N;
    for (let k = 1; k <= N; k++) body.addConstraint(ids[k - 1], ids[k], { len });
    return ids;
  };
  const dL = chain(ends.deckL), dR = chain(ends.deckR), rL = chain(ends.railL), rR = chain(ends.railR);
  for (let k = 1; k < N; k++) {
    body.addConstraint(dL[k], dR[k], { rigid: true, visible: false });            // l'asse
    body.addConstraint(rL[k], dL[k], { len: 0.55, color: '#9a8566' });             // cordini verticali
    body.addConstraint(rR[k], dR[k], { len: 0.55, color: '#9a8566' });
  }
  const plankMat = new THREE.MeshStandardMaterial({ map: woodPlanks(seed + 30, 1), roughness: 0.9 });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.035, 0.16), plankMat, N - 1);
  mesh.frustumCulled = false; mesh.name = 'ponticello';
  const widths = Array.from({ length: N - 1 }, () => 0.95 + rnd() * 0.12), tilt = Array.from({ length: N - 1 }, () => (rnd() - 0.5) * 0.12);
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), mid = new THREE.Vector3(), m = new THREE.Matrix4(), sc = new THREE.Vector3();
  const tq = new THREE.Quaternion();
  return {
    name: 'ponticello', bodies: [body], loads: [], object: mesh,
    // il percorso a piedi sulle assi, dal capo 'a' al capo 'b' (o al contrario): funzioni-punto
    path(reverse = false) {
      const pts = [];
      for (let k = 0; k <= N; k++) {
        const v = new THREE.Vector3(), l = dL[k], r = dR[k];
        pts.push(() => v.lerpVectors(body.pos[l], body.pos[r], 0.5).add(_up4));
      }
      return reverse ? pts.reverse() : pts;
    },
    update() {
      const P = body.pos;
      for (let k = 1; k < N; k++) {
        const l = P[dL[k]], r = P[dR[k]];
        mid.lerpVectors(l, r, 0.5);
        X.subVectors(r, l);
        const w = X.length(); X.normalize();
        Z.subVectors(P[dL[k + 1]], P[dL[k - 1]]); Z.addScaledVector(X, -Z.dot(X)).normalize();
        Y.crossVectors(Z, X);
        m.makeBasis(X, Y, Z);
        tq.setFromRotationMatrix(m).multiply(_q.setFromAxisAngle(UP, tilt[k - 1])); // assi un po' storte
        mesh.setMatrixAt(k - 1, m.compose(mid, tq, sc.set(w * widths[k - 1], 1, 1)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ===============================================================
// TELEFERICA INTERNA: attraversa la città in diagonale, da un quartiere all'altro,
// passando sotto la passerella. Le due STAZIONI sono appese alla rete in punti
// sgombri, e sono riconoscibili da lontano: pedana ottagonale con ringhiera
// verde, torretta alta con la grande ruota del cavo, tetto a punta e una
// bandierina che sventola col vento.
//
// - stazione = corpo rigido di particelle: tre angoli della pedana legati con
//   funi a tre nodi della rete + il contrappeso appeso sotto (un tetraedro rigido
//   che la tiene dritta)
// - il CAVO pende tra le due ruote come una parabola, ricalcolata ogni frame perché
//   le stazioni dondolano con la rete (cilindri istanziati)
// - la CABINA è un modello gerarchico: CARRELLO (ruote sul cavo) → PERNO → BRACCIO →
//   CABINA, un PENDOLO che oscilla quando parte, frena e col vento
// Per il futuro: cabinPoint() dà il punto del pavimento della cabina (per salirci).
// ===============================================================
function cableStation(net, i, j, drop) {
  const nodes = [[i, j], [i + 2, j], [i + 1, j + 2]].map(([a, b]) => net.index(a, b));
  const body = new VerletBody({ damping: 0.993, iterations: 16 });
  const R = 1.1, DOWN_D = 2.4;
  const center = new THREE.Vector3();
  nodes.forEach((n) => center.add(nodePos(net, n)));
  center.divideScalar(3); center.y -= drop;
  const a0 = Math.atan2(nodePos(net, nodes[0]).z - center.z, nodePos(net, nodes[0]).x - center.x);
  const ids = nodes.map((n) => {
    const p = nodePos(net, n), ang = Math.atan2(p.z - center.z, p.x - center.x);
    const k = Math.round((((ang - a0) / ((Math.PI * 2) / 3)) % 3 + 3) % 3), a = a0 + (k * Math.PI * 2) / 3;
    return body.addParticle(new THREE.Vector3(center.x + Math.cos(a) * R, center.y, center.z + Math.sin(a) * R));
  });
  const D = body.addParticle(new THREE.Vector3(center.x, center.y - DOWN_D, center.z));
  const [A, B, C] = ids;
  for (const [p, q] of [[A, B], [B, C], [C, A], [A, D], [B, D], [C, D]]) body.addConstraint(p, q, { rigid: true, visible: false });
  nodes.forEach((n, k) => {
    const top = body.addParticle(nodePos(net, n), netPin(net, n));
    let prev = top;
    for (let q = 1; q < 3; q++) { const mid = body.addParticle(new THREE.Vector3().lerpVectors(body.pos[top], body.pos[ids[k]], q / 3)); body.addConstraint(prev, mid); prev = mid; }
    body.addConstraint(prev, ids[k]);
  });
  const O = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), m = new THREE.Matrix4();
  const root = new THREE.Group();
  const frame = () => {
    const P = body.pos;
    O.copy(P[A]).add(P[B]).add(P[C]).divideScalar(3);
    Y.subVectors(O, P[D]).normalize();
    Z.subVectors(P[A], O); Z.addScaledVector(Y, -Z.dot(Y)).normalize();
    X.crossVectors(Y, Z);
    root.position.copy(O); root.quaternion.setFromRotationMatrix(m.makeBasis(X, Y, Z));
    root.updateMatrixWorld();
  };
  frame();
  return { body, nodes, root, frame, center, DOWN_D, X, Z };
}

// gapsA / gapsB: punti (nel mondo) verso cui la pedana lascia un varco nella ringhiera,
// per legarci un ponticello (vedi porch(stazione, varco))
export function cableway(net, { a, b, drop = 2.8, sag = 2.0, seed = 1, gapsA = [], gapsB = [] }) {
  let rs = seed * 3907 + 7;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const holder = new THREE.Group(); holder.name = 'teleferica';
  const sA = cableStation(net, a[0], a[1], drop), sB = cableStation(net, b[0], b[1], drop);
  const H = 2.9; // altezza della ruota del cavo sulla pedana: così il pavimento della cabina arriva a filo della pedana
  const roofMat = new THREE.MeshStandardMaterial({ map: paintedWood('#2f5d6a', seed + 40, 6), roughness: 0.8, side: THREE.DoubleSide });
  const railMat = new THREE.MeshStandardMaterial({ map: paintedWood('#4f7a3a', seed + 44, 3), roughness: 0.8 });
  const planks = new THREE.MeshStandardMaterial({ map: woodPlanks(seed + 41, 5), roughness: 0.9 });
  const flagMat = new THREE.MeshStandardMaterial({ map: stripedFabric(['#d9a43a', '#a8352c', '#d9a43a', '#a8352c']), side: THREE.DoubleSide, roughness: 1 });
  const wheels = [], exits = [], flags = [];
  const localAngle = (st, yaw, p) => { // angolo (nel gruppo g della stazione) verso un punto del mondo
    const d = new THREE.Vector3().subVectors(p, st.center).setY(0).normalize();
    return Math.atan2(d.dot(st.X), d.dot(st.Z)) - yaw;
  };
  const angDist = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));
  for (const [st, other, gaps] of [[sA, sB, gapsA], [sB, sA, gapsB]]) {
    holder.add(st.root);
    const dir = new THREE.Vector3().subVectors(other.center, st.center).setY(0).normalize();
    const yaw = Math.atan2(dir.dot(st.X), dir.dot(st.Z)); // +Z del modello verso l'altra stazione
    const g = new THREE.Group(); g.rotation.y = yaw; st.root.add(g);
    st.g = g;
    st.gapAngles = gaps.map((p) => localAngle(st, yaw, p));
    const box = (w, h, d, mat, px, py, pz) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mm.position.set(px, py, pz); g.add(mm); return mm; };
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 8), planks); deck.position.y = -0.06; deck.rotation.y = Math.PI / 8; g.add(deck);
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.04, 4, 8), railMat); rimRing.rotation.x = Math.PI / 2; rimRing.rotation.z = Math.PI / 8; g.add(rimRing);
    // ringhiera verde tutt'intorno, tranne verso la cabina (+Z)
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2, nxt = ang + Math.PI / 4;
      const px = Math.sin(ang) * 1.28, pz = Math.cos(ang) * 1.28, nx = Math.sin(nxt) * 1.28, nz = Math.cos(nxt) * 1.28;
      const mid = ang + Math.PI / 8;
      if (Math.cos(ang) > 0.9 || Math.cos(nxt) > 0.9 || st.gapAngles.some((ga) => angDist(mid, ga) < 0.45)) { box(0.07, 0.8, 0.07, railMat, px, 0.4, pz); continue; }
      box(0.07, 0.8, 0.07, railMat, px, 0.4, pz);
      const r = box(0.05, 0.05, Math.hypot(nx - px, nz - pz), railMat, (px + nx) / 2, 0.78, (pz + nz) / 2);
      r.rotation.y = Math.atan2(nx - px, nz - pz);
    }
    // torretta alta: quattro pali, la ruota del cavo, il tetto a punta, l'asta con la bandierina
    for (const px of [-0.45, 0.45]) for (const pz of [0.15, 0.85]) box(0.1, H + 0.9, 0.1, MAT.wood, px, (H + 0.9) / 2, pz);
    box(1.05, 0.1, 0.1, MAT.wood, 0, H + 0.85, 0.5); box(0.1, 0.1, 0.8, MAT.wood, 0, H + 0.85, 0.5);
    const wheel = new THREE.Group(); wheel.position.set(0, H, 0.75); g.add(wheel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 22), MAT.iron); rim.rotation.x = Math.PI / 2; wheel.add(rim);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.03, 0.04), MAT.iron); sp.rotation.y = (k / 5) * Math.PI; wheel.add(sp); }
    wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), MAT.brass));
    wheels.push(wheel);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.9, 4, 1, true), roofMat); roof.rotation.y = Math.PI / 4; roof.position.set(0, H + 1.35, 0.5); g.add(roof);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5), MAT.iron); mast.position.set(0, H + 2.2, 0.5); g.add(mast);
    const flagPivot = new THREE.Group(); flagPivot.position.set(0, H + 2.55, 0.5); g.add(flagPivot);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.3, 6, 1), flagMat); flag.geometry.translate(0.28, 0, 0); flagPivot.add(flag);
    flags.push({ pivot: flagPivot, flag, rest: flag.geometry.attributes.position.array.slice(), phase: rnd() * 6 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), MAT.window); lamp.position.set(0.5, H - 0.25, 0.85); g.add(lamp);
    box(1.0, 0.06, 0.32, MAT.wood, 0, 0.45, -0.85); box(0.06, 0.42, 0.28, MAT.wood, -0.45, 0.21, -0.85); box(0.06, 0.42, 0.28, MAT.wood, 0.45, 0.21, -0.85);
    // il contrappeso appeso sotto la pedana (è anche ciò che la tiene dritta)
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 10), MAT.iron); cw.position.y = -st.DOWN_D; st.root.add(cw);
    const cwRope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, st.DOWN_D, 4), MAT.rope); cwRope.position.y = -st.DOWN_D / 2; st.root.add(cwRope);
    exits.push({ g, local: new THREE.Vector3(0, H, 1.15) });
  }

  // --- cavo: segmenti istanziati lungo la parabola tra le due ruote
  const SEG = 40;
  const cable = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.024, 0.024, 1, 5), MAT.iron, SEG);
  cable.frustumCulled = false; holder.add(cable);
  const E1 = new THREE.Vector3(), E2 = new THREE.Vector3();
  const cablePoint = (u, out) => out.lerpVectors(E1, E2, u).setY(E1.y + (E2.y - E1.y) * u - 4 * sag * u * (1 - u));

  // --- cabina (come prima): carrello → perno → braccio → cabina
  const trolley = new THREE.Group(); holder.add(trolley);
  trolley.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.7), MAT.iron));
  const tw = [];
  for (const z of [-0.28, 0.28]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), MAT.brass); w.rotation.z = Math.PI / 2; w.position.set(0, 0.06, z); trolley.add(w); tw.push(w); }
  const pivot = new THREE.Group(); pivot.position.y = -0.05; trolley.add(pivot);
  const ARM = 0.7;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, ARM, 6), MAT.iron); arm.position.y = -ARM / 2; pivot.add(arm);
  const cabin = new THREE.Group(); cabin.position.y = -ARM; pivot.add(cabin);
  const paint = new THREE.MeshStandardMaterial({ map: paintedWood(['#3f6f73', '#b88a3b', '#4a5f86'][Math.floor(rnd() * 3)], seed + 43, 6), roughness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb45a', emissiveIntensity: 0.7, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  // misure interne: alta abbastanza per un adulto in piedi (2,2 m), con un varco a ogni testata
  const CW = 1.5, CH = 2.2, CD = 1.9, DOOR = 0.8;
  const add = (geo, mat, px, py, pz) => { const mm = new THREE.Mesh(geo, mat); mm.position.set(px, py, pz); cabin.add(mm); return mm; };
  add(new THREE.BoxGeometry(CW, 0.08, CD), planks, 0, -CH, 0);                                  // pavimento
  for (const sx of [-1, 1]) {                                                                // fiancate: pannello, vetri, fascia
    add(new THREE.BoxGeometry(0.05, 0.95, CD), paint, sx * CW / 2, -CH + 0.5, 0);
    add(new THREE.BoxGeometry(0.05, CH - 1.9, CD), paint, sx * CW / 2, -(CH - 1.9) / 2, 0);
    for (const z of [-CD / 2 + 0.03, 0, CD / 2 - 0.03]) add(new THREE.BoxGeometry(0.06, 0.95, 0.06), paint, sx * CW / 2, -CH + 1.42, z);
    add(new THREE.PlaneGeometry(CD, 0.95), glass, sx * (CW / 2 - 0.01), -CH + 1.42, 0).rotation.y = Math.PI / 2;
  }
  const sideW = (CW - DOOR) / 2;
  for (const sz of [-1, 1]) {                                                                // testate: varco al centro
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(sideW, CH, 0.05), paint, sx * (DOOR / 2 + sideW / 2), -CH / 2, sz * CD / 2);
    add(new THREE.BoxGeometry(DOOR, CH - 1.95, 0.05), paint, 0, -(CH - 1.95) / 2, sz * CD / 2);
  }
  for (const sx of [-1, 1]) { const r = add(new THREE.BoxGeometry(CW / 2 + 0.25, 0.05, CD + 0.25), roofMat, sx * (CW / 4 + 0.05), 0.12, 0); r.rotation.z = -sx * 0.38; }
  add(new THREE.BoxGeometry(0.07, 0.07, CD + 0.3), MAT.wood, 0, 0.27, 0);                         // colmo
  add(new THREE.SphereGeometry(0.07, 8, 6), MAT.window, 0, -0.25, CD / 2 + 0.12);                 // lanterna
  add(new THREE.BoxGeometry(0.34, 0.06, 1.2), MAT.wood, CW / 2 - 0.22, -CH + 0.47, 0);            // panca lungo una fiancata
  add(new THREE.BoxGeometry(0.05, 0.45, 0.05), MAT.wood, CW / 2 - 0.22, -CH + 0.24, -0.5);
  add(new THREE.BoxGeometry(0.05, 0.45, 0.05), MAT.wood, CW / 2 - 0.22, -CH + 0.24, 0.5);
  add(new THREE.CylinderGeometry(0.015, 0.015, CW - 0.1, 5), MAT.brass, 0, -CH + 1.75, 0).rotation.z = Math.PI / 2; // maniglione

  // --- movimento
  const TRAVEL = 18, STOP = 8;
  // control.manual = true → la posizione della cabina la decide la storia: control.u da 0 (A) a 1 (B)
  const control = { manual: false, u: 1 };
  let t = rnd() * (TRAVEL + STOP) * 2, swing = 0, swingV = 0, roll = 0, rollV = 0, prevS = null, prevV = 0, wheelAng = 0;
  const ease = (q) => q * q * (3 - 2 * q);
  const posAt = (time) => {
    const T = (TRAVEL + STOP) * 2, ph = ((time % T) + T) % T;
    if (ph < TRAVEL) return ease(ph / TRAVEL);
    if (ph < TRAVEL + STOP) return 1;
    if (ph < 2 * TRAVEL + STOP) return 1 - ease((ph - TRAVEL - STOP) / TRAVEL);
    return 0;
  };
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), mid = new THREE.Vector3(), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const dirH = new THREE.Vector3(), basis = new THREE.Matrix4(), bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), smid = new THREE.Vector3(), smm = new THREE.Matrix4(), sq = new THREE.Quaternion(), ssc = new THREE.Vector3(1, 1, 1);
  const update = (dt) => {
    dt = Math.min(dt || 0, 0.05);
    sA.frame(); sB.frame();
    exits[0].g.localToWorld(E1.copy(exits[0].local));
    exits[1].g.localToWorld(E2.copy(exits[1].local));
    for (let k = 0; k < SEG; k++) {
      cablePoint(k / SEG, P0); cablePoint((k + 1) / SEG, P1);
      smid.lerpVectors(P0, P1, 0.5); _v.subVectors(P1, P0); ssc.y = _v.length();
      sq.setFromUnitVectors(UP, _v.normalize());
      cable.setMatrixAt(k, smm.compose(smid, sq, ssc));
    }
    cable.instanceMatrix.needsUpdate = true;
    // bandierine: girano col vento e ondeggiano
    for (const f of flags) {
      f.phase += dt * (3 + 6 * Math.abs(VerletBody.wind.x));
      f.pivot.rotation.y = VerletBody.wind.x >= 0 ? 0 : Math.PI;
      const pa = f.flag.geometry.attributes.position;
      for (let q = 0; q < pa.count; q++) { const x = f.rest[q * 3]; pa.array[q * 3 + 2] = Math.sin(f.phase - x * 9) * 0.06 * x * 2; }
      pa.needsUpdate = true;
    }
    // la cabina si ferma ~0.9 m oltre la ruota, accanto alla pedana
    const len = E1.distanceTo(E2), U0 = 1.0 / len;
    t += dt;
    const u = U0 + (1 - 2 * U0) * (control.manual ? control.u : posAt(t));
    const s = u * len;
    const v = dt > 0 && prevS !== null ? (s - prevS) / dt : 0, acc = dt > 0 ? (v - prevV) / dt : 0;
    prevS = s; prevV = v;
    cablePoint(u, P); cablePoint(Math.min(1, u + 0.01), Q);
    trolley.position.copy(P);
    // orientamento del carrello: Z lungo il cavo, Y verso l'alto
    bz.subVectors(Q, P).normalize(); bx.crossVectors(UP, bz).normalize(); by.crossVectors(bz, bx);
    trolley.quaternion.setFromRotationMatrix(basis.makeBasis(bx, by, bz));
    const slope = Math.asin(Math.max(-1, Math.min(1, bz.y)));
    for (const w of tw) w.rotation.x -= (v * dt) / 0.11;
    const g = 9.81, wind = VerletBody.wind.x;
    swingV += (-(g / ARM) * Math.sin(swing) - (Math.abs(acc) < 5 ? acc : 0) / ARM * Math.cos(swing) - 0.6 * swingV) * dt;
    swing += swingV * dt;
    rollV += (-(g / ARM) * Math.sin(roll) + (wind * 0.25 * Math.abs(bx.x)) / ARM - 0.8 * rollV) * dt;
    roll += rollV * dt;
    pivot.rotation.set(swing + slope, 0, -roll); // la cabina resta verticale, più l'oscillazione
    wheelAng += (v * dt) / 0.35;
    wheels[0].rotation.y = wheelAng; wheels[1].rotation.y = -wheelAng;
  };
  update(0);
  return {
    name: 'teleferica', bodies: [sA.body, sB.body], object: holder, update,
    control,
    // percorso a piedi sulla pedana: dal varco (verso una casa) al centro e al bordo dove si ferma la cabina
    deckPath: (station, gap, toCabin = true) => {
      const st = station ? sB : sA, L = (x, z) => { const local = new THREE.Vector3(x, 0.03, z), v = new THREE.Vector3(); return () => { st.frame(); return st.g.localToWorld(v.copy(local)); }; };
      const ga = st.gapAngles[gap];
      const pts = [L(Math.sin(ga) * 1.25, Math.cos(ga) * 1.25), L(0, 0), L(0, 1.0)];
      return toCabin ? pts : pts.reverse();
    },
    // il cavo come percorso di punti (da A a B), per le luci che ci corrono sopra
    cablePath: (n = 20, reverse = false) => {
      const pts = Array.from({ length: n + 1 }, (_, k) => { const v = new THREE.Vector3(); return () => cablePoint(k / n, v); });
      return reverse ? pts.reverse() : pts;
    },
    // il punto del cavo sopra la cabina (dove arrivano le luci) e i due capi del cavo
    trolleyPoint: (out = new THREE.Vector3()) => out.copy(trolley.position),
    cableEnd: (station) => () => (station ? E2 : E1),
    // capi di un ponticello legato alla pedana: station 0 = A, 1 = B; gap = indice del varco
    porch: (station, gap) => (side, high = false) => {
      const st = station ? sB : sA, v = new THREE.Vector3();
      const ga = st.gapAngles[gap];
      const local = new THREE.Vector3(side * 0.42, high ? 0.78 : 0.0, 1.3).applyAxisAngle(UP, ga);
      return () => { st.frame(); return st.g.localToWorld(v.copy(local)); };
    },
    loads: [...sA.nodes, ...sB.nodes].map((node) => ({ node, weight: 60 })),
    cabinPoint: (out = new THREE.Vector3()) => cabin.getWorldPosition(out).add(_v.set(0, -CH + 0.05, 0)),
  };
}

// Capo di un ponticello legato al bordo della passerella principale: due nodi vicini
// della stessa colonna (j e j+1); 'high' = il corrimano, 60 cm sopra la rete.
export function walkwayEnd(net, i, j) {
  return (side, high = false) => netPin(net, net.index(i, j + (side > 0 ? 1 : 0)), new THREE.Vector3(0, high ? 0.65 : 0.04, 0));
}
