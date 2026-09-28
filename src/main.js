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
import { Player } from './player/Player.js';
import { FollowCamera } from './player/FollowCamera.js';

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

const netMesh = new NetMesh(net);
scene.add(netMesh.object);

// --- Le traversine: una passerella centrale larga 4 m, con alcune assi mancanti
const walkway = new Walkway(net, { fromCol: 10, toCol: 14, missing: [9, 17, 27] });
scene.add(walkway.object);

// --- Mondo, viaggiatore, camera
const world = buildWorld(scene, { netLength, netWidth });
const player = new Player({ net, world, walkway, start: new THREE.Vector3(0, 0, -3) });
scene.add(player.object);
const followCam = new FollowCamera(camera, renderer.domElement);

// Utile per il debug: nella console del browser puoi scrivere ottavia.player.state
window.ottavia = { net, player, walkway };

// --- HUD
const tensionEl = document.getElementById('tension');
const hintEl = document.getElementById('hint');
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
    net.step(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  netMesh.update();
  walkway.update();
  followCam.update(dt, player.position);
  tensionEl.textContent = Math.round(netMesh.tension * 100) + '%';
  const hint = player.hint;
  if (hint !== lastHint) { hintEl.innerHTML = hint; hintEl.style.display = hint ? 'block' : 'none'; lastHint = hint; }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
