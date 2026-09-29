// VerletBody.js
// ---------------------------------------------------------------
// Un piccolo "corpo morbido" simulato con Verlet: particelle + vincoli.
// È lo stesso metodo della rete (VerletNet), in versione generica,
// e serve per tutto ciò che è appeso: funi, amache, scale di corda…
//
// - una particella può essere FISSATA (pin) a un punto che si muove,
//   ad esempio un nodo della rete: la funzione pin() dice dov'è ora
// - un vincolo può essere:
//     · una fune   (rigid = false): resiste solo se tirata, si allenta se compressa
//     · un'asta    (rigid = true):  mantiene sempre la sua lunghezza (pioli, sbarre)
// ---------------------------------------------------------------
import * as THREE from 'three';

export class VerletBody {
  constructor({ damping = 0.99, gravity = -9.81, iterations = 12 } = {}) {
    Object.assign(this, { damping, gravity, iterations });
    this.pos = [];    // THREE.Vector3 per ogni particella
    this.prev = [];
    this.pin = [];    // funzione () => Vector3, oppure null
    this.constraints = []; // { a, b, len, rigid, visible, color }
    this._d = new THREE.Vector3();
  }

  addParticle(position, pin = null) {
    this.pos.push(position.clone());
    this.prev.push(position.clone());
    this.pin.push(pin);
    return this.pos.length - 1;
  }

  addConstraint(a, b, { len = null, rigid = false, visible = true, color = null } = {}) {
    const c = { a, b, len: len ?? this.pos[a].distanceTo(this.pos[b]), rigid, visible, color };
    this.constraints.push(c);
    return c;
  }

  // Una catena di 'segments' tratti che parte dalla particella 'from' e scende
  // in verticale per 'length' metri. Restituisce gli indici (compreso 'from').
  chain(from, length, segments, opts = {}) {
    const idx = [from];
    const step = length / segments;
    for (let k = 1; k <= segments; k++) {
      const p = this.pos[from].clone(); p.y -= step * k;
      const i = this.addParticle(p);
      this.addConstraint(idx[k - 1], i, { len: step, ...opts });
      idx.push(i);
    }
    return idx;
  }

  step(dt) {
    const { pos, prev, pin } = this;
    const dt2 = dt * dt;
    // 1) Verlet: inerzia + gravità (le particelle fissate seguono il loro punto)
    for (let i = 0; i < pos.length; i++) {
      if (pin[i]) { prev[i].copy(pos[i]); pos[i].copy(pin[i]()); continue; }
      const p = pos[i], q = prev[i];
      const vx = (p.x - q.x) * this.damping, vy = (p.y - q.y) * this.damping, vz = (p.z - q.z) * this.damping;
      q.copy(p);
      p.x += vx; p.y += vy + this.gravity * dt2; p.z += vz;
    }
    // 2) vincoli
    for (let it = 0; it < this.iterations; it++) {
      for (const c of this.constraints) {
        const a = pos[c.a], b = pos[c.b];
        const d = this._d.subVectors(b, a);
        const len = d.length();
        if (len === 0 || (!c.rigid && len <= c.len)) continue;
        const wa = pin[c.a] ? 0 : 1, wb = pin[c.b] ? 0 : 1;
        if (wa + wb === 0) continue;
        d.multiplyScalar((len - c.len) / len / (wa + wb));
        a.addScaledVector(d, wa);
        b.addScaledVector(d, -wb);
      }
    }
  }

  // Fotografia della posizione iniziale, per ricominciare
  save() { this.saved = this.pos.map((p) => p.clone()); }
  reset() {
    this.saved.forEach((p, i) => { this.pos[i].copy(p); this.prev[i].copy(p); });
  }
}

// Un pin che segue il nodo n della rete (con uno spostamento opzionale)
export function netPin(net, n, offset = null) {
  const v = new THREE.Vector3();
  return () => {
    const k = n * 3;
    v.set(net.pos[k], net.pos[k + 1], net.pos[k + 2]);
    if (offset) v.add(offset);
    return v;
  };
}

// Un pin a metà strada (t = 0..1) tra due nodi della rete
export function netPinBetween(net, n1, n2, t) {
  const v = new THREE.Vector3();
  return () => {
    const a = n1 * 3, b = n2 * 3;
    v.set(
      net.pos[a] + (net.pos[b] - net.pos[a]) * t,
      net.pos[a + 1] + (net.pos[b + 1] - net.pos[a + 1]) * t,
      net.pos[a + 2] + (net.pos[b + 2] - net.pos[a + 2]) * t,
    );
    return v;
  };
}
