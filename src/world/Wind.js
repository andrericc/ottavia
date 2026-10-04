// Wind.js
// ---------------------------------------------------------------
// Le raffiche di vento sul burrone.
//
//   calm ──(30-50 s)──► rising (2 s: il vento sale, avviso) ──► gust (3,5 s) ──► calm
//
// Durante una raffica il vento spinge di lato:
//   - la rete (accelerazione su ogni nodo libero, con un'onda che la percorre)
//   - tutti gli oggetti appesi (VerletBody.wind)
//   - il viaggiatore: se cammina lo spinge verso gli intervalli; se sta fermo
//     su un'asse resiste (e l'asse lo porta con sé mentre la rete ondeggia)
// ---------------------------------------------------------------
import { VerletBody } from '../hanging/VerletBody.js';

const NET_FORCE = 1.6;      // accelerazione sulla rete al culmine (≈ 70 cm di oscillazione)
const HANGING_FORCE = 3.5;  // sugli oggetti appesi
const PLAYER_PUSH = 1.6;    // m/s di spinta laterale su chi cammina
const RISE = 2, GUST = 3.5;

export class Wind {
  constructor({ net, player, narrator, texts, isActive }) {
    Object.assign(this, { net, player, narrator, texts, isActive });
    this.reset();
  }

  reset() {
    this.state = 'calm';
    this.forced = null;
    this.timer = 35;        // la prima raffica arriva dopo un po' che si è sulla rete
    this.t = 0;
    this.dir = 1;
    this.strength = 0;      // 0..1
    this.count = 0;         // quante raffiche finora (i pensieri compaiono solo le prime volte)
    this.time = 0;
    this.apply();
  }

  // La storia può imporre il vento: force(0.9, 1) = raffica forte verso +X; force(null) = torna libero
  force(strength, dir = 1) {
    this.forced = strength;
    if (strength !== null) { this.dir = dir; this.state = 'calm'; this.timer = 30; }
  }

  update(dt) {
    this.time += dt;
    if (this.forced != null) {
      this.strength += (this.forced - this.strength) * Math.min(1, dt * 1.5); // sale e cala con dolcezza
      this.apply();
      return;
    }
    if (this.state === 'calm') {
      if (this.isActive()) this.timer -= dt; // il conto alla rovescia si ferma durante i dialoghi
      if (this.timer <= 0) {
        this.state = 'rising'; this.t = 0;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        if (this.count < 2) this.narrator.thought(this.texts.windRising, 2.5);
      }
    } else if (this.state === 'rising') {
      this.t += dt;
      this.strength = 0.15 * (this.t / RISE);
      if (this.t >= RISE) {
        this.state = 'gust'; this.t = 0;
        if (this.count < 2) this.narrator.thought(this.texts.windHold, 3.5);
      }
    } else if (this.state === 'gust') {
      this.t += dt;
      const u = Math.min(1, this.t / GUST);
      this.strength = Math.max(0.15 * (1 - u), Math.sin(Math.PI * u) ** 2); // sale, culmina, si spegne
      if (this.t >= GUST) {
        this.state = 'calm'; this.strength = 0; this.count++;
        this.timer = 30 + Math.random() * 20;
      }
    }
    this.apply();
  }

  // Comunica la forza del vento a oggetti appesi e viaggiatore
  apply() {
    const s = this.strength * this.dir;
    VerletBody.wind.set(s * HANGING_FORCE, 0, 0);
    this.player.windPush = s * PLAYER_PUSH;
    this.player.windLean = s;
  }

  // Nel passo fisso, prima di net.step: spinge i nodi della rete
  applyToNet() {
    if (this.strength <= 0) return;
    const { net } = this, s = this.strength * this.dir * NET_FORCE;
    for (let n = 0; n < net.count; n++) {
      if (net.pinned[n]) continue;
      const z = net.pos[n * 3 + 2];
      net.acc[n * 3] += s * (0.75 + 0.25 * Math.sin(z * 0.35 + this.time * 2)); // un'onda che corre lungo la rete
    }
  }
}
