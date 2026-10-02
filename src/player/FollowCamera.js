// FollowCamera.js
// ---------------------------------------------------------------
// Camera in terza persona che orbita attorno al viaggiatore.
// Tieni premuto il mouse e trascina per ruotare, rotella per lo zoom.
// ---------------------------------------------------------------
import * as THREE from 'three';

export class FollowCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = Math.PI;      // guardiamo verso +Z (dalla cresta nord verso la sud)
    this.pitch = 0.35;       // inclinazione verso il basso
    this.distance = 7;
    this.target = new THREE.Vector3();
    this.trauma = 0;         // scossone della camera (0..1), si smorza da solo
    this.time = 0;
    this.focusFn = null;     // inquadratura su un oggetto (vedi focus)
    this.saved = null;       // inquadratura del giocatore, da ripristinare

    let dragging = false;
    dom.addEventListener('pointerdown', () => (dragging = true));
    addEventListener('pointerup', () => (dragging = false));
    addEventListener('pointermove', (e) => {
      if (!dragging || this.focusFn) return; // durante un'inquadratura la camera è della storia
      this.goal = null;
      this.yaw -= e.movementX * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.005, -0.6, 1.3);
    });
    dom.addEventListener('wheel', (e) => {
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, 3, 40);
    }, { passive: true });
  }

  // Scuote la camera (es. quando una fune si spezza). amount: 0..1
  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // Inquadra un oggetto accanto al viaggiatore (pointFn = () => Vector3), o torna
  // all'inquadratura normale con focus(null). La camera ci arriva con dolcezza.
  focus(pointFn, { distance = 4.8, pitch = 0.55, side = 0.6 } = {}) {
    if (pointFn && !this.focusFn) this.saved = { yaw: this.yaw, pitch: this.pitch, distance: this.distance };
    if (!pointFn && this.saved) { this.goal = { ...this.saved }; this.saved = null; }
    this.focusFn = pointFn;
    this.focusOpts = { distance, pitch, side };
  }

  update(dt, playerPos) {
    this.time += dt;
    const k = 1 - Math.exp(-3 * dt);
    let desired;
    if (this.focusFn) {
      // bersaglio tra il viaggiatore e l'oggetto; la camera si mette di tre quarti
      const obj = this.focusFn();
      desired = playerPos.clone().add(new THREE.Vector3(0, 1.0, 0)).lerp(obj, 0.55);
      const away = Math.atan2(playerPos.x - obj.x, playerPos.z - obj.z) + this.focusOpts.side;
      let dy = away - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * k;
      this.pitch += (this.focusOpts.pitch - this.pitch) * k;
      this.distance += (this.focusOpts.distance - this.distance) * k;
    } else {
      desired = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
      if (this.goal) { // ritorno all'inquadratura di prima
        let dy = this.goal.yaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * k;
        this.pitch += (this.goal.pitch - this.pitch) * k;
        this.distance += (this.goal.distance - this.distance) * k;
        if (Math.abs(dy) < 0.01 && Math.abs(this.goal.distance - this.distance) < 0.05) this.goal = null;
      }
    }
    this.target.lerp(desired, 1 - Math.exp(-(this.focusFn ? 6 : 10) * dt));

    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ).multiplyScalar(this.distance);

    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);

    // scossone: rotazioni piccole e rapide, proporzionali a trauma² (così i colpi piccoli
    // si sentono appena e quelli grandi molto)
    if (this.trauma > 0) {
      const k = this.trauma * this.trauma * 0.05, t = this.time * 35;
      this.camera.rotation.x += Math.sin(t * 1.3) * k;
      this.camera.rotation.y += Math.sin(t * 1.7 + 1) * k;
      this.camera.rotation.z += Math.sin(t * 2.1 + 2) * k;
      this.trauma = Math.max(0, this.trauma - dt * 1.2);
    }
  }
}
