// InteractionManager.js
// ---------------------------------------------------------------
// Il sistema di interazione con il tasto E.
//
// Qualunque cosa può diventare interattiva registrandosi con:
//   interactions.add({
//     id: 'nota-arrivo',
//     position: () => vector3,       // dove si trova ADESSO (può muoversi con la rete)
//     radius: 1.6,                   // entro quanti metri si può interagire
//     prompt: 'Read',                // la scritta accanto a [E]
//     enabled: () => true,           // (facoltativo) quando è disponibile
//     onInteract: async () => {…},   // cosa succede (può usare await narrator.say(...))
//   });
//
// Ogni frame sceglie l'interazione disponibile più vicina, davanti al
// viaggiatore, e la segnala con un piccolo rombo luminoso che fluttua
// sopra l'oggetto (animazione procedurale) e con la scritta [E] in basso.
// ---------------------------------------------------------------
import * as THREE from 'three';

export class InteractionManager {
  constructor(scene, player, narrator) {
    this.player = player;
    this.narrator = narrator;
    this.list = [];
    this.current = null;
    this.running = false;   // true mentre un'interazione è in corso
    this.time = 0;
    this.cooldown = 0;      // breve pausa dopo un'interazione: E ripetuto non la riapre subito

    // Indicatore 3D: un rombo dorato che ruota e fluttua sopra l'oggetto
    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#e8a93a', emissiveIntensity: 1.4 }),
    );
    this.marker.visible = false;
    scene.add(this.marker);

    // Scritta [E] in basso
    this.promptEl = document.createElement('div');
    this.promptEl.id = 'prompt';
    document.body.appendChild(this.promptEl);

    addEventListener('keydown', (e) => {
      if (e.code !== 'KeyE' || e.repeat) return;
      if (this.current && !this.running && !this.narrator.busy && !this.blocked && this.cooldown <= 0) this.trigger(this.current);
    });
  }

  add(interaction) {
    this.list.push({ radius: 1.6, enabled: () => true, ...interaction });
    return interaction;
  }

  remove(id) {
    this.list = this.list.filter((i) => i.id !== id);
  }

  async trigger(it) {
    this.running = true;
    this.player.frozen = true;
    this.hide();
    try {
      await it.onInteract();
    } finally {
      this.player.frozen = false;
      this.running = false;
      this.cooldown = 0.6;
    }
  }

  update(dt) {
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const p = this.player;
    // si interagisce solo stando in piedi, e non durante un'altra interazione
    if (this.running || this.narrator.busy || this.blocked || p.state !== 'walk' || !p.onGround) { this.hide(); return; }

    const forward = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
    const _d = new THREE.Vector3();
    let best = null, bestScore = Infinity;
    for (const it of this.list) {
      if (!it.enabled()) continue;
      const pos = it.position();
      _d.subVectors(pos, p.position);
      const dist = Math.hypot(_d.x, _d.z);
      if (dist > it.radius || Math.abs(_d.y) > 4) continue;
      // preferisco ciò che ho davanti: le cose alle spalle "costano" di più
      const facing = dist > 0.01 ? (_d.x * forward.x + _d.z * forward.z) / dist : 1;
      const score = dist * (1.6 - facing * 0.6);
      if (score < bestScore) { bestScore = score; best = it; }
    }

    this.current = best;
    if (!best) { this.hide(); return; }
    const pos = best.position();
    this.marker.visible = true;
    this.marker.position.set(pos.x, pos.y + (best.markerHeight ?? 0.5) + Math.sin(this.time * 3) * 0.06, pos.z);
    this.marker.rotation.y += dt * 2;
    this.marker.scale.setScalar(1 + 0.12 * Math.sin(this.time * 6));
    const label = typeof best.prompt === 'function' ? best.prompt() : best.prompt;
    this.promptEl.innerHTML = `<kbd>E</kbd>${label}`;
    this.promptEl.classList.add('show');
  }

  hide() {
    this.marker.visible = false;
    this.promptEl.classList.remove('show');
  }
}
