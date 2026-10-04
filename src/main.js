// main.js
// ---------------------------------------------------------------
// Punto di ingresso: crea renderer, scena, rete, viaggiatore e camera,
// poi fa girare il ciclo principale.
//
// La fisica gira a passo fisso (1/120 s) indipendentemente dagli FPS:
// così la rete si comporta allo stesso modo su ogni computer.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { VerletNet } from './net/VerletNet.js';
import { NetMesh } from './net/NetMesh.js';
import { Walkway } from './net/Walkway.js';
import { buildWorld } from './world/World.js';
import { Debris } from './world/Debris.js';
import { HangingSystem } from './hanging/HangingSystem.js';
import { populateOttavia } from './hanging/layout.js';
import { Player } from './player/Player.js';
import { NotePost } from './world/NotePost.js';
import { Narrator } from './ui/Narrator.js';
import { Journal } from './ui/Journal.js';
import { InteractionManager } from './interaction/InteractionManager.js';
import { Story } from './story/Story.js';
import { Wind } from './world/Wind.js';
import { TEXTS } from './story/texts.js';
import './ui/style.css';
import { FollowCamera } from './player/FollowCamera.js';
import { Dream } from './world/Dream.js';
import { Transition } from './world/Transition.js';

// --- Renderer, scena, camera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- La rete di Ottavia
const net = new VerletNet({ cols: 25, rows: 40, spacing: 1 });
const netLength = (net.rows - 1) * net.spacing;
const netWidth = (net.cols - 1) * net.spacing;

// Facciamo "assestare" la rete prima di mostrarla, così non parte piatta
for (let i = 0; i < 600; i++) net.step(1 / 120);
net.saveState(); // lo stato di partenza, per ricominciare con R

// La zona vecchia: sotto la passerella, dalla fila 21 alla 24 (funi grigie).
// Nella storia v2 lì la rete è già STRAPPATA: le funi longitudinali tra la fila 21 e la 22
// sono spezzate, e mancano le traversine dalla 19 alla 23. Per passare bisogna scendere
// tra le case e prendere la teleferica (vedi story/Story.js).
net.weaken({ cols: [11, 13], rows: [21, 24], capacity: 1e9 });
function makeTear() {
  for (let i = 8; i <= 16; i++) net.broken[net.vRope[net.index(i, 21)]] = 1;
}
makeTear();

const netMesh = new NetMesh(net);
scene.add(netMesh.object);

// --- Le traversine: una passerella centrale larga 4 m, con alcune assi mancanti
const walkway = new Walkway(net, { fromCol: 10, toCol: 14, missing: [9, 19, 20, 21, 22, 23, 31], worn: [18, 24] });
scene.add(walkway.object);

// --- Tutto ciò che sta appeso sotto la rete (lampadari, otri, case a sacco…)
const hanging = new HangingSystem(scene, net);
const route = populateOttavia(hanging, net); // il percorso della storia: case, ponticelli, teleferica
// rete e oggetti si assestano insieme (il peso degli oggetti abbassa un po' la rete)
for (let i = 0; i < 480; i++) { hanging.applyLoads(); net.step(1 / 120); hanging.step(1 / 120); }
net.saveState();
hanging.save();

// --- Mondo, viaggiatore, camera
const world = buildWorld(scene, { netLength, netWidth });
// Partenza: nella conca sulle colline, da dove Ottavia non si vede ancora (vedi World.js).
// Con ?skip nell'indirizzo si parte invece accanto alla rete, senza il sogno (comodo per lavorare).
const SKIP = new URLSearchParams(location.search).has('skip');
const START = SKIP ? new THREE.Vector3(0, 0, -3) : world.startPoint.clone();
const player = new Player({ net, world, walkway, start: START });
scene.add(player.object);
const followCam = new FollowCamera(camera, renderer.domElement);
const debris = new Debris(scene);

