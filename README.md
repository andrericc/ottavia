# Ottavia — Le città invisibili

Progetto di Interactive Graphics (Sapienza, AI & Robotics).
Esperienza narrativa 3D interattiva ispirata a *Le città invisibili* di Italo Calvino.

## Avvio

Serve [Node.js](https://nodejs.org) (versione 18 o superiore).

```bash
npm install     # solo la prima volta
npm run dev     # apre il progetto su http://localhost:5173
```

Build per la pubblicazione (cartella `dist/`):

```bash
npm run build
```

## Controlli

- **WASD** muovi il viaggiatore (anche quando è appeso sotto la rete)
- **Spazio** salta · quando sei appeso, risali sulla traversina più vicina
- **Mouse** tieni premuto e trascina per ruotare la camera
- **Rotella** zoom
- **R** ricomincia (rete integra, traversine al loro posto)

## Struttura

```
src/
├── main.js               ciclo principale, fisica a passo fisso
├── net/
│   ├── VerletNet.js      simulazione della rete (Verlet + vincoli di distanza)
│   ├── NetMesh.js        disegno della rete, colore in base alla tensione
│   └── Walkway.js        traversine di legno che seguono la rete
├── player/
│   ├── Player.js         macchina a stati: walk / hang / climb / fall
│   ├── Traveler.js       il viaggiatore: modello gerarchico (22 articolazioni)
│   ├── TravelerAnimator.js  animazione procedurale di ogni stato
│   └── FollowCamera.js   camera in terza persona (con scossone)
├── hanging/              tutto ciò che sta appeso sotto la rete
│   ├── VerletBody.js     corpo morbido generico: particelle + funi/aste (Verlet)
│   ├── HangingSystem.js  gestisce gli oggetti: pesi sulla rete, fisica, disegno delle funi
│   ├── items.js          gli oggetti: lampadario, otre, cesto, vaso, amaca, trapezio…
│   ├── layout.js         DOVE sta ogni oggetto (da modificare liberamente)
│   └── textures.js       texture procedurali (tela a righe, sacco rattoppato)
└── world/
    ├── World.js          creste, burrone, luci, nebbia
    └── Debris.js         oggetti che precipitano (traversine cadute)
```

## Parametri da provare

- `VerletNet` in `main.js`: `cols`, `rows`, `slack` (quanto pende), `iterations` (rigidità)
- `Player.weight`: quanto il viaggiatore deforma la rete
- `NetMesh.breakStress`: tensione considerata "100%"

## Regole della rete

- Si cammina sulle **traversine**. Se il piede resta in un **intervallo** per più di
  `gapLimit` secondi (0,3 s), il viaggiatore scivola e si aggrappa alle maglie.
- Camminando si scavalcano gli intervalli normali; le **traversine mancanti**
  (file 9, 17, 27) vanno **saltate**.
- Da appeso ci si sposta sotto la rete e si risale con Spazio se sopra c'è una traversina
  (o il bordo di una cresta). La **presa** dura `gripTime` secondi (10): poi si cade e si
  riparte dall'ultimo punto sicuro.

## La rete cede (step 4)

*"Sanno che più di tanto la rete non regge."*

- Dalla fila 21 alla 24 la passerella è **vecchia**: legno grigio e canapa ingrigita.
  Le sue funi longitudinali reggono al massimo `capacity` (200) di peso diretto sui nodi.
- **Attraversarla camminando** va bene. Ogni passaggio però le logora un po' (circa 30%):
  al quarto passaggio cedono.
- **Fermarsi** sopra fa cedere la rete in circa un secondo e mezzo. **Saltarci** sopra in mezzo secondo.
- Una fune oltre il limite accumula **danno** (resta rossa). A 1 si spezza e dà uno
  strattone alle funi vecchie vicine: lo strappo si propaga, ma le funi sane lo fermano.
- Una traversina con almeno 2 funi spezzate sotto di sé **si stacca e precipita**.
- Se la rete si strappa sotto i piedi, il viaggiatore **si aggrappa** alla maglia integra
  più vicina, preferendo la canapa sana. Per salvarsi bisogna aggirare il buco a mano a mano
  e risalire oltre.

## Il viaggiatore (step 5)

Modello gerarchico in `Traveler.js`: ogni articolazione è un `Group` vuoto posto nel punto
di rotazione, e le parti visibili ne sono figlie. La catena più lunga ha 9 livelli:
root → swing → body → pelvis → spine → chest → shoulder → elbow → wrist.

Animazioni (tutte in `TravelerAnimator.js`, nessun file importato):

| Stato | Come è fatta |
|---|---|
| Fermo | respiro, peso che si sposta, sguardo che vaga e ogni tanto guarda nel vuoto |
| Camminata | ciclo del passo guidato dalla **distanza percorsa** (i piedi non pattinano); braccia in controfase; torsione di bacino e busto |
| Salto | gambe raccolte, braccia su quando sale e larghe quando scende |
| Barcollare | braccia che annaspano, una gamba sollevata, sguardo verso il basso |
| Appeso | braccia in alto, "mano dopo mano" quando si sposta, gambe a penzoloni |
| Arrampicata | interpolazione tra 4 **pose chiave** (tirata, ginocchio sull'asse, in piedi) |
| Caduta | braccia e gambe che mulinano |

Dettagli tecnici:
- **Transizioni morbide.** Ogni stato produce una posa bersaglio e le articolazioni la
  inseguono con uno smorzamento esponenziale, così i cambi di stato si fondono da soli.
- **Piedi a terra senza IK.** L'altezza del bacino si ricava dalla cinematica diretta delle
  gambe, in modo che il piede più basso tocchi il suolo. Il saliscendi del passo nasce da qui.
- **Due pendoli simulati:**
  - il corpo appeso dondola attorno alle mani, spinto dalla loro accelerazione;
  - la lanterna è un pendolo sferico calcolato nello spazio del mondo.
- **Luce gerarchica.** La lanterna contiene una `PointLight` figlia: la luce segue ogni
  movimento della catena gerarchica.

## Gli oggetti appesi (step 6)

*"Tutto il resto, invece d'elevarsi sopra, sta appeso sotto."*

21 oggetti appesi sotto la rete (la loro posizione è in `layout.js`):
3 case a sacco, 3 lampadari, 5 otri, 2 cesti, 3 vasi con piante pendule, 2 amache,
un trapezio, gli anelli e una scala di corda.

- **Nessuna animazione scritta a mano per le oscillazioni.** Ogni oggetto è appeso ai nodi
  della rete con funi simulate (`VerletBody`, lo stesso metodo della rete). Quando la rete si
  muove, per esempio quando il viaggiatore cammina o salta, tutto dondola da solo.
- **Accoppiamento a due vie.** Il peso di ogni oggetto tira giù i nodi a cui è legato, e
  rete e oggetti si assestano insieme all'avvio.
- **Funi e aste.** Le funi resistono solo alla trazione. Pioli della scala e sbarra del
  trapezio sono aste rigide (`rigid: true`).
- **Modelli gerarchici.** Esempio: lampadario → anello (ruota) → 6 bracci → candela →
  fiamma (tremola). C'è anche una `PointLight` vera.
- **Movimento secondario a cascata.** Le fronde delle piante sono piccole funi legate al
  bordo del vaso, che a sua volta dondola appeso alla rete. L'acqua negli otri è una molla
  smorzata che li allunga e li schiaccia.
- **Geometria dinamica.** Il telo dell'amaca è una striscia di triangoli ricalcolata a ogni
  frame dalle particelle.
- **Texture procedurali** disegnate con il Canvas 2D: tela a righe e sacco rattoppato.
- **Prestazioni.** Tutte le funi sono una sola `LineSegments`, e le foglie e i pioli sono
  `InstancedMesh`. La fisica di 300 particelle costa meno di 0,1 ms per passo.
