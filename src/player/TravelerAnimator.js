// TravelerAnimator.js
// ---------------------------------------------------------------
// Animazione PROCEDURALE del viaggiatore, scritta a mano.
// Nessun file di animazione importato: ogni frame calcoliamo gli angoli
// delle articolazioni con funzioni del tempo e dello stato del gioco.
//
// Come funziona:
//  1. ogni stato (camminare, appeso, arrampicata, caduta…) produce una
//     POSA BERSAGLIO: un angolo per ogni articolazione
//  2. le articolazioni vere si avvicinano alla posa bersaglio con uno
//     smorzamento esponenziale → i passaggi tra stati sono morbidi da soli
//  3. dopo: altezza del bacino ricavata dalle gambe (i piedi toccano terra),
//     dondolo del corpo da appeso e lanterna: due PENDOLI simulati
//
// Convenzione (vedi Traveler.js): rotation.x negativa = arto in avanti;
// per busto e testa rotation.x positiva = inclinati in avanti.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { DIMS } from './Traveler.js';

const JOINTS = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR',
  'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR',
];
const PI = Math.PI;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Pose chiave dell'arrampicata (t = avanzamento 0..1): un piccolo sistema a keyframe
const CLIMB_KEYS = [
  { t: 0.0, pose: { shoulderL: [-PI, 0, 0.12], shoulderR: [-PI, 0, -0.12], head: [-0.35, 0, 0] } },
  { t: 0.45, pose: { // tirata: il petto arriva al bordo dell'asse
    shoulderL: [-0.9, 0, 0.1], shoulderR: [-0.9, 0, -0.1], elbowL: [-1.9, 0, 0], elbowR: [-1.9, 0, 0],
    spine: [0.35, 0, 0], hipL: [-0.3, 0, 0], kneeL: [0.4, 0, 0], kneeR: [0.3, 0, 0], head: [0.1, 0, 0] } },
  { t: 0.75, pose: { // spinta sulle braccia e ginocchio sull'asse
    shoulderL: [-0.25, 0, 0.1], shoulderR: [-0.25, 0, -0.1], elbowL: [-0.3, 0, 0], elbowR: [-0.3, 0, 0],
    spine: [0.5, 0, 0], hipL: [-1.6, 0, 0], kneeL: [2.0, 0, 0], ankleL: [-0.4, 0, 0], head: [0.2, 0, 0] } },
  { t: 1.0, pose: {} }, // in piedi
];

export class TravelerAnimator {
  constructor(traveler) {
    this.t = traveler;
    this.j = traveler.joints;
    this.target = {};
    for (const n of JOINTS) this.target[n] = new THREE.Euler();

    this.time = 0;
    this.phase = 0;          // fase del ciclo del passo
    this.hangPhase = 0;      // fase del "mano dopo mano"
    this.yaw = 0;            // direzione mostrata (si gira con dolcezza)
    this.prevState = null;

    // Pendolo del corpo appeso (angoli attorno a X e Z del perno 'swing')
    this.swing = { x: 0, z: 0, vx: 0, vz: 0 };
    this.prevHands = null; this.prevHandsVel = new THREE.Vector3();

    // Pendolo sferico della lanterna, simulato nello spazio del mondo
    this.lantern = { u: new THREE.Vector3(0, -1, 0), v: new THREE.Vector3(), prevPos: null, prevVel: new THREE.Vector3() };

    // oggetti temporanei
    this._v = new THREE.Vector3(); this._a = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._down = new THREE.Vector3(0, -1, 0);
  }

