// HangingSystem.js
// ---------------------------------------------------------------
// Gestisce tutto ciò che sta appeso sotto la rete di Ottavia.
//
// Ogni "oggetto appeso" (vedi items.js) è fatto di:
//   bodies   → uno o più VerletBody (le sue funi)
//   loads    → il suo peso, scaricato sui nodi della rete a cui è legato
//   object   → il modello 3D (spesso gerarchico)
//   update() → aggiorna il modello dalle particelle (e le sue animazioni)
//
// Le funi di tutti gli oggetti sono disegnate insieme in un'unica
// LineSegments (una sola chiamata di disegno per centinaia di funi).
// ---------------------------------------------------------------
import * as THREE from 'three';

const ROPE_COLOR = new THREE.Color('#8a7556');

export class HangingSystem {
  constructor(scene, net) {
    this.scene = scene;
    this.net = net;
    this.items = [];
    this.group = new THREE.Group();
    this.group.name = 'hanging';
    scene.add(this.group);
  }

  add(item) {
    item.released = false;
    this.items.push(item);
    if (item.object) this.group.add(item.object);
    return item;
  }

  get(id) {
    return this.items.find((it) => it.id === id);
  }

  // Punto in cui l'oggetto è legato alla rete (la prima particella fissata)
  anchorOf(item) {
    const body = item.bodies[0];
    const i = body.pin.findIndex((p) => p);
    return body.pos[i];
  }

  // Dove si trova l'oggetto vero e proprio: la fine della sua (prima) fune
  focusOf(item) {
    const body = item.bodies[0];
    return body.pos[body.pos.length - 1];
  }

  // Accorcia (f < 1) o riallunga (f = 1) le funi dell'oggetto: è il gesto di "tirarlo su".
  // Le funi resistono solo alla trazione, quindi accorciandole l'oggetto sale da solo.
  reel(item, f) {
    for (const c of item.bodies[0].constraints) if (!c.rigid && c.baseLen) c.len = c.baseLen * f;
  }

  // Taglia le funi: l'oggetto precipita e il suo peso sparisce dalla rete.
  // Lo appendo a un perno nel punto dell'oggetto, così ruota attorno a sé mentre cade.
  release(item, debris) {
    if (item.released) return null;
    item.released = true;
    const pivot = new THREE.Group();
    pivot.position.copy(this.focusOf(item));
    this.scene.add(pivot);
    pivot.attach(item.object);
    debris.spawnObject(pivot, new THREE.Vector3(0, -0.5, 0));
    return pivot;
  }

  // Da chiamare dopo aver aggiunto tutti gli oggetti: prepara le funi da disegnare
  build() {
    this.visible = [];
    for (const item of this.items) {
      for (const body of item.bodies) {
        body.save();
        for (const c of body.constraints) {
          c.baseLen = c.len; // lunghezza originale, per poter accorciare e riallungare le funi
          if (c.visible) this.visible.push({ item, body, c });
        }
      }
    }
    const n = this.visible.length;
    this.positions = new Float32Array(n * 6);
    const colors = new Float32Array(n * 6);
    this.visible.forEach(({ c }, k) => {
      const col = c.color ? new THREE.Color(c.color) : ROPE_COLOR;
      colors.set([col.r, col.g, col.b, col.r, col.g, col.b], k * 6);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }));
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
  }

  // Lascia assestare funi e oggetti prima di mostrarli (partono dritti e fermi),
  // poi salva lo stato per il tasto R.
  settle(seconds = 3, dt = 1 / 120) {
    for (let t = 0; t < seconds; t += dt) {
      this.step(dt);
      for (const item of this.items) item.update?.(0, 0);
    }
    this.save();
  }

  save() {
    for (const item of this.items) for (const body of item.bodies) body.save();
  }

  // Nel passo fisso, PRIMA di net.step: il peso degli oggetti tira giù i loro nodi
  applyLoads() {
    const acc = this.net.acc;
    for (const item of this.items) {
      if (item.released) continue;
      for (const { node, weight } of item.loads) acc[node * 3 + 1] -= weight;
    }
  }

  // Nel passo fisso, DOPO net.step: le funi seguono i nodi che si sono mossi
  step(dt) {
    for (const item of this.items) if (!item.released) for (const body of item.bodies) body.step(dt);
  }

  // Una volta per frame: modelli 3D e funi
  update(dt, time) {
    for (const item of this.items) if (!item.released) item.update?.(dt, time);
    this.visible.forEach(({ item, body, c }, k) => {
      if (item.released) { this.positions.fill(0, k * 6, k * 6 + 6); return; } // funi tagliate
      const a = body.pos[c.a], b = body.pos[c.b];
      this.positions.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
    });
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  reset() {
    for (const item of this.items) {
      if (item.released) {
        item.released = false;
        item.object.position.set(0, 0, 0);   // dopo la caduta era relativo al perno: lo azzero
        item.object.quaternion.identity();
        this.group.add(item.object);
      }
      for (const body of item.bodies) {
        body.reset();
        for (const c of body.constraints) if (c.baseLen) c.len = c.baseLen;
      }
      item.update?.(0, 0);
    }
  }
}
