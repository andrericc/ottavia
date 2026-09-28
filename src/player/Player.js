// Player.js
// ---------------------------------------------------------------
// Il viaggiatore, versione "cubo" della settimana 1.
// Si muove con WASD rispetto alla camera, salta con Spazio,
// cammina sulla rete e sulle creste e scarica il suo peso sulla rete.
// Nella settimana 2 il cubo diventa un modello gerarchico animato.
// ---------------------------------------------------------------
import * as THREE from 'three';

export class Player {
  constructor({ net, world, start }) {
    this.net = net;
    this.world = world;
    this.start = start.clone();

    this.position = start.clone();
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.facing = 0;          // angolo verso cui guarda (radianti)

    this.speed = 3.2;         // m/s
    this.jumpSpeed = 5.5;
    this.gravity = -18;
    this.weight = 800;        // forza scaricata sulla rete (vedi VerletNet.applyLoad)

    // --- Aspetto provvisorio: corpo + testa + "naso" per capire la direzione
    this.object = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#2f3b4a', roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.3), mat);
    body.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: '#d8c3a5' }));
    head.position.y = 1.3;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.15), mat);
    nose.position.set(0, 1.3, 0.2);
    this.object.add(body, head, nose);

    // --- Input
    this.keys = new Set();
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  // Altezza del "pavimento" sotto (x, z): rete, cresta, o null (vuoto)
  surfaceAt(x, z) {
    const g = this.world.groundHeightAt(x, z);
    if (g !== null) return g;
    return this.net.heightAt(x, z);
  }

  update(dt, cameraYaw) {
    const k = this.keys;

    // Direzione di input relativa alla camera
    let ix = 0, iz = 0;
    if (k.has('KeyW')) iz -= 1;
    if (k.has('KeyS')) iz += 1;
    if (k.has('KeyA')) ix -= 1;
    if (k.has('KeyD')) ix += 1;
    const len = Math.hypot(ix, iz);
    if (len > 0) {
      ix /= len; iz /= len;
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const dx = ix * cos + iz * sin;
      const dz = -ix * sin + iz * cos;
      this.velocity.x = dx * this.speed;
      this.velocity.z = dz * this.speed;
      this.facing = Math.atan2(dx, dz);
    } else {
      this.velocity.x = this.velocity.z = 0;
    }

    // Salto
    if (this.onGround && k.has('Space')) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    // Gravità e movimento
    this.velocity.y += this.gravity * dt;
    const p = this.position;
    p.addScaledVector(this.velocity, dt);

    // Contatto con la superficie
    const surf = this.surfaceAt(p.x, p.z);
    const wasOnGround = this.onGround;
    this.onGround = false;
    // se stavo già camminando "incollo" i piedi anche quando la rete scende sotto di me
    const snap = wasOnGround ? 0.4 : 0.05;
    if (surf !== null && p.y <= surf + snap && this.velocity.y <= 0) {
      // se atterro da un salto, colpisco la rete più forte (impulso)
      const impact = wasOnGround ? 0 : Math.min(-this.velocity.y, 12) * 250;
      p.y = surf;
      this.velocity.y = 0;
      this.onGround = true;
      this.impact = impact;
    }

    // Caduta nell'abisso → ricomincio dalla cresta
    if (p.y < -60) this.respawn();

    // Aggiorno l'oggetto 3D
    this.object.position.copy(p);
    this.object.rotation.y = this.facing;
  }

  // Chiamato a ogni passo della fisica: il peso del viaggiatore spinge giù la rete
  applyToNet() {
    if (!this.onGround) return;
    const p = this.position;
    if (this.world.groundHeightAt(p.x, p.z) !== null) return; // sono sulla roccia
    this.net.applyLoad(p.x, p.z, this.weight + (this.impact || 0));
    this.impact = 0;
  }

  respawn() {
    this.position.copy(this.start);
    this.velocity.set(0, 0, 0);
  }
}