  // ctx: { state, onGround, speed, vy, wobble, climbT, hands, facing }
  update(dt, ctx) {
    this.time += dt;
    if (ctx.state !== this.prevState) this.onStateChange(ctx);

    // 1) posa bersaglio
    for (const n of JOINTS) this.target[n].set(0, 0, 0);
    let rate = 18;
    if (ctx.state === 'walk') {
      if (ctx.onGround) { this.poseGround(dt, ctx); rate = 22; } else this.poseAir(ctx);
      if (ctx.onGround && ctx.wind) this.poseWind(ctx.wind);
      if (ctx.action === 'pull') { this.posePull(); rate = 16; }
      else if (ctx.action === 'hold') { this.poseHold(); rate = 10; }
      else if (ctx.action === 'reach') { this.poseReach(); rate = 8; }     // Valdrada: alza il braccio (accendere una lanterna)
      else if (ctx.action === 'ring') { this.poseRing(); rate = 10; }      // Valdrada: tiene la corda della campana (le braccia le muove Story.js)
      else if (ctx.action === 'offer') { this.poseOffer(-1); rate = 4; }   // Valdrada: tende la mano destra
      else if (ctx.action === 'offerL') { this.poseOffer(1); rate = 4; }   // Valdrada: tende la mano sinistra
      else if (ctx.action === 'lookup') { this.poseLookUp(); rate = 3; }   // Valdrada: guarda in su
      if (ctx.wobble > 0) this.poseWobble(ctx.wobble);
    } else if (ctx.state === 'hang') this.poseHang(dt, ctx);
    else if (ctx.state === 'climb') { this.poseClimb(ctx.climbT); rate = 20; }
    else if (ctx.state === 'fall') { this.poseFall(); rate = 10; }

    // 2) le articolazioni inseguono la posa bersaglio
    const k = 1 - Math.exp(-rate * dt);
    for (const n of JOINTS) {
      const r = this.j[n].rotation, g = this.target[n];
      r.x += (g.x - r.x) * k; r.y += (g.y - r.y) * k; r.z += (g.z - r.z) * k;
    }

    // 3) altezza del bacino, direzione, pendoli
    this.placePelvis(ctx);
    this.turn(dt, ctx.facing);
    this.updateSwing(dt, ctx);
    this.updateLantern(dt);
  }

  onStateChange(ctx) {
    // aggrapparsi di colpo fa partire il dondolo in avanti
    if (ctx.state === 'hang' && this.prevState !== 'climb') this.swing.vx -= 1.4;
    if (ctx.state === 'walk' && this.prevState === 'fall') this.snapToTarget();
    this.prevState = ctx.state;
    this.prevHands = null;
  }

  // Imposta subito la posa (dopo un respawn non vogliamo vedere la transizione)
  snapToTarget() {
    for (const n of JOINTS) this.j[n].rotation.set(0, 0, 0);
    this.swing.x = this.swing.z = this.swing.vx = this.swing.vz = 0;
  }

  set(name, x = 0, y = 0, z = 0) { this.target[name].set(x, y, z); }
  add(name, x = 0, y = 0, z = 0) { const e = this.target[name]; e.x += x; e.y += y; e.z += z; }

