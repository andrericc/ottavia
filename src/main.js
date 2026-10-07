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
import { applyDetailMaps } from './hanging/textures.js';
import { Player } from './player/Player.js';
import { NotePost } from './world/NotePost.js';
import { Narrator } from './ui/Narrator.js';
import { Journal } from './ui/Journal.js';
import { InteractionManager } from './interaction/InteractionManager.js';
import { Story } from './story/Story.js';
import { Wind } from './world/Wind.js';
import { TEXTS } from './story/texts.js';
import { FollowCamera } from './player/FollowCamera.js';
import { Dream } from './world/Dream.js';
import { Transition } from './world/Transition.js';
import { createValdrada, START_FACING as VALDRADA_FACING } from './valdrada/Valdrada.js';

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
applyDetailMaps(scene);                      // normal e roughness map su tutti i materiali con texture procedurali
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
// view.mode: 'world' = Ottavia · 'dream' = il sogno · 'blend' = passaggio nella nebbia (view.t: 0 sogno → 1 Ottavia)
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
// ---------------------------------------------------------------
// LA CORNICE COMPLETA, con l'ordine fisso:
//   sogno → Ottavia → sogno → Valdrada → sogno → fine
// Ottavia è la città di partenza (sopra). Finita Ottavia, Story.ending torna nel sogno
// e chiama story.onFinished: qui il Khan chiede un'altra città, si costruisce Valdrada
// e la nebbia porta là. Finita Valdrada (story.onEnd) si torna nel sogno per l'ultima volta.
// Con ?valdrada nell'indirizzo (o aprendo valdrada.html) si salta Ottavia e si parte dal sogno
// prima di Valdrada.
// ---------------------------------------------------------------
let city = 'ottavia';        // la città attiva: 'ottavia' | 'valdrada'
let valdrada = null;         // costruita solo quando serve
let playing = true;          // false mentre si è nel sogno o nella nebbia (solo per Valdrada)
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// inquadratura del sogno: di tre quarti, sopra la spalla, il viaggiatore e il Khan insieme
function dreamCamera(facing, pos) {
  followCam.focusFn = null; followCam.goal = null;
  followCam.yaw = facing + Math.PI - 0.5; followCam.pitch = 0.28; followCam.distance = 6.0;
  followCam.target.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
}

// passaggio nella nebbia con un'azione a metà, quando lo schermo è tutto coperto
async function fog(from, to, atMiddle) {
  view.mode = 'blend'; view.t = from;
  const mid = 0.5;
  await story.tween(2.25, (e) => { view.t = from + (mid - from) * e; });
  atMiddle?.();
  await story.tween(2.25, (e) => { view.t = mid + (to - mid) * e; });
  view.mode = to >= 1 ? 'world' : 'dream';
}

async function toValdrada() {
  playing = false;
  interactions.hide();
  // costruire la città richiede un attimo: lo facciamo mentre il sogno è fermo
  await nextFrame();
  valdrada = createValdrada({ renderer, camera, followCam, narrator });
  city = 'valdrada';
  scene.add(player.object);   // il viaggiatore di Ottavia torna nella sua scena (non resta nel sogno)
  const vp = valdrada.player;
  hudEl.innerHTML = '<b>WASD</b> move · <b>E</b> interact · <b>J</b> journal · <b>Mouse</b> (hold) camera · <b>Wheel</b> zoom · <b>R</b> restart';
  // il sogno riappare intorno al viaggiatore, già in punta al pontile di Valdrada
  dream.setAnchor(vp.position, VALDRADA_FACING);
  dreamCamera(VALDRADA_FACING, vp.position);
  view.mode = 'dream';
  await story.dialogue(TEXTS.dreamValdrada);
  await narrator.card(TEXTS.valdradaIntro);
  // "Its name is Valdrada." → la nebbia sale e scopre il lago
  await fog(0, 1, () => { valdrada.placeCamera(); followCam.target.copy(vp.position).add(new THREE.Vector3(0, 1.2, 0)); });
  playing = true;
  valdrada.story.onEnd = backToDream;
  valdrada.story.start();
}

async function backToDream() {
  playing = false;
  const vp = valdrada.player;
  await new Promise((r) => setTimeout(r, 1200));
  dream.setAnchor(vp.position, vp.facing);
  // a metà nebbia il viaggiatore torna com'era (a Valdrada era svanito): nel sogno c'è di nuovo Marco
  await fog(1, 0, () => { valdrada.story.restoreTraveler(); dreamCamera(vp.facing, vp.position); });
  await story.dialogue(TEXTS.dreamFinal);
  await narrator.card(TEXTS.theEnd);
}

story.onFinished = toValdrada;

// apertura (aggiungi ?skip all'indirizzo per saltarla mentre sviluppate)
// (anche valdrada.html parte così: Valdrada dal sogno, e alla fine di nuovo il sogno)
if (new URLSearchParams(location.search).has('valdrada') || /valdrada\.html$/.test(location.pathname)) { view.mode = 'dream'; toValdrada(); }
else if (!SKIP) story.intro();

// R = ricomincia: rete integra, traversine al loro posto, viaggiatore sulla cresta
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR') return;
  if (city === 'valdrada') { if (playing) valdrada.reset(); return; }
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
window.ottavia = { net, player, walkway, debris, followCam, hanging, narrator, journal, interactions, story, wind, dream, view,
  get city() { return city; }, get valdrada() { return valdrada; }, camera, renderer };

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

function updateOttavia(dt, now) {
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
  if (tensionEl) tensionEl.textContent = Math.round(netMesh.tension * 100) + '%';
  hudEl.style.opacity = narrator.busy || journal.isOpen ? 0 : 1; // mentre si legge, l'HUD si fa da parte
  showHint(narrator.busy ? '' : (story.hint || player.hint));
}

function updateValdrada(dt) {
  const live = playing && view.mode === 'world';
  valdrada.update(dt, live);
  if (journal.isOpen) valdrada.player.frozen = true;
  story.update(dt);   // la storia di Ottavia fa avanzare le transizioni (tween) della cornice
  followCam.update(dt, valdrada.player.position);
  hudEl.style.opacity = !live || narrator.busy || journal.isOpen ? 0 : 1;
  showHint(!live || narrator.busy ? '' : (valdrada.story.hint || ''));
}

function showHint(hint) {
  if (hint !== lastHint) { hintEl.innerHTML = hint; hintEl.style.display = hint ? 'block' : 'none'; lastHint = hint; }
}

function frame(now) {
  // tra 0 e 0,1 s: se la tab era in pausa non esplodiamo, e dopo un lavoro lungo (la costruzione
  // di Valdrada) il tempo del frame può risultare indietro: mai un passo negativo
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
  last = now;

  if (city === 'ottavia') updateOttavia(dt, now);
  else updateValdrada(dt);
  dream.update(dt);

  // la città attiva e il suo viaggiatore (che nel sogno e nella nebbia va spostato di scena)
  const active = city === 'ottavia' ? scene : valdrada.scene;
  const traveler = city === 'ottavia' ? player.object : valdrada.player.object;
  if (view.mode === 'world') {
    active.add(traveler);
    if (city === 'ottavia') renderer.render(scene, camera);
    else valdrada.render();
  } else if (view.mode === 'dream') {
    dream.scene.add(traveler);
    renderer.render(dream.scene, camera);
  } else {
    const prepare = city === 'valdrada' ? (sc) => { if (sc === valdrada.scene) valdrada.prepare(); } : null;
    transition.render(dream.scene, active, camera, view.t, traveler, now / 1000, prepare);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
