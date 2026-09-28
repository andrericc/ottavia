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

  update(dt, playerPos) {
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
  }
}
