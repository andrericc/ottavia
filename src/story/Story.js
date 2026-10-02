// Story.js
// ---------------------------------------------------------------
// La storia: cosa succede, quando, e cosa si ricorda.
// Qui la storia è scritta come codice "leggibile": grazie alle Promise
// del Narrator ogni evento è una sequenza di await, riga dopo riga.
//
// Step 7: apertura, biglietto all'arrivo, riquadri di testo e scelte.
// Step 8: i frammenti si TIRANO SU per la fune; lasciarli andare alleggerisce
//         la rete e apre la "porta" del legno grigio (3 frammenti su 4).
//         Enigmi: i ricordi vanno riconosciuti tra oggetti qualunque, e la
//         lampada lontana va fatta oscillare saltando a tempo, poi afferrata.
// Step 9-10 aggiungeranno le case, il carillon e il finale.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { TEXTS } from './texts.js';
import { netPin } from '../hanging/VerletBody.js';

// La porta del legno grigio: quanti frammenti lasciare andare, e quanto
// peso diretto reggono le funi vecchie prima e dopo
const GATE_COUNT = 3;
const capacityFor = (released) => 120 + 35 * Math.min(released, GATE_COUNT); // 120 … 225

// Piccoli aiuti per scrivere le sequenze nel tempo
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
function animate(duration, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 1000 / duration);
      fn(t);
      if (t < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}
const smooth = (t) => t * t * (3 - 2 * t);

// Avvolgimento della fune "a strattoni": 6 tirate, ognuna parte e si ferma,
// a tempo con le braccia del viaggiatore (TravelerAnimator.posePull)
const PULLS = 6, SHORTEST = 0.15;
function reelCurve(t) {
  const s = t * PULLS, k = Math.min(Math.floor(s), PULLS - 1);
  const e = (k + smooth(Math.min(1, (s - k) * 1.6))) / PULLS;
  return 1 - (1 - SHORTEST) * e;
}

export class Story {
  constructor({ narrator, journal, interactions, player, hanging, debris, notePost, net, camera }) {
    Object.assign(this, { narrator, journal, interactions, player, hanging, debris, notePost, net, camera });
    this.reset();
    this.setupInteractions();
  }

  // Tutto ciò che la storia ricorda
  reset() {
    this.state = {
      introSeen: false,
      greyWoodSeen: false,
      ropeSeen: false,
      gateOpen: false,
      fragments: {},          // id → 'letGo' | 'kept'
    };
    this.retreating = false;
    this.lamp = this.lamp && { ...this.lamp, caught: false, farSeen: false, reachSeen: false, grace: 0 };
    if (this.lamp) this.lamp.item.loads[0].node = this.lamp.farNode; // il peso torna sul suo nodo
    this.journal?.reset();
    this.net.setWornCapacity(capacityFor(0));
    if (this.player) this.player.action = null;
    this.camera?.focus(null);
  }

  get released() {
    return Object.values(this.state.fragments).filter((f) => f === 'letGo').length;
  }

  // --- APERTURA -------------------------------------------------
  async intro() {
    this.player.frozen = true;
    await this.narrator.card(TEXTS.intro);
    this.player.frozen = false;
    this.state.introSeen = true;
  }

  // --- INTERAZIONI ----------------------------------------------
  setupInteractions() {
    const T = TEXTS;

    // Il biglietto del Knot-keeper all'arrivo
    this.interactions.add({
      id: 'note-arrival',
      position: () => this.notePost.anchor,
      radius: 1.8,
      markerHeight: 0.35,
      prompt: T.ui.prompts.read,
      onInteract: async () => {
        const n = T.notes.arrival;
        await this.narrator.say(n.pages, n.title);
        this.journal.add('note-arrival', n.title, n.pages);
      },
    });

    // I frammenti lungo la passerella (il carillon arriva allo step 9)
    this.setupFarLamp();
    this.addFragment('lamp', T.fragments.lamp);
    this.addFragment('water', T.fragments.water);
    this.addFragment('rings', T.fragments.rings);

    // Gli oggetti che non sono ricordi: si tirano su, una riga, e riscendono
    for (const [id, line] of Object.entries(T.decoys)) {
      const item = this.hanging.get(id);
      if (!item) continue;
      this.interactions.add({
        id: 'decoy-' + id,
        position: () => this.hanging.anchorOf(item),
        radius: 2.6,
        markerHeight: 0.25,
        prompt: T.ui.prompts.pull,
        onInteract: () => this.playDecoy(item, line),
      });
    }
  }

  // --- LA LAMPADA LONTANA ---------------------------------------
  // È appesa alla colonna 6 con una fune di 4 m. Per prenderla bisogna farla
  // oscillare: ogni atterraggio sulla passerella lì vicino le dà una spinta verso
  // la passerella. Saltare mentre viene verso di te la fa oscillare sempre di più;
  // saltare mentre si allontana la frena (come spingere un'altalena).
  setupFarLamp() {
    const item = this.hanging.get('lamp');
    if (!item) return;
    const body = item.bodies[0];
    const farNode = item.loads[0].node;
    const row = Math.floor(farNode / this.net.cols), col = farNode % this.net.cols;
    const nearNode = this.net.index(col < this.net.cols / 2 ? 9 : 15, row); // nodo accanto alla passerella
    this.lamp = { item, body, farNode, nearNode, farPin: body.pin[0], caught: false, farSeen: false, reachSeen: false,
      grace: 0, reachAt: new THREE.Vector3() };
  }

