// Story.js
// ---------------------------------------------------------------
// La storia di Ottavia, versione 2: "Le funi che rispondono".
// (Il documento della storia, scheda "Ottavia v2", descrive gli stessi passi.)
//
//   1. la passerella è strappata a metà: non si passa
//   2. Polo pizzica una fune → un'onda di luce corre sulla rete → una casa risponde
//   3. scende tra le case (ponticello → casa → casa → stazione A), le voci parlano
//   4. pizzica il cavo → dall'altra parte qualcuno molla il contrappeso → la cabina arriva
//   5. a metà strada la raffica blocca la cabina: le case mandano luci lungo le funi,
//      Polo pizzica a tempo, e ogni colpo riuscito tira la cabina avanti
//   6. stazione B → casa → ponticello → passerella oltre lo strappo → cresta → finale
//
// Come per la versione 1, ogni scena è una funzione async: si legge riga dopo riga
// (await narrator.say(...), await this.walk(...), await pulse.send(...)).
// Gli spostamenti guidati, le luci e la cabina avanzano in update(dt), ogni frame.
// Ogni sequenza controlla il "gettone" (token): se si preme R a metà, si ferma.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { TEXTS } from './texts.js';
import { Pulse } from './Pulse.js';
import { pluck, ropeFreq, SCALE } from './Sound.js';

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const smooth = (t) => t * t * (3 - 2 * t);

// lo strappo: niente traversine dalla fila 19 alla 23 (vedi main.js)
const TEAR_Z0 = 18.1, TEAR_Z1 = 23.9; // sopra le traversine 18 e 24 (profonde 0,6 m), non nell'intervallo
const HITS_NEEDED = 6;

