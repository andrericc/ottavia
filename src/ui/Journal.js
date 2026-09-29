// Journal.js
// ---------------------------------------------------------------
// Il diario (tasto J): raccoglie i biglietti letti e i frammenti
// ascoltati, con la scelta fatta per ciascuno. Si può rileggere tutto.
// ---------------------------------------------------------------
import { TEXTS } from '../story/texts.js';

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*(.+?)\*/g, '<em>$1</em>');

export class Journal {
  constructor(narrator) {
    this.narrator = narrator;
    this.entries = [];   // { id, title, pages, fate? }
    this.el = document.createElement('div');
    this.el.id = 'journal';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyJ' && !this.narrator.busy) this.isOpen ? this.close() : this.open();
      else if (e.code === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() { return this.el.classList.contains('open'); }

  // Aggiunge (o aggiorna) una voce
  add(id, title, pages, fate = null) {
    const old = this.entries.find((e) => e.id === id);
    if (old) { old.fate = fate ?? old.fate; return; }
    this.entries.push({ id, title, pages, fate });
  }

  setFate(id, fate) {
    const e = this.entries.find((x) => x.id === id);
    if (e) e.fate = fate;
  }

  open() {
    const T = TEXTS.ui;
    const body = this.entries.length
      ? this.entries.map((e) => `<div class="entry"><h3>${esc(e.title)}</h3>${e.pages.map((p) => `<p>${esc(p)}</p>`).join('')}${e.fate ? `<div class="fate">${esc(e.fate)}</div>` : ''}</div>`).join('')
      : `<p class="empty">${esc(T.journalEmpty)}</p>`;
    this.el.innerHTML = `<div class="book"><h2>${T.journalTitle}</h2><div class="sub">${T.journalSub}</div>${body}<div class="close">${T.journalClose}</div></div>`;
    this.el.classList.add('open');
    this.onToggle?.(true);
  }

  close() {
    this.el.classList.remove('open');
    this.onToggle?.(false);
  }

  reset() { this.entries = []; }
}