  // --- A TERRA: fermo + camminata, mescolati in base alla velocità ---------
  poseGround(dt, ctx) {
    const w = Math.min(1.2, ctx.speed / 3.2); // 0 = fermo, 1 = passo normale
    const t = this.time;

    // Il ciclo del passo avanza con la DISTANZA percorsa, non con il tempo:
    // così i piedi non "pattinano" qualunque sia la velocità.
    const STEP = 0.8; // metri per passo (mezzo ciclo)
    this.phase += (ctx.speed * dt / STEP) * PI;
    const p = this.phase;

    // Gambe: la coscia oscilla, il ginocchio si piega nella fase di volo
    // (quando la gamba torna in avanti), la caviglia tiene il piede in piano.
    const A = 0.5 * w, K = 1.1 * w;
    for (const [s, ph] of [['L', p], ['R', p + PI]]) {
      const hip = -A * Math.sin(ph);
      const knee = K * Math.max(0, Math.cos(ph)) + 0.05;
      this.set('hip' + s, hip);
      this.set('knee' + s, knee);
      this.set('ankle' + s, -(hip + knee) * 0.8);
    }

    // Braccia: in controfase rispetto alla gamba dello stesso lato
    const B = 0.45 * w;
    this.set('shoulderL', B * Math.sin(p), 0, -0.08);
    this.set('shoulderR', B * Math.sin(p + PI), 0, 0.08);
    this.set('elbowL', -(0.15 + 0.35 * w * Math.max(0, -Math.sin(p))));
    this.set('elbowR', -(0.15 + 0.35 * w * Math.max(0, Math.sin(p))));

    // Bacino e busto: torsione e rollio in controfase, leggera inclinazione in avanti
    this.set('pelvis', 0, 0.12 * w * Math.sin(p), 0.04 * w * Math.sin(p));
    this.set('spine', 0.08 * w, -0.2 * w * Math.sin(p), 0);

    // Da fermo (1 - w): respiro, peso che si sposta, sguardo che vaga (e ogni tanto guarda giù)
    const idle = Math.max(0, 1 - w);
    this.add('chest', 0.025 * Math.sin(t * 1.7) * idle);
    this.add('pelvis', 0, 0, 0.03 * Math.sin(t * 0.5) * idle);
    this.add('kneeL', 0.06 * (1 + Math.sin(t * 0.5)) * idle);
    this.add('kneeR', 0.06 * (1 - Math.sin(t * 0.5)) * idle);
    const lookDown = smooth(clamp01(Math.sin(t * 0.21) * 3 - 2)); // ogni tanto, per qualche secondo
    this.set('head',
      (0.05 * Math.sin(t * 0.23) + 0.45 * lookDown) * idle - 0.04 * w,
      0.5 * Math.sin(t * 0.37) * Math.max(0, Math.sin(t * 0.13)) * idle,
      0);
    // la testa compensa la torsione del busto: lo sguardo resta dritto
    this.add('head', 0, 0.2 * w * Math.sin(p) * 0.6, 0);
  }

  // --- VENTO: si piega verso il vento, braccia un po' larghe, ginocchia flesse ---
  // wind ha il segno della direzione nel mondo (+X / -X): la porto nel sistema del corpo
  poseWind(wind) {
    const side = wind * Math.cos(this.yaw); // componente lungo il fianco del viaggiatore
    const a = Math.abs(wind);
    this.add('spine', 0.1 * a, 0, 0.3 * side);
    this.add('head', 0, 0, -0.15 * side);
    this.add('shoulderL', 0, 0, -0.5 * a); this.add('shoulderR', 0, 0, 0.5 * a);
    this.add('kneeL', 0.3 * a); this.add('kneeR', 0.3 * a);
  }

  // --- TIRARE SU UNA FUNE: chino, le braccia si alternano mano dopo mano ---
  // Ritmo di 2,5 tirate al secondo, lo stesso dell'avvolgimento in Story.js
  posePull() {
    const ph = this.time * Math.PI * 2 * 1.25, s = Math.sin(ph);
    this.set('spine', 0.45); this.set('chest', 0.1); this.set('head', 0.35);
    this.set('hipL', -0.45); this.set('kneeL', 0.8); this.set('ankleL', -0.35);
    this.set('hipR', -0.15); this.set('kneeR', 0.5); this.set('ankleR', -0.35);
    // un braccio scende a prendere la fune mentre l'altro la tira su
    this.set('shoulderL', -1.0 - 0.55 * s, 0, 0.1); this.set('elbowL', -0.5 - 0.6 * Math.max(0, s));
    this.set('shoulderR', -1.0 + 0.55 * s, 0, -0.1); this.set('elbowR', -0.5 - 0.6 * Math.max(0, -s));
    this.set('pelvis', 0, 0.08 * s, 0);
  }

  // --- TENERE LA FUNE mentre si legge: braccia avanti, sguardo sull'oggetto ---
  poseHold() {
    const b = 0.02 * Math.sin(this.time * 1.6); // respiro
    this.set('spine', 0.2 + b); this.set('head', 0.3);
    this.set('shoulderL', -0.85, 0, 0.12); this.set('elbowL', -0.9);
    this.set('shoulderR', -0.8, 0, -0.12); this.set('elbowR', -0.95);
    this.set('kneeL', 0.2); this.set('kneeR', 0.15); this.set('hipL', -0.1);
  }

