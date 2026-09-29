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
import { stripedFabric, burlap } from './textures.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

const MAT = {
  brass: new THREE.MeshStandardMaterial({ color: '#b08d48', metalness: 0.7, roughness: 0.35 }),
  iron: new THREE.MeshStandardMaterial({ color: '#3b3a38', metalness: 0.6, roughness: 0.5 }),
  wax: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.8 }),
  flame: new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffae3d', emissiveIntensity: 2 }),
  leather: new THREE.MeshStandardMaterial({ color: '#7b5433', roughness: 0.75, flatShading: true }),
  wicker: new THREE.MeshStandardMaterial({ color: '#a47c46', roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
  terracotta: new THREE.MeshStandardMaterial({ color: '#b5603c', roughness: 0.9, flatShading: true }),
  soil: new THREE.MeshStandardMaterial({ color: '#3d2b1f', roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }),
  rope: new THREE.MeshStandardMaterial({ color: '#8a7556', roughness: 1 }),
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
export function chandelier(net, { i, j, length = 2.5, intensity = 6 }) {
  const { body, idx, n } = simpleRope(net, i, j, length, 6, { damping: 0.995 });

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
    candle.add(wax, flame); arm.add(bar, candle); ring.add(arm);
    flames.push(flame);
  }
  const light = new THREE.PointLight('#ffb866', intensity, 12, 1.6);
  light.position.y = -0.2;
  root.add(rod, hub, ring, light);

  return {
    name: 'lampadario', bodies: [body], loads: [{ node: n, weight: 40 }], object: root,
    update(dt, t) {
      const end = body.pos[idx[idx.length - 1]], before = body.pos[idx[idx.length - 2]];
      hangAlong(root, before, end);
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
export function waterskin(net, { i, j, length = 1.2 }) {
  const { body, idx, n } = simpleRope(net, i, j, length, 3);
  const root = new THREE.Group(); root.name = 'otre';
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 5, 8), MAT.rope);
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
// CASA FATTA A SACCO: appesa a quattro nodi, con porta e finestra accesa
// ===============================================================
export function sackHouse(net, { i, j, size = 2, drop = 1.2, yaw = 0, seed = 1 }) {
  const corners = [[i, j], [i + size, j], [i, j + size], [i + size, j + size]].map(([a, b]) => net.index(a, b));
  const body = new VerletBody({ damping: 0.99, iterations: 16 });
  const center = new THREE.Vector3();
  const pins = corners.map((n) => { const p = nodePos(net, n); center.add(p); return body.addParticle(p, netPin(net, n)); });
  center.divideScalar(4); center.y -= drop;
  const knot = body.addParticle(center);
  for (const p of pins) body.addConstraint(p, knot); // quattro funi tese fino al nodo centrale
  const idx = body.chain(knot, 0.8, 2);

  const root = new THREE.Group(); root.name = 'casa a sacco';
  const tex = burlap(seed); tex.repeat.set(3, 2);
  const profile = [[0.12, 0], [0.2, -0.15], [0.7, -0.5], [1.1, -1.0], [1.25, -1.6], [1.2, -2.2], [0.95, -2.7], [0.5, -3.0], [0.001, -3.08]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const sack = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, flatShading: true }));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12), MAT.rope);
  tie.rotation.x = Math.PI / 2; tie.position.y = -0.08;
  const band1 = new THREE.Mesh(new THREE.TorusGeometry(1.11, 0.04, 5, 24), MAT.rope);
  band1.rotation.x = Math.PI / 2; band1.position.y = -1.0;
  const band2 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 5, 24), MAT.rope);
  band2.rotation.x = Math.PI / 2; band2.position.y = -2.2;
  // porta (verso +Z locale) e una finestrella accesa
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), MAT.dark);
  door.position.set(0, -1.75, 1.245);
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), MAT.window);
  win.position.set(Math.sin(0.7) * 1.13, -1.15, Math.cos(0.7) * 1.13); win.rotation.y = 0.7;
  root.add(sack, tie, band1, band2, door, win);

  return {
    name: 'casa', bodies: [body], loads: corners.map((node) => ({ node, weight: 70 })), object: root,
    update() { hangAlong(root, body.pos[idx[idx.length - 2]], body.pos[idx[idx.length - 1]], yaw); },
  };
}
