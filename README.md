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
│   └── FollowCamera.js   camera in terza persona
└── world/
    └── World.js          creste, burrone, luci, nebbia
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
