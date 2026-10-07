// Atmosphere.js
// ---------------------------------------------------------------
// Il clima di Valdrada: TARDO POMERIGGIO NEBBIOSO, toni del blu e del grigio.
//   - cielo: una sfera con uno shader a gradiente (azzurro-grigio in alto, perla
//     all'orizzonte) e un sole basso, velato, che è solo un alone caldo nella nebbia
//   - nebbia esponenziale blu-grigia: le cose lontane si sciolgono nel cielo
//   - colline e monti a strati, come in un paesaggio a inchiostro: sagome piatte
//     sempre più chiare man mano che si allontanano
//   - bande di nebbia bassa che scivolano piano sopra il lago
//   - luci: emisferica fredda + un sole basso e debole, caldo
// ---------------------------------------------------------------
import * as THREE from 'three';
import { mistTexture } from './vtextures.js';

export const FOG_COLOR = new THREE.Color('#87929e'); // grigio-blu, cupo
export const SUN_DIR = new THREE.Vector3(-0.78, 0.16, 0.6).normalize();

export function buildAtmosphere(scene) {
  scene.background = FOG_COLOR.clone();
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.016);

  // --- cielo
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 sun; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 zenith = vec3(0.25, 0.30, 0.38), horizon = vec3(0.53, 0.57, 0.62), below = vec3(0.48, 0.52, 0.57);
        vec3 c = mix(horizon, zenith, smoothstep(0.02, 0.6, h));
        c = mix(below, c, smoothstep(-0.2, 0.02, h));
        float s = max(dot(normalize(vDir), sun), 0.0);
        c += vec3(1.0, 0.82, 0.62) * (pow(s, 6.0) * 0.12 + pow(s, 60.0) * 0.22 + pow(s, 900.0) * 0.35); // sole velato, appena un alone // alone e disco velato
        // velature di nubi orizzontali
        float band = sin(vDir.y * 40.0 + vDir.x * 3.0) * 0.5 + 0.5;
        c = mix(c, horizon * 1.05, band * 0.06 * smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.25, 0.6, h)));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(sky);

  // --- luci
  const hemi = new THREE.HemisphereLight('#aab6c3', '#3a4038', 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#f3d2b0', 0.75);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#8fa3bd', 0.35); // controluce fredda dal lago
  fill.position.set(0.4, 0.5, -1).multiplyScalar(100);
  scene.add(fill);

  // --- monti a strati (sagome piatte, ognuna più chiara e lontana)
  const layers = [
    { r: 150, h: 26, color: '#56657a', seed: 1 },
    { r: 230, h: 48, color: '#6f7d8f', seed: 2 },
    { r: 330, h: 80, color: '#8692a2', seed: 3 },
    { r: 470, h: 120, color: '#97a2b0', seed: 4 },
  ];
  for (const L of layers) {
    const seg = 220, pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = Math.sin(a * 3 + L.seed) * 0.35 + Math.sin(a * 7 + L.seed * 2.3) * 0.25 + Math.sin(a * 17 + L.seed * 5.1) * 0.12 + Math.sin(a * 31 + L.seed) * 0.05;
      const top = L.h * (0.55 + 0.45 * n);
      const x = Math.sin(a) * L.r, z = Math.cos(a) * L.r;
      pos.push(x, -2, z, x, Math.max(2, top), z);
      if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: L.color, side: THREE.DoubleSide, fog: true }));
    scene.add(m);
  }

  // --- bande di nebbia bassa sul lago
  const mistTex = mistTexture();
  const mists = [];
  const mistMat = new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.42, color: '#d9dfe5', fog: true });
  for (let k = 0; k < 22; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mistMat);
    // lontano dal pontile e dalle case: la nebbia non deve coprire il riflesso del villaggio
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 90;
    const s = 24 + Math.random() * 40;
    m.scale.set(s, s * 0.45, 1);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * Math.PI;
    m.position.set(Math.sin(a) * r, 0.3 + Math.random() * 1.6, Math.cos(a) * r);
    m.renderOrder = 2;
    scene.add(m); mists.push({ m, speed: 0.15 + Math.random() * 0.35, a, r });
  }

  // --- gabbiani: piccoli modelli gerarchici (corpo → ali → punte), che girano
  // larghi sopra il lago battendo le ali ogni tanto e poi planando
  const gullMat = new THREE.MeshStandardMaterial({ color: '#d9dee3', roughness: 0.9, side: THREE.DoubleSide });
  const tipMat = new THREE.MeshStandardMaterial({ color: '#4a525b', roughness: 0.9, side: THREE.DoubleSide });
  const gulls = [];
  for (let k = 0; k < 7; k++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 6), gullMat); body.rotation.x = Math.PI / 2; g.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group(); shoulder.position.x = s * 0.05; g.add(shoulder);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.2), gullMat); inner.rotation.x = -Math.PI / 2; inner.position.x = s * 0.22; shoulder.add(inner);
      const elbow = new THREE.Group(); elbow.position.x = s * 0.45; shoulder.add(elbow);
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), tipMat); outer.rotation.x = -Math.PI / 2; outer.position.x = s * 0.2; elbow.add(outer);
      wings.push({ shoulder, elbow, s });
    }
    g.scale.setScalar(1.6);
    scene.add(g);
    gulls.push({ g, wings, r: 20 + Math.random() * 40, h: 12 + Math.random() * 16, w: (0.08 + Math.random() * 0.06) * (Math.random() < 0.5 ? -1 : 1), a: Math.random() * 6.28, ph: Math.random() * 6.28, cx: (Math.random() - 0.5) * 30, cz: -10 - Math.random() * 20 });
  }
  let time = 0;

  return {
    sun,
    update(dt) {
      time += dt;
      for (const b of gulls) {
        b.a += b.w * dt;
        b.g.position.set(b.cx + Math.sin(b.a) * b.r, b.h + Math.sin(time * 0.3 + b.ph) * 1.5, b.cz + Math.cos(b.a) * b.r);
        b.g.rotation.y = b.a + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2);
        b.g.rotation.z = (b.w > 0 ? -1 : 1) * 0.25; // inclinato in virata
        const flap = Math.max(0, Math.sin(time * 0.5 + b.ph)) > 0.6 ? Math.sin(time * 9 + b.ph) : 0.12; // batte, poi plana
        for (const w of b.wings) { w.shoulder.rotation.z = w.s * flap * 0.55; w.elbow.rotation.z = w.s * flap * 0.35; }
      }
      for (const it of mists) {
        it.m.position.x += it.speed * dt;
        if (it.m.position.x > 120) it.m.position.x = -120;
        it.m.visible = Math.hypot(it.m.position.x, it.m.position.z) > 30; // mai davanti al villaggio
      }
    },
  };
}
