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
    ['K', 'You have described many cities to me, Venetian. Tonight, tell me one that stands on nothing.'],
    ['P', 'There is one, Sire. Between two steep mountains there is a chasm, and below it only air.'],
    ['K', 'And yet people live there?'],
    ['P', 'They tied the two mountains together with ropes and chains and little bridges, and hung their lives underneath.'],
    ['K', 'Then it must be the most uncertain of all your cities.'],
    ['P', 'Strangely, Sire, it is the least. They know the net will not last forever.'],
    ['K', 'What is its name?'],
    ['P', 'Its name is Ottavia.'],
  ],
  dreamEnd: [
    ['K', 'A city that holds because it knows it will fall. I am not sure I believe you.'],
    ['P', 'Every city I describe to you, Sire, is held together by something. In Ottavia you can see the ropes.'],
    ['K', 'Then tell me another.'],
  ],
  // dopo Ottavia, ancora nel sogno: Polo racconta la seconda città
  dreamValdrada: [
    ['K', 'But not another city hanging over the void. Tonight I am tired of looking down.'],
    ['P', 'Then look across, Sire. There is a city on the shore of a lake, its houses all verandas, one above the other.'],
    ['K', 'A lake is only a lake.'],
    ['P', 'Not this one. Whoever arrives sees two cities: one standing above the water, and one upside down beneath it.'],
    ['K', 'A reflection. Every city on the water has one.'],
    ['P', 'Here nothing happens above that the lake does not repeat below. Every gesture is made twice.'],
    ['K', 'And the traveller? Does the lake repeat him too?'],
    ['P', 'That, Sire, is what I went there to find out. Its name is Valdrada.'],
  ],
  // prima di Valdrada, come per Ottavia, una riga del libro
  valdradaIntro: [
    '> «Così il viaggiatore, arrivando, vede due città: una diritta sopra il lago e una riflessa capovolta.»',
    '— Italo Calvino, Le città invisibili (1972)',
  ],
  // dopo Valdrada: la cornice si chiude
  dreamFinal: [
    ['K', 'So the lake gave you back to yourself piece by piece, Venetian. And then it kept you.'],
    ['P', 'It kept someone, Sire. I am still not sure it was me.'],
    ['K', 'Two cities that look at each other forever and do not love each other. Are you describing Valdrada, or my court?'],
    ['P', 'Perhaps every city I tell you about is the same city, Sire. Ottavia hangs from what it cannot see. Valdrada lives for what it sees and cannot touch.'],
    ['K', 'And you? In which of them do you live?'],
    ['P', 'In the one I am about to describe, Sire. Always the next one.'],
  ],
  names: { K: 'Kublai Khan', P: 'Marco Polo' },

  // il biglietto sul palo, all'arrivo: insegna il gesto senza dirlo come un manuale
  note: {
    title: 'A note on a post',
    pages: [
      'TRAVELLER. Walk on the planks, not between them.',
      'Here we do not shout. We pluck the ropes, and listen. Everything in Ottavia is tied to something else: a pull here is felt over there.',
      'If you cannot go on, ask the net. Someone will answer.',
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
      pages: [
        'You plucked the rope by the tear. We all felt it, up and down the city.',
        'Go through, go through. Mind the table. Nobody here crosses alone: when you walk on a bridge, someone holds the other end.',
      ],
    },
    L2: {
      title: 'Another voice',
      pages: [
        'You are wondering why we do not mend the tear. We mend and mend. The net goes down a hand\'s breadth every winter all the same.',
        'We know it will not hold forever. Strange: it makes life here less uncertain, not more. Take the cable. Pluck it when you are on the platform.',
      ],
    },
    R1: {
      title: 'A voice on the other side',
      pages: [
        'You felt it, out there in the wind? That was all of us, pulling.',
        'Up the little bridge, and you are back on the walkway, past the tear. Go well. Pluck a rope when you are far away, now and then. We will hear it.',
      ],
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
    'Behind me, the houses that answered keep their lights on. The ropes I walked still hum.',
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