// --- Narrazione e interazione
const notePost = new NotePost(new THREE.Vector3(1.7, 0, -1.4), Math.PI + 0.5);
scene.add(notePost.object);
const narrator = new Narrator();
const journal = new Journal(narrator);
const interactions = new InteractionManager(scene, player, narrator);
journal.onToggle = (open) => { interactions.blocked = open; player.frozen = open || interactions.running; };
// Il sogno (Marco Polo e Kublai Khan) e la dissolvenza verso Ottavia.
// view.mode: 'world' = Ottavia · 'dream' = il sogno · 'blend' = dissolvenza (view.t: 0 sogno → 1 Ottavia)
const dream = new Dream();
const transition = new Transition(renderer);
const view = { mode: SKIP ? 'world' : 'dream', t: 0 };
const story = new Story({ narrator, journal, interactions, player, hanging, net, camera: followCam, walkway, route, scene, notePost, dream, view });
// Raffiche di vento: solo quando si cammina sulla rete e nessun testo è aperto
const wind = new Wind({
  net, player, narrator, texts: TEXTS.thoughts,
  isActive: () => player.state === 'walk' && player.position.z > 1 && player.position.z < netLength - 1 &&
    !narrator.busy && !interactions.running && !journal.isOpen,
});
story.wind = wind;
// apertura (aggiungi ?skip all'indirizzo per saltarla mentre sviluppate)
if (!SKIP) story.intro();

// R = ricomincia: rete integra, traversine al loro posto, viaggiatore sulla cresta
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR') return;
  net.restoreState();
  makeTear();
  walkway.reset();
  debris.clear();
  hanging.reset();
  player.reset(START);
  story.reset();
  wind.reset();
});

// Quando una fune si spezza: scossone della camera e traversine che si staccano
function handleNetEvents() {
  for (const ev of net.events) {
    if (ev.type === 'break') followCam.shake(0.45);
  }
  net.events.length = 0;
  for (const { plank, matrix } of walkway.checkBroken()) {
    debris.spawn(walkway.object.geometry, matrix, plank.color, new THREE.Vector3(0, -1, 0));
    followCam.shake(0.3);
  }
}

// Utile per il debug: nella console del browser puoi scrivere ottavia.player.state
window.ottavia = { net, player, walkway, debris, followCam, hanging, narrator, journal, interactions, story, wind, dream, view };

// --- HUD
const tensionEl = document.getElementById('tension');
const hintEl = document.getElementById('hint');
const hudEl = document.getElementById('hud');
hudEl.style.transition = 'opacity .3s';
let lastHint = '';

// --- Ciclo principale
const FIXED_DT = 1 / 120;
let accumulator = 0;
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); // se la tab era in pausa non esplodiamo
  last = now;

  player.update(dt, followCam.yaw);

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    player.applyToNet();
    hanging.applyLoads();
    wind.applyToNet();
    net.step(FIXED_DT);
    hanging.step(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  handleNetEvents();
  netMesh.update(now / 1000);
  walkway.update();
  debris.update(dt);
  wind.update(dt);
  hanging.update(dt, now / 1000);
  player.postPhysics();
  notePost.update(dt);
  interactions.update(dt);
  story.update(dt);
  followCam.update(dt, player.position);
  tensionEl.textContent = Math.round(netMesh.tension * 100) + '%';
  hudEl.style.opacity = narrator.busy || journal.isOpen ? 0 : 1; // mentre si legge, l'HUD si fa da parte
  const hint = narrator.busy ? '' : (story.hint || player.hint);
  if (hint !== lastHint) { hintEl.innerHTML = hint; hintEl.style.display = hint ? 'block' : 'none'; lastHint = hint; }

  dream.update(dt);
  if (view.mode === 'world') {
    scene.add(player.object);
    renderer.render(scene, camera);
  } else if (view.mode === 'dream') {
    dream.scene.add(player.object);
    renderer.render(dream.scene, camera);
  } else {
    transition.render(dream.scene, scene, camera, view.t, player.object, now / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
