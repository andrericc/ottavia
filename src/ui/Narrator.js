// Narrator.js
// ---------------------------------------------------------------
// L'interfaccia narrativa: tutto ciò che il giocatore LEGGE.
//
// Ogni funzione restituisce una Promise, così la storia si scrive
// come una sequenza leggibile (vedi story/Story.js):
//
//   await narrator.say(['Prima pagina…', 'Seconda pagina…'], 'The Last Water');
//   const scelta = await narrator.choose(['Let it go', 'Leave it']);   // → 0 o 1
//   await narrator.card(['Riga 1', 'Riga 2']);                          // schermo nero
//   narrator.thought('Un pensiero che svanisce da solo');
//
// Tasti: E / Invio / clic = avanti (se il testo sta ancora scrivendo lo completa)
//        1 / 2, frecce ← → = scegli
// ---------------------------------------------------------------

function el(tag, id, parent = document.body) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  parent.appendChild(e);
  return e;
}

// testo con *corsivo* → HTML sicuro (niente HTML dall'esterno)
function format(text) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export class Narrator {
  constructor() {
    this.box = el('div', 'dialogue');
    this.titleEl = el('div', null, this.box); this.titleEl.className = 'title';
    this.textEl = el('div', null, this.box); this.textEl.className = 'text';
    this.choicesEl = el('div', null, this.box); this.choicesEl.className = 'choices';
    this.moreEl = el('div', null, this.box); this.moreEl.className = 'more';
    this.cardEl = el('div', 'card');
    this.thoughtEl = el('div', 'thought');

    this.speed = 42;          // caratteri al secondo
    this.busy = false;        // true mentre c'è un testo o una scelta a schermo
    this._advance = null;     // chi aspetta il prossimo "avanti"
    this._choice = null;

    const advanceKeys = ['KeyE', 'Enter', 'NumpadEnter'];
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this._choice) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') this._choice.pick(0);
        else if (e.code === 'Digit2' || e.code === 'Numpad2') this._choice.pick(1);
        else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') this._choice.move(-1);
        else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') this._choice.move(1);
        else if (advanceKeys.includes(e.code)) this._choice.pick(this._choice.sel);
        return;
      }
      if (advanceKeys.includes(e.code) && this._advance) { e.stopImmediatePropagation(); this._advance(); }
    }, true); // 'capture': la narrazione ha la precedenza sugli altri tasti
    this.box.addEventListener('click', () => this._advance?.());
    this.cardEl.addEventListener('click', () => this._advance?.());
  }

  // Attende un "avanti" (E, Invio o clic)
  waitAdvance() {
    return new Promise((resolve) => { this._advance = () => { this._advance = null; resolve(); }; });
  }

  // Scrive una pagina lettera per lettera. "Avanti" durante la scrittura la completa.
  typePage(text) {
    return new Promise((resolve) => {
      const html = format(text);
      const plain = text.replace(/\*/g, '');
      let shown = 0, done = false, last = performance.now();
      const finish = () => { done = true; this.textEl.innerHTML = html; resolve(); };
      this._advance = () => { this._advance = null; finish(); };
      const tick = (now) => {
        if (done) return;
        shown += ((now - last) / 1000) * this.speed; last = now;
        if (shown >= plain.length) { this._advance = null; finish(); return; }
        this.textEl.textContent = plain.slice(0, Math.floor(shown));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // Una o più pagine nel riquadro in basso
  async say(pages, title = '') {
    if (typeof pages === 'string') pages = [pages];
    this.busy = true;
    this.titleEl.textContent = title;
    this.titleEl.style.display = title ? '' : 'none';
    this.choicesEl.innerHTML = '';
    this.box.classList.add('open');
    for (const page of pages) {
      this.moreEl.textContent = '';
      await this.typePage(page);
      this.moreEl.textContent = 'E ▸';
      await this.waitAdvance();
    }
    this.box.classList.remove('open');
    this.busy = false;
  }

  // Scelta tra due o più risposte; restituisce l'indice scelto
  choose(options, prompt = '', title = '') {
    this.busy = true;
    this.titleEl.textContent = title;
    this.titleEl.style.display = title ? '' : 'none';
    this.textEl.innerHTML = prompt ? format(prompt) : '';
    this.textEl.style.minHeight = prompt ? '' : '0';
    this.moreEl.textContent = '';
    this.choicesEl.innerHTML = '';
    this.box.classList.add('open');
    return new Promise((resolve) => {
      const buttons = options.map((label, i) => {
        const b = el('button', null, this.choicesEl);
        b.innerHTML = `<kbd>${i + 1}</kbd>${format(label)}`;
        b.addEventListener('click', () => pick(i));
        return b;
      });
      const state = { sel: 0 };
      const refresh = () => buttons.forEach((b, i) => b.classList.toggle('sel', i === state.sel));
      const pick = (i) => {
        this._choice = null;
        this.choicesEl.innerHTML = '';
        this.textEl.style.minHeight = '';
        this.box.classList.remove('open');
        this.busy = false;
        resolve(i);
      };
      this._choice = { get sel() { return state.sel; }, pick, move: (d) => { state.sel = (state.sel + d + options.length) % options.length; refresh(); } };
      refresh();
    });
  }

  // Cartello a tutto schermo: le righe compaiono una alla volta.
  // Una riga che inizia con '>' è una citazione, con '—' una fonte.
  async card(lines, { hold = true } = {}) {
    this.busy = true;
    this.cardEl.innerHTML = '';
    this.cardEl.classList.add('open');
    await new Promise((r) => setTimeout(r, 900));
    for (const line of lines) {
      const d = el('div', null, this.cardEl);
      d.className = 'line' + (line.startsWith('>') ? ' quote' : line.startsWith('—') ? ' cite' : '');
      d.innerHTML = format(line.replace(/^>\s*/, ''));
      requestAnimationFrame(() => d.classList.add('show'));
      await new Promise((r) => setTimeout(r, line.startsWith('—') ? 400 : 1300));
    }
    if (hold) {
      const more = el('div', null, this.cardEl); more.className = 'more'; more.textContent = 'E ▸';
      await this.waitAdvance();
    }
    this.cardEl.classList.remove('open');
    await new Promise((r) => setTimeout(r, 1200));
    this.busy = false;
  }

  // Un pensiero breve che compare in alto e svanisce da solo
  thought(text, seconds = 4) {
    this.thoughtEl.innerHTML = format(text);
    this.thoughtEl.classList.add('show');
    clearTimeout(this._thoughtTimer);
    this._thoughtTimer = setTimeout(() => this.thoughtEl.classList.remove('show'), seconds * 1000);
  }
}
