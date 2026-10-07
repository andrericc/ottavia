// valdrada/Story.js
// ---------------------------------------------------------------
// LA STORIA DI VALDRADA: "l'uomo senza riflesso".
//
// La regola: gli abitanti di Valdrada sono immagini senza corpo (esistono solo nel
// lago); il viaggiatore è un corpo senza immagine (nel lago non c'è). Calvino dice
// che a Valdrada ogni atto è insieme l'atto e la sua immagine: quando il viaggiatore
// compie davvero un gesto che nell'acqua qualcuno sta compiendo, atto e immagine si
// ricongiungono, e un pezzo del suo riflesso compare nel lago.
//
//   0. All'arrivo il villaggio è quasi buio, sopra e sotto: poche finestre accese,
//      lanterne del parapetto spente.
//   1. LA LANTERNA (portico della casa lunga): nell'acqua un uomo la accende, sopra è
//      spenta. Il viaggiatore la accende → nel riflesso si accendono tutte le finestre e
//      le lanterne del villaggio; sopra resta buio ("lo specchio ora accresce il valore
//      delle cose"). Nell'acqua compaiono i suoi piedi.
//   2. LA CAMPANA (sulla piattaforma accanto al pontile): appena accesa la lanterna,
//      nell'acqua la donna sotto il campanile comincia a suonare — la campana del lago
//      oscilla, ma non si sente niente. Il viaggiatore va sotto la campana e tira la corda:
//      sopra suona, e nel lago la campana si ferma e tace ("ora lo nega"). Compare metà
//      di lui.
//   3. LA MANO (in punta al pontile): nell'acqua una figura tende una mano. Il viaggiatore
//      tende la sua; il riflesso va a prenderla, e solo dopo la stretta gli compare la
//      testa: è intero. Allora il viaggiatore sopra svanisce, e resta solo il riflesso.
//      "Vivono l'una per l'altra… ma non si amano."
//
// IL RIFLESSO DEL VIAGGIATORE è un secondo modello (lo stesso Traveler) sul layer che
// vede solo la camera specchio: ogni frame copia posizione e pose del viaggiatore. Un
// PIANO DI CLIPPING orizzontale lo taglia sopra una certa quota: prima non si vede
// niente, poi i piedi, poi fino al petto, poi tutto. Alla fine smette di copiarlo e
// vive per conto suo.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { Traveler } from '../player/Traveler.js';
import { TravelerAnimator } from '../player/TravelerAnimator.js';
import { LAYER_REFLECTION_ONLY, LAYER_NO_REFLECTION } from './MirrorWater.js';
import { setLayer } from './Inhabitants.js';
import { BW_Y, PIER_X, PIER_Y, PIER_END, RAIL_Z } from './City.js';

export const TEXTS = {
  arrive: ['Valdrada.', 'Down in the water the village is full of people. Up here, nobody.', '…and I am not there.'],
  hintLantern: 'In the water, by the long house, a man keeps lighting a lantern. Up here, it is dark.',
  hintBell: 'Down there, the woman under the bell has started to ring it. I hear nothing.',
  lantern: 'Down in the water every window lights up. Up here, only mine.',
  bell: 'The bell rings. In the water it stops, without a sound.',
  feet: 'There are my feet, in the water.',
  half: 'Half of me, down there.',
  waiting: 'At the end of the pier, in the water, someone is holding out a hand.',
  hand: ['Down there, he takes her hand.', 'Up here, my hand closes on nothing.'],
  whole: 'Now all of me is down there.',
  fade: 'And up here, less and less of me.',
  card: ['The two Valdradas live for each other,', 'always looking each other in the eye —', 'and they do not love each other.'],
  prompts: { lantern: 'Light the lantern', bell: 'Ring the bell', hand: 'Reach out your hand' },
};

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

