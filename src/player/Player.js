// Player.js
// ---------------------------------------------------------------
// Il viaggiatore (ancora un blocco: diventa gerarchico allo step 5).
//
// È una piccola MACCHINA A STATI:
//
//   walk  ── piede nell'intervallo troppo a lungo ──►  hang
//   hang  ── Spazio sotto una traversina ──────────►  climb ──► walk
//   hang  ── la presa si esaurisce ────────────────►  fall
//   fall  ── cade nel vuoto ───────────────────────►  riparte dall'ultimo punto sicuro
//
// "Si cammina sulle traversine di legno, attenti a non mettere il piede
//  negli intervalli, o ci si aggrappa alle maglie di canapa." (Calvino)
// ---------------------------------------------------------------
import * as THREE from 'three';

const ARM_REACH = 1.65;   // distanza piedi → mani quando le braccia sono alzate

export class Player {
  constructor({ net, world, walkway, start }) {
    this.net = net;
    this.world = world;
    this.walkway = walkway;

    this.state = 'walk';
    this.position = start.clone();
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.facing = 0;
    this.lastSafe = start.clone();   // ultimo punto dove poggiava bene: lì si riparte

    // Parametri di gioco
    this.speed = 3.2;         // camminata (m/s)
    this.hangSpeed = 1.1;     // spostamento appeso alla rete, mano dopo mano
    this.jumpSpeed = 5.5;
    this.gravity = -18;
    this.weight = 800;        // forza scaricata sulla rete
    this.gapLimit = 0.3;      // secondi che si resiste con il piede in un intervallo
    this.gripTime = 10;       // secondi di presa quando si è appesi

    // Stato interno
    this.gapTimer = 0;        // da quanto il piede è in un intervallo
    this.grip = 1;            // presa rimasta (1 = piena, 0 = si cade)
    this.hands = new THREE.Vector3();   // dove sono aggrappate le mani (quando appeso)
    this.climb = null;        // dati dell'animazione di risalita
    this.plank = null;        // traversina su cui poggiano i piedi (se c'è)
    this.plankZPrev = null;
    this.impact = 0;          // colpo extra sulla rete (atterraggi, scivolate)
    this.canClimb = false;
    this.time = 0;

    this.buildMesh();

    // Input: 'keys' = tasti tenuti premuti, 'pressed' = premuti in questo frame
    this.keys = new Set();
    this.pressed = new Set();
    addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  buildMesh() {
    this.object = new THREE.Group();
    this.body = new THREE.Group();   // tutto ciò che oscilla quando perde l'equilibrio
    this.object.add(this.body);

    const cloth = new THREE.MeshStandardMaterial({ color: '#2f3b4a', roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: '#d8c3a5' });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.3), cloth);
    torso.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
    head.position.y = 1.3;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.15), cloth);
    nose.position.set(0, 1.3, 0.2);
    this.body.add(torso, head, nose);

    // Braccia: un "perno" alla spalla con il braccio appeso sotto.
    // Ruotando il perno di 180° il braccio si alza (anteprima dello step 5).
    this.arms = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.32, 1.05, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), cloth);
      arm.position.y = -0.3;
      pivot.add(arm);
      this.body.add(pivot);
      return pivot;
    });
  }

  // ---------------------------------------------------------------
  // Aggiornamento, chiamato una volta per frame
  // ---------------------------------------------------------------
  update(dt, cameraYaw) {
    this.time += dt;
    const move = this.readInput(cameraYaw);

    if (this.state === 'walk') this.updateWalk(dt, move);
    else if (this.state === 'hang') this.updateHang(dt, move);
    else if (this.state === 'climb') this.updateClimb(dt);
    else if (this.state === 'fall') this.updateFall(dt);

    this.updateMesh(dt);
    this.pressed.clear();
  }

  // Direzione WASD trasformata nel sistema della camera
  readInput(cameraYaw) {
    const k = this.keys;
    let ix = 0, iz = 0;
    if (k.has('KeyW')) iz -= 1;
    if (k.has('KeyS')) iz += 1;
    if (k.has('KeyA')) ix -= 1;
    if (k.has('KeyD')) ix += 1;
    const len = Math.hypot(ix, iz);
    if (len === 0) return null;
    ix /= len; iz /= len;
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    return { x: ix * cos + iz * sin, z: -ix * sin + iz * cos };
  }

  // --- WALK ------------------------------------------------------
  updateWalk(dt, move) {
    const p = this.position, v = this.velocity;

    if (move) {
      v.x = move.x * this.speed;
      v.z = move.z * this.speed;
      this.facing = Math.atan2(move.x, move.z);
    } else {
      v.x = v.z = 0;
    }
    if (this.onGround && this.pressed.has('Space')) {
      v.y = this.jumpSpeed;
      this.onGround = false;
    }

    v.y += this.gravity * dt;
    p.addScaledVector(v, dt);

    // Su cosa poggio? roccia della cresta, traversina, o solo funi (intervallo)
    const crest = this.world.groundHeightAt(p.x, p.z);
    const netH = crest === null ? this.net.heightAt(p.x, p.z) : null;
    const plank = netH !== null ? this.walkway.plankUnder(p.x, p.z, this.plank) : null;
    let surf = null;
    if (crest !== null) surf = crest;
    else if (plank) surf = this.walkway.plankTopAt(plank, p.x, p.z); // piedi sul piano dell'asse
    else if (netH !== null) surf = netH;                             // piedi sulle funi

    if (plank !== this.plank) this.plankZPrev = plank ? this.walkway.plankZ(plank) : null;
    this.plank = plank;
    const wasOnGround = this.onGround;
    const snap = wasOnGround ? 0.4 : 0.05;
    this.onGround = false;
    if (surf !== null && p.y <= surf + snap && v.y <= 0) {
      if (!wasOnGround) this.impact = Math.min(-v.y, 12) * 250;
      p.y = surf;
      v.y = 0;
      this.onGround = true;
    }

    if (!this.onGround) { this.gapTimer = 0; if (p.y < -8) this.startFall(); return; }

    if (crest !== null || plank) {
      // piede ben piantato: memorizzo il punto e recupero la presa
      this.gapTimer = 0;
      this.lastSafe.copy(p);
      this.grip = Math.min(1, this.grip + dt / 3);
    } else {
      // piede in un intervallo: si barcolla, e dopo un attimo si scivola giù
      this.gapTimer += dt;
      if (this.gapTimer > this.gapLimit) this.startHang();
    }
  }

  // --- HANG ------------------------------------------------------
  startHang() {
    this.state = 'hang';
    this.gapTimer = 0;
    this.velocity.set(0, 0, 0);
    this.hands.set(this.position.x, 0, this.position.z);
    this.impact = 1500; // lo strattone della scivolata si sente sulla rete
  }

  updateHang(dt, move) {
    const net = this.net, h = this.hands;

    // mano dopo mano sotto la rete
    if (move) {
      h.x += move.x * this.hangSpeed * dt;
      h.z += move.z * this.hangSpeed * dt;
      this.facing = Math.atan2(move.x, move.z);
    }
    const W = (net.cols - 1) * net.spacing, L = (net.rows - 1) * net.spacing;
    h.x = THREE.MathUtils.clamp(h.x, net.x0 + 0.1, net.x0 + W - 0.1);
    h.z = THREE.MathUtils.clamp(h.z, net.z0 + 0.2, net.z0 + L - 0.2);
    h.y = net.heightAt(h.x, h.z);

    this.position.set(h.x, h.y - ARM_REACH, h.z);

    // la presa si consuma
    this.grip -= dt / this.gripTime;
    if (this.grip <= 0) { this.grip = 0; this.startFall(); return; }

    // si può risalire?
    const target = this.climbTarget();
    this.canClimb = !!target;
    if (target && this.pressed.has('Space')) this.startClimb(target);
  }

  // Dove arrivo se risalgo da qui? Una traversina vicina o il bordo di una cresta.
  climbTarget() {
    const h = this.hands, net = this.net;
    const L = (net.rows - 1) * net.spacing;
    if (h.z < net.z0 + 0.9) return { x: h.x, z: net.z0 - 0.5, crest: true };
    if (h.z > net.z0 + L - 0.9) return { x: h.x, z: net.z0 + L + 0.5, crest: true };
    const p = this.walkway.nearestPlank(h.x, h.z);
    if (!p) return null;
    const [xa, xb] = this.walkway.plankXRange(p);
    return { x: THREE.MathUtils.clamp(h.x, xa + 0.3, xb - 0.3), z: this.walkway.plankZ(p), plank: p };
  }

  // --- CLIMB -----------------------------------------------------
  startClimb(target) {
    this.state = 'climb';
    this.canClimb = false;
    this.climb = { t: 0, duration: 0.8, from: this.position.clone(), target };
  }

  updateClimb(dt) {
    const c = this.climb;
    c.t = Math.min(1, c.t + dt / c.duration);
    const e = c.t * c.t * (3 - 2 * c.t); // smoothstep: parte e arriva dolcemente

    // la destinazione si muove con la rete, quindi la ricalcolo ogni frame
    const tx = c.target.x, tz = c.target.z;
    const ty = c.target.crest ? 0 : this.walkway.plankTopAt(c.target.plank, tx, tz);

    // prima sale in verticale, poi si sposta sopra la traversina
    const up = Math.min(1, e * 1.6);
    const over = Math.max(0, (e - 0.4) / 0.6);
    this.position.set(
      THREE.MathUtils.lerp(c.from.x, tx, over),
      THREE.MathUtils.lerp(c.from.y, ty, up),
      THREE.MathUtils.lerp(c.from.z, tz, over),
    );

    if (c.t >= 1) {
      this.state = 'walk';
      this.onGround = true;
      this.velocity.set(0, 0, 0);
      this.climb = null;
    }
  }

  // --- FALL ------------------------------------------------------
  startFall() {
    this.state = 'fall';
    this.onGround = false;
    this.fallTime = 0; // la velocità resta quella che aveva: se stava cadendo, continua
  }

  updateFall(dt) {
    this.fallTime += dt;
    this.velocity.y += this.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);
    if (this.fallTime > 2.2) this.respawn();
  }

  respawn() {
    this.state = 'walk';
    this.position.copy(this.lastSafe);
    this.position.y += 0.3;
    this.velocity.set(0, 0, 0);
    this.grip = 1;
    this.gapTimer = 0;
  }

  // ---------------------------------------------------------------
  // Dopo la fisica: la rete si è mossa, quindi rimetto i piedi (o le mani)
  // esattamente dove devono stare. Così non c'è un frame di ritardo.
  // ---------------------------------------------------------------
  postPhysics() {
    const p = this.position;
    if (this.state === 'walk' && this.onGround) {
      if (this.world.groundHeightAt(p.x, p.z) !== null) return;
      if (this.plank) {
        // l'asse mi trascina con sé (attrito): seguo il suo spostamento in Z
        const z = this.walkway.plankZ(this.plank);
        if (this.plankZPrev !== null) p.z += z - this.plankZPrev;
        this.plankZPrev = z;
        p.y = this.walkway.plankTopAt(this.plank, p.x, p.z);
      } else {
        const h = this.net.heightAt(p.x, p.z);
        if (h !== null) p.y = h;
      }
    } else if (this.state === 'hang') {
      const h = this.net.heightAt(this.hands.x, this.hands.z);
      if (h !== null) { this.hands.y = h; p.y = h - ARM_REACH; }
    } else return;
    this.object.position.copy(p);
  }

  // ---------------------------------------------------------------
  // Il peso sulla rete (chiamato a ogni passo della fisica)
  // ---------------------------------------------------------------
  applyToNet() {
    let x, z;
    if (this.state === 'walk') {
      if (!this.onGround) return;
      x = this.position.x; z = this.position.z;
      if (this.world.groundHeightAt(x, z) !== null) return; // sono sulla roccia
      if (this.plank) {                                      // sono su un'asse
        this.walkway.applyLoad(this.plank, x, this.weight + this.impact);
        this.impact = 0;
        return;
      }
    } else if (this.state === 'hang' || this.state === 'climb') {
      x = this.hands.x; z = this.hands.z;
    } else return;

    this.net.applyLoad(x, z, this.weight + this.impact);
    this.impact = 0;
  }

  // ---------------------------------------------------------------
  // Aspetto: posizione, barcollamento, braccia
  // ---------------------------------------------------------------
  updateMesh(dt) {
    this.object.position.copy(this.position);
    this.object.rotation.y = this.facing;

    // barcolla quando il piede è in un intervallo
    const wobble = this.gapTimer / this.gapLimit;
    this.body.rotation.z = Math.sin(this.time * 30) * 0.25 * wobble;

    // braccia alzate quando è appeso o sta risalendo
    const armsUp = this.state === 'hang' || this.state === 'climb' || this.state === 'fall';
    const target = armsUp ? Math.PI : 0;
    for (const a of this.arms) a.rotation.x += (target - a.rotation.x) * (1 - Math.exp(-15 * dt));

    // appeso: il corpo dondola un po' sotto le mani
    this.body.rotation.x = this.state === 'hang' ? Math.sin(this.time * 2.2) * 0.08 : 0;
  }

  // Testo di aiuto per l'HUD
  get hint() {
    if (this.state === 'hang') {
      const bar = '█'.repeat(Math.ceil(this.grip * 10)).padEnd(10, '░');
      return `Appeso alla rete · presa ${bar} · WASD per spostarti` +
        (this.canClimb ? ' · <b>Spazio</b> per risalire' : ' · cerca una traversina');
    }
    if (this.state === 'fall') return 'Sotto non c\'è niente per centinaia e centinaia di metri…';
    if (this.gapTimer > 0) return 'Attento agli intervalli!';
    return '';
  }
}
