// Pulse.js
// ---------------------------------------------------------------
// Gli IMPULSI DI LUCE che corrono lungo le funi quando qualcuno le pizzica.
//
// 1) ripple(nodo): un'onda che si allarga sulla RETE dal nodo pizzicato.
//    Calcolo una volta le distanze (in "salti di fune") da quel nodo con una
//    visita in ampiezza (BFS) sul grafo nodi-funi; a ogni frame la luce di
//    una fune è una gaussiana centrata sul fronte dell'onda:
//       luce = exp(-((d - fronte) / larghezza)²) · dissolvenza
//    Le funi spezzate non conducono: l'onda gira intorno ai buchi.
//    Disegno: una LineSegments sovrapposta alla rete + un punto luminoso per
//    nodo (Points), con blending additivo (nero = invisibile).
//
// 2) send(percorso): una luce che viaggia lungo un percorso qualunque (una fune,
//    un cavo, un ponticello), fatto di punti che possono muoversi. Restituisce una
//    Promise che si risolve quando la luce arriva: la storia può fare
//       await pulse.send([...]); // la risposta è arrivata
// ---------------------------------------------------------------
import * as THREE from 'three';

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.8)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Pulse {
  constructor(scene, net) {
    this.net = net;
    this.ripples = [];
    this.travellers = [];
    const nR = net.rest.length, nN = net.count;

    // --- sovrapposizione luminosa della rete
    this.linePos = new Float32Array(nR * 6);
    this.lineCol = new Float32Array(nR * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(this.lineCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false; this.lines.visible = false;
    this.pointCol = new Float32Array(nN * 3);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(net.pos, 3).setUsage(THREE.DynamicDrawUsage)); // le posizioni della rete stessa
    pg.setAttribute('color', new THREE.BufferAttribute(this.pointCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tex = glowTexture();
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.5, map: this.tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.points.frustumCulled = false; this.points.visible = false;
    scene.add(this.lines, this.points);

    // --- per gli impulsi in viaggio: un gruppo di sprite riusati
    this.spriteMat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.group = new THREE.Group(); scene.add(this.group);

    // vicini di ogni nodo (per la visita in ampiezza)
    this.adj = Array.from({ length: nN }, () => []);
    for (let c = 0; c < nR; c++) { this.adj[net.ca[c]].push([net.cb[c], c]); this.adj[net.cb[c]].push([net.ca[c], c]); }
    this.intensity = new Float32Array(nN);
  }

  // distanza in salti da 'start' lungo le funi integre
  hops(start) {
    const n = this.net.count, dist = new Float32Array(n).fill(Infinity), queue = [start];
    dist[start] = 0;
    for (let q = 0; q < queue.length; q++) {
      const a = queue[q];
      for (const [b, c] of this.adj[a]) {
        if (this.net.broken[c] || dist[b] !== Infinity) continue;
        dist[b] = dist[a] + 1; queue.push(b);
      }
    }
    return dist;
  }

  // un'onda sulla rete
  ripple(node, { color = '#ffd98a', speed = 9, maxHops = 14, width = 1.3 } = {}) {
    this.ripples.push({ dist: this.hops(node), t: 0, color: new THREE.Color(color), speed, maxHops, width });
  }

  // una luce che viaggia lungo 'path' (array di Vector3 o di funzioni che restituiscono un Vector3)
  send(path, { speed = 7, duration = null, color = '#ffe6a8', size = 0.45 } = {}) {
    return new Promise((resolve) => {
      const head = new THREE.Sprite(this.spriteMat.clone());
      head.material.color.set(color); head.scale.setScalar(size);
      const trail = [0, 1, 2, 3].map((k) => { const s = new THREE.Sprite(head.material.clone()); s.scale.setScalar(size * (0.75 - k * 0.15)); s.material.opacity = 0.6 - k * 0.13; this.group.add(s); return s; });
      this.group.add(head);
      this.travellers.push({ path, s: 0, speed, duration, head, trail, resolve, t: 0 });
    });
  }

  // punti del percorso, a questo istante
  static resolve(path) { return path.map((p) => (typeof p === 'function' ? p().clone() : p.clone())); }
  static at(pts, s) {
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const l = pts[k - 1].distanceTo(pts[k]);
      if (acc + l >= s) return new THREE.Vector3().lerpVectors(pts[k - 1], pts[k], l > 0 ? (s - acc) / l : 0);
      acc += l;
    }
    return pts[pts.length - 1].clone();
  }
  static length(pts) { let L = 0; for (let k = 1; k < pts.length; k++) L += pts[k - 1].distanceTo(pts[k]); return L; }

  clear() {
    this.ripples.length = 0;
    for (const tr of this.travellers) { this.group.remove(tr.head, ...tr.trail); tr.resolve(); }
    this.travellers.length = 0;
  }

  update(dt) {
    const net = this.net;
    // --- onde sulla rete
    this.ripples = this.ripples.filter((r) => (r.t += dt) * r.speed < r.maxHops + 3 * r.width);
    const on = this.ripples.length > 0;
    this.lines.visible = this.points.visible = on;
    if (on) {
      const I = this.intensity; I.fill(0);
      const col = this.pointCol; col.fill(0);
      for (const r of this.ripples) {
        const front = r.t * r.speed, fade = Math.max(0, 1 - front / r.maxHops);
        for (let n = 0; n < net.count; n++) {
          const d = r.dist[n];
          if (d === Infinity || Math.abs(d - front) > 3 * r.width) continue;
          const v = Math.exp(-(((d - front) / r.width) ** 2)) * fade;
          if (v <= 0.01) continue;
          I[n] += v;
          col[n * 3] += r.color.r * v; col[n * 3 + 1] += r.color.g * v; col[n * 3 + 2] += r.color.b * v;
        }
      }
      const lp = this.linePos, lc = this.lineCol;
      for (let c = 0; c < net.rest.length; c++) {
        const o = c * 6, a = net.ca[c], b = net.cb[c];
        if (net.broken[c]) { lp.fill(0, o, o + 6); lc.fill(0, o, o + 6); continue; }
        lp[o] = net.pos[a * 3]; lp[o + 1] = net.pos[a * 3 + 1] + 0.01; lp[o + 2] = net.pos[a * 3 + 2];
        lp[o + 3] = net.pos[b * 3]; lp[o + 4] = net.pos[b * 3 + 1] + 0.01; lp[o + 5] = net.pos[b * 3 + 2];
        for (let q = 0; q < 3; q++) { lc[o + q] = Math.min(1, col[a * 3 + q] * 1.4); lc[o + 3 + q] = Math.min(1, col[b * 3 + q] * 1.4); }
      }
      this.lines.geometry.attributes.position.needsUpdate = true;
      this.lines.geometry.attributes.color.needsUpdate = true;
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
    // --- luci in viaggio
    this.travellers = this.travellers.filter((tr) => {
      const pts = Pulse.resolve(tr.path), L = Pulse.length(pts);
      tr.t += dt;
      tr.s = tr.duration ? (tr.t / tr.duration) * L : tr.s + tr.speed * dt;
      tr.head.position.copy(Pulse.at(pts, Math.min(tr.s, L)));
      tr.head.scale.setScalar(tr.head.scale.x * 0.9 + 0.1 * (0.45 + 0.1 * Math.sin(tr.t * 30)));
      tr.trail.forEach((sp, k) => sp.position.copy(Pulse.at(pts, Math.max(0, Math.min(tr.s, L) - (k + 1) * 0.25))));
      if (tr.s >= L) { this.group.remove(tr.head, ...tr.trail); tr.resolve(); return false; }
      return true;
    });
  }
}
