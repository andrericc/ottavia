// NotePost.js
// ---------------------------------------------------------------
// Il palo con il biglietto del Knot-keeper, all'arrivo sulla cresta.
// Modello gerarchico: palo → chiodo → foglio (perno sul bordo in alto).
// Il foglio si muove nel vento: rotazione attorno al chiodo con due
// oscillazioni sovrapposte, più una "raffica" ogni tanto.
// ---------------------------------------------------------------
import * as THREE from 'three';

export class NotePost {
  constructor(position, yaw = 0) {
    this.object = new THREE.Group();
    this.object.name = 'palo con biglietto';
    this.object.position.copy(position);
    this.object.rotation.y = yaw;

    const wood = new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.95, flatShading: true });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 7), wood);
    post.position.y = 0.75;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.1, 7), wood);
    cap.position.y = 1.55;

    // il chiodo è il perno del foglio
    this.nail = new THREE.Group();
    this.nail.position.set(0, 1.32, 0.075);
    const nailHead = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6),
      new THREE.MeshStandardMaterial({ color: '#444', metalness: 0.7, roughness: 0.4 }));
    nailHead.rotation.x = Math.PI / 2;
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3, 1, 3),
      new THREE.MeshStandardMaterial({ color: '#e9dfc6', roughness: 1, side: THREE.DoubleSide }));
    this.paper.position.y = -0.14; // il foglio pende sotto il chiodo
    this.nail.add(nailHead, this.paper);

    // una piccola corda con un nodo attorno al palo
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 5, 12),
      new THREE.MeshStandardMaterial({ color: '#8a7556', roughness: 1 }));
    knot.rotation.x = Math.PI / 2; knot.position.y = 1.0;

    this.object.add(post, cap, this.nail, knot);
    this.time = Math.random() * 10;
  }

  // punto a cui "puntare" l'interazione
  get anchor() {
    return this.object.localToWorld(new THREE.Vector3(0, 1.2, 0.1));
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const gust = Math.max(0, Math.sin(t * 0.35)) ** 8;        // ogni tanto una raffica
    this.nail.rotation.x = -0.12 - (0.08 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 5.3)) * (0.4 + gust);
    this.nail.rotation.z = 0.05 * Math.sin(t * 1.3) * (0.5 + gust);
  }
}
