// valdrada/main.js
// ---------------------------------------------------------------
// Pagina di prova di VALDRADA (valdrada.html): la seconda città da sola, senza
// Ottavia e senza il sogno. Nell'esperienza completa la città la costruisce
// src/main.js con lo stesso modulo (Valdrada.js).
// ---------------------------------------------------------------
import * as THREE from 'three';
import { createValdrada } from './Valdrada.js';
import { FollowCamera } from '../player/FollowCamera.js';
import { Narrator } from '../ui/Narrator.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const followCam = new FollowCamera(camera, renderer.domElement);
const narrator = new Narrator();
const valdrada = createValdrada({ renderer, camera, followCam, narrator });
valdrada.placeCamera();
valdrada.story.start();
const hintEl = document.getElementById('hint');
let lastHint = '';

// R = ricomincia
addEventListener('keydown', (e) => { if (e.code === 'KeyR') valdrada.reset(); });

window.valdrada = { ...valdrada, followCam, camera, renderer, narrator };

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  valdrada.update(dt);
  followCam.update(dt, valdrada.player.position);
  const hint = narrator.busy ? '' : (valdrada.story.hint || '');
  if (hintEl && hint !== lastHint) { hintEl.innerHTML = hint; hintEl.style.display = hint ? 'block' : 'none'; lastHint = hint; }
  valdrada.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
