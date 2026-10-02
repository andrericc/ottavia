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
    limit = 0.08,       // allungamento oltre il quale una fune si logora (le funi sane non ci arrivano mai)
    damageRate = 1.5,   // velocità con cui si logora una fune sovraccarica
  } = {}) {
    Object.assign(this, { cols, rows, spacing, slack, iterations, damping, gravity, damageRate });

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
    const add = (n1, n2, len) => { a.push(n1); b.push(n2); rest.push(len); return rest.length - 1; };
    // Per ritrovare le funi a partire dalla griglia:
    //   hRope[i,j] = fune trasversale tra (i,j) e (i+1,j)
    //   vRope[i,j] = fune longitudinale tra (i,j) e (i,j+1)
    this.hRope = new Int32Array(cols * rows).fill(-1);
    this.vRope = new Int32Array(cols * rows).fill(-1);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const n = this.index(i, j);
        if (i < cols - 1) this.hRope[n] = add(n, this.index(i + 1, j), spacing);          // trasversale
        if (j < rows - 1) this.vRope[n] = add(n, this.index(i, j + 1), spacing * slack);  // longitudinale
      }
    }
    this.ca = Int32Array.from(a);
    this.cb = Int32Array.from(b);
    this.rest = Float32Array.from(rest);
    this.stress = new Float32Array(rest.length); // allungamento relativo di ogni fune (0 = a riposo)
    this.broken = new Uint8Array(rest.length);   // 1 = fune spezzata
    this.maxStress = 0;

    // --- Usura
    // Una fune si logora in due casi:
    //   1) è troppo allungata (stress > limit): vale per tutta la rete, ma le funi sane non ci arrivano
    //   2) i suoi nodi reggono un peso diretto oltre la sua capacità (capacity): vale per le funi
    //      vecchie, i cui nodi si sfilano se ci si ferma sopra o ci si salta
    this.limit = new Float32Array(rest.length).fill(limit);
    this.capacity = new Float32Array(rest.length).fill(Infinity);
    this.nodeLoad = new Float32Array(this.count); // peso esterno su ogni nodo nell'ultimo passo
    this.damage = new Float32Array(rest.length);  // 0 = integra, 1 = si spezza
    this.worn = new Uint8Array(rest.length);      // 1 = fune vecchia (disegnata diversa)
    this.ratio = new Float32Array(rest.length); // per ogni fune: 1 = al punto di rottura
    this.maxRatio = 0;       // il valore massimo di ratio su tutta la rete
    this.straining = false;  // true se in questo passo qualche fune si sta logorando
    this.events = [];        // eventi per il resto del gioco (es. { type: 'break', x, y, z })
  }

  // Rende "vecchia" una zona della rete: le funi longitudinali al suo interno reggono
  // al massimo 'capacity' di peso diretto sui loro nodi.
  // cols = [prima, ultima] colonna, rows = [prima, ultima] fila (estremi inclusi).
  weaken({ cols: [c0, c1], rows: [r0, r1], capacity }) {
    for (let j = r0; j < r1; j++) {
      for (let i = c0; i <= c1; i++) {
        const v = this.vRope[this.index(i, j)];
        this.capacity[v] = capacity;
        this.worn[v] = 1;
      }
    }
  }

  // Cambia la capacità di tutte le funi vecchie (la usa la storia: la "porta" del legno grigio)
  setWornCapacity(capacity) {
    for (let c = 0; c < this.capacity.length; c++) if (this.worn[c]) this.capacity[c] = capacity;
  }

  // Le funi vecchie si riposano: azzera il loro danno (solo quelle non ancora spezzate)
  restWorn() {
    for (let c = 0; c < this.damage.length; c++) if (this.worn[c] && !this.broken[c]) this.damage[c] = 0;
  }

  // Una cella della rete è integra se tutte e quattro le sue funi reggono
  cellIntactIJ(i, j) {
    if (i < 0 || j < 0 || i >= this.cols - 1 || j >= this.rows - 1) return false;
    const b = this.broken;
    return !b[this.hRope[this.index(i, j)]] && !b[this.hRope[this.index(i, j + 1)]] &&
           !b[this.vRope[this.index(i, j)]] && !b[this.vRope[this.index(i + 1, j)]];
  }

  cellIntact(x, z) {
    const i = Math.floor((x - this.x0) / this.spacing);
    const j = Math.floor((z - this.z0) / this.spacing);
    return this.cellIntactIJ(Math.min(i, this.cols - 2), Math.min(j, this.rows - 2));
  }

  // Fotografia dello stato, per ricominciare (tasto R) senza ricreare tutto
  saveState() {
    this.saved = { pos: this.pos.slice(), prev: this.prev.slice() };
  }

  restoreState() {
    this.pos.set(this.saved.pos);
    this.prev.set(this.saved.prev);
    this.acc.fill(0);
    this.broken.fill(0);
    this.damage.fill(0);
    this.events.length = 0;
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
      this.nodeLoad[n] = Math.max(0, -acc[k + 1]); // lo registro prima di azzerarlo
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

    // 3) Usura: le funi oltre il loro limite si logorano, e alla fine si spezzano
    this.updateDamage(dt);
  }

  updateDamage(dt) {
    const { stress, limit, capacity, damage, broken, nodeLoad, ca, cb } = this;
    let maxRatio = 0;
    this.straining = false;
    for (let c = 0; c < stress.length; c++) {
      if (broken[c]) continue;
      // quanto è vicina al punto di rottura: 1 = al limite
      const load = Math.max(nodeLoad[ca[c]], nodeLoad[cb[c]]);
      const ratio = Math.max(stress[c] / limit[c], load / capacity[c]);
      this.ratio[c] = ratio;
      if (ratio > maxRatio) maxRatio = ratio;
      if (ratio <= 1) continue;
      this.straining = true;
      damage[c] += (ratio - 1) * this.damageRate * dt;
      if (damage[c] >= 1) this.breakRope(c);
    }
    this.maxRatio = maxRatio;
  }

  breakRope(c) {
    if (this.broken[c]) return;
    this.broken[c] = 1;
    this.damage[c] = 1;

    // Lo strappo si propaga: le funi vecchie vicine (che condividono un nodo o sono
    // sulla stessa fila) ricevono uno strattone. Le funi sane lo reggono senza danni.
    const a = this.ca[c], b = this.cb[c];
    for (let d = 0; d < this.rest.length; d++) {
      if (d === c || this.broken[d] || !this.worn[d]) continue;
      const shares = this.ca[d] === a || this.cb[d] === b || this.ca[d] === b || this.cb[d] === a;
      const beside = Math.abs(this.ca[d] - a) === 1 && Math.abs(this.cb[d] - b) === 1;
      if (shares || beside) this.damage[d] = Math.min(0.99, this.damage[d] + 0.35);
    }

    const ka = this.ca[c] * 3, kb = this.cb[c] * 3;
    this.events.push({
      type: 'break', rope: c,
      x: (this.pos[ka] + this.pos[kb]) / 2,
      y: (this.pos[ka + 1] + this.pos[kb + 1]) / 2,
      z: (this.pos[ka + 2] + this.pos[kb + 2]) / 2,
    });
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
