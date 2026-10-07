// Inhabitants.js
// ---------------------------------------------------------------
// Gli ABITANTI di Valdrada esistono solo nel lago.
//
// Sono lo stesso modello gerarchico del viaggiatore (Traveler), con vestiti di
// altri colori (vivaci, così si riconoscono nel riflesso) e senza bagaglio,
// animati da TravelerAnimator. Stanno sul LAYER 1: la camera del giocatore non li
// vede, la camera specchio sì. Sopra l'acqua il villaggio è vuoto; nell'acqua è
// abitato.
//
// Alcuni camminano avanti e indietro (path), alcuni SALUTANO (wave): il braccio
// destro si alza e la mano oscilla — un gesto fatto ruotando a mano le
// articolazioni del modello (spalla → gomito → polso) dopo l'animazione normale.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { Traveler } from '../player/Traveler.js';
import { TravelerAnimator } from '../player/TravelerAnimator.js';
import { LAYER_REFLECTION_ONLY } from './MirrorWater.js';

const PALETTES = [
  { coat: '#b8432f', trousers: '#3a3530', scarf: '#e3c36a', hat: '#2a2622' },
  { coat: '#3f6f9a', trousers: '#2b2f35', scarf: '#d8d2c4', hat: '#1f2328' },
  { coat: '#d1a24a', trousers: '#4a3b2c', scarf: '#7a3b33', hat: '#5a4636' },
  { coat: '#5f8a5a', trousers: '#2e2a28', scarf: '#c9574a', hat: '#3d3a32' },
  { coat: '#8a5a8a', trousers: '#2f2a30', scarf: '#e8dcc0', hat: '#2c2622' },
  { coat: '#d8d2c4', trousers: '#3b3f44', scarf: '#2f5d6a', hat: '#4a3b2c' },
  { coat: '#2f7f7d', trousers: '#3a3532', scarf: '#e3c36a', hat: '#2a2e33' },
];

export function setLayer(obj, layer) {
  obj.traverse((o) => o.layers.set(layer));
}

function makePerson(k) {
  const t = new Traveler();
  const pal = PALETTES[k % PALETTES.length];
  // vestiti propri: clono i materiali condivisi e cambio colore
  t.root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    const c = '#' + o.material.color.getHexString();
    if (c === '#2e3f55') o.material.color.set(pal.coat);
    else if (c === '#3b3530') o.material.color.set(pal.trousers);
    else if (c === '#a8352c') o.material.color.set(pal.scarf);
    else if (c === '#4a3b2c') o.material.color.set(pal.hat);
  });
  // niente zaino né lanterna: sono a casa loro
  if (t.joints.pack) t.joints.pack.visible = false;
  if (t.light && t.light.parent) t.light.parent.remove(t.light);
  setLayer(t.root, LAYER_REFLECTION_ONLY);
  return { t, anim: new TravelerAnimator(t) };
}

// people: [{ pos: Vector3, facing, path?: [Vector3, Vector3], speed?, wave?, scale?, action?, visible? }]
// (action: un gesto di TravelerAnimator, es. 'pull' per chi suona la campana)
export class Inhabitants {
  constructor(scene, people) {
    this.time = 0;
    this.list = people.map((p, k) => {
      const { t, anim } = makePerson(k);
      t.root.position.copy(p.pos);
      if (p.scale) t.root.scale.setScalar(p.scale);
      scene.add(t.root);
      return { ...p, t, anim, u: Math.random(), dir: 1, facing: p.facing || 0, wait: 0, ph: Math.random() * 10 };
    });
  }

  // aggiunge una persona dopo la creazione (restituisce il suo oggetto, per guidarla)
  spawn(scene, p) {
    const { t, anim } = makePerson(this.list.length);
    t.root.position.copy(p.pos); if (p.scale) t.root.scale.setScalar(p.scale); scene.add(t.root);
    const o = { ...p, t, anim, u: 0, dir: 1, facing: p.facing || 0, wait: 0, ph: Math.random() * 10 };
    this.list.push(o); return o;
  }

  update(dt) {
    this.time += dt;
    for (const p of this.list) {
      let speed = 0;
      if (p.path) {
        // va avanti e indietro lungo il suo tratto, fermandosi un attimo alle estremità
        const [a, b] = p.path, len = a.distanceTo(b);
        if (p.wait > 0) p.wait -= dt;
        else {
          p.u += p.dir * (p.speed || 0.9) * dt / len;
          if (p.u >= 1 || p.u <= 0) { p.u = THREE.MathUtils.clamp(p.u, 0, 1); p.dir *= -1; p.wait = 2 + Math.random() * 2; }
          speed = p.speed || 0.9;
        }
        p.t.root.position.lerpVectors(a, b, p.u);
        const d = b.clone().sub(a).multiplyScalar(p.dir);
        if (speed) p.facing = Math.atan2(d.x, d.z);
      }
      p.t.root.visible = p.visible !== false;
      p.anim.update(dt, { state: 'walk', onGround: true, speed, vy: 0, wobble: 0, climbT: 0, hands: null, hangSpeed: 0, facing: p.facing, action: p.action || null, wind: 0 });
      if (p.wave) {
        // saluta a intervalli: 3 s di saluto ogni 7 s
        const c = (this.time + p.ph) % 7, on = c < 3, j = p.t.joints;
        if (on) {
          const k = Math.min(1, c * 3, (3 - c) * 3); // alza e abbassa il braccio con dolcezza
          j.shoulderR.rotation.set(-0.3 * k, 0, -2.5 * k);
          j.elbowR.rotation.set(0, 0, -0.5 * k + Math.sin(this.time * 9) * 0.45 * k);
        }
      }
    }
  }
}