export class ValdradaStory {
  constructor({ scene, city, player, followCam, narrator, interactions, inhabitants, water }) {
    Object.assign(this, { scene, city, player, followCam, narrator, interactions, inhabitants, water });
    this.stage = 0;          // pezzi di riflesso ritrovati: 0 niente, 1 piedi, 2 fino al petto, 3 intero
    this.done = { lantern: false, bell: false };
    this.reveal = -1;        // quota del taglio sopra i piedi (animata)
    this.revealGoal = -1;
    this.time = 0;
    this.audio = null;

    this.makeTwin();
    this.setupLights();
    this.setupLantern();
    this.setupBell();
    this.setupHand();
    this.onEnd = null;       // chiamata dopo il cartello finale (la usa la cornice del sogno)
  }

  // comincia la storia (dopo l'arrivo dalla nebbia, o subito nella pagina di prova)
  start() { this.intro(); }

  // ---------------- il riflesso del viaggiatore ----------------
  makeTwin() {
    const t = new Traveler();
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -100); // visibile dove y ≤ quota: all'inizio niente
    t.root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.clippingPlanes = [this.clip];
      o.material.clipShadows = true;
    });
    if (t.light && t.light.parent) t.light.parent.remove(t.light);
    setLayer(t.root, LAYER_REFLECTION_ONLY);
    this.scene.add(t.root);
    this.twin = t;
    this.twinFree = false;   // true alla fine: non copia più il viaggiatore
  }
  copyPose() {
    const src = this.player.traveler, dst = this.twin;
    dst.root.position.copy(src.root.position); dst.root.quaternion.copy(src.root.quaternion);
    for (const k in src.joints) {
      const a = src.joints[k], b = dst.joints[k];
      if (!b) continue;
      b.position.copy(a.position); b.quaternion.copy(a.quaternion);
    }
    // A Valdrada il riflesso non è simmetrico: non sta sotto i piedi (dove la passerella
    // lo nasconderebbe) ma cammina accanto al viaggiatore, sull'acqua aperta — oltre il
    // parapetto della passerella, o a fianco del pontile.
    const p = dst.root.position;
    if (Math.abs(p.x - PIER_X) < 1.3 && p.z > RAIL_Z - 0.2) p.x = PIER_X - 1.7;
    else p.z = Math.max(p.z + 1.2, RAIL_Z + 2.8); // davanti a lui, oltre le barche ormeggiate
  }
  setStage(n) {
    this.stage = n;
    this.revealGoal = [-1, 0.55, 1.45, 3.0][n];
  }

  // ---------------- le luci del villaggio ----------------
  // All'inizio il villaggio è quasi buio, sopra e sotto: restano accese solo poche finestre
  // (materiale litOn). Le finestre "accendibili" (lit), le lanterne (lamp) e le loro luci
  // sono spente. Dopo la lanterna, mentre si disegna il RIFLESSO tutto si accende (anche i
  // vetri bui), e subito dopo torna spento: la stessa città, accesa solo nell'acqua.
  setupLights() {
    const M = this.city.materials;
    this.lampOn = M.lamp.clone();                       // la lanterna della storia, accesa davvero
    const look = (m) => ({ c: m.color.clone(), e: m.emissive.clone(), i: m.emissiveIntensity });
    const put = (m, v) => { m.color.copy(v.c); m.emissive.copy(v.e); m.emissiveIntensity = v.i; };
    const ON_WIN = { c: new THREE.Color('#f0bd78'), e: new THREE.Color('#ffae5c'), i: 1.0 };
    const ON_LAMP = look(M.lamp);
    const OFF_WIN = look(M.glass);
    const OFF_LAMP = { c: new THREE.Color('#3b352e'), e: new THREE.Color('#000000'), i: 0 };
    const lights = this.city.lampLights || [], lightOn = lights.map((l) => l.intensity);
    const off = () => { put(M.lit, OFF_WIN); put(M.glass, OFF_WIN); put(M.lamp, OFF_LAMP); lights.forEach((l) => (l.intensity = 0)); };
    off();
    this.windowsLit = false;
    this.water.onBefore = () => {
      if (!this.windowsLit) return;
      put(M.lit, ON_WIN); put(M.glass, ON_WIN); put(M.lamp, ON_LAMP);
      lights.forEach((l, k) => (l.intensity = lightOn[k]));
    };
    this.water.onAfter = off;
  }

  // ---------------- 1. la lanterna ----------------
  setupLantern() {
    const M = this.city.materials;
    const H = this.city.lanternHouse; // la casa lunga più vicina al pontile (davanti, il lago è libero)
    const m = H.mirror ? -1 : 1;
    const base = new THREE.Vector3(H.x + m * 1.55, BW_Y, H.porch + 0.05);
    this.lanternPos = base.clone().add(new THREE.Vector3(0, 2.25, 0));
    // il palo con il braccio (si vede ovunque)
    const g = new THREE.Group(); g.position.copy(base); this.scene.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6), M.post); post.position.y = 1.3; g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), M.post); arm.position.set(0, 2.55, 0.2); g.add(arm);
    // due lanterne nello stesso punto: quella SPENTA la vede solo il viaggiatore, quella
    // ACCESA solo il lago. Quando la si accende, quella vera diventa accesa per tutti.
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.6 });
    const mk = (mat) => {
      const l = new THREE.Group(); l.position.set(0, 2.3, 0.42); g.add(l);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.32, 6), mat); l.add(body);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 6), M.metal); cap.position.y = 0.2; l.add(cap);
      return { l, body };
    };
    this.realLantern = mk(dark); setLayer(this.realLantern.l, LAYER_NO_REFLECTION);
    this.reflLantern = mk(this.lampOn); setLayer(this.reflLantern.l, LAYER_REFLECTION_ONLY);
    // nell'acqua, l'uomo che la accende (e la riaccende, e la riaccende)
    this.lanternMan = this.inhabitants.spawn(this.scene, { pos: new THREE.Vector3(base.x - m * 0.55, BW_Y, base.z - 0.25), facing: m * 1.2, action: 'reach' });
    this.interactions.add({
      id: 'lanterna', position: () => this.lanternPos, radius: 2.2, prompt: TEXTS.prompts.lantern,
      enabled: () => !this.done.lantern,
      onInteract: async () => {
        const p = this.player;
        p.facing = Math.atan2(this.lanternPos.x - p.position.x, this.lanternPos.z - p.position.z);
        p.action = 'reach'; await wait(1.1);
        // la fiamma: la lanterna vera si accende, con la sua luce
        this.realLantern.body.material = this.lampOn; setLayer(this.realLantern.l, 0);
        this.reflLantern.l.visible = false;
        const light = new THREE.PointLight('#ffb36b', 3, 10, 2); light.position.copy(this.lanternPos).add(new THREE.Vector3(0, 0, 0.4)); this.scene.add(light);
        this.chime(660, 0.08);
        await wait(0.6); p.action = null;
        // nel riflesso si accendono tutte le finestre e le lanterne
        this.windowsLit = true;
        this.lanternMan.action = null; this.lanternMan.facing = Math.atan2(p.position.x - this.lanternMan.t.root.position.x, p.position.z - this.lanternMan.t.root.position.z);
        this.done.lantern = true;
        this.narrator.thought(TEXTS.lantern, 4.5); await wait(4.8);
        await this.gain();
        // subito dopo, nel lago la donna sotto il campanile comincia a suonare (senza suono)
        this.bellWoman.action = 'ring'; this.bellWoman.facing = Math.PI;
        this.grab(this.reflBell, this.bellWoman.t);
        await wait(1.5);
        this.narrator.thought(TEXTS.hintBell, 5);
      },
    });
  }

  // ---------------- 2. la campana ----------------
  // La corda pende dalla punta di una leva fissata al giogo. Chi suona la tiene con tutte e
  // due le mani: la corda viene disegnata ogni frame DALLA PUNTA DELLA LEVA ALLE MANI, così
  // le mani la toccano sempre. Le braccia seguono un ciclo di trazione (su → giù) e la
  // campana ruota di quanto è scesa la corda; a ogni fine corsa il battaglio colpisce.
  // Quando nessuno la tiene, la corda pende dritta dalla leva e la campana si calma piano.
  setupBell() {
    const B = this.city.bell, M = this.city.materials;
    this.B = B;
    // due campane nello stesso punto: quella vera la vede solo il viaggiatore, la copia solo il lago
    const reflYoke = B.yoke.clone(true); B.yoke.parent.add(reflYoke);
    setLayer(B.yoke, LAYER_NO_REFLECTION); setLayer(reflYoke, LAYER_REFLECTION_ONLY);
    // una corda è un cilindro alto 1 con la base nell'origine: lo si stira tra due punti
    const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 5); ropeGeo.translate(0, 0.5, 0);
    const mkRope = (layer) => {
      const main = new THREE.Mesh(ropeGeo, M.rope), tail = new THREE.Mesh(ropeGeo, M.rope);
      main.frustumCulled = tail.frustumCulled = false;
      setLayer(main, layer); setLayer(tail, layer); this.scene.add(main, tail);
      return { main, tail };
    };
    const mkBell = (yoke, layer, sound) => ({ yoke, rope: mkRope(layer), sound, phase: 0, amp: 0, ringer: null, grip: 0, release: false });
    this.realBell = mkBell(B.yoke, LAYER_NO_REFLECTION, true);
    this.reflBell = mkBell(reflYoke, LAYER_REFLECTION_ONLY, false);
    this.reflYoke = reflYoke;
    // il posto di chi suona: sotto la campana, con la punta della leva sopra le mani
    this.ringSpot = B.base.clone().add(new THREE.Vector3(0, 0, B.lever + 0.3));
    this.bellPos = B.base.clone().add(new THREE.Vector3(0, 1.6, B.lever));
    // nell'acqua la donna aspetta sotto il campanile; comincia a suonare dopo la lanterna
    this.bellWoman = this.inhabitants.spawn(this.scene, { pos: this.ringSpot.clone(), facing: 0, action: null });
    this.interactions.add({
      id: 'campana', position: () => this.bellPos, radius: 1.8, prompt: TEXTS.prompts.bell,
      enabled: () => this.done.lantern && !this.done.bell,
      onInteract: async () => {
        const p = this.player;
        // due passi fino al posto giusto, poi le mani in alto sulla corda
        p.facing = Math.PI;
        await this.slide(p, this.ringSpot, 0.5);
        p.action = 'ring';
        this.grab(this.realBell, p.traveler);
        this.strikes = 0;
        // appena il viaggiatore tira, nel lago la donna lascia la corda e la campana si ferma
        this.reflBell.release = true;
        await wait(1.0);
        this.bellWoman.action = 'lookup';
        while (this.strikes < 4) await wait(0.1);
        this.realBell.release = true;              // lascia la corda (quando le mani sono in alto)
        while (this.realBell.ringer) await wait(0.1);
        p.action = null;
        this.bellWoman.action = null;
        this.bellWoman.facing = Math.atan2(p.position.x - this.bellWoman.t.root.position.x, p.position.z - this.bellWoman.t.root.position.z + 0.01);
        this.done.bell = true;
        this.narrator.thought(TEXTS.bell, 4.5); await wait(4.8);
        await this.gain();
      },
    });
  }

  // qualcuno prende la corda: si parte con le mani in alto
  grab(b, traveler) { b.ringer = traveler; b.phase = 0; b.grip = 0; b.release = false; }

  // sposta il viaggiatore con dolcezza fino a un punto (passi brevi, non un salto)
  slide(p, to, seconds) {
    return new Promise((resolve) => { this.sliding = { p, from: p.position.clone(), to: to.clone(), t: 0, seconds, resolve }; });
  }

  // le braccia di chi tira: k = 0 mani in alto (corda su), k = 1 mani al petto (corda giù)
  ringerPose(t, k) {
    const j = t.joints, e = Math.sqrt(k);
    // le due mani si chiudono sulla corda, una sopra l'altra davanti al viso
    j.shoulderL.rotation.set(-2.75 + 2.2 * k, 0, 0.42 + 0.2 * k);
    j.shoulderR.rotation.set(-2.75 + 2.2 * k, 0, -0.42 - 0.2 * k);
    j.elbowL.rotation.set(-0.2 - 1.5 * e, 0, 0); j.elbowR.rotation.set(-0.2 - 1.5 * e, 0, 0);
    j.wristL.rotation.set(0.3, 0, 0); j.wristR.rotation.set(0.3, 0, 0);
    j.spine.rotation.set(0.04 + 0.2 * k, 0, 0); j.chest.rotation.set(0.04 * k, 0, 0);
    j.head.rotation.set(-0.45 + 0.35 * k, 0, 0);
    j.kneeL.rotation.set(0.08 + 0.3 * k, 0, 0); j.kneeR.rotation.set(0.08 + 0.3 * k, 0, 0);
    j.hipL.rotation.set(-0.06 - 0.22 * k, 0, 0); j.hipR.rotation.set(-0.06 - 0.22 * k, 0, 0);
  }

  // il punto tra i due pugni (dove passa la corda)
  handsPoint(t, out) {
    t.root.updateMatrixWorld(true);
    const a = t.joints.wristL.localToWorld(new THREE.Vector3(0, -0.06, 0));
    const b = t.joints.wristR.localToWorld(new THREE.Vector3(0, -0.06, 0));
    return out.copy(a).add(b).multiplyScalar(0.5);
  }

  // stira un cilindro-corda dal punto a al punto b
  stretch(mesh, a, b) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    mesh.position.copy(a);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.multiplyScalar(1 / Math.max(len, 1e-4)));
    mesh.scale.set(1, len, 1);
  }

  // un passo di una campana
  stepBell(b, dt) {
    const prevS = Math.sin(b.phase);
    b.phase += dt * Math.PI * 2 * 0.5;             // un ciclo ogni 2 s: un rintocco a ogni fine corsa
    const k = (1 - Math.cos(b.phase)) / 2;         // 0 = corda in alto, 1 = corda giù
    if (b.ringer) {
      b.grip = Math.min(1, b.grip + dt * 1.5);     // la prima tirata è più morbida
      b.amp = 0.4 * b.grip;
      // lascia la corda solo quando le mani sono tornate in alto
      if (b.release && k < 0.04) { b.ringer = null; b.release = false; }
    } else {
      b.amp *= Math.exp(-dt * 0.45);               // senza nessuno la campana si calma piano
    }
    const a = b.amp * (-Math.cos(b.phase));        // corda giù = la leva scende = giogo ruotato
    b.yoke.rotation.x = a;
    b.yoke.updateMatrixWorld(true);
    const tip = b.yoke.localToWorld(new THREE.Vector3(0, 0.05, this.B.lever));
    if (b.ringer) {
      this.ringerPose(b.ringer, k * b.grip);
      const h = this.handsPoint(b.ringer, new THREE.Vector3());
      this.stretch(b.rope.main, h, tip);
      b.rope.tail.visible = true;
      this.stretch(b.rope.tail, h.clone().add(new THREE.Vector3(0, -0.5, 0.03)), h);
    } else {
      this.stretch(b.rope.main, tip.clone().add(new THREE.Vector3(0, -2.35, 0)), tip);
      b.rope.tail.visible = false;
    }
    // il battaglio: a ogni fine corsa (la velocità cambia verso)
    if (b.sound && b.amp > 0.12 && Math.sign(prevS) !== Math.sign(Math.sin(b.phase))) { this.ring(); this.strikes = (this.strikes || 0) + 1; }
  }

  // ---------------- 3. la mano ----------------
  setupHand() {
    this.tip = new THREE.Vector3(PIER_X, PIER_Y, PIER_END - 0.6);
    // la figura che aspetta sta OLTRE la punta del pontile, sull'acqua, e tende la mano sinistra
    this.waiting = this.inhabitants.spawn(this.scene, { pos: new THREE.Vector3(PIER_X + 0.1, PIER_Y, PIER_END + 2.2), facing: Math.PI, action: 'offerL', visible: false });
    this.interactions.add({
      id: 'mano', position: () => this.tip, radius: 1.6, prompt: TEXTS.prompts.hand,
      enabled: () => this.stage === 2 && !this.ended,
      onInteract: () => this.finale(),
    });
  }

  // un pezzo di riflesso in più
  async gain() {
    const n = (this.done.lantern ? 1 : 0) + (this.done.bell ? 1 : 0);
    this.setStage(n);
    // la camera va a guardare nell'acqua il pezzo ritrovato, poi torna al viaggiatore
    await this.lookAtTwin(n === 1 ? TEXTS.feet : TEXTS.half, 5);
    if (n === 2) {
      this.waiting.visible = true;
      this.narrator.thought(TEXTS.waiting, 5);
    }
  }

  // breve inquadratura sul riflesso: dal lago, di lato, così che il raggio di vista
  // colpisca l'acqua libera (non le assi della passerella o del pontile)
  async lookAtTwin(text, seconds) {
    const cam = this.followCam, saved = cam.update;
    const tp = this.twin.root.position, sx = tp.x < PIER_X ? -1.5 : 1.5;
    const cpos = new THREE.Vector3(tp.x + sx, 3.6, tp.z + 3.2), goal = new THREE.Vector3(tp.x, -1.0, tp.z); // dall'alto: dietro il riflesso c'è il cielo chiaro, non il villaggio scuro
    const look = this.player.position.clone();
    cam.update = function (dt) {
      const k = 1 - Math.exp(-2.5 * dt);
      this.camera.position.lerp(cpos, k); look.lerp(goal, k); this.camera.lookAt(look);
    };
    await wait(1.2);
    this.narrator.thought(text, seconds - 1.5);
    await wait(seconds);
    cam.update = saved;
  }

  async intro() {
    await wait(1.2); this.narrator.thought(TEXTS.arrive[0], 3);
    await wait(5); this.narrator.thought(TEXTS.arrive[1], 5);
    await wait(6); this.narrator.thought(TEXTS.arrive[2], 4);
    await wait(6); if (!this.done.lantern) this.narrator.thought(TEXTS.hintLantern, 6);
  }

  async finale() {
    this.ended = true;
    this.waiting.visible = true;
    const p = this.player, cam = this.followCam;
    p.facing = 0; // verso il lago
    p.action = 'offer'; // tende la mano verso l'acqua
    // la camera esce sull'acqua, di lato e davanti alla punta: vede il viaggiatore con la
    // mano tesa e, sotto di lui, l'acqua libera dove le due mani si incontrano (da dietro,
    // lungo il pontile, l'acqua sarebbe nascosta dalle assi)
    const savedUpdate = cam.update, cpos = new THREE.Vector3(PIER_X + 6.2, 2.3, PIER_END + 4.8), cgoal = new THREE.Vector3(PIER_X, 0.1, PIER_END + 1.0), clook = new THREE.Vector3();
    cam.update = function (dt) { this.camera.position.lerp(cpos, 1 - Math.exp(-2 * dt)); clook.lerp(cgoal, 1 - Math.exp(-2 * dt)); this.camera.lookAt(clook); };
    clook.copy(this.player.position);
    await wait(1.8);
    // il riflesso (ancora senza testa) smette di copiare il viaggiatore e cammina verso di lei
    this.twinFree = true;
    this.twinAnim = new TravelerAnimator(this.twin);
    this.twinAction = null;
    const w = this.waiting.t.root.position;
    const from = this.twin.root.position.clone(), to = new THREE.Vector3(w.x, w.y, w.z - 1.15);
    this.twinFacing = Math.atan2(to.x - from.x, to.z - from.z);
    this.twinMove = { from, to, t: 0, seconds: Math.max(1, from.distanceTo(to) / 1.1) };
    while (this.twinMove.t < 1) await wait(0.1);
    // arrivato davanti a lei: le tende la destra, lei gliela prende con la sinistra
    this.twinAction = 'offer';
    await wait(1.2);
    this.narrator.thought(TEXTS.hand[0], 3.2); await wait(3.4);
    // dopo la stretta compare la testa: il riflesso è intero
    this.setStage(3);
    await wait(1.0);
    this.narrator.thought(TEXTS.whole, 3.2); await wait(3.4);
    this.narrator.thought(TEXTS.hand[1], 3.2); await wait(3.0);
    // e il viaggiatore, sopra, svanisce: resta solo il riflesso
    this.fadeTraveler(4.0);
    this.narrator.thought(TEXTS.fade, 3.5);
    while (this.fading) await wait(0.1);
    await wait(0.8);
    this.twinAction = 'lookup';   // laggiù alza gli occhi verso il pontile vuoto
    await wait(3.0);
    await this.narrator.card(TEXTS.card);
    cam.update = savedUpdate;
    this.onEnd?.();
  }

  // il viaggiatore svanisce: diventa trasparente mentre piccole luci si staccano e salgono
  fadeTraveler(seconds) {
    const meshes = [];
    this.player.object.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.keepMat = o.material;
      o.material = o.material.clone(); o.material.transparent = true;
      meshes.push(o);
    });
    const light = this.player.traveler.light;
    const motes = [];
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,240,215,1)'); gr.addColorStop(1, 'rgba(255,220,180,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
    })();
    for (let k = 0; k < 40; k++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      m.scale.setScalar(0.06 + Math.random() * 0.08);
      m.layers.set(LAYER_NO_REFLECTION);   // si vedono solo sopra: nel lago non c'è niente da perdere
      const p = this.player.position;
      m.position.set(p.x + (Math.random() - 0.5) * 0.5, p.y + 0.2 + Math.random() * 1.7, p.z + (Math.random() - 0.5) * 0.4);
      this.scene.add(m);
      motes.push({ m, delay: Math.random() * seconds * 0.7, vy: 0.25 + Math.random() * 0.35, life: 1.6 + Math.random() * 1.2, t: 0 });
    }
    this.fading = { t: 0, seconds, meshes, light, light0: light ? light.intensity : 0, motes };
  }

  // riporta il viaggiatore com'era (lo usa la cornice, prima di tornare nel sogno)
  restoreTraveler() {
    const f = this.fadeDone || this.fading;
    this.player.object.traverse((o) => { if (o.isMesh && o.userData.keepMat) { o.material = o.userData.keepMat; delete o.userData.keepMat; } });
    this.player.object.visible = true;
    if (f) {
      if (f.light) f.light.intensity = f.light0;
      for (const it of f.motes) this.scene.remove(it.m);
    }
    this.fading = null; this.fadeDone = null;
  }

  // ---------------- suoni (WebAudio, sintetizzati) ----------------
  ctx() { if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)(); return this.audio; }
  // campana: somma di parziali non armoniche che si spengono a velocità diverse
  ring() {
    const a = this.ctx(), t0 = a.currentTime, f = 196;
    const out = a.createGain(); out.gain.value = 0.18; out.connect(a.destination);
    for (const [r, g, d] of [[0.5, 0.5, 5], [1, 1, 4], [1.19, 0.6, 3], [1.56, 0.5, 2.5], [2.0, 0.35, 2], [2.74, 0.25, 1.4], [3.76, 0.15, 1]]) {
      const o = a.createOscillator(), v = a.createGain();
      o.frequency.value = f * r; o.type = 'sine';
      v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(v); v.connect(out); o.start(t0); o.stop(t0 + d + 0.1);
    }
  }
  chime(f, gain) {
    const a = this.ctx(), t0 = a.currentTime, o = a.createOscillator(), v = a.createGain();
    o.frequency.value = f; v.gain.setValueAtTime(gain, t0); v.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    o.connect(v); v.connect(a.destination); o.start(t0); o.stop(t0 + 1.3);
  }

  // ---------------- ogni frame ----------------
  update(dt) {
    this.time += dt;
    // due passi fino al posto della campana
    if (this.sliding) {
      const S = this.sliding;
      S.t = Math.min(1, S.t + dt / S.seconds);
      const e = S.t * S.t * (3 - 2 * S.t);
      S.p.position.lerpVectors(S.from, S.to, e); S.p.object.position.copy(S.p.position);
      S.p.scriptSpeed = S.t < 1 ? 1 : 0; S.p.scriptMoving = S.t < 1;
      if (S.t >= 1) { this.sliding = null; S.resolve(); }
    }
    // le due campane (prima del riflesso, così il riflesso copia le braccia già sulla corda)
    this.stepBell(this.realBell, dt);
    this.stepBell(this.reflBell, dt);
    // il riflesso del viaggiatore
    if (!this.twinFree) this.copyPose();
    else {
      let speed = 0;
      if (this.twinMove && this.twinMove.t < 1) {
        this.twinMove.t = Math.min(1, this.twinMove.t + dt / this.twinMove.seconds);
        this.twin.root.position.lerpVectors(this.twinMove.from, this.twinMove.to, this.twinMove.t);
        speed = 1.1;
        if (this.twinMove.t >= 1) this.twinFacing = 0; // arrivato: davanti a lei
      }
      this.twinAnim.update(dt, { state: 'walk', onGround: true, speed, vy: 0, wobble: 0, climbT: 0, hands: null, hangSpeed: 0, facing: this.twinFacing, action: this.twinAction, wind: 0 });
    }
    // il taglio sale con dolcezza verso la quota del pezzo ritrovato
    if (this.revealGoal > 0 && this.reveal < 0) this.reveal = 0;
    if (this.reveal < this.revealGoal) this.reveal = Math.min(this.revealGoal, this.reveal + dt * 0.6);
    const feetY = this.twin.root.position.y;
    this.clip.constant = this.reveal < 0 ? -100 : feetY + this.reveal;
    // il viaggiatore che svanisce
    if (this.fading) {
      const F = this.fading;
      F.t += dt;
      const k = Math.min(1, F.t / F.seconds), o = 1 - k * k * (3 - 2 * k);
      for (const m of F.meshes) m.material.opacity = o;
      if (F.light) F.light.intensity = F.light0 * o;
      for (const it of F.motes) {
        const tt = F.t - it.delay;
        if (tt < 0) continue;
        it.m.position.y += it.vy * dt;
        it.m.position.x += Math.sin((F.t + it.delay) * 2) * 0.05 * dt;
        it.m.material.opacity = Math.max(0, Math.sin(Math.PI * Math.min(1, tt / it.life))) * 0.9;
      }
      if (F.t >= F.seconds + 1.5) { this.player.object.visible = false; this.fadeDone = F; this.fading = null; }
    }
    // l'uomo della lanterna, finché non è accesa, la riaccende di continuo (alza e abbassa il braccio)
    if (!this.done.lantern) this.lanternMan.action = (this.time % 3.5) < 2.2 ? 'reach' : null;
  }

  // suggerimento in basso (come in Ottavia)
  get hint() {
    if (this.ended) return '';
    if (this.stage === 1 && this.done.lantern && !this.done.bell) return 'Ring the bell by the pier.';
    if (this.stage === 2 && !this.ended) return 'Walk back to the end of the pier.';
    return '';
  }
}
