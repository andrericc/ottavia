// valdrada/lab.js — pagina di prova delle CASE del villaggio (valdrada-case.html)
// ---------------------------------------------------------------
// Tre case sulla passerella, davanti a una riva DRITTA con il bosco ripido dietro,
// nell'atmosfera di Valdrada e con il lago-specchio. Si guarda con il mouse
// (trascina per ruotare, rotella per lo zoom). Serve a decidere lo stile prima di
// costruire tutto il villaggio.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { buildAtmosphere } from './Atmosphere.js';
import { MirrorWater } from './MirrorWater.js';
import { waterNormal } from './vtextures.js';
import { makeHouseKit, Smoke, box } from './VillageHouse.js';
import { FollowCamera } from '../player/FollowCamera.js';
import { applyDetailMaps, rng } from '../hanging/textures.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const atmosphere = buildAtmosphere(scene);
const water = new MirrorWater({ normalMap: waterNormal(), height: 0, color: '#1f2a31' });
scene.add(water.mesh);

const BW = 1.0;
const kit = makeHouseKit(7), M = kit.materials, R = rng(3);
const root = new THREE.Group(); scene.add(root);

// --- le tre case
const houses = [
  { h: kit.casaStorta(), x: -10, z: 2.3 },
  { h: kit.casaTorre(), x: -1.2, z: 2.3 },
  { h: kit.casaLunga(), x: 9, z: 0 },
];
for (const H of houses) { H.h.group.position.set(H.x, BW, H.z); root.add(H.h.group); }

// --- la passerella davanti (z 2,4 … 4,6), con il parapetto sul lago e i pali
add(box(36, 0.14, 2.2), M.deck, 0, BW - 0.07, 3.5);
for (let x = -17.5; x <= 17.5; x += 2.5) for (const z of [2.5, 4.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), M.post); p.position.set(x, BW - 2.5, z); root.add(p); }
kit.railing(root, new THREE.Vector3(-18, BW, 4.5), new THREE.Vector3(18, BW, 4.5));
function add(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); root.add(m); return m; }

// --- la riva dritta e il bosco ripido alle spalle (niente case: il villaggio è solo sull'acqua)
{
  const W = 400, D = 160, NX = 120, NZ = 60, pos = [], col = [], idx = [], c = new THREE.Color();
  const hAt = (x, z) => { // z negativo = verso terra
    const t = -z;
    const bank = THREE.MathUtils.lerp(-1.5, 1.2, THREE.MathUtils.smoothstep(t, 5, 9));
    const n = Math.sin(x * 0.07) * 2 + Math.sin(x * 0.19 + 1) * 1 + Math.sin(x * 0.031) * 4;
    return bank + 46 * THREE.MathUtils.smoothstep(t, 9, 80) + n * THREE.MathUtils.smoothstep(t, 12, 40);
  };
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = -W / 2 + W * i / NX, z = -2 - D * Math.pow(j / NZ, 1.4), h = hAt(x, z);
    pos.push(x, h, z);
    c.set('#2f3a2c').lerp(new THREE.Color('#3f4b3a'), 0.5 + 0.5 * Math.sin(x * 0.3 + z * 0.2));
    c.lerp(new THREE.Color('#4a4a44'), 1 - THREE.MathUtils.smoothstep(h, -0.5, 1.0));
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + NX + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  // abeti: due coni sovrapposti, scuri; qualche albero tondo vicino alla riva
  const N = 900, cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: '#33402f', roughness: 1, flatShading: true }), N * 2);
  const Mt = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const x = (R() - 0.5) * 300, z = -9 - Math.pow(R(), 1.3) * 110, h = hAt(x, z), s = 1.4 + R() * 1.2, hh = 6 + R() * 6;
    Mt.compose(P.set(x, h + hh * 0.45, z), Q, S.set(s, hh * 0.65, s)); cones.setMatrixAt(i * 2, Mt);
    Mt.compose(P.set(x, h + hh * 0.85, z), Q, S.set(s * 0.7, hh * 0.45, s * 0.7)); cones.setMatrixAt(i * 2 + 1, Mt);
  }
  scene.add(cones);
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 1, 4), new THREE.MeshStandardMaterial({ color: '#6c7552', roughness: 1 }), 500);
  for (let i = 0; i < 500; i++) {
    const x = (R() - 0.5) * 120, z = -3.5 - R() * 4, hh = 1 + R() * 1.4;
    if (Math.abs(x) < 19 && z > -6) { i--; continue; }
    Mt.compose(P.set(x, hh / 2 - 0.3, z), Q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3)), S.set(1, hh, 1)); reeds.setMatrixAt(i, Mt);
  }
  scene.add(reeds);
}

applyDetailMaps(root);
// fumo dai camini
root.updateMatrixWorld(true);
const smoke = new Smoke(scene);
for (const H of houses) for (const c of H.h.chimneys) smoke.add(c.obj.localToWorld(c.p.clone()));

// --- camera libera attorno al gruppo
const followCam = new FollowCamera(camera, renderer.domElement);
followCam.yaw = 0.05; followCam.pitch = 0.1; followCam.distance = 26;
const target = new THREE.Vector3(0, 3.2, 0);
window.lab = { scene, followCam, target, houses, camera };

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  followCam.update(dt, target);
  atmosphere.update(dt);
  smoke.update(dt);
  water.render(renderer, scene, camera, now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
