// Debris.js
// ---------------------------------------------------------------
// Oggetti che si staccano dalla rete e precipitano nel burrone
// (per ora le traversine). Animazione scritta a mano:
// caduta con gravità + rotazione costante, poi spariscono nella nebbia.
// ---------------------------------------------------------------
import * as THREE from 'three';

export class Debris {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this._q = new THREE.Quaternion();
  }

  // geometry: la forma dell'oggetto · matrix: dove si trovava · color: il suo colore
  spawn(geometry, matrix, color, velocity = new THREE.Vector3()) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    this.scene.add(mesh);
    this.items.push({
      mesh,
      velocity: velocity.clone(),
      // asse e velocità di rotazione casuali: ogni asse cade in modo diverso
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.3, Math.random() - 0.5).normalize(),
      spin: 2 + Math.random() * 4,
      age: 0,
    });
  }

  // Fa cadere un oggetto intero (un gruppo con figli, luci comprese).
  // L'oggetto non viene distrutto: con R torna al suo posto.
  spawnObject(object, velocity = new THREE.Vector3()) {
    object.updateMatrixWorld(true);
    this.scene.attach(object); // cambia genitore mantenendo la posizione nel mondo
    this.items.push({
      mesh: object, owned: false,
      velocity: velocity.clone(),
      axis: new THREE.Vector3(Math.random() - 0.5, 0.2, Math.random() - 0.5).normalize(),
      spin: 0.6 + Math.random() * 0.8,
      age: 0, life: 9,
    });
  }

  update(dt) {
    for (let k = this.items.length - 1; k >= 0; k--) {
      const d = this.items[k];
      d.age += dt;
      d.velocity.y -= 9.81 * dt;
      d.velocity.multiplyScalar(1 - 0.05 * dt); // un filo di resistenza dell'aria
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.quaternion.premultiply(this._q.setFromAxisAngle(d.axis, d.spin * dt));
      if (d.age > (d.life ?? 6)) this.remove(k);
    }
  }

  remove(k) {
    const d = this.items[k];
    this.scene.remove(d.mesh);
    if (d.owned !== false) d.mesh.material.dispose();
    this.items.splice(k, 1);
  }

  clear() {
    for (let k = this.items.length - 1; k >= 0; k--) this.remove(k);
  }
}
