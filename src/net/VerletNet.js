// VerletNet.js
// ---------------------------------------------------------------
// La rete di Ottavia simulata con integrazione di Verlet.
// Nessuna dipendenza da Three.js: qui c'è solo la fisica.
//
// Idea di base (Verlet "position based"):
//   - ogni NODO ha una posizione attuale e una precedente;
//     la velocità è implicita: v = pos - prev
//   - ogni FUNE è un vincolo di distanza tra due nodi
//   - a ogni passo: 1) muovo i nodi (inerzia + gravità)
//                   2) rimetto a posto le funi troppo tese, più volte
//
// Le funi di canapa resistono solo alla trazione, non alla compressione:
// se due nodi si avvicinano, la fune semplicemente si allenta.
// ---------------------------------------------------------------

export class VerletNet {
  constructor({
    cols = 25,          // nodi lungo X (larghezza della rete)
    rows = 40,          // nodi lungo Z (da una cresta all'altra)
    spacing = 1.0,      // distanza tra i nodi in metri
    origin = { x: 0, y: 0, z: 0 }, // posizione del primo nodo della prima fila (centrato in X)
    slack = 1.02,       // >1 = le funi sono un po' più lunghe del necessario → la rete si incurva
    iterations = 24,    // quante volte risolvo i vincoli per passo (più = rete più rigida)
    damping = 0.992,    // smorzamento (1 = nessuno)
    gravity = -9.81,
  } = {}) {
    Object.assign(this, { cols, rows, spacing, slack, iterations, damping, gravity });

    this.count = cols * rows;
    this.pos = new Float32Array(this.count * 3);
    this.prev = new Float32Array(this.count * 3);
    this.acc = new Float32Array(this.count * 3); // forze esterne del frame (es. il peso del viaggiatore)
    this.pinned = new Uint8Array(this.count);    // 1 = nodo ancorato alla montagna

    // Angolo "minimo" della griglia in XZ (serve per trovare la cella sotto un punto)
    this.x0 = origin.x - ((cols - 1) / 2) * spacing;
    this.z0 = origin.z;
    this.y0 = origin.y;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const n = this.index(i, j);
        const x = this.x0 + i * spacing;
        const z = this.z0 + j * spacing;
        this.setNode(n, x, origin.y, z);
        // la prima e l'ultima fila sono legate alle due creste
        if (j === 0 || j === rows - 1) this.pinned[n] = 1;
      }
    }

    // --- Funi (vincoli) ---
    const a = [], b = [], rest = [];
    const add = (n1, n2, len) => { a.push(n1); b.push(n2); rest.push(len); };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const n = this.index(i, j);
        if (i < cols - 1) add(n, this.index(i + 1, j), spacing);           // trasversale
        if (j < rows - 1) add(n, this.index(i, j + 1), spacing * slack);   // longitudinale
      }
    }
    this.ca = Int32Array.from(a);
    this.cb = Int32Array.from(b);
    this.rest = Float32Array.from(rest);
    this.stress = new Float32Array(rest.length); // allungamento relativo di ogni fune (0 = a riposo)
    this.broken = new Uint8Array(rest.length);   // per lo step "la rete cede"
    this.maxStress = 0;
  }

  index(i, j) { return j * this.cols + i; }

  setNode(n, x, y, z) {
    const k = n * 3;
    this.pos[k] = this.prev[k] = x;
    this.pos[k + 1] = this.prev[k + 1] = y;
    this.pos[k + 2] = this.prev[k + 2] = z;
  }

  // Un passo di simulazione di durata dt (secondi)
  step(dt) {
    const { pos, prev, acc, pinned, damping } = this;
    const dt2 = dt * dt;

    // 1) Integrazione di Verlet: nuova = pos + (pos - prev) * damping + a * dt²
    for (let n = 0; n < this.count; n++) {
      const k = n * 3;
      if (pinned[n]) { acc[k] = acc[k + 1] = acc[k + 2] = 0; continue; }
      for (let c = 0; c < 3; c++) {
        const p = pos[k + c];
        const v = (p - prev[k + c]) * damping;
        prev[k + c] = p;
        const g = c === 1 ? this.gravity : 0;
        pos[k + c] = p + v + (g + acc[k + c]) * dt2;
        acc[k + c] = 0;
      }
    }

    // 2) Rilassamento dei vincoli
    for (let it = 0; it < this.iterations; it++) this.solveConstraints(it === this.iterations - 1);
  }

  solveConstraints(measure) {
    const { pos, pinned, ca, cb, rest, stress, broken } = this;
    let maxS = 0;
    for (let c = 0; c < rest.length; c++) {
      if (broken[c]) continue;
      const ka = ca[c] * 3, kb = cb[c] * 3;
      const dx = pos[kb] - pos[ka];
      const dy = pos[kb + 1] - pos[ka + 1];
      const dz = pos[kb + 2] - pos[ka + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const r = rest[c];

      if (measure) {
        const s = Math.max(0, (len - r) / r);
        stress[c] = s;
        if (s > maxS) maxS = s;
      }
      if (len <= r || len === 0) continue; // fune allentata: nessuna spinta

      const wa = pinned[ca[c]] ? 0 : 1;
      const wb = pinned[cb[c]] ? 0 : 1;
      const w = wa + wb;
      if (w === 0) continue;
      const corr = (len - r) / len / w;
      pos[ka] += dx * corr * wa; pos[ka + 1] += dy * corr * wa; pos[ka + 2] += dz * corr * wa;
      pos[kb] -= dx * corr * wb; pos[kb + 1] -= dy * corr * wb; pos[kb + 2] -= dz * corr * wb;
    }
    if (measure) this.maxStress = maxS;
  }

  // Trova la cella della griglia sotto (x, z) e i pesi bilineari dei 4 nodi.
  // Restituisce null se il punto è fuori dalla rete.
  cellAt(x, z) {
    const u = (x - this.x0) / this.spacing;
    const v = (z - this.z0) / this.spacing;
    if (u < 0 || v < 0 || u > this.cols - 1 || v > this.rows - 1) return null;
    const i = Math.min(Math.floor(u), this.cols - 2);
    const j = Math.min(Math.floor(v), this.rows - 2);
    const fu = u - i, fv = v - j;
    return {
      nodes: [this.index(i, j), this.index(i + 1, j), this.index(i, j + 1), this.index(i + 1, j + 1)],
      weights: [(1 - fu) * (1 - fv), fu * (1 - fv), (1 - fu) * fv, fu * fv],
    };
  }

  // Altezza della rete nel punto (x, z), interpolando i 4 nodi vicini
  heightAt(x, z) {
    const cell = this.cellAt(x, z);
    if (!cell) return null;
    let h = 0;
    for (let q = 0; q < 4; q++) h += this.pos[cell.nodes[q] * 3 + 1] * cell.weights[q];
    return h;
  }

  // Applica una forza verso il basso (es. il peso del viaggiatore) nel punto (x, z)
  applyLoad(x, z, force) {
    const cell = this.cellAt(x, z);
    if (!cell) return;
    for (let q = 0; q < 4; q++) this.acc[cell.nodes[q] * 3 + 1] -= force * cell.weights[q];
  }
}