  // Sposta il perno della fune dal nodo lontano a quello accanto alla passerella (o viceversa)
  async moveLampPin(toNear, duration) {
    const L = this.lamp, nearPin = netPin(this.net, L.nearNode), v = new THREE.Vector3();
    let u = toNear ? 0 : 1;
    L.body.pin[0] = () => v.lerpVectors(L.farPin(), nearPin(), u);
    await animate(duration, (t) => { u = toNear ? smooth(t) : 1 - smooth(t); });
    L.body.pin[0] = toNear ? nearPin : L.farPin;
    L.item.loads[0].node = toNear ? L.nearNode : L.farNode;
  }

  // Un oggetto qualunque: lo tiri su, una riga, lo lasci riscendere
  async playDecoy(item, line) {
    const p = this.player;
    const obj = this.hanging.focusOf(item);
    p.facing = Math.atan2(obj.x - p.position.x, obj.z - p.position.z);
    this.camera.focus(() => this.hanging.focusOf(item));
    p.action = 'pull';
    await animate(1.6, (t) => this.hanging.reel(item, 1 - 0.6 * (1 - reelCurve(t)) / (1 - SHORTEST)));
    p.action = 'hold';
    await this.narrator.say(line);
    await animate(1.2, (t) => this.hanging.reel(item, 0.4 + 0.6 * smooth(t)));
    p.action = null;
    this.camera.focus(null);
  }

  addFragment(id, text) {
    const item = this.hanging.get(id);
    if (!item) return;
    const far = this.lamp && this.lamp.item === item;
    const reachPoint = new THREE.Vector3();
    this.interactions.add({
      id: 'fragment-' + id,
      // la lampada lontana si afferra quando passa vicina: il punto d'interazione è la
      // lampada stessa (portato all'altezza del viaggiatore), con un raggio piccolo
      position: () => {
        if (!far || this.lamp.caught) return this.hanging.anchorOf(item);
        // a portata (o appena uscita: 0,7 s di tolleranza per il riflesso) → punto accanto a me
        if (this.lamp.grace > 0) return reachPoint.copy(this.lamp.reachAt);
        const f = this.hanging.focusOf(item);
        return reachPoint.set(f.x, this.player.position.y + 0.3, f.z);
      },
      radius: far ? 2.2 : 2.6,
      markerHeight: 0.25,
      // si può tornare su un frammento lasciato appeso e cambiare idea
      prompt: () => (far && !this.lamp.caught ? TEXTS.ui.prompts.catch
        : this.state.fragments[id] === 'kept' ? TEXTS.ui.prompts.pullAgain : TEXTS.ui.prompts.pull),
      enabled: () => this.state.fragments[id] !== 'letGo' && !item.released,
      onInteract: () => this.playFragment(id, item, text),
    });
  }

  // Un frammento: tirare su → leggere → scegliere → conseguenza
  async playFragment(id, item, text) {
    const p = this.player, T = TEXTS;
    const far = this.lamp && this.lamp.item === item;
    const obj = this.hanging.focusOf(item);
    p.facing = Math.atan2(obj.x - p.position.x, obj.z - p.position.z); // si gira verso la fune

    // la lampada lontana: la afferro al volo e lego la sua fune accanto alla passerella
    if (far && !this.lamp.caught) {
      this.lamp.caught = true;
      p.action = 'hold';
      await this.moveLampPin(true, 0.8);
    }

    // 1) tirare su: la camera inquadra l'oggetto, la fune si accorcia a strattoni
    this.camera.focus(() => this.hanging.focusOf(item));
    p.action = 'pull';
    await animate(2.4, (t) => this.hanging.reel(item, reelCurve(t)));
    p.action = 'hold';

    // 2) la sua storia
    await this.narrator.say([text.examine, ...text.story], text.title);
    this.journal.add('fragment-' + id, text.title, text.story);

    // 3) la scelta
    const choice = await this.narrator.choose([T.ui.choices.letGo, T.ui.choices.keep], '', text.title);

    if (choice === 0) {
      // LASCIAR ANDARE: la fune si taglia, la camera segue la caduta, la rete risale
      p.action = null;
      const pivot = this.hanging.release(item, this.debris);
      const falling = new THREE.Vector3();
      this.camera.focus(() => pivot.getWorldPosition(falling), { distance: 6, pitch: 0.7 });
      this.state.fragments[id] = 'letGo';
      this.journal.setFate('fragment-' + id, T.ui.fateLetGo);
      const opened = this.updateGate();
      await wait(1.6);
      this.camera.shake(0.12); // la rete, alleggerita, dà un piccolo strattone verso l'alto
      this.camera.focus(null);
      await this.narrator.say(text.letGo);
      this.narrator.thought(opened ? T.thoughts.readyToCross : T.thoughts.afterLetGo, opened ? 6 : 4);
    } else {
      // LASCIARE APPESO: la fune riscivola giù
      await animate(1.6, (t) => this.hanging.reel(item, SHORTEST + (1 - SHORTEST) * smooth(t)));
      if (far) { await this.moveLampPin(false, 1.2); this.lamp.caught = false; } // torna a oscillare lontano
      p.action = null;
      this.camera.focus(null);
      this.state.fragments[id] = 'kept';
      this.journal.setFate('fragment-' + id, T.ui.fateKept);
      await this.narrator.say(text.keep);
      this.narrator.thought(T.thoughts.afterKeep);
    }
    this.onFragment?.(id, this.state.fragments[id]);
  }

