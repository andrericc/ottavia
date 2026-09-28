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

- **WASD** muovi il viaggiatore
- **Spazio** salta (l'atterraggio colpisce la rete più forte)
- **Mouse** tieni premuto e trascina per ruotare la camera
- **Rotella** zoom

## Struttura

```
src/
├── main.js               ciclo principale, fisica a passo fisso
├── net/
│   ├── VerletNet.js      simulazione della rete (Verlet + vincoli di distanza)
│   └── NetMesh.js        disegno della rete, colore in base alla tensione
├── player/
│   ├── Player.js         movimento, salto, peso scaricato sulla rete
│   └── FollowCamera.js   camera in terza persona
└── world/
    └── World.js          creste, burrone, luci, nebbia
```

## Parametri da provare

- `VerletNet` in `main.js`: `cols`, `rows`, `slack` (quanto pende), `iterations` (rigidità)
- `Player.weight`: quanto il viaggiatore deforma la rete
- `NetMesh.breakStress`: tensione considerata "100%"
