// texts.js
// ---------------------------------------------------------------
// TUTTI i testi del gioco, in un solo posto (storia v2: "Le funi che rispondono").
// Per correggere una frase basta modificarla qui: il codice non cambia.
// La fonte è il documento della storia (scheda "Ottavia v2"). Tenere i due allineati.
//
// Formattazione: *parole* = corsivo.
// Nei cartelli: una riga che inizia con '>' è una citazione, con '—' la fonte.
// ---------------------------------------------------------------

export const TEXTS = {
  intro: [
    '> «Sanno che più di tanto la rete non regge.»',
    '— Italo Calvino, Le città invisibili (1972)',
  ],

  // la cornice: Marco Polo e Kublai Khan, in un luogo fuori dal tempo (K = il Khan, P = Polo)
  dream: [
    ['K', 'Tell me a city, Venetian. One that stands on nothing.'],
    ['P', 'Between two mountains there is only air. Its people tied the peaks together with ropes, and hung their lives underneath.'],
    ['K', 'Then it is the most fragile of your cities.'],
    ['P', 'The least, Sire. They know the net will not hold forever. Its name is Ottavia.'],
  ],
  dreamEnd: [
    ['K', 'A city that holds because it knows it will fall… Tell me another, Venetian.'],
  ],
  // dopo Ottavia, ancora nel sogno: Polo racconta la seconda città
  dreamValdrada: [
    ['P', 'On the shore of a lake there is a village built to be reflected. Whoever arrives sees two cities: one above the water, one upside down.'],
    ['K', 'And the traveller? Does the lake repeat him too?'],
    ['P', 'That is what I went to find out. Its name is Valdrada.'],
  ],
  // prima di Valdrada, come per Ottavia, una riga del libro
  valdradaIntro: [
    '> «Così il viaggiatore, arrivando, vede due città: una diritta sopra il lago e una riflessa capovolta.»',
    '— Italo Calvino, Le città invisibili (1972)',
  ],
  // dopo Valdrada: la cornice si chiude
  dreamFinal: [
    ['K', 'So the lake gave you back to yourself, Venetian. And then it kept you.'],
    ['P', 'Ottavia holds on to what it cannot see. Valdrada lives for what it sees and cannot touch.'],
    ['K', 'And you? Where do you live?'],
    ['P', 'Always in the next city, Sire.'],
  ],
  names: { K: 'Kublai Khan', P: 'Marco Polo' },

  // il biglietto sul palo, all'arrivo: insegna il gesto senza dirlo come un manuale
  note: {
    title: 'A note on a post',
    pages: [
      'TRAVELLER. Walk on the planks. If you cannot go on, pluck a rope and listen: someone will answer.',
    ],
  },

  thoughts: {
    tear: 'The walkway is torn. There is nothing to step on, only air.',
    tearAgain: 'No. Not across that.',
    pluckHint: 'The note said: pluck the ropes, and listen.',
    noAnswer: 'The sound runs away through the net… and nothing.',
    answer: 'There! Something answered, down to the left.',
    goDown: 'A little bridge going down. It is lit, as if someone left it for me.',
    stationA: 'A cable. It goes under the whole city, to the other side.',
    cabinComing: 'Someone on the other side let go of the counterweight.',
    board: 'In I go.',
    gust: 'The wind! The cabin is stuck, swinging over the void.',
    rhythm: 'Lights are coming down the ropes from the houses. Pluck when they reach me!',
    hit: 'Together.',
    miss: 'Too late. Again.',
    saved: 'The whole city is pulling me across.',
    windRising: 'The wind is rising.',
    windHold: 'Stand still. Hold on.',
    greyWoodAgain: 'Grey wood. Do not stop here.',
    onTheOtherSide: 'The other side. Now up, to the walkway.',
    almost: 'The far ridge. Almost there.',
    arrive: 'Ottavia.',
  },

  // le voci dalle case (non si vedono mai: parlano da dentro)
  voices: {
    L1: {
      title: 'A voice from inside the house',
      pages: ['We all felt your rope. Come through the house: nobody here crosses alone.'],
    },
    L2: {
      title: 'Another voice',
      pages: ['The net sinks a little every winter. Knowing it will fall makes life here less uncertain. Take the cable.'],
    },
    R1: {
      title: 'A voice on the other side',
      pages: ['That was all of us, pulling. Up the little bridge, and you are past the tear.'],
    },
  },

  ui: {
    read: 'Read the note',
    pluck: 'Pluck the rope',
    pluckCable: 'Pluck the cable',
    goDown: 'Go down to the house',
    board: 'Step into the cabin',
    stepOut: 'Step out',
    rhythm: 'Pluck in time',
  },

  ending: [
    'Ottavia does not stand. It hangs, and it holds, because everything in it is tied to everything else.',
    '> «…la vita degli abitanti d\'una città così è meno incerta che in altre città.»',
    '— Italo Calvino, Le città invisibili',
  ],
  toBeContinued: ['*To be continued: the Khan is waiting for the next city.*'],
  // il cartello che chiude tutto
  theEnd: [
    'Ottavia · Valdrada',
    '*An interactive journey through Italo Calvino\'s Invisible Cities*',
    'Interactive Graphics — Sapienza Università di Roma',
    '*Thank you for travelling.*',
  ],
};
