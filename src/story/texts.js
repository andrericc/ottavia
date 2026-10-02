// texts.js
// ---------------------------------------------------------------
// TUTTI i testi del gioco, in un solo posto.
// Per correggere una frase basta modificarla qui: il codice non cambia.
// La fonte è il documento "Story Bible". Tenere i due allineati.
//
// Formattazione: *parole* = corsivo.
// Nei cartelli: una riga che inizia con '>' è una citazione, con '—' la fonte.
// ---------------------------------------------------------------

export const TEXTS = {
  intro: [
    '> «Sanno che più di tanto la rete non regge.»',
    '— Italo Calvino, Le città invisibili (1972)',
    'I had been walking for eleven days when the path ended in air.',
    'Below me, clouds. Across, the other mountain. Between them, knotted to both, a city made of rope.',
    'In the valley they told me that whoever reaches Ottavia must cross it. Nobody told me what it costs.',
  ],

  notes: {
    arrival: {
      title: 'A note on a post',
      pages: [
        'TRAVELLER. Walk on the planks, not between them. Do not stop where the wood is grey. If the net sings under you, keep moving.',
        'Everything hanging below belongs to someone. You may listen to it.',
        'Not everything down there is a memory. Most of it is only the city: water, figs, ferns. Three things were left by travellers who had to cross: a lamp that still burns, though nobody tends it; water tied with a red cord; two rings for one child. And one song, in the lowest house. — K.',
      ],
    },
    keeperHouse: {
      title: 'A note in the Knot-keeper\'s house',
      pages: [
        'You are wondering where we went. We did not go anywhere far. We left one by one, lighter than we came, because the net was going down a hand\'s breadth every winter.',
        'I stayed to keep the knots. I am still looking for the courage to do the one thing the net asks. — K.',
      ],
    },
    lowHouse: {
      title: 'A note beside the music box',
      pages: [
        'Every traveller leaves something, because nobody can cross carrying everything. For years we kept it all. We hung it beneath us, every lamp and letter and ring, because it seemed a sin to let a memory fall.',
        'That was our mistake. Listen to what they left. Remember it. Then let it go, and the net will rise. It was never the net that was weak. — K.',
      ],
    },
  },

  fragments: {
    lamp: {
      title: 'The Cartographer\'s Lamp',
      examine: 'A brass lamp with six candles, still warm. Scratched into its ring there is a map: streets, squares, a fountain. None of them exist here.',
      story: [
        'She came to draw Ottavia. Every morning her map was wrong. In the night the net had moved, a knot had slipped, a house had swung a little further out.',
        'After a year she understood that Ottavia cannot be drawn, only crossed. She scratched one last map into the lamp, the map of the city she came from, and left it burning, so that someone would know where she was going home to.',
      ],
      letGo: 'The lamp falls still lit. For a long time I can see it, a small star going down.',
      keep: 'I let the rope slide back. Someone else can read her map.',
    },
    water: {
      title: 'The Last Water',
      examine: 'A leather water-skin, heavy and full. The water inside smells of stone and snow.',
      story: [
        'A man drew it from the well of his village on the day the valley was flooded for a dam. It was the last water of that well. He meant to pour it into the sea, but the road to the sea runs through Ottavia, and the net will not hold a man who carries a drowned village on his back.',
        'He left it here. He said he would come back for it. I think that not coming back was the point.',
      ],
      letGo: 'I pull the cork. The water goes first, a long thread into the clouds. Then the skin, empty, light as a leaf.',
      keep: 'Not yet. The water has waited this long.',
    },
    rings: {
      title: 'The Second Ring',
      examine: 'Two wooden rings for children\'s games. One is worn smooth by small hands. The other has hardly been touched.',
      story: [
        'A father crossed with his daughter on his shoulders. At the grey planks the net began to sing, and he knew it would not hold them both. So he made it a game. He swung down onto the rings and told her to run, as lightly as she could, to the other side.',
        'She ran. She won. He hung beneath the net until the ropes were quiet, then climbed up and followed her. He left the rings for the next child who has to cross alone.',
      ],
      letGo: 'They fall together, knocking once against each other, like a small bell.',
      keep: 'Some child will need them.',
    },
    musicBox: {
      title: 'The Music Box',
      examine: 'A music box, tin and walnut. The key still turns.',
      story: [
        'A singer who had lost her voice brought here the only thing that still sang her song. She could not bear to hear it, and she could not bear to lose it.',
        'In Ottavia she learned that those two things weigh the same. She wound it one last time and left it to sing to the wind.',
      ],
      letGo: 'It keeps playing as it falls. I hear it long after I stop seeing it.',
      keep: 'I close the lid. The song stays in the house.',
    },
  },

  // Oggetti che si possono tirare su ma non sono ricordi: una riga e la fune riscende
  decoys: {
    'skin-a': 'Water, and the smell of old rope. Nobody\'s memory.',
    'skin-b': 'Rainwater. Ottavia collects it. It remembers nothing.',
    'basket-a': 'Dried figs and a wooden spoon. Somebody\'s lunch, not somebody\'s past.',
    'fern': 'Only a fern, thirsty and patient. It belongs to the net, not to a traveller.',
    'lamp-b': 'A lamp nobody has lit for years. The wax is cold.',
    'lamp-c': 'Another cold lamp. Whoever lit it took the flame with them.',
  },

  thoughts: {
    lampFar: 'It is too far to reach. But the net moves when I jump. Maybe it can move the lamp.',
    lampReach: 'Now!',
    windRising: 'The wind is rising.',
    windHold: 'Stand still. Hold on.',
    greyWoodFirst: 'The net won\'t hold me. Not like this. Not with everything it is already carrying.',
    greyWoodAgain: 'Not yet. Not with everything it is still carrying.',
    ropeBelow: 'Something hangs down there. I could pull it up.',
    afterLetGo: 'The net lifts, just a little. I can feel it through the planks.',
    afterKeep: 'Its weight stays with the city. And a little with me.',
    readyToCross: 'The grey planks look different now. Or I do.',
  },

  ending: {
    prompt: 'Hang the lantern',
    lines: [
      'I have carried it since I left home. It lit every road that brought me here. It seems right that it should light the one road I will not take again.',
      'Behind me, a new light hangs under Ottavia. The next traveller will find it and wonder whose it was.',
    ],
    quote: [
      '> «Sospesa sull\'abisso, la vita degli abitanti d\'Ottavia è meno incerta che in altre città.»',
      '— Italo Calvino',
    ],
  },

  ui: {
    prompts: { read: 'Read', examine: 'Examine', pull: 'Pull up the rope', pullAgain: 'Pull it up again', catch: 'Catch the lamp', lever: 'Pull the lever' },
    choices: { letGo: 'Let it go', keep: 'Leave it hanging' },
    journalTitle: 'Journal',
    journalSub: 'What Ottavia has told me',
    journalEmpty: 'Nothing yet. Everything hanging below belongs to someone.',
    journalClose: 'J or Esc to close',
    fateLetGo: 'Let go',
    fateKept: 'Left hanging',
  },
};
