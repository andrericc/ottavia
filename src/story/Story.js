// Story.js
// ---------------------------------------------------------------
// La storia: cosa succede, quando, e cosa si ricorda.
// Qui la storia è scritta come codice "leggibile": grazie alle Promise
// del Narrator ogni evento è una sequenza di await, riga dopo riga.
//
// Step 7: apertura, biglietto all'arrivo, primo tentativo sul legno
//         grigio e il primo frammento completo (la lampada).
// Step 8 e 10 aggiungeranno gli altri frammenti, la porta e il finale.
// ---------------------------------------------------------------
import { TEXTS } from './texts.js';

export class Story {
  constructor({ narrator, journal, interactions, player, hanging, debris, notePost }) {
    Object.assign(this, { narrator, journal, interactions, player, hanging, debris, notePost });
    this.reset();
    this.setupInteractions();
  }

  // Tutto ciò che la storia ricorda
  reset() {
    this.state = {
      introSeen: false,
      greyWoodSeen: false,
      fragments: {},          // id → 'letGo' | 'kept'
    };
    this.journal?.reset();
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

    // Frammento 1: la lampada della cartografa
    this.addFragment('lamp', T.fragments.lamp);
  }

  // Un frammento: esamina → storia → scelta → conseguenza.
  // (Allo step 8 l'oggetto verrà prima tirato su per la sua fune.)
  addFragment(id, text) {
    const item = this.hanging.get(id);
    if (!item) return;
    this.interactions.add({
      id: 'fragment-' + id,
      position: () => this.hanging.anchorOf(item),
      radius: 2.6,
      markerHeight: 0.25,
      prompt: TEXTS.ui.prompts.examine,
      enabled: () => !(id in this.state.fragments) && !item.released,
      onInteract: async () => {
        await this.narrator.say([text.examine, ...text.story], text.title);
        this.journal.add('fragment-' + id, text.title, text.story);
        const choice = await this.narrator.choose([TEXTS.ui.choices.letGo, TEXTS.ui.choices.keep], '', text.title);
        if (choice === 0) {
          this.hanging.release(item, this.debris);   // l'oggetto precipita, la rete si alleggerisce
          this.state.fragments[id] = 'letGo';
          this.journal.setFate('fragment-' + id, TEXTS.ui.fateLetGo);
          await this.narrator.say(text.letGo);
          this.narrator.thought(TEXTS.thoughts.afterLetGo);
        } else {
          this.state.fragments[id] = 'kept';
          this.journal.setFate('fragment-' + id, TEXTS.ui.fateKept);
          await this.narrator.say(text.keep);
          this.narrator.thought(TEXTS.thoughts.afterKeep);
        }
        this.onFragment?.(id, this.state.fragments[id]);
      },
    });
  }

  // --- EVENTI LEGATI AL LUOGO (controllati ogni frame) ----------
  update() {
    const p = this.player;
    // Primo passo sul legno grigio
    if (!this.state.greyWoodSeen && p.state === 'walk' && p.plank && p.plank.worn) {
      this.state.greyWoodSeen = true;
      this.narrator.thought(TEXTS.thoughts.greyWoodFirst, 6);
    }
  }
}
