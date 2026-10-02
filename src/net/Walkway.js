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
    worn = [],          // file di traversine vecchie (legno grigio, funi logore sotto)
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
      const plank = {
        row: j, i0: fromCol, i1: toCol, broken: false, worn: worn.includes(j),
        top: new THREE.Vector3(),          // un punto della faccia superiore (aggiornato ogni frame)
        normal: new THREE.Vector3(0, 1, 0), // normale dell'asse
      };
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
    const old = new THREE.Color('#6b6358');   // legno vecchio: grigio, sbiadito
    const c = new THREE.Color();
    this.planks.forEach((p, k) => {
      c.copy(p.worn ? old : base).offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.08);
      this.object.setColorAt(k, c);
      p.color = c.clone();
      p.index = k;
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

      // L'asse è la corda tra i due nodi estremi. Se qualche nodo intermedio della
      // fila sta più in alto della corda, alzo l'asse: deve sempre poggiare SOPRA le funi.
      let lift = 0;
      for (let i = p.i0 + 1; i < p.i1; i++) {
        const t = (i - p.i0) / (p.i1 - p.i0);
        const chordY = a.y + (b.y - a.y) * t;
        const nodeY = net.pos[net.index(i, p.row) * 3 + 1];
        lift = Math.max(lift, nodeY - chordY);
      }

      m.makeBasis(X, Y, Z);
      m.scale(this._s.set(len + this.overhang * 2, 1, 1));
      a.add(b).multiplyScalar(0.5).addScaledVector(Y, this.thickness / 2 + 0.02);
      a.y += lift;
      m.setPosition(a);
      this.object.setMatrixAt(k, m);

      // memorizzo il piano della faccia superiore: serve per appoggiarci i piedi
      p.normal.copy(Y);
      p.top.copy(a).addScaledVector(Y, this.thickness / 2);
    });
    this.object.instanceMatrix.needsUpdate = true;
  }

  // Altezza della faccia superiore dell'asse nel punto (x, z).
  // È l'equazione del piano: n · (P - T) = 0  →  y = T.y - (nx·(x-Tx) + nz·(z-Tz)) / ny
  plankTopAt(p, x, z) {
    const n = p.normal, t = p.top;
    return t.y - (n.x * (x - t.x) + n.z * (z - t.z)) / n.y;
  }

  // Il peso su un'asse rigida si distribuisce su tutti i nodi della fila su cui
  // appoggia, di più su quelli vicini ai piedi: così l'asse si abbassa tutta
  // insieme e si inclina un po' verso il lato su cui stai.
  applyLoad(p, x, force) {
    const net = this.net, s = net.spacing;
    const xa = net.x0 + p.i0 * s, xb = net.x0 + p.i1 * s;
    const t = THREE.MathUtils.clamp((x - xa) / (xb - xa), 0, 1);
    const n = p.i1 - p.i0;
    let total = 0;
    const w = [];
    for (let i = 0; i <= n; i++) {
      w[i] = Math.max(0.2, 1 - Math.abs(i / n - t) * 1.5);
      total += w[i];
    }
    for (let i = 0; i <= n; i++) {
      net.acc[net.index(p.i0 + i, p.row) * 3 + 1] -= force * w[i] / total;
    }
  }

  // Controlla se qualche traversina ha perso il suo sostegno: quando almeno 2 funi
  // longitudinali legate ai suoi nodi sono spezzate, l'asse si stacca e cade.
  // Restituisce le traversine appena cadute (con la loro matrice, per animarle).
  checkBroken() {
    const net = this.net, fallen = [];
    for (const p of this.planks) {
      if (p.broken) continue;
      let count = 0;
      for (let i = p.i0; i <= p.i1; i++) {
        const up = p.row > 0 ? net.vRope[net.index(i, p.row - 1)] : -1;
        const down = net.vRope[net.index(i, p.row)];
        if (up >= 0 && net.broken[up]) count++;
        if (down >= 0 && net.broken[down]) count++;
      }
      if (count >= 2) {
        const matrix = new THREE.Matrix4();
        this.object.getMatrixAt(p.index, matrix);
        p.broken = true;
        fallen.push({ plank: p, matrix });
      }
    }
    return fallen;
  }

  reset() {
    for (const p of this.planks) p.broken = false;
    this.update();
  }

  // Posizione Z reale (non a riposo) del centro di una traversina
  plankZ(p) {
    const ka = this.net.index(p.i0, p.row) * 3 + 2;
    const kb = this.net.index(p.i1, p.row) * 3 + 2;
    return (this.net.pos[ka] + this.net.pos[kb]) / 2;
  }

  // Estremi in X di una traversina (con la sporgenza), dalla posizione VERA dei suoi nodi:
  // quando il vento fa ondeggiare la rete di lato, le assi si spostano davvero
  plankXRange(p) {
    const xa = this.net.pos[this.net.index(p.i0, p.row) * 3];
    const xb = this.net.pos[this.net.index(p.i1, p.row) * 3];
    return [Math.min(xa, xb) - this.overhang, Math.max(xa, xb) + this.overhang];
  }

  // Centro in X di una traversina (per portarsi dietro chi ci sta sopra)
  plankX(p) {
    return (this.net.pos[this.net.index(p.i0, p.row) * 3] + this.net.pos[this.net.index(p.i1, p.row) * 3]) / 2;
  }


  // Il piede in (x, z) poggia su una traversina? Restituisce la traversina o null.
  // 'current' è l'asse su cui si trova già: le diamo un po' di margine in più
  // (isteresi), così non si "perde" l'asse per pochi centimetri mentre oscilla.
  plankUnder(x, z, current = null) {
    if (current && !current.broken) {
      const [xa, xb] = this.plankXRange(current);
      if (x >= xa && x <= xb && Math.abs(z - this.plankZ(current)) <= this.depth / 2 + 0.12) return current;
    }
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
