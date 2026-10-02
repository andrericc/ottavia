// Story.js
// ---------------------------------------------------------------
// La storia: cosa succede, quando, e cosa si ricorda.
// Qui la storia è scritta come codice "leggibile": grazie alle Promise
// del Narrator ogni evento è una sequenza di await, riga dopo riga.
//
// Step 7: apertura, biglietto all'arrivo, riquadri di testo e scelte.
// Step 8: i frammenti si TIRANO SU per la fune; lasciarli andare alleggerisce
//         la rete e apre la "porta" del legno grigio (3 frammenti su 4).
// Step 9-10 aggiungeranno le case, il carillon e il finale.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { TEXTS } from './texts.js';

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
    this.addFragment('lamp', T.fragments.lamp);
    this.addFragment('water', T.fragments.water);
    this.addFragment('rings', T.fragments.rings);
  }

  addFragment(id, text) {
    const item = this.hanging.get(id);
    if (!item) return;
    this.interactions.add({
      id: 'fragment-' + id,
      position: () => this.hanging.anchorOf(item),
      radius: 2.6,
      markerHeight: 0.25,
      // si può tornare su un frammento lasciato appeso e cambiare idea
      prompt: () => (this.state.fragments[id] === 'kept' ? TEXTS.ui.prompts.pullAgain : TEXTS.ui.prompts.pull),
      enabled: () => this.state.fragments[id] !== 'letGo' && !item.released,
      onInteract: () => this.playFragment(id, item, text),
    });
  }

  // Un frammento: tirare su → leggere → scegliere → conseguenza
  async playFragment(id, item, text) {
    const p = this.player, T = TEXTS;
    const obj = this.hanging.focusOf(item);
    p.facing = Math.atan2(obj.x - p.position.x, obj.z - p.position.z); // si gira verso la fune

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
  update() {
    const p = this.player;
    if (this.narrator.busy || this.interactions.running) return;

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