  // --- GESTI DI VALDRADA -------------------------------------------------
  poseReach() {
    this.set('head', -0.45); this.set('spine', -0.05);
    this.set('shoulderR', -2.5, 0, -0.15); this.set('elbowR', -0.35);
    this.set('shoulderL', -0.2, 0, 0.15); this.set('elbowL', -0.3);
  }
  // le mani in alto sulla corda; quanto la tirano giù lo decide Story.js (ringArms)
  poseRing() {
    this.set('head', -0.35); this.set('spine', -0.04);
    this.set('kneeL', 0.12); this.set('kneeR', 0.12);
    this.set('shoulderL', -2.55, 0, -0.18); this.set('elbowL', -0.3);
    this.set('shoulderR', -2.55, 0, 0.18); this.set('elbowR', -0.3);
  }
  // tendere una mano in avanti, un po' in basso, aperta (side: -1 destra, 1 sinistra)
  poseOffer(side) {
    const b = 0.02 * Math.sin(this.time * 1.3);
    const arm = side < 0 ? 'R' : 'L', other = side < 0 ? 'L' : 'R';
    this.set('spine', 0.06); this.set('head', 0.12);
    this.set('shoulder' + arm, -1.25 + b, 0, -side * 0.05); this.set('elbow' + arm, -0.12);
    this.set('wrist' + arm, 0.25);
    this.set('shoulder' + other, -0.1, 0, side * 0.1); this.set('elbow' + other, -0.2);
  }
  poseLookUp() {
    this.set('head', -0.75); this.set('chest', -0.12);
    this.set('shoulderL', -0.1, 0, 0.1); this.set('shoulderR', -0.1, 0, -0.1);
  }

  // --- IN ARIA (salto) -----------------------------------------------------
  poseAir(ctx) {
    const rising = ctx.vy > 0;
    this.set('hipL', -0.7); this.set('kneeL', 1.2); this.set('ankleL', -0.3);
    this.set('hipR', -0.1); this.set('kneeR', 0.7);
    if (rising) {
      this.set('shoulderL', -2.4, 0, -0.2); this.set('shoulderR', -2.4, 0, 0.2);
    } else {
      this.set('shoulderL', -0.5, 0, -1.2); this.set('shoulderR', -0.5, 0, 1.2); // braccia larghe
    }
    this.set('elbowL', -0.3); this.set('elbowR', -0.3);
    this.set('spine', 0.15);
  }

  // --- BARCOLLARE (piede in un intervallo): si mescola sopra la posa corrente
  poseWobble(w) {
    const t = this.time;
    const mix = (name, x, y, z) => {
      const e = this.target[name];
      e.set(e.x + (x - e.x) * w, e.y + (y - e.y) * w, e.z + (z - e.z) * w);
    };
    mix('shoulderL', -0.3 + 0.5 * Math.sin(t * 17), 0, -1.4 - 0.4 * Math.sin(t * 13));
    mix('shoulderR', -0.3 + 0.5 * Math.sin(t * 17 + 2), 0, 1.4 + 0.4 * Math.sin(t * 13 + 1));
    mix('spine', 0.2, 0, 0.3 * Math.sin(t * 9));
    mix('hipR', -0.6, 0, 0.2); mix('kneeR', 0.9, 0, 0);
    mix('head', 0.5, 0, -0.2 * Math.sin(t * 9)); // guarda giù, nel vuoto
  }

