import * as THREE from 'three';
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
import { chandelier, waterskin, basket, plantPot, hammock, trapeze, rings, ropeLadder, sackHouse, gondola, roaster, clothesline, shower, gasBurner, anchors, ropeBridge, cableway, walkwayEnd } from './items.js';

export function populateOttavia(system, net) {
  // 'id' dà un nome agli oggetti che servono alla storia (vedi story/Story.js)
  // 'weight' (facoltativo) sostituisce il peso totale dell'oggetto sulla rete
  const put = (make, opts) => {
    const it = system.add(make(net, opts));
    if (opts.id) it.id = opts.id;
    if (opts.weight) for (const l of it.loads) l.weight = opts.weight / it.loads.length;
    return it;
  };

  // --- I FRAMMENTI DELLA STORIA. Pesano molto (i ricordi pesano): quando li lasci
  // andare la rete risale di ~9 cm. Ognuno ha un dettaglio che lo distingue (vedi texts.js).
  // 1 · The Cartographer's Lamp: l'unica accesa, lontana dalla passerella (colonna 6) su
  //     una fune lunga 4 m: va fatta oscillare saltando a tempo (Story.js). Poco smorzata.
  put(chandelier, { i: 6, j: 8, length: 4, id: 'lamp', damping: 0.9993 });
  // 2 · The Last Water: l'unico otre con il cordino rosso
  put(waterskin, { i: 9, j: 15, length: 1.4, id: 'water', cord: '#b3302a' });
  // 3 · The Second Ring: l'unico gioco per bambini
  put(rings, { i: 15, j: 19, length: 1.6, id: 'rings' });

  // --- OGGETTI CHE SI POSSONO TIRARE SU MA NON SONO RICORDI (riga breve in texts.js)
  put(waterskin, { i: 9, j: 5, length: 1.2, id: 'skin-a' });
  put(waterskin, { i: 15, j: 6, length: 1.6, id: 'skin-b' });
  put(basket, { i: 16, j: 10, length: 2.0, id: 'basket-a' });
  put(plantPot, { i: 9, j: 13, length: 1.0, seed: 2, id: 'fern' });
  put(chandelier, { i: 9, j: 11, length: 2.0, lit: false, id: 'lamp-c' });
  put(chandelier, { i: 16, j: 16, length: 3.0, lit: false, id: 'lamp-b' });

  // Funi d'ancoraggio a raggiera verso le pareti delle creste (il "telaio" della ragnatela)
  put(anchors, { seed: 1 });

  // --- IL PERCORSO DELLA STORIA (vedi il documento della storia):
  // passerella → ponticello che scende → casa L1 → casa L2 → stazione A → teleferica →
  // stazione B → casa R1 → ponticello che risale → passerella, oltre lo strappo.
  // Le case del percorso hanno due porte (una per ponticello) e niente scala.
  const C = (i, j) => [i + 1, j + 1];                       // centro di una casa (in nodi)
  const dirTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]); // angolo verso un altro punto
  const W = (i, j) => new THREE.Vector3(net.x0 + i * net.spacing, 0, net.z0 + j * net.spacing);
  const L1 = [2, 7], L2 = [2, 13], R1 = [20, 25];
  const stA = [2, 18.7], stB = [22, 31.7];                  // centri delle stazioni (vedi sotto)
  const hL1 = put(sackHouse, { i: L1[0], j: L1[1], drop: 1.5, seed: 5, ladder: false,
    doors: [dirTo(C(...L1), [10, 7.5]), dirTo(C(...L1), C(...L2))] });
  const hL2 = put(sackHouse, { i: L2[0], j: L2[1], drop: 1.4, seed: 3, ladder: false,
    doors: [dirTo(C(...L2), C(...L1)), dirTo(C(...L2), stA)] });
  const hR1 = put(sackHouse, { i: R1[0], j: R1[1], drop: 1.0, seed: 7, ladder: false,
    doors: [dirTo(C(...R1), stB), dirTo(C(...R1), [14, 26.5])] });
  // la teleferica attraversa la città in diagonale; le pedane hanno un varco verso le case
  const cw = put(cableway, { a: [1, 18], b: [21, 31], drop: 2.8, sag: 2.0, seed: 1,
    gapsA: [W(...C(...L2))], gapsB: [W(...C(...R1))] });
  const bridges = [
    system.add(ropeBridge(walkwayEnd(net, 10, 7), (s, h) => hL1.porch(s, h, 0), { seed: 11, planks: 14 })),
    system.add(ropeBridge((s, h) => hL1.porch(s, h, 1), (s, h) => hL2.porch(s, h, 0), { seed: 1 })),
    system.add(ropeBridge((s, h) => hL2.porch(s, h, 1), cw.porch(0, 0), { seed: 4 })),
    system.add(ropeBridge(cw.porch(1, 0), (s, h) => hR1.porch(s, h, 0), { seed: 5 })),
    system.add(ropeBridge((s, h) => hR1.porch(s, h, 1), walkwayEnd(net, 14, 26), { seed: 12, planks: 14 })),
  ];
  // tutto ciò che serve alla storia per guidare il viaggiatore lungo il percorso
  const route = { houses: { L1: hL1, L2: hL2, R1: hR1 }, cableway: cw, bridges, walkwayIn: [10, 7], walkwayOut: [14, 26] };

  // Altre case (non sul percorso): una coppia a sinistra col suo ponticello, una a destra.
  // Hanno la scala di corda fino alla rete.
  const pair = (A, B, seed) => {
    const ca = C(A.i, A.j), cb = C(B.i, B.j);
    const ha = put(sackHouse, { ...A, yaw: dirTo(ca, cb) }), hb = put(sackHouse, { ...B, yaw: dirTo(cb, ca) });
    system.add(ropeBridge(ha.porch, hb.porch, { seed }));
  };
  pair({ i: 4, j: 29, drop: 1.8, seed: 11 }, { i: 1, j: 24, drop: 1.6, seed: 13 }, 2);
  put(sackHouse, { i: 21, j: 20, drop: 1.2, seed: 9, yaw: -Math.PI / 2 });

  // accanto a ogni coppia di case (all'altezza delle porte), un gasometro con il suo becco acceso
  put(gasBurner, { i: 6, j: 13, length: 3.2, seed: 3 });
  put(gasBurner, { i: 18, j: 24, length: 2.8, seed: 7 });
  put(gasBurner, { i: 8, j: 27, length: 3.6, seed: 11 });

  // Terrazzi come navicelle: barche di legno appese a quattro funi
  put(gondola, { i: 18, j: 7, drop: 1.6, yaw: 0.3, seed: 2 });
  put(gondola, { i: 1, j: 34, drop: 2.2, yaw: -0.4, seed: 5 });
  put(gondola, { i: 19, j: 1, drop: 1.9, yaw: 0.2, seed: 9 });

  // Girarrosti a contrappeso, con il fumo che sale verso la rete
  put(roaster, { i: 19, j: 14, length: 1.4, seed: 1 });
  put(roaster, { i: 6, j: 37, length: 1.8, seed: 4 });

  // Fili da bucato tesi tra due nodi: grucce e mollette, stoffa simulata che sventola
  put(clothesline, { i1: 18, j1: 37, i2: 23, j2: 37, drop: 0.6, seed: 2 });
  put(clothesline, { i1: 2, j1: 5, i2: 7, j2: 5, drop: 0.9, seed: 6 });

  // docce a secchio basculante: si riempiono e si svuotano da sole
  put(shower, { i: 5, j: 15, drop: 1.6, seed: 1 });
  put(shower, { i: 20, j: 16, drop: 1.5, seed: 4 });


  // Lampadari spenti (solo quello della Cartografa è acceso e fa luce)
  put(chandelier, { i: 8, j: 31, length: 2.8, lit: false });

  // Otri d'acqua
  put(waterskin, { i: 16, j: 22, length: 1.4 });
  put(waterskin, { i: 6, j: 19, length: 1.0 });
  put(waterskin, { i: 15, j: 35, length: 1.1 });

  // Cesti appesi a spaghi
  put(basket, { i: 17, j: 12, length: 1.8 });

  // Vasi con piante dal fogliame pendulo
  put(plantPot, { i: 15, j: 30, length: 1.2, seed: 1 });
  put(plantPot, { i: 18, j: 20, length: 1.5, seed: 3 });

  // Amache
  put(hammock, { i1: 5, j1: 10, i2: 5, j2: 13 });
  put(hammock, { i1: 18, j1: 32, i2: 18, j2: 35 });

  // Trapezio (gli anelli sono il frammento 3, in alto)
  put(trapeze, { i: 16, j: 33, length: 2.2 });

  // Scala di corda vicino all'arrivo: più avanti servirà per scendere sotto la rete
  put(ropeLadder, { i: 15, j: 3, length: 6, rungs: 12 });

  system.build();
  system.settle(3);

  return route;
}
