// Walkway.js
// ---------------------------------------------------------------
// Le traversine di legno posate sulla rete.
//
// Ogni traversina è un'asse che va dal nodo (i0, j) al nodo (i1, j)
// della rete: a ogni frame leggiamo la posizione di quei nodi e
// orientiamo l'asse di conseguenza, così le traversine seguono
// la rete quando si piega e oscilla.
//
// Per disegnarle usiamo un InstancedMesh: una sola geometria,
// disegnata N volte con matrici diverse (molto più veloce di N mesh).
// ---------------------------------------------------------------
import * as THREE from 'three';

export class Walkway {
  constructor(net, {
    fromCol = 10,       // prima colonna della passerella
    toCol = 14,         // ultima colonna (larghezza = toCol - fromCol metri)
    missing = [],       // file di traversine mancanti (buchi più grandi da saltare)
    depth = 0.6,        // profondità dell'asse lungo Z (il resto della maglia è "intervallo")
    thickness = 0.06,
    overhang = 0.15,    // quanto l'asse sporge oltre i nodi ai lati
  } = {}) {
    this.net = net;
    Object.assign(this, { fromCol, toCol, depth, thickness, overhang });
    this.topOffset = thickness + 0.02; // altezza del piano di calpestio sopra la fune

    // Una traversina per ogni fila della rete, tranne quelle mancanti
    this.planks = [];
    this.byRow = new Map();
    for (let j = 0; j < net.rows; j++) {
      if (missing.includes(j)) continue;
      const plank = { row: j, i0: fromCol, i1: toCol, broken: false };
      this.planks.push(plank);
      this.byRow.set(j, plank);
    }

    // Mesh istanziata
    const geo = new THREE.BoxGeometry(1, thickness, depth);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    this.object = new THREE.InstancedMesh(geo, mat, this.planks.length);
    this.object.frustumCulled = false;

    // Ogni asse con una sfumatura di legno leggermente diversa
    const base = new THREE.Color('#7a5a3a');
    const c = new THREE.Color();
    this.planks.forEach((p, k) => {
      c.copy(base).offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.08);
      this.object.setColorAt(k, c);
    });

    // oggetti temporanei riusati a ogni frame (evitiamo di creare garbage)
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
    this._f = new THREE.Vector3(); this._g = new THREE.Vector3();
    this._x = new THREE.Vector3(); this._y = new THREE.Vector3(); this._z = new THREE.Vector3();
    this._m = new THREE.Matrix4(); this._s = new THREE.Vector3();

    this.update();
  }

  node(i, j, out) {
    const k = this.net.index(i, j) * 3;
    return out.set(this.net.pos[k], this.net.pos[k + 1], this.net.pos[k + 2]);
  }

  // Ricalcola la matrice di ogni traversina dalle posizioni dei nodi
  update() {
    const { net, _a: a, _b: b, _f: f, _g: g, _x: X, _y: Y, _z: Z, _m: m } = this;
    this.planks.forEach((p, k) => {
      if (p.broken) { m.makeScale(0, 0, 0); this.object.setMatrixAt(k, m); return; }
      this.node(p.i0, p.row, a);
      this.node(p.i1, p.row, b);

      // asse X: lungo la traversina
      X.subVectors(b, a);
      const len = X.length();
      X.divideScalar(len);

      // asse Z: direzione della rete lungo il cammino (dalla fila prima alla fila dopo)
      const mid = Math.round((p.i0 + p.i1) / 2);
      const jPrev = Math.max(0, p.row - 1), jNext = Math.min(net.rows - 1, p.row + 1);
      this.node(mid, jNext, f).sub(this.node(mid, jPrev, g));
      Y.crossVectors(f, X).normalize();   // asse Y: perpendicolare alla rete, verso l'alto
      Z.crossVectors(X, Y);

      m.makeBasis(X, Y, Z);
      m.scale(this._s.set(len + this.overhang * 2, 1, 1));
      a.add(b).multiplyScalar(0.5).addScaledVector(Y, this.thickness / 2 + 0.02);
      m.setPosition(a);
      this.object.setMatrixAt(k, m);
    });
    this.object.instanceMatrix.needsUpdate = true;
  }

  // Posizione Z reale (non a riposo) del centro di una traversina
  plankZ(p) {
    const ka = this.net.index(p.i0, p.row) * 3 + 2;
    const kb = this.net.index(p.i1, p.row) * 3 + 2;
    return (this.net.pos[ka] + this.net.pos[kb]) / 2;
  }

  // Estremi in X di una traversina (con la sporgenza)
  plankXRange(p) {
    const s = this.net.spacing;
    return [this.net.x0 + p.i0 * s - this.overhang, this.net.x0 + p.i1 * s + this.overhang];
  }

  // Il piede in (x, z) poggia su una traversina? Restituisce la traversina o null.
  plankUnder(x, z) {
    const j = Math.round((z - this.net.z0) / this.net.spacing);
    for (let r = j - 1; r <= j + 1; r++) {
      const p = this.byRow.get(r);
      if (!p || p.broken) continue;
      const [xa, xb] = this.plankXRange(p);
      if (x < xa || x > xb) continue;
      if (Math.abs(z - this.plankZ(p)) <= this.depth / 2) return p;
    }
    return null;
  }

  // La traversina più vicina entro 'reach' metri in Z (per risalire quando si è appesi)
  nearestPlank(x, z, reach = 0.9) {
    const j = Math.round((z - this.net.z0) / this.net.spacing);
    let best = null, bestD = reach;
    for (let r = j - 1; r <= j + 1; r++) {
      const p = this.byRow.get(r);
      if (!p || p.broken) continue;
      const [xa, xb] = this.plankXRange(p);
      if (x < xa - 0.3 || x > xb + 0.3) continue;
      const d = Math.abs(z - this.plankZ(p));
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }
}
