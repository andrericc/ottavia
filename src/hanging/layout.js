// layout.js
// ---------------------------------------------------------------
// DOVE sta appeso ogni oggetto sotto la rete di Ottavia.
// La rete ha 25 colonne (i = 0..24, x da -12 a +12 m) e 40 file
// (j = 0..39, z da 0 a 39 m). La passerella occupa le colonne 10..14.
//
// Per spostare, aggiungere o togliere oggetti basta modificare questa lista.
// Attenzione: niente oggetti sulla zona vecchia (colonne 11..13, file 21..24)
// e niente sulle file 0 e 39 (sono legate alle creste).
// ---------------------------------------------------------------
import { chandelier, waterskin, basket, plantPot, hammock, trapeze, rings, ropeLadder, sackHouse } from './items.js';

export function populateOttavia(system, net) {
  const put = (make, opts) => system.add(make(net, opts));

  // Case fatte a sacco, ai due lati della città
  put(sackHouse, { i: 2, j: 13, drop: 1.4, yaw: Math.PI / 2, seed: 3 });
  put(sackHouse, { i: 20, j: 25, drop: 1.0, yaw: -Math.PI / 2, seed: 7 });
  put(sackHouse, { i: 4, j: 29, drop: 1.8, yaw: Math.PI / 2 + 0.4, seed: 11 });

  // Lampadari (contengono una luce vera: non esagerare, ogni luce costa)
  put(chandelier, { i: 8, j: 8, length: 2.5 });
  put(chandelier, { i: 16, j: 16, length: 3.0 });
  put(chandelier, { i: 8, j: 31, length: 2.8 });

  // Otri d'acqua
  put(waterskin, { i: 9, j: 5, length: 1.2 });
  put(waterskin, { i: 15, j: 6, length: 1.6 });
  put(waterskin, { i: 17, j: 27, length: 1.4 });
  put(waterskin, { i: 6, j: 19, length: 1.0 });
  put(waterskin, { i: 15, j: 35, length: 1.1 });

  // Cesti appesi a spaghi
  put(basket, { i: 16, j: 10, length: 2.0 });
  put(basket, { i: 8, j: 24, length: 1.8 });

  // Vasi con piante dal fogliame pendulo
  put(plantPot, { i: 15, j: 30, length: 1.2, seed: 1 });
  put(plantPot, { i: 9, j: 13, length: 1.0, seed: 2 });
  put(plantPot, { i: 18, j: 20, length: 1.5, seed: 3 });

  // Amache
  put(hammock, { i1: 6, j1: 9, i2: 6, j2: 12 });
  put(hammock, { i1: 18, j1: 32, i2: 18, j2: 35 });

  // Trapezio e anelli per i giochi
  put(trapeze, { i: 15, j: 19, length: 2.2 });
  put(rings, { i: 8, j: 35, length: 1.8 });

  // Scala di corda vicino all'arrivo: più avanti servirà per scendere sotto la rete
  put(ropeLadder, { i: 15, j: 3, length: 6, rungs: 12 });

  system.build();
  system.settle(3);
}