  // La porta: la capacità del legno grigio cresce con ogni frammento lasciato andare.
  // Restituisce true se si è appena aperta.
  updateGate() {
    const n = this.released;
    this.net.setWornCapacity(capacityFor(n));
    if (n >= GATE_COUNT && !this.state.gateOpen) {
      this.state.gateOpen = true;
      this.net.restWorn(); // le funi vecchie "riposano": si riparte da zero danni
      return true;
    }
    return false;
  }

  // --- EVENTI LEGATI AL LUOGO (controllati ogni frame) ----------
  update(dt = 1 / 60) {
    const p = this.player;
    const landed = p.landed; p.landed = false; // lo leggo una volta sola
    if (this.narrator.busy || this.interactions.running) return;

    this.updateFarLamp(landed, dt);

    // Vicino a una fune per la prima volta
    if (!this.state.ropeSeen && this.interactions.current?.id.startsWith('fragment-')) {
      this.state.ropeSeen = true;
      this.narrator.thought(TEXTS.thoughts.ropeBelow, 5);
    }

    if (!this.state.gateOpen) {
      // Finché la porta è chiusa le funi vecchie non arrivano a spezzarsi:
      // un tentativo anticipato non deve rompere la rete e bloccare la storia
      for (let c = 0; c < this.net.damage.length; c++) {
        if (this.net.worn[c] && this.net.damage[c] > 0.5) this.net.damage[c] = 0.5;
      }
      // Sul legno grigio il viaggiatore si rifiuta di proseguire
      if (!this.retreating && p.state === 'walk' && p.onGround && p.plank && p.plank.worn) this.refuse();
    }
  }

  // La lampada lontana: spinta a ogni atterraggio vicino, e i pensieri che guidano
  updateFarLamp(landed, dt) {
    const L = this.lamp, p = this.player;
    if (!L || L.caught || this.state.fragments.lamp === 'letGo' || L.item.released) return;
    const anchor = this.hanging.anchorOf(L.item);

    // finestra di tolleranza: quando la lampada passa a portata resta afferrabile 0,7 s
    const f = this.hanging.focusOf(L.item);
    if (Math.hypot(f.x - p.position.x, f.z - p.position.z) < 2.2) {
      L.grace = 0.7;
      L.reachAt.set(p.position.x + Math.sign(f.x - p.position.x) * 0.8, p.position.y + 0.3, p.position.z);
    } else L.grace = Math.max(0, L.grace - dt);
    const near = Math.abs(p.position.z - anchor.z) < 4.5;
    if (!L.farSeen && near && Math.hypot(p.position.x - anchor.x, p.position.z - anchor.z) < 6) {
      L.farSeen = true;
      this.narrator.thought(TEXTS.thoughts.lampFar, 6);
    }
    if (landed && near && p.plank) {
      // spinta sempre verso la passerella: aiuta se la lampada sta già venendo verso di te
      const dir = Math.sign(-anchor.x) || 1, n = L.body.pos.length;
      L.body.push(new THREE.Vector3(dir * 1.3, 0, 0), 1 / 120, (i) => i / (n - 1));
    }
    if (!L.reachSeen && this.interactions.current?.id === 'fragment-lamp') {
      L.reachSeen = true;
      this.narrator.thought(TEXTS.thoughts.lampReach, 1.5);
    }
  }

  // Il viaggiatore sente la rete cedere e torna indietro da solo
  async refuse() {
    const p = this.player;
    this.retreating = true;
    p.frozen = true;
    const first = !this.state.greyWoodSeen;
    this.state.greyWoodSeen = true;
    this.narrator.thought(first ? TEXTS.thoughts.greyWoodFirst : TEXTS.thoughts.greyWoodAgain, first ? 6 : 4);
    this.camera.shake(0.15);
    const from = p.position.clone(), to = p.lastSafe.clone();
    p.facing = Math.atan2(to.x - from.x, to.z - from.z);
    await animate(0.9, (t) => {
      const e = smooth(t);
      p.position.x = from.x + (to.x - from.x) * e;
      p.position.z = from.z + (to.z - from.z) * e;
    });
    p.frozen = false;
    this.retreating = false;
  }
}