  // --- APPESO ALLA RETE ----------------------------------------------------
  poseHang(dt, ctx) {
    const moving = ctx.hangSpeed > 0.05;
    if (moving) this.hangPhase += dt * 7;
    const s = Math.sin(this.hangPhase);
    const reach = moving ? 0.3 : 0;
    // braccia in alto (rotation.x = -PI), mani vicine; muovendosi un braccio
    // alla volta si allunga in avanti mentre l'altro tira
    this.set('shoulderL', -PI + reach * Math.max(0, s), 0, 0.12);
    this.set('shoulderR', -PI + reach * Math.max(0, -s), 0, -0.12);
    this.set('elbowL', moving ? -0.7 * Math.max(0, -s) : -0.1);
    this.set('elbowR', moving ? -0.7 * Math.max(0, s) : -0.1);
    // gambe a penzoloni, con un piccolo calcio quando si sposta
    const kick = moving ? 0.25 : 0.06;
    this.set('hipL', kick * Math.sin(this.hangPhase + 1) - 0.1, 0, -0.05);
    this.set('hipR', kick * Math.sin(this.hangPhase + 1 + PI) - 0.1, 0, 0.05);
    this.set('kneeL', 0.3 + 0.1 * Math.sin(this.time * 2)); this.set('kneeR', 0.25);
    this.set('ankleL', 0.4); this.set('ankleR', 0.4);
    this.set('head', -0.35 + 0.05 * Math.sin(this.time * 1.3)); // guarda in su, verso la rete
    this.set('chest', -0.05);
  }

  // --- ARRAMPICATA: interpolazione tra pose chiave -------------------------
  poseClimb(t) {
    let a = CLIMB_KEYS[0], b = CLIMB_KEYS[CLIMB_KEYS.length - 1];
    for (let i = 0; i < CLIMB_KEYS.length - 1; i++) {
      if (t >= CLIMB_KEYS[i].t && t <= CLIMB_KEYS[i + 1].t) { a = CLIMB_KEYS[i]; b = CLIMB_KEYS[i + 1]; break; }
    }
    const f = smooth((t - a.t) / (b.t - a.t || 1));
    for (const n of JOINTS) {
      const pa = a.pose[n] || [0, 0, 0], pb = b.pose[n] || [0, 0, 0];
      this.set(n, pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f, pa[2] + (pb[2] - pa[2]) * f);
    }
  }

  // --- CADUTA: braccia e gambe che mulinano --------------------------------
  poseFall() {
    const t = this.time;
    this.set('shoulderL', -1.6 + 1.2 * Math.sin(t * 14), 0, -0.9 - 0.3 * Math.sin(t * 11));
    this.set('shoulderR', -1.6 + 1.2 * Math.cos(t * 14), 0, 0.9 + 0.3 * Math.sin(t * 11 + 1));
    this.set('elbowL', -0.5); this.set('elbowR', -0.5);
    this.set('hipL', 0.5 * Math.sin(t * 12) - 0.3); this.set('kneeL', 0.7 + 0.4 * Math.sin(t * 15));
    this.set('hipR', 0.5 * Math.sin(t * 12 + PI) - 0.3); this.set('kneeR', 0.7 + 0.4 * Math.cos(t * 15));
    this.set('spine', -0.3); this.set('head', -0.5);
  }

  // Altezza del bacino: cinematica diretta delle due gambe. Il piede più basso
  // deve toccare terra, quindi il bacino sta alla lunghezza verticale della gamba
  // più "lunga" in quel momento. Il saliscendi del passo nasce da qui, da solo.
  placePelvis(ctx) {
    const pelvis = this.j.pelvis;
    const grounded = ctx.state === 'walk' && ctx.onGround;
    if (!grounded) { pelvis.position.y = DIMS.hipHeight; return; }
    const legHeight = (s) => {
      const a = this.j['hip' + s].rotation.x, k = this.j['knee' + s].rotation.x;
      return DIMS.thigh * Math.cos(a) + DIMS.shin * Math.cos(a + k) + DIMS.foot;
    };
    pelvis.position.y = Math.max(legHeight('L'), legHeight('R'));
  }

  // Si gira verso la direzione di marcia per la via più breve
  turn(dt, facing) {
    if (!Number.isFinite(this.yaw) || Math.abs(this.yaw) > 1e3) this.yaw = facing; // sicurezza
    let d = facing - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * THREE.MathUtils.clamp(1 - Math.exp(-12 * dt), 0, 1);
    this.t.root.rotation.y = this.yaw;
  }

