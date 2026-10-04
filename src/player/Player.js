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
//   script ── la storia lo muove lei (ponticelli, cabina) ──► walk (endScript)
//
// "Si cammina sulle traversine di legno, attenti a non mettere il piede
//  negli intervalli, o ci si aggrappa alle maglie di canapa." (Calvino)
// ---------------------------------------------------------------
import * as THREE from 'three';
import { Traveler, DIMS } from './Traveler.js';
import { TravelerAnimator } from './TravelerAnimator.js';

const ARM_REACH = DIMS.reach;   // distanza piedi → mani quando le braccia sono alzate (dal modello)

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
    this.hangSpeed = 1.4;     // spostamento appeso alla rete, mano dopo mano
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
    this.stridePlank = null;  // traversina vicina mentre si scavalca un intervallo
    this.plankZPrev = null;
    this.impact = 0;          // colpo extra sulla rete (atterraggi, scivolate)
    this.canClimb = false;
    this.time = 0;

    // Il modello gerarchico e la sua animazione procedurale
    this.traveler = new Traveler();
    this.object = this.traveler.root;
    this.animator = new TravelerAnimator(this.traveler);
    this.hangMoving = false;
    this.frozen = false;      // true mentre si legge un testo o si sceglie
    this.action = null;       // gesto in corso durante un'interazione: 'pull' | 'hold' | null
    this.windPush = 0;        // spinta laterale del vento (m/s), la imposta world/Wind.js
    this.windLean = 0;        // forza del vento con segno (-1..1), per l'animazione
    this.landed = false;      // true nel frame in cui atterra da un salto (lo legge la storia)

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

  // ---------------------------------------------------------------
  // Aggiornamento, chiamato una volta per frame
  // ---------------------------------------------------------------
  update(dt, cameraYaw) {
    this.time += dt;
    // durante un dialogo il viaggiatore sta fermo (e Spazio non lo fa saltare)
    if (this.frozen) this.pressed.clear();
    const move = this.frozen ? null : this.readInput(cameraYaw);

    if (this.state === 'walk') this.updateWalk(dt, move);
    else if (this.state === 'hang') this.updateHang(dt, move);
    else if (this.state === 'climb') this.updateClimb(dt);
    else if (this.state === 'fall') this.updateFall(dt);
    // 'script': la posizione la decide la storia (spostamenti guidati, cabina)

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
    const y0 = p.y; // altezza a inizio frame

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

    // Il vento spinge di lato: chi cammina viene spostato, chi sta fermo su un'asse resiste
    if (this.windPush && this.onGround) p.x += this.windPush * (move ? 1 : 0.06) * dt;

    // Su cosa poggio? roccia della cresta, traversina, o solo funi (intervallo)
    const crest = this.world.groundHeightAt(p.x, p.z);
    const netH = crest === null ? this.net.heightAt(p.x, p.z) : null;
    const plank = netH !== null ? this.walkway.plankUnder(p.x, p.z, this.plank) : null;
    const netOk = netH !== null && this.net.cellIntact(p.x, p.z); // sotto c'è rete integra?
    let surf = null;
    if (crest !== null) surf = crest;
    else if (plank) surf = this.walkway.plankTopAt(plank, p.x, p.z); // piedi sul piano dell'asse
    else if (netOk) surf = netH;                                     // piedi sulle funi

    if (plank !== this.plank) {
      this.plankZPrev = plank ? this.walkway.plankZ(plank) : null;
      this.plankXPrev = plank ? this.walkway.plankX(plank) : null;
    }
    this.plank = plank;
    const wasOnGround = this.onGround;

    // Passo sopra un intervallo tra due traversine: un piede è ancora sull'asse,
    // quindi il corpo non scende nel buco e il peso resta sulle assi vicine.
    this.stridePlank = null;
    if (wasOnGround && crest === null && !plank && netOk && v.y <= 0) {
      this.stridePlank = this.walkway.nearestPlank(p.x, p.z, 0.7);
      if (this.stridePlank) surf = Math.max(netH, y0);
    }

    // La rete si è strappata sotto i piedi: istintivamente ci si aggrappa alle maglie vicine
    if (wasOnGround && surf === null && netH !== null) {
      const grip = this.findGrip(p.x, p.z, 1.3);
      if (grip) { this.startHang(grip); return; }
    }

    const snap = wasOnGround ? 0.4 : 0.05;
    this.onGround = false;
    if (surf !== null && p.y <= surf + snap && v.y <= 0) {
      if (!wasOnGround) { this.impact = 2000 + Math.min(-v.y, 12) * 400; this.landed = true; } // atterrare colpisce la rete
      p.y = surf;
      v.y = 0;
      this.onGround = true;
    }

    if (!this.onGround) { this.gapTimer = 0; if (p.y < -8) this.startFall(); return; }

    if (crest !== null || plank) {
      // piede ben piantato: memorizzo il punto (se è legno sano) e recupero la presa
      this.gapTimer = 0;
      if (!plank || !plank.worn) this.lastSafe.copy(p);
      this.grip = Math.min(1, this.grip + dt / 3);
    } else {
      // piede in un intervallo: si barcolla, e dopo un attimo si scivola giù
      this.gapTimer += dt;
      if (this.gapTimer > this.gapLimit) this.startHang();
    }
  }

  // --- HANG ------------------------------------------------------
  // at = punto in cui aggrapparsi (se non dato: sotto i piedi, o la maglia integra più vicina)
  startHang(at = null) {
    const grip = at || this.findGrip(this.position.x, this.position.z, 1.0);
    if (!grip) { this.startFall(); return; }
    this.state = 'hang';
    this.gapTimer = 0;
    this.velocity.set(0, 0, 0);
    this.hands.set(grip.x, 0, grip.z);
    this.impact = 1500; // lo strattone della scivolata si sente sulla rete
  }

  // Il punto di rete integra più vicino a (x, z) entro 'reach' metri, o null.
  // Istintivamente si preferisce la canapa sana: le maglie vecchie "contano" 0,7 m in più.
  findGrip(x, z, reach) {
    const net = this.net, s = net.spacing;
    const ci = Math.floor((x - net.x0) / s), cj = Math.floor((z - net.z0) / s);
    const r = Math.ceil(reach / s) + 1;
    let best = null, bestD = reach;
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (!net.cellIntactIJ(i, j)) continue;
        // punto della cella più vicino a (x, z), un po' all'interno del bordo
        const gx = THREE.MathUtils.clamp(x, net.x0 + i * s + 0.1, net.x0 + (i + 1) * s - 0.1);
        const gz = THREE.MathUtils.clamp(z, net.z0 + j * s + 0.1, net.z0 + (j + 1) * s - 0.1);
        const worn = net.worn[net.vRope[net.index(i, j)]] || net.worn[net.vRope[net.index(i + 1, j)]];
        const d = Math.hypot(gx - x, gz - z) + (worn ? 0.7 : 0);
        if (d < bestD) { bestD = d; best = { x: gx, z: gz }; }
      }
    }
    return best;
  }

  updateHang(dt, move) {
    const net = this.net, h = this.hands;

    // la maglia a cui sono aggrappato si è strappata: provo a riprendermi, se no cado
    if (!net.cellIntact(h.x, h.z)) {
      const grip = this.findGrip(h.x, h.z, 1.2);
      if (!grip) { this.startFall(); return; }
      h.x = grip.x; h.z = grip.z;
    }

    // mano dopo mano sotto la rete (ma non dentro i buchi: lì non c'è niente a cui tenersi)
    if (move) {
      const nx = h.x + move.x * this.hangSpeed * dt;
      const nz = h.z + move.z * this.hangSpeed * dt;
      const hx = h.x, hz = h.z;
      if (net.cellIntact(nx, nz)) { h.x = nx; h.z = nz; }
      else if (net.cellIntact(nx, h.z)) h.x = nx;   // scivolo lungo il bordo del buco
      else if (net.cellIntact(h.x, nz)) h.z = nz;
      this.facing = Math.atan2(move.x, move.z);
      this.hangMoving = h.x !== hx || h.z !== hz;
    } else {
      this.hangMoving = false;
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
    // la traversina verso cui salivo è caduta: mi riaggrappo
    if (c.target.plank && c.target.plank.broken) { this.startHang(this.findGrip(this.hands.x, this.hands.z, 1.0)); return; }
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

  // --- SCRIPT: spostamenti guidati dalla storia ------------------
  startScript() {
    this.state = 'script';
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.plank = null; this.stridePlank = null;
    this.scriptSpeed = 0;
  }

  // Torna a camminare da solo, posato in 'at' (es. su una traversina)
  endScript(at) {
    this.state = 'walk';
    this.position.copy(at);
    this.lastSafe.copy(at);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.plank = null; this.plankZPrev = null; this.plankXPrev = null;
    this.scriptSpeed = 0;
  }

  // Ricomincia dall'inizio (tasto R)
  reset(start) {
    this.lastSafe.copy(start);
    this.respawn();
    this.position.copy(start);
    this.plank = null;
    this.plankZPrev = null;
    this.impact = 0;
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
        // l'asse mi trascina con sé (attrito): seguo il suo spostamento in Z e in X
        const z = this.walkway.plankZ(this.plank), x = this.walkway.plankX(this.plank);
        if (this.plankZPrev !== null) p.z += z - this.plankZPrev;
        if (this.plankXPrev != null) p.x += x - this.plankXPrev;
        this.plankZPrev = z; this.plankXPrev = x;
        p.y = this.walkway.plankTopAt(this.plank, p.x, p.z);
      } else if (!this.stridePlank && this.net.cellIntact(p.x, p.z)) {
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
      const plank = this.plank || this.stridePlank;
      if (plank) {                                           // sono su un'asse (o sto scavalcando)
        this.walkway.applyLoad(plank, x, this.weight + this.impact);
        this.impact *= 0.92;
        return;
      }
    } else if (this.state === 'hang' || this.state === 'climb') {
      x = this.hands.x; z = this.hands.z;
    } else return;

    this.net.applyLoad(x, z, this.weight + this.impact);
    this.impact *= 0.92; // il colpo si smorza in circa un decimo di secondo
  }

  // ---------------------------------------------------------------
  // Aspetto: il modello gerarchico, animato da TravelerAnimator
  // ---------------------------------------------------------------
  updateMesh(dt) {
    this.object.position.copy(this.position);
    this.animator.update(dt, {
      state: this.state === 'script' ? 'walk' : this.state,
      onGround: this.onGround,
      speed: this.state === 'walk' ? Math.hypot(this.velocity.x, this.velocity.z) : this.state === 'script' ? this.scriptSpeed : 0,
      vy: this.velocity.y,
      wobble: Math.min(1, this.gapTimer / this.gapLimit),
      climbT: this.climb ? this.climb.t : 0,
      hands: this.state === 'hang' ? this.hands : null,
      hangSpeed: this.hangMoving ? this.hangSpeed : 0,
      facing: this.facing,
      action: this.action,
      wind: this.windLean,
    });
  }

  // Testo di aiuto per l'HUD
  get hint() {
    if (this.state === 'hang') {
      const bar = '█'.repeat(Math.ceil(this.grip * 10)).padEnd(10, '░');
      return `Hanging from the net · grip ${bar} · WASD to move hand over hand` +
        (this.canClimb ? ' · <b>Space</b> to climb up' : ' · find a plank above you');
    }
    if (this.state === 'fall') return 'Below there is nothing for hundreds and hundreds of metres…';
    if (this.gapTimer > 0.12) return 'Mind the gaps!';
    if (this.state === 'walk' && this.net.straining) return 'The net is giving way! Keep moving!';
    if (this.state === 'walk' && Math.abs(this.windLean) > 0.4) return 'Wind! Stand still on a plank.';
    if (this.state === 'walk' && this.plank && this.plank.worn) return 'Grey wood. Do not stop here.';
    return '';
  }

}
