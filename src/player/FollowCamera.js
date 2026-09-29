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

    let dragging = false;
    dom.addEventListener('pointerdown', () => (dragging = true));
    addEventListener('pointerup', () => (dragging = false));
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
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

  update(dt, playerPos) {
    this.time += dt;
    // Il bersaglio segue il giocatore con un po' di morbidezza
    const desired = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.target.lerp(desired, 1 - Math.exp(-10 * dt));

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