  // --- PENDOLO 1: il corpo appeso dondola sotto le mani --------------------
  // θ'' = -(g/L)·sin θ - c·θ' + (accelerazione delle mani)/L
  updateSwing(dt, ctx) {
    const s = this.swing, L = DIMS.reach;
    let ax = 0, az = 0;
    if (ctx.state === 'hang' && ctx.hands) {
      // accelerazione delle mani, nel sistema di riferimento del viaggiatore
      if (this.prevHands && dt > 0) {
        const vel = this._v.subVectors(ctx.hands, this.prevHands).divideScalar(dt);
        const acc = this._a.subVectors(vel, this.prevHandsVel).divideScalar(dt);
        this.prevHandsVel.copy(vel);
        const c = Math.cos(-this.yaw), sn = Math.sin(-this.yaw);
        ax = THREE.MathUtils.clamp(acc.x * c + acc.z * sn, -30, 30);   // laterale
        az = THREE.MathUtils.clamp(-acc.x * sn + acc.z * c, -30, 30);  // avanti
      } else this.prevHandsVel.set(0, 0, 0);
      this.prevHands = (this.prevHands || new THREE.Vector3()).copy(ctx.hands);

      // se le mani accelerano in avanti, i piedi restano indietro (e viceversa)
      s.vx += (-(9.81 / L) * Math.sin(s.x) - 0.8 * s.vx + az / L) * dt;
      s.vz += (-(9.81 / L) * Math.sin(s.z) - 0.8 * s.vz - ax / L) * dt;
      s.x += s.vx * dt; s.z += s.vz * dt;
    } else {
      // non appeso: il dondolo si spegne in fretta
      const k = 1 - Math.exp(-10 * dt);
      s.x -= s.x * k; s.z -= s.z * k; s.vx = s.vz = 0;
    }
    this.j.swing.rotation.set(s.x, 0, s.z);
  }

  // --- PENDOLO 2: la lanterna appesa allo zaino ----------------------------
  // Pendolo sferico: la direzione del filo 'u' è simulata nel mondo, spinta da
  // gravità meno l'accelerazione del gancio (quando il viaggiatore scatta,
  // la lanterna resta indietro; quando si ferma, va avanti).
  updateLantern(dt) {
    if (dt <= 0) return;
    const L = 0.15, lan = this.lantern, pivot = this.j.lanternPivot;
    this.t.root.updateMatrixWorld(true);
    const pos = pivot.parent.localToWorld(this._v.copy(pivot.position));
    if (!lan.prevPos || pos.distanceTo(lan.prevPos) > 1) { // primo frame o teletrasporto
      lan.prevPos = pos.clone(); lan.prevVel.set(0, 0, 0); return;
    }
    const vel = this._a.subVectors(pos, lan.prevPos).divideScalar(dt);
    const acc = vel.clone().sub(lan.prevVel).divideScalar(dt).clampLength(0, 40);
    lan.prevVel.copy(vel); lan.prevPos.copy(pos);

    const g = new THREE.Vector3(0, -9.81, 0).sub(acc);            // gravità "sentita" dal gancio
    const tangent = g.sub(lan.u.clone().multiplyScalar(g.dot(lan.u))); // solo la componente che fa oscillare
    lan.v.addScaledVector(tangent, dt / L);
    lan.v.sub(lan.u.clone().multiplyScalar(lan.v.dot(lan.u)));
    lan.v.multiplyScalar(Math.exp(-2.5 * dt));
    lan.u.addScaledVector(lan.v, dt).normalize();

    // dal mondo al sistema locale dello zaino, e ruoto il perno della lanterna
    pivot.parent.getWorldQuaternion(this._q).invert();
    const uLocal = lan.u.clone().applyQuaternion(this._q);
    pivot.quaternion.setFromUnitVectors(this._down, uLocal);
  }
}
