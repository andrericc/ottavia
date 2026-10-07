# Ottavia — Le città invisibili

Progetto di Interactive Graphics (Sapienza, AI & Robotics).
Esperienza narrativa 3D interattiva ispirata a *Le città invisibili* di Italo Calvino.

**Versione online (GitHub Pages): https://andrericc.github.io/ottavia/**
*(se il repository viene spostato su GitHub Classroom, aggiornare questo link)*

## Avvio

Il progetto **non ha bisogno di build**: Three.js è incluso nel repository (`libs/three/`)
e `index.html` lo indica al browser con un'*import map*. Basta servire la cartella
principale con un server statico qualsiasi (i moduli JavaScript non si aprono con `file://`):

```bash
python3 -m http.server 8000     # poi apri http://localhost:8000
```

Per lavorare con la ricarica automatica si può usare Vite (serve [Node.js](https://nodejs.org) 18+):

```bash
npm install     # solo la prima volta
npm run dev     # apre il progetto su http://localhost:5173
```

**Pubblicazione:** a ogni push su `main` il workflow `.github/workflows/deploy.yml` pubblica
la cartella principale così com'è su GitHub Pages (Settings → Pages → Source: *GitHub Actions*).
In alternativa si può scegliere *Deploy from a branch → main / (root)*: funziona allo stesso modo.

## Librerie, strumenti e risorse esterne

| Cosa | Uso | Dove |
|---|---|---|
| [Three.js](https://threejs.org) r170 (licenza MIT) | rendering WebGL, scene, materiali, luci | `libs/three/three.module.js` (incluso) |
| [Vite](https://vitejs.dev) | solo server di sviluppo con ricarica automatica (facoltativo) | `devDependencies` |
| [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) (Google Fonts, OFL) | carattere dei testi | caricato da Google Fonts |

Nessun modello 3D, texture o animazione è importato da file: geometrie, texture e
animazioni sono tutte generate nel codice. Non si usano motori fisici esterni
(la fisica Verlet è scritta da noi) né tween.js (le interpolazioni sono in `Story.js`).

## Controlli

- **E** interagisci (leggi, esamina) · avanti nel testo · **1 / 2** scegli
- **J** diario · **Esc** chiudi
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
├── story/
│   ├── texts.js          TUTTI i testi del gioco (inglese), da modificare qui
│   └── Story.js          la storia: eventi, scelte, cosa si ricorda
├── ui/
│   ├── Narrator.js       riquadro di testo, scelte, cartelli, pensieri (con Promise)
│   ├── Journal.js        il diario (J)
│   └── style.css         stile dell'interfaccia narrativa
├── interaction/
│   └── InteractionManager.js  tasto E: oggetto più vicino, indicatore, prompt
├── hanging/              tutto ciò che sta appeso sotto la rete
│   ├── VerletBody.js     corpo morbido generico: particelle + funi/aste (Verlet)
│   ├── HangingSystem.js  gestisce gli oggetti: pesi sulla rete, fisica, disegno delle funi
│   ├── items.js          gli oggetti: lampadario, otre, cesto, vaso, amaca, trapezio…
│   ├── layout.js         DOVE sta ogni oggetto (da modificare liberamente)
│   └── textures.js       texture procedurali: colore + normal + roughness (+ bump)
└── world/
    ├── World.js          creste, burrone, luci, nebbia
    ├── NotePost.js       il palo con il biglietto del Knot-keeper
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

## Interazione e narrazione (step 7)

- **Tasto E.** `InteractionManager` sceglie ogni frame l'interazione più vicina, preferendo
  ciò che sta davanti al viaggiatore, e la segnala con un rombo dorato che ruota e fluttua
  sopra l'oggetto, più la scritta `[E] Read` in basso. Qualunque cosa diventa interattiva
  con `interactions.add({...})`.
- **Narrazione con Promise.** `Narrator` scrive il testo lettera per lettera e offre scelte
  e cartelli a tutto schermo. Ogni funzione restituisce una Promise, così la storia in
  `Story.js` si legge come un copione: `await say(...)`, `await choose(...)`.
- **Testi separati dal codice.** Tutto è in `story/texts.js`.
- **Già giocabile:**
  - apertura con la citazione di Calvino (aggiungere `?skip` all'indirizzo per saltarla);
  - il biglietto sul palo, con il foglio che si muove nel vento;
  - il primo frammento, la lampada: la esamini, leggi la storia e scegli. Se la lasci
    andare, precipita accesa e il suo peso sparisce dalla rete;
  - il diario (J) raccoglie tutto quello che hai letto e le tue scelte.

## Tirare su, lasciar andare, la porta (step 8)

- **Tirare su la fune (E).** Il viaggiatore si china e tira a mano a mano: sono 6 tirate,
  a tempo con l'animazione delle braccia (`posePull`). Le funi dell'oggetto si accorciano
  (`HangingSystem.reel`) e, poiché resistono solo alla trazione, l'oggetto sale da solo
  fino alla passerella. La camera lo inquadra (`FollowCamera.focus`).
- **Lasciar andare.** Le funi si tagliano. L'oggetto viene appeso a un perno nel suo punto,
  così ruota su se stesso mentre cade, e la camera lo segue un attimo. Il suo peso sparisce
  dalla rete, che accanto alla passerella risale di circa 7–9 cm (i frammenti pesano 300).
- **Lasciare appeso.** La fune riscende. Si può tornare in qualsiasi momento e cambiare idea:
  nessuna scelta blocca la storia.
- **I tre frammenti della passerella:**
  - la lampada (colonna 9, fila 8);
  - l'otre (colonna 9, fila 15);
  - gli anelli (colonne 15–16, fila 19).
- **La porta del legno grigio.** La capacità delle funi vecchie cresce con ogni frammento
  lasciato andare: 120 → 155 → 190 → 225. Prima del terzo:
  - il viaggiatore si rifiuta di proseguire e torna indietro da solo;
  - il danno delle funi vecchie è limitato al 50%, così un tentativo anticipato non può
    rompere la rete e bloccare la storia.

  Al terzo frammento la porta si apre, le funi vecchie "riposano" (danno azzerato) e da lì
  vale la fisica vera: camminare va bene, fermarsi no.

## Gli enigmi (step 8, seconda parte)

- **Ricordi da riconoscere.** Si possono tirare su 9 oggetti, ma solo 3 sono ricordi (il
  quarto, il carillon, arriva allo step 9). Gli altri danno una riga (`TEXTS.decoys`) e la fune
  riscende. Gli indizi sono nella terza pagina del primo biglietto, e ogni ricordo ha un
  dettaglio visibile:
  - la lampada della Cartografa è l'unica accesa (gli altri lampadari hanno `lit: false`:
    niente fiamme e niente luce, quindi costano anche meno);
  - l'acqua del pozzo ha il cordino rosso (`cord`);
  - gli anelli sono l'unico gioco per bambini.
- **La lampada lontana.** È appesa alla colonna 6, a 4 m dalla passerella, con una fune di 4 m
  poco smorzata (`damping: 0.9993`, periodo circa 4 s). Ogni atterraggio sulla passerella lì
  vicino le dà una spinta di 1,3 m/s verso la passerella (`VerletBody.push`):
  - saltare mentre viene verso di te aumenta l'oscillazione (risonanza, come un'altalena);
  - saltare mentre si allontana la frena.

  In simulazione: con i salti a tempo arriva a portata in circa 8 s, saltando di continuo non
  ci arriva mai. A portata compare `[E] Catch the lamp`, con 0,7 s di tolleranza per il
  riflesso. Afferrata, il perno della sua fune si sposta dal nodo lontano a quello accanto alla
  passerella. Se la lasci appesa, il perno torna al suo posto e la lampada riprende a oscillare.
- **Il vento** (`world/Wind.js`). Raffiche ogni 30–50 s, solo mentre si cammina sulla rete:
  - 2 s di vento che sale (*The wind is rising*), poi 3,5 s di raffica (*Stand still. Hold on.*);
  - la raffica spinge di lato la rete, gli oggetti appesi (`VerletBody.wind`) e il viaggiatore;
  - chi cammina viene spostato verso gli intervalli, chi sta fermo resiste;
  - il viaggiatore si piega verso il vento (`poseWind`).
- **Le assi seguono la rete anche di lato.** I bordi delle traversine si calcolano dalla
  posizione vera dei nodi (`plankXRange`), e il viaggiatore fermo viene trascinato dall'asse
  su cui sta (`plankX`), così quando il vento fa ondeggiare la rete non si trova sospeso nel vuoto.

## Storia v2: le funi che rispondono

La storia dei frammenti (step 7–8) è stata sostituita. Il percorso completo è nel documento
della storia, scheda *Ottavia v2*. In breve: la passerella è strappata a metà, Polo pizzica le
funi per farsi rispondere dalla città, scende tra le case, prende la teleferica, e nella raffica
la città lo tira dall'altra parte a ritmo.

- **Lo strappo** (`main.js`, `makeTear`). Le funi longitudinali tra la fila 21 e la 22 (colonne
  8–16) sono spezzate e mancano le traversine 19–23. `restoreState` azzera le funi rotte, quindi
  `makeTear` viene richiamata anche quando si preme R. La storia impedisce di camminare nel buco
  (`TEAR_Z0`, `TEAR_Z1` in `Story.js`).
- **Pizzicare** (`story/Pulse.js`, `story/Sound.js`).
  - *L'onda sulla rete:* una visita in ampiezza (BFS) sul grafo nodi-funi dà la distanza in
    "salti" di ogni nodo da quello pizzicato. A ogni frame la luce di un nodo è una gaussiana
    centrata sul fronte dell'onda, `exp(-((d - fronte)/larghezza)²)`, che si spegne allontanandosi.
    Le funi spezzate non conducono, quindi l'onda aggira lo strappo. Si disegna con una
    `LineSegments` e dei `Points` sovrapposti alla rete, con blending additivo.
  - *La luce in viaggio:* `pulse.send(percorso)` fa correre uno sprite luminoso (con una scia)
    lungo un percorso di punti che possono muoversi (un ponticello, il cavo). Restituisce una
    Promise, quindi la storia scrive `await pulse.send(...)`.
  - *La nota:* sintesi Karplus-Strong. Un rumore entra in una linea di ritardo lunga un periodo
    e a ogni giro viene mediato col campione vicino (passa-basso), proprio come una corda vera.
    La frequenza dipende dall'allungamento della fune (`ropeFreq`) e viene arrotondata alla nota
    più vicina di una scala pentatonica: la rete "canta" invece di stonare.
- **Spostamenti guidati** (`Player.startScript` / `endScript`). Nello stato `script` la posizione
  la decide la storia: `story.walk(percorso)` fa avanzare il viaggiatore a velocità costante lungo
  una spezzata di funzioni-punto e lo gira nella direzione di marcia. L'animazione di camminata
  è la stessa di sempre (le si passa `scriptSpeed`). I percorsi vengono dagli oggetti stessi:
  - `ropeBridge.path()`: i punti medi delle assi;
  - `sackHouse.through(a, b)`: da una porta all'altra passando per il centro della casa;
  - `cableway.deckPath()`: sulla pedana, dal varco al punto dove si ferma la cabina.
- **La cabina** (`cableway.control`). Con `manual = true` la sua posizione lungo il cavo
  (`control.u`, da 0 = stazione A a 1 = stazione B) la decide la storia, con interpolazioni
  dolci (`story.tween`). Il pendolo della cabina reagisce da solo alle accelerazioni e al vento.
- **Il battito.** Le luci partono a turno dalle case (`house.centerPoint`) e arrivano al carrello
  della cabina in 1,25 s. Un tasto E premuto tra 0,32 s prima e 0,38 s dopo l'arrivo conta come
  colpo riuscito: nota sempre più acuta e la cabina avanza. Ne servono 6 (`HITS_NEEDED`). Se si
  sbaglia non succede niente di grave: arriva la luce successiva.
- **Il vento imposto** (`wind.force(forza, direzione)`). Durante la traversata la raffica la
  decide la storia; `force(null)` restituisce il vento al suo ciclo normale.
- **Il finale.** Arrivati sulla cresta opposta, un'onda attraversa tutta la rete, ogni casa manda
  una luce al viaggiatore con la sua nota, poi compare il cartello conclusivo.

## La cornice: il sogno con Kublai Khan

- **Apertura** (`Story.intro`): la citazione di Calvino, poi Marco Polo e Kublai Khan parlano in
  un luogo fuori dal tempo (`world/Dream.js`). Quando Polo dice "Ottavia", la nebbia del sogno si alza e
  sotto c'è la città, con la stessa inquadratura. Il viaggiatore parte da una conca sulle
  colline (`world.startPoint`): un dosso morbido (in `heightAt`, `World.js`) nasconde il burrone,
  che si scopre superandolo. Con `?skip` si salta tutto e si parte accanto alla rete.
- **Il sogno** è una scena separata, con il suo cielo e la sua nebbia: un pavimento a scacchiera
  che sfuma nella nebbia, due bracieri e Kublai Khan. Kublai è un modello gerarchico seduto (busto → testa → cappello, spalle → braccia
  → avambracci); quando parla (`speaking`) alza il braccio destro e accompagna le parole.
  Tutto il sogno sta in un gruppo che si posa dove si trova il viaggiatore (`setAnchor`).
- **La nebbia che si alza** (`world/Transition.js`): la scena visibile viene disegnata in un
  render target (un'immagine fuori schermo) e ripassata su un rettangolo a tutto schermo con uno
  shader di nebbia. Nella prima metà la nebbia color crema si infittisce a sbuffi (un rumore che
  scorre verso l'alto) fino a coprire tutto; dietro di lei la scena cambia; nella seconda metà si
  solleva dal basso verso l'alto e scopre Ottavia. `view.mode` in `main.js` sceglie cosa disegnare:
  `'dream'`, `'world'` oppure `'blend'` (con `view.t` da 0 a 1). Il viaggiatore viene spostato
  nella scena che si sta disegnando.
- **L'ordine è fisso**: sogno → Ottavia → sogno → Valdrada → sogno → fine. Dopo il cartello su
  Ottavia si torna nel sogno con la nebbia al contrario e il Khan chiede un'altra città
  (`story.onFinished`). `main.js` costruisce allora Valdrada (`createValdrada`, solo in quel
  momento, per non appesantire l'avvio), il sogno si riposa in punta al pontile e Polo la
  racconta; la nebbia sale e scopre il lago. Finita Valdrada (`valdradaStory.onEnd`) si torna nel
  sogno un'ultima volta: Kublai e Polo chiudono e compare il cartello finale.
- **Una sola pagina per tutto**: renderer, camera, camera che segue e narratore sono condivisi tra
  le due città; ognuna ha la sua scena, il suo viaggiatore e le sue interazioni. `city` in
  `main.js` dice quale città si aggiorna e si disegna (l'altra resta ferma). La transizione
  accetta un `prepare(scene)`, che per Valdrada prepara il riflesso del lago prima di disegnare.
- **Scorciatoie per lavorare**: `?skip` parte accanto alla rete di Ottavia; `?valdrada` (o la
  pagina `valdrada.html`) salta Ottavia e parte dal sogno prima di Valdrada, fino al sogno finale.
- **La cabina** è stata ingrandita (2,2 m di altezza interna, 1,5 × 1,9 m) e ha un varco a ogni
  testata. Le stazioni sono state rialzate (`H = 2.9`), così il pavimento della cabina arriva a filo
  della pedana.

## Texture di tipi diversi

Tutte le texture sono generate nel codice (`src/hanging/textures.js`), ma di **tipi diversi**:

| Tipo | Uso in three.js | Dove |
|---|---|---|
| **Colore** | `map` | legno, legno dipinto, juta delle case, tessuti, vestiti, insegne, acqua del fiume |
| **Normal map** | `normalMap` | venature e chiodi del legno, trama e toppe della juta, scaglie di vernice, trama dei tessuti, roccia delle pareti (bozze e crepe), erba delle colline, graffi del ferro |
| **Roughness map** (la "specular" dei materiali PBR) | `roughnessMap` | vernice più lucida del legno nudo, chiodi lucidi, ferro consumato lucido e ruggine opaca |
| **Bump map** | `bumpMap` | trefoli a elica delle funi |
| **Trasparenza** | canale alfa della `map` + `alphaTest` | sagome dei vestiti stesi |

Come funziona: ogni generatore disegna la stessa immagine **tre volte** con gli stessi numeri
casuali, una per livello (colore, altezza, ruvidezza), così le mappe combaciano pixel per pixel.
L'immagine delle altezze diventa una normal map con l'**operatore di Sobel** (`heightToNormal`):
la pendenza in x e in y di ogni pixel dà il vettore normale (−dx, −dy, 1), normalizzato e scritto
nei canali RGB. Le mappe extra viaggiano attaccate alla texture colore e `applyDetailMaps(scene)`
(chiamata in `main.js`) le monta su tutti i materiali che la usano. Le texture con gli stessi
parametri si generano una volta sola (cache) e si clonano.


## Valdrada, la seconda città

Nell'esperienza completa si arriva a Valdrada dal sogno, dopo Ottavia. Per provarla subito:
`index.html?valdrada` oppure **`valdrada.html`** (sogno → Valdrada → sogno).

*"Gli antichi costruirono Valdrada sulle rive d'un lago con case tutte verande una sopra
l'altra e vie alte che affacciano sull'acqua i parapetti a balaustra."*

```
src/valdrada/
├── Valdrada.js      la città come modulo: lago, villaggio, viaggiatore, abitanti, storia
├── City.js          il villaggio in fila lungo la riva: case su palafitte, passerella,
│                    ponticelli di corda, campanile di legno, pontile, barche, riva e bosco
├── VillageHouse.js  le case del villaggio (casa storta, torre di verande, casa lunga) e il fumo
├── lab.js           pagina di prova delle case (valdrada-case.html)
├── MirrorWater.js   il lago-specchio: riflesso planare scritto da noi
├── Atmosphere.js    tardo pomeriggio nebbioso: cielo, nebbia, luci, monti a strati, gabbiani
├── Inhabitants.js   gli abitanti, che esistono solo nel riflesso
├── Story.js         la storia: l'uomo senza riflesso, i tre gesti e il finale
└── vtextures.js     tavole, scandole con muschio, paglia, reti, facciate (emissive), acqua, nebbia
```

- **Il lago-specchio** (`MirrorWater.js`): ogni frame una *camera specchio* (la camera del
  giocatore riflessa rispetto al piano dell'acqua) disegna la scena in un render target.
  Un piano di clipping obliquo (tecnica di Lengyel, la stessa del `Reflector` degli esempi
  di three.js, qui riscritta) taglia ciò che sta sotto l'acqua. Lo shader proietta
  l'immagine sulla superficie con una *texture matrix*, la deforma con due normal map che
  scorrono e la mescola al colore dell'acqua con un termine di Fresnel.
- **Layer**: la città sta sul layer 0; gli **abitanti** sul layer 1, che vede solo la camera
  specchio (sopra la città è vuota, nell'acqua è abitata); il **viaggiatore** sul layer 2,
  che la camera specchio non vede: a Valdrada lui non ha riflesso.
- **Il villaggio** (`City.js`, `VillageHouse.js`): una fila di case di legno su **palafitte**
  lungo una riva dritta, con il bosco di abeti che sale ripido nella nebbia (nessuna casa sulla
  collina). Cinque tipi di casa, in varianti diverse e a volte specchiate:
  la **casa storta** (il piano di sopra sporge su mensole e i due piani pendono in versi opposti,
  tetto di paglia o di scandole, balconcino con la scala a pioli, casotto addossato), la
  **torre di verande** (3–5 piani stretti, ognuno con la sua veranda ad angolo e ruotato un poco
  rispetto a quello sotto — ogni piano è figlio del precedente nel modello gerarchico; carrucola
  con il secchio, piccionaia) e la **casa lunga** (timpano intagliato verso il lago, portico
  sull'acqua, abbaino, legna accatastata), la **casa rotonda** (capanna tonda con il tetto conico
  di paglia e la veranda tutt'intorno) e la **casa a ponte** (il piano di sopra scavalca la
  passerella: ci si passa sotto). Davanti corre la passerella con il parapetto; tra i
  piani alti di alcune case passano **ponticelli di corda** (le "vie alte"). Legno grigio, solo
  porte e persiane di colori stinti; fumo dai camini (sprite che salgono e sbiadiscono).
  **Dettagli di vita**: nei vicoli piccoli pontili con botti, casse, remi, pesci a seccare,
  altarini con la lucina; canne da pesca al parapetto; due **trabucchi** (macchine da pesca di
  pali che sporgono sul lago) con la rete che scende nell'acqua e risale.
- **Modelli gerarchici nuovi**: la campana sul campanile di legno (giogo → campana → batacchio),
  le barche (scafo → remo), le lanterne appese (palo → braccio → lanterna, che dondola),
  i gabbiani (corpo → ali → punte, con battito e planata); gli abitanti riusano il
  viaggiatore, e alcuni salutano (spalla → gomito ruotati a mano sopra l'animazione).
- **Texture**: tavole, scandole (anche con il muschio), paglia e assi con map + normal +
  roughness; la rete da pesca è una texture con trasparenza (alphaTest); la nebbia sul lago è una texture di sola
  trasparenza; l'acqua usa una normal map animata.
- **Camminare a più piani**: `Player.js` ora passa la quota dei piedi a
  `world.groundHeightAt(x, z, y)` (si sceglie la superficie appena sotto) e chiama
  `world.constrain` per bordi, balaustre e pilastri. Per Ottavia non cambia nulla.
- **Prestazioni**: le parti ferme della città (più di mille oggetti) vengono fuse in una
  geometria per materiale (`mergeStatic`), perché la scena si disegna due volte a frame.

### La storia: l'uomo senza riflesso (`Story.js`)

Il viaggiatore arriva in punta al pontile e scopre di non avere riflesso. Nell'acqua il
villaggio è abitato e ognuno compie un gesto; quando il viaggiatore compie lo stesso gesto
sopra, nell'acqua ritrova un pezzo di sé. All'arrivo il villaggio è quasi buio, sopra e sotto:
poche finestre accese e le lanterne del parapetto spente.

1. **La lanterna** sotto il portico della casa lunga: nel riflesso un uomo la accende di
   continuo. Il viaggiatore la accende davvero (`E`): sopra si accende solo quella lanterna,
   nel lago si accendono **tutte le finestre e le lanterne**. Nell'acqua compaiono i suoi **piedi**.
2. **La campana** sulla piattaforma accanto al pontile (ci si arriva da una passerella di
   tavole). Appena accesa la lanterna, nel lago la donna sotto il campanile comincia a
   suonarla: la campana del riflesso oscilla, ma non si sente niente. Il viaggiatore va sotto
   la campana e tira la corda (`E`): la campana vera oscilla e suona (WebAudio), quella del
   lago si ferma e tace. Nell'acqua compare **metà** del suo corpo.
3. **La mano** in punta al pontile: oltre la punta, nell'acqua, una figura tende una mano.
   Il viaggiatore tende la sua: il riflesso, ancora senza testa, smette di copiarlo, va da lei
   e le prende la mano. Solo dopo la stretta gli compare la testa: è intero. Allora il
   viaggiatore sopra **svanisce** (diventa trasparente mentre piccole luci si staccano e
   salgono) e resta solo il riflesso, che alza gli occhi verso il pontile vuoto.
   *"Le due Valdrade vivono l'una per l'altra, guardandosi negli occhi di continuo, ma non
   si amano."* Poi la nebbia, e nel sogno Marco è di nuovo davanti a Kublai.

Le tecniche:

- **Il riflesso che compare a pezzi**: è un secondo `Traveler` sul layer 1 (lo vede solo la
  camera specchio) che ogni frame copia posizione e articolazioni del viaggiatore. Non sta
  sotto i suoi piedi (le assi lo nasconderebbero) ma accanto, sull'acqua libera. I suoi
  materiali hanno un **piano di clipping** (`renderer.localClippingEnabled`) che sale
  dolcemente: piedi → metà → intero.
- **Luci accese solo nel lago**: `MirrorWater` ha due ganci, `onBefore` e `onAfter`,
  chiamati intorno al disegno del riflesso. All'inizio vetri, finestre "accendibili" e
  lanterne sono spenti (restano accese solo poche finestre con un materiale a parte); dopo la
  lanterna, durante il disegno del riflesso, i loro materiali diventano emissivi e le luci
  delle lanterne si accendono, e subito dopo tornano spenti. La stessa città è buia sopra e
  accesa nell'acqua.
- **Due oggetti nello stesso punto**: la lanterna spenta (layer 2, solo il giocatore) e quella
  accesa (layer 1, solo il lago); la campana vera con la sua corda (layer 2) e una copia
  `clone(true)` (layer 1), ognuna con il suo suonatore.
- **La campana a leva e la corda nelle mani**: la corda pende dalla punta di una leva del
  giogo. Chi suona segue un ciclo di trazione (braccia in alto → mani al petto, con una
  leggera piegata delle ginocchia), impostato sulle articolazioni dopo l'animazione normale.
  La corda viene disegnata ogni frame come un cilindro stirato **dalla punta della leva al
  punto tra i due pugni** (con un capo che pende sotto le mani): le mani la toccano sempre.
  Il giogo ruota di quanto la corda è scesa; il battaglio suona a ogni fine corsa. Quando la
  corda viene lasciata (sempre con le mani in alto) pende dritta e la campana si calma piano.
- **Il viaggiatore che svanisce**: i suoi materiali vengono clonati e resi trasparenti, e
  l'opacità scende a zero mentre una quarantina di sprite luminosi (additivi, solo sul layer
  del giocatore) salgono e si spengono; alla fine l'oggetto viene nascosto. `restoreTraveler`
  lo rimette com'era prima di tornare nel sogno.
- **Il suono della campana** è sintetizzato con WebAudio: somma di parziali non armoniche
  (0,5 · 1 · 1,19 · 1,56 · 2 · 2,74 · 3,76 volte la fondamentale) che si spengono a velocità
  diverse.
- **Nuovi gesti del viaggiatore** (`TravelerAnimator.js`): `reach` (alza il braccio),
  `ring` (base per suonare la campana), `offer` / `offerL` (tende la mano destra / sinistra),
  `lookup` (alza la testa).
- **Un passo di tempo mai negativo**: dopo un lavoro lungo (la costruzione di Valdrada) il
  primo frame poteva avere un `dt` negativo, che faceva impazzire l'orientamento del
  viaggiatore; ora `dt` è limitato tra 0 e 0,1 s e la rotazione del modello ha un controllo
  di sicurezza.
- **Regia**: dopo ogni gesto la camera va a guardare il riflesso dall'alto, perché dietro di
  lui ci sia il cielo chiaro e non il villaggio scuro; nel finale esce sull'acqua, di lato
  alla punta del pontile, da dove si vedono insieme il viaggiatore e le due mani che si incontrano sotto.