export class Story {
  constructor({ narrator, journal, interactions, player, hanging, net, camera, walkway, route, scene, notePost, dream, view }) {
    Object.assign(this, { narrator, journal, interactions, player, hanging, net, camera, walkway, route, notePost, dream, view });
    this.pulse = new Pulse(scene, net);
    this.wind = null; // lo collega main.js (il vento nasce dopo la storia)
    this.houses = hanging.items.filter((it) => it.name === 'casa');
    // un faro che pulsa dove la storia aspetta il viaggiatore
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.pulse.tex, color: '#ffd98a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.token = 0;
    this.reset();
    this.setupInteractions();
    addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) this.lastPress = performance.now() / 1000; });
  }

  // Tutto ciò che la storia ricorda
  reset() {
    this.token++;
    this.stage = 'free';           // free · atTear · called · guided · stationA · calling · cabinHere · riding · rhythm · atB · back · ending · done
    this.crossed = false;          // ha già superato lo strappo (dall'altra parte)
    this.thoughtCooldown = 0;
    this.movers = []; this.tweens = [];
    this.riding = false;
    this.rhythm = null;
    this.beaconAt = null;
    this.pulse?.clear();
    const cw = this.route.cableway;
    cw.control.manual = true; cw.control.u = 1;   // la cabina aspetta alla stazione B
    this.wind?.force(null);
    if (this.view) this.view.mode = 'world';
    if (this.player) { this.player.action = null; this.player.frozen = false; }
    this.journal?.reset();
    this.camera?.focus(null);
  }

  // --- APERTURA: la citazione, poi il sogno con Kublai Khan, poi Ottavia ----
  async intro() {
    const tok = this.token, p = this.player;
    p.frozen = true;
    p.facing = 0;                                   // guarda verso la città (+Z)
    this.camera.yaw = Math.PI - 0.5; this.camera.pitch = 0.28; this.camera.distance = 6.0; // di tre quarti, sopra la spalla: si vedono tutti e due
    this.dream.setAnchor(p.position, p.facing);
    this.view.mode = 'dream';
    await this.narrator.card(TEXTS.intro); if (!this.alive(tok)) return;
    await this.dialogue(TEXTS.dream); if (!this.alive(tok)) return;
    // "Its name is Ottavia." → il sogno si dissolve, resta la città
    await this.dissolve(0, 1, 4.5); if (!this.alive(tok)) return;
    p.frozen = false;
    this.think(TEXTS.thoughts.arrive, 3);
  }

  // un dialogo a battute alterne; quando parla il Khan, il Khan gesticola
  async dialogue(lines) {
    for (const [who, text] of lines) {
      this.dream.kublai.speaking = who === 'K';
      await this.narrator.say(text, TEXTS.names[who]);
    }
    this.dream.kublai.speaking = false;
  }

  // passaggio nella nebbia tra il sogno (0) e Ottavia (1), con la camera ferma
  async dissolve(from, to, seconds) {
    this.view.mode = 'blend'; this.view.t = from;
    await this.tween(seconds, (e) => { this.view.t = from + (to - from) * e; });
    this.view.mode = to >= 1 ? 'world' : 'dream';
  }

  // ---------------------------------------------------------------
  // Le interazioni con E (compaiono solo nella fase giusta)
  // ---------------------------------------------------------------
  setupInteractions() {
    const I = this.interactions, R = this.route, net = this.net;
    const nodeFn = (i, j, dy = 0) => { const v = new THREE.Vector3(), n = net.index(i, j); return () => v.set(net.pos[n * 3], net.pos[n * 3 + 1] + dy, net.pos[n * 3 + 2]); };
    this.edgeNode = net.index(9, 18);
    I.add({
      id: 'nota', position: () => this.notePost.object.position.clone().setY(1.1), radius: 1.8, prompt: TEXTS.ui.read,
      onInteract: async () => { await this.narrator.say(TEXTS.note.pages, TEXTS.note.title); this.journal.add('nota', TEXTS.note.title, TEXTS.note.pages); },
    });
    I.add({
      id: 'pizzica-strappo', position: nodeFn(9, 18), radius: 2.4, prompt: TEXTS.ui.pluck, markerHeight: 0.3,
      enabled: () => this.stage === 'free' || this.stage === 'atTear',
      onInteract: () => this.firstCall(),
    });
    I.add({
      id: 'scendi', position: () => this.goDownPoint(), radius: 2.0, prompt: TEXTS.ui.goDown,
      enabled: () => this.stage === 'called',
      onInteract: () => this.descend(),
    });
    I.add({
      id: 'pizzica-cavo', position: () => R.cableway.cableEnd(0)().clone(), radius: 3.2, prompt: TEXTS.ui.pluckCable, markerHeight: 0.2,
      enabled: () => this.stage === 'stationA',
      onInteract: () => this.callCabin(),
    });
    I.add({
      id: 'sali', position: () => R.cableway.cabinPoint(), radius: 2.6, prompt: TEXTS.ui.board, markerHeight: 1.4,
      enabled: () => this.stage === 'cabinHere',
      onInteract: () => this.ride(),
    });
    I.add({
      id: 'scendi-cabina', position: () => R.cableway.cabinPoint(), radius: 2.6, prompt: TEXTS.ui.stepOut, markerHeight: 1.4,
      enabled: () => this.stage === 'atB',
      onInteract: () => this.ascend(),
    });
  }

  goDownPoint() {
    const [i, j] = this.route.walkwayIn, net = this.net, a = net.index(i, j), b = net.index(i, j + 1);
    return new THREE.Vector3((net.pos[a * 3] + net.pos[b * 3]) / 2, (net.pos[a * 3 + 1] + net.pos[b * 3 + 1]) / 2, (net.pos[a * 3 + 2] + net.pos[b * 3 + 2]) / 2);
  }

  // ---------------------------------------------------------------
  // Gesti e piccoli aiuti
  // ---------------------------------------------------------------
  // Pizzicare una fune della rete: nota (dalla tensione) + onda di luce + gesto delle braccia
  pluckNode(node, opts = {}) {
    const c = this.net.vRope[node] >= 0 ? this.net.vRope[node] : this.net.hRope[node];
    const f = opts.freq ?? ropeFreq(this.net.stress[c] || 0, this.net.ratio[c] > 0.9);
    pluck(f, { pan: THREE.MathUtils.clamp(this.net.pos[node * 3] / 12, -1, 1) });
    this.pulse.ripple(node, opts);
    this.gesture();
  }

  gesture(seconds = 0.6) {
    this.player.action = 'pull';
    clearTimeout(this._gestureTimer);
    this._gestureTimer = setTimeout(() => { this.player.action = null; }, seconds * 1000);
  }

  think(text, seconds = 3.5) {
    this.narrator.thought(text, seconds);
  }

  // Cammino guidato lungo un percorso (punti o funzioni-punto che si muovono con la rete)
  walk(path, speed = 1.3) {
    const p = this.player;
    if (p.state !== 'script') p.startScript();
    p.frozen = true;
    return new Promise((resolve) => this.movers.push({ path: [p.position.clone(), ...path], s: 0, speed, resolve }));
  }

  // un valore che va da a a b in 'seconds', con partenza e arrivo dolci
  tween(seconds, set) {
    return new Promise((resolve) => this.tweens.push({ t: 0, seconds, set, resolve }));
  }

  alive(tok) { return tok === this.token; }

  // ---------------------------------------------------------------
  // SCENA 1–2: lo strappo e la prima chiamata
  // ---------------------------------------------------------------
  async firstCall() {
    const tok = this.token, R = this.route;
    this.stage = 'atTear';
    this.pluckNode(this.edgeNode);
    await wait(1.4); if (!this.alive(tok)) return;
    this.think(TEXTS.thoughts.noAnswer, 2.5);
    await wait(1.8); if (!this.alive(tok)) return;
    // la risposta: una luce che risale il ponticello dalla prima casa alla passerella
    pluck(SCALE[6], { pan: -0.6, gain: 0.5 });
    await this.pulse.send([R.houses.L1.centerPoint, ...R.bridges[0].path(true)], { speed: 6 }); if (!this.alive(tok)) return;
    const [i, j] = R.walkwayIn;
    this.pulse.ripple(this.net.index(i, j), { color: '#ffe6a8', maxHops: 8 });
    pluck(SCALE[8], { pan: -0.4, gain: 0.4 });
    this.think(TEXTS.thoughts.answer, 4);
    this.stage = 'called';
    this.beaconAt = () => this.goDownPoint();
  }

  // ---------------------------------------------------------------
  // SCENA 3: giù tra le case, fino alla stazione A
  // ---------------------------------------------------------------
  async descend() {
    const tok = this.token, R = this.route, H = R.houses, B = R.bridges;
    this.stage = 'guided'; this.beaconAt = null;
    this.think(TEXTS.thoughts.goDown, 3);
    await this.walk(B[0].path(false), 1.2); if (!this.alive(tok)) return;
    await this.voice('L1'); if (!this.alive(tok)) return;
    await this.walk(H.L1.through(0, 1), 1.0); if (!this.alive(tok)) return;
    await this.walk(B[1].path(false), 1.3); if (!this.alive(tok)) return;
    await this.voice('L2'); if (!this.alive(tok)) return;
    await this.walk(H.L2.through(0, 1), 1.0); if (!this.alive(tok)) return;
    await this.walk([...B[2].path(false), ...R.cableway.deckPath(0, 0, true)], 1.3); if (!this.alive(tok)) return;
    this.player.facing = Math.atan2(R.cableway.cableEnd(1)().x - this.player.position.x, R.cableway.cableEnd(1)().z - this.player.position.z);
    this.think(TEXTS.thoughts.stationA, 4);
    this.stage = 'stationA';
    this.beaconAt = () => R.cableway.cableEnd(0)().clone();
  }

  async voice(id) {
    const v = TEXTS.voices[id];
    this.player.scriptSpeed = 0;
    pluck(SCALE[3], { gain: 0.25 });
    await this.narrator.say(v.pages, v.title);
    this.journal.add('voce-' + id, v.title, v.pages);
  }

  // ---------------------------------------------------------------
  // SCENA 4: chiamare la cabina
  // ---------------------------------------------------------------
  async callCabin() {
    const tok = this.token, cw = this.route.cableway;
    this.stage = 'calling'; this.beaconAt = null;
    this.gesture();
    pluck(SCALE[2], { gain: 0.7 });
    await this.pulse.send(cw.cablePath(24), { speed: 14 }); if (!this.alive(tok)) return;
    await wait(0.8); if (!this.alive(tok)) return;
    pluck(SCALE[5], { pan: 0.7, gain: 0.55 });
    await this.pulse.send(cw.cablePath(24, true), { speed: 14 }); if (!this.alive(tok)) return;
    this.think(TEXTS.thoughts.cabinComing, 4);
    await this.tween(10, (e) => { cw.control.u = 1 - e; }); if (!this.alive(tok)) return;
    this.stage = 'cabinHere';
  }

  // ---------------------------------------------------------------
  // SCENA 5: la traversata, la raffica, il battito
  // ---------------------------------------------------------------
  async ride() {
    const tok = this.token, cw = this.route.cableway;
    await this.walk([() => cw.cabinPoint()], 1.0); if (!this.alive(tok)) return;
    this.riding = true; this.stage = 'riding';
    this.think(TEXTS.thoughts.board, 2);
    this.camera.focus(() => cw.cabinPoint(), { distance: 7.5, pitch: 0.35, side: 0.9 });
    await this.tween(11, (e) => { cw.control.u = 0.5 * e; }); if (!this.alive(tok)) return;
    // la raffica
    this.wind?.force(0.95, 1);
    this.camera.shake(0.5);
    this.think(TEXTS.thoughts.gust, 3);
    await wait(2.5); if (!this.alive(tok)) return;
    this.think(TEXTS.thoughts.rhythm, 4.5);
    await wait(1.5); if (!this.alive(tok)) return;
    await this.playRhythm(tok); if (!this.alive(tok)) return;
    // salvo
    this.wind?.force(0.12, 1);
    this.think(TEXTS.thoughts.saved, 4);
    for (let k = 0; k < 4; k++) pluck(SCALE[4 + k], { delay: k * 0.12, gain: 0.45 });
    const u0 = cw.control.u;
    await this.tween(5, (e) => { cw.control.u = u0 + (1 - u0) * e; }); if (!this.alive(tok)) return;
    this.wind?.force(null);
    this.camera.focus(null);
    this.stage = 'atB';
  }

  // Le luci partono dalle case e scendono lungo le funi fino alla cabina: bisogna
  // pizzicare (E) quando arrivano. Si accetta un attimo prima o dopo l'arrivo.
  async playRhythm(tok) {
    const cw = this.route.cableway;
    this.stage = 'rhythm';
    this.rhythm = { hits: 0, beat: 0 };
    while (this.rhythm.hits < HITS_NEEDED) {
      const house = this.houses[this.rhythm.beat % this.houses.length];
      this.rhythm.beat++;
      const target = () => cw.trolleyPoint();
      await this.pulse.send([house.centerPoint, target], { duration: 1.25, size: 0.6 }); if (!this.alive(tok)) return;
      const arrive = performance.now() / 1000;
      const hit = await this.waitPress(arrive, 0.32, 0.38); if (!this.alive(tok)) return;
      if (hit) {
        this.rhythm.hits++;
        pluck(SCALE[1 + this.rhythm.hits], { gain: 0.7 });
        this.gesture(0.4);
        this.camera.shake(0.15);
        const u0 = cw.control.u, du = 0.5 / HITS_NEEDED * 0.6;
        this.tween(0.7, (e) => { cw.control.u = u0 + du * e; });
        if (this.rhythm.hits === 1) this.think(TEXTS.thoughts.hit, 1.5);
      } else {
        pluck(98, { gain: 0.4, damping: 0.99 });
        if (this.rhythm.beat - this.rhythm.hits <= 2) this.think(TEXTS.thoughts.miss, 1.5);
      }
      await wait(0.45);
    }
    this.rhythm = null;
  }

  // vero se E viene premuto tra (arrivo - prima) e (arrivo + dopo)
  waitPress(arrive, before, after) {
    return new Promise((resolve) => {
      if (this.lastPress && arrive - this.lastPress < before) { resolve(true); return; }
      const t0 = arrive, check = () => {
        const now = performance.now() / 1000;
        if (this.lastPress && this.lastPress >= t0 - before && this.lastPress <= now) { resolve(true); return; }
        if (now - t0 > after) { resolve(false); return; }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }

  // ---------------------------------------------------------------
  // SCENA 6: dalla stazione B, attraverso la casa, di nuovo sulla passerella
  // ---------------------------------------------------------------
  async ascend() {
    const tok = this.token, R = this.route, H = R.houses, B = R.bridges, cw = R.cableway;
    this.riding = false; this.stage = 'back';
    await this.walk([...cw.deckPath(1, 0, false), ...B[3].path(false)], 1.3); if (!this.alive(tok)) return;
    await this.voice('R1'); if (!this.alive(tok)) return;
    await this.walk(H.R1.through(0, 1), 1.0); if (!this.alive(tok)) return;
    await this.walk(B[4].path(false), 1.2); if (!this.alive(tok)) return;
    // di nuovo sulle traversine, oltre lo strappo
    const plank = this.walkway.byRow.get(R.walkwayOut[1]) || this.walkway.nearestPlank(1, R.walkwayOut[1] + 0.5);
    const x = this.net.x0 + (R.walkwayOut[0] - 1.2) * this.net.spacing, z = this.walkway.plankZ(plank);
    const at = new THREE.Vector3(x, 0, z);
    await this.walk([at.clone().setY(this.walkway.plankTopAt(plank, x, z))], 1.2); if (!this.alive(tok)) return;
    at.y = this.walkway.plankTopAt(plank, x, z);
    this.player.endScript(at);
    this.player.frozen = false;
    this.crossed = true;
    this.stage = 'free2';
    this.camera.goal = { yaw: Math.PI, pitch: 0.35, distance: 7 }; // di nuovo alle sue spalle, verso la cresta d'arrivo
    this.think(TEXTS.thoughts.onTheOtherSide, 3.5);
  }

  // ---------------------------------------------------------------
  // FINALE
  // ---------------------------------------------------------------
  async ending() {
    const tok = this.token, p = this.player;
    this.stage = 'ending';
    p.frozen = true;
    p.facing = Math.PI; // si gira verso la città
    const L = (this.net.rows - 1) * this.net.spacing;
    this.camera.focus(() => new THREE.Vector3(0, -3, L / 2), { distance: 16, pitch: 0.35, side: 0.2 });
    this.pulse.ripple(this.net.index(12, this.net.rows - 2), { maxHops: 45, speed: 10, width: 2 });
    this.houses.forEach((h, k) => {
      setTimeout(() => {
        if (!this.alive(tok)) return;
        pluck(SCALE[k % SCALE.length], { gain: 0.35, pan: h.centerPoint().x / 12 });
        this.pulse.send([h.centerPoint, () => p.position.clone().setY(p.position.y + 1)], { duration: 2.2 });
      }, 600 + k * 450);
    });
    await wait(5); if (!this.alive(tok)) return;
    await this.narrator.card(TEXTS.ending); if (!this.alive(tok)) return;
    // ritorno alla cornice: Ottavia si dissolve e intorno al viaggiatore riappare il sogno
    this.camera.focus(null);
    this.camera.goal = { yaw: p.facing + Math.PI - 0.5, pitch: 0.28, distance: 6.0 };
    this.dream.setAnchor(p.position, p.facing);
    await wait(1.5); if (!this.alive(tok)) return;
    await this.dissolve(1, 0, 4.5); if (!this.alive(tok)) return;
    await this.dialogue(TEXTS.dreamEnd); if (!this.alive(tok)) return;
    await this.narrator.card(TEXTS.toBeContinued);
    this.stage = 'done';
  }

  // ---------------------------------------------------------------
  // Ogni frame
  // ---------------------------------------------------------------
  get hint() {
    if (this.rhythm) {
      const dots = '●'.repeat(this.rhythm.hits) + '○'.repeat(HITS_NEEDED - this.rhythm.hits);
      return `<b>E</b> ${TEXTS.ui.rhythm} · ${dots}`;
    }
    return '';
  }

  update(dt = 1 / 60) {
    const p = this.player;
    this.pulse.update(dt);
    this.thoughtCooldown = Math.max(0, this.thoughtCooldown - dt);

    // valori che cambiano nel tempo (cabina)
    this.tweens = this.tweens.filter((tw) => {
      tw.t = Math.min(1, tw.t + dt / tw.seconds);
      tw.set(smooth(tw.t));
      if (tw.t >= 1) { tw.resolve(); return false; }
      return true;
    });

    // cammini guidati
    if (this.movers.length) {
      const m = this.movers[0];
      const pts = Pulse.resolve(m.path), L = Pulse.length(pts);
      m.s = Math.min(L, m.s + m.speed * dt);
      const pos = Pulse.at(pts, m.s), ahead = Pulse.at(pts, Math.min(L, m.s + 0.3));
      if (ahead.distanceToSquared(pos) > 1e-6) p.facing = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
      p.position.copy(pos); p.object.position.copy(pos);
      p.scriptSpeed = m.speed; p.scriptMoving = true;
      if (m.s >= L) { this.movers.shift(); p.scriptSpeed = 0; p.scriptMoving = false; m.resolve(); }
    } else if (this.riding) {
      const c = this.route.cableway.cabinPoint();
      p.position.copy(c); p.object.position.copy(c);
      p.scriptSpeed = 0;
    }

    // il faro dove la storia aspetta il viaggiatore
    this.beacon.visible = !!this.beaconAt;
    if (this.beaconAt) {
      this.beacon.position.copy(this.beaconAt()); this.beacon.position.y += 0.25;
      this.beacon.scale.setScalar(0.5 + 0.15 * Math.sin(performance.now() / 180));
    }

    if (p.state !== 'walk') return;
    // lo strappo: non si passa (né prima, né tornando indietro dopo)
    const z = p.position.z, nearWalk = Math.abs(p.position.x) < 4;
    if (!this.crossed && nearWalk && z > TEAR_Z0 && z < TEAR_Z1 + 2) {
      p.position.z = TEAR_Z0;
      if (this.thoughtCooldown <= 0) { this.think(this.stage === 'free' ? TEXTS.thoughts.tear : TEXTS.thoughts.tearAgain, 3); this.thoughtCooldown = 4; }
    }
    if (this.crossed && nearWalk && z < TEAR_Z1 && z > TEAR_Z0 - 2) p.position.z = TEAR_Z1;
    if (this.stage === 'free' && z > TEAR_Z0 - 2.5 && nearWalk) {
      this.stage = 'atTear';
      this.think(TEXTS.thoughts.tear, 3.5);
      setTimeout(() => { if (this.stage === 'atTear') this.think(TEXTS.thoughts.pluckHint, 4); }, 3800);
    }
    // finale: arrivato sulla cresta opposta
    const Lz = (this.net.rows - 1) * this.net.spacing;
    if (this.stage === 'free2' && z > Lz + 0.8) this.ending();
  }
}
