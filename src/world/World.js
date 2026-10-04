// World.js
// ---------------------------------------------------------------
// L'ambiente di Ottavia al TRAMONTO: il burrone tra due creste verdi.
//
//   CIELO      una sfera enorme con uno shader: sfumatura dal blu-viola in alto
//              all'arancio-oro all'orizzonte, il sole basso con il suo alone
//   COLLINE    le due creste sono "heightfield": un piano suddiviso in cui ogni
//              vertice viene alzato con un rumore frattale (fBm) → colline morbide.
//              Vicino alla rete c'è un pianoro piatto (lì cammina il viaggiatore).
//              Colori per vertice: prati, boschi più scuri, roccia dove è ripido.
//   PARETI     pareti lisce con grandi costoloni morbidi, dall'arenaria calda in
//              alto al viola-grigio in basso (semplici e leggibili)
//   FONDO      una valle verde con un fiume che scorre (texture animata) e alberi
//   NEBBIA     FogExp2 calda: le cose lontane sfumano nel colore del tramonto
//   ORIZZONTE  un anello di montagne lontane, azzurro-viola per la distanza
//   ALBERI     InstancedMesh: centinaia di alberi in due sole chiamate di disegno
//
// Tutto è procedurale (niente file da caricare). L'animazione del fiume
// usano onBeforeRender dei loro mesh, così non serve toccare main.js.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { rockNormal, grassNormal } from '../hanging/textures.js';

// ---- rumore: value noise 2D liscio + fBm (somma di ottave) ----
function makeNoise(seed = 1) {
  const hash = (x, y) => {
    let h = x * 374761393 + y * 668265263 + seed * 2147483647;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 0.5, f = 1;
    for (let k = 0; k < oct; k++) { s += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return s / (1 - Math.pow(0.5, oct)); // 0..1
  };
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// palette del tramonto
const SKY_TOP = new THREE.Color('#2c3566'), SKY_MID = new THREE.Color('#c96a5a'), SKY_HOR = new THREE.Color('#f5b26b');
const FOG = new THREE.Color('#d99a7c');
const START_D = 34; // distanza della partenza dal bordo del burrone (m)
const SUN_DIR = new THREE.Vector3(-0.55, 0.16, -0.82).normalize(); // il sole basso alle spalle di chi entra nella rete

export function buildWorld(scene, { netLength, netWidth }) {
  const L = netLength;
  const nNorth = makeNoise(3), nSouth = makeNoise(7), nWall = makeNoise(11), nCol = makeNoise(5);

  scene.background = SKY_HOR.clone();
  scene.fog = new THREE.FogExp2(FOG, 0.0065);

  // ---------------- LUCI ----------------
  scene.add(new THREE.HemisphereLight('#f2d2bc', '#40405a', 0.9));
  const sun = new THREE.DirectionalLight('#ffc192', 1.9);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#8a9cff', 0.35); // un po' di luce fredda dal cielo opposto
  fill.position.set(30, 40, 60);
  scene.add(fill);

  // ---------------- CIELO ----------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: SKY_TOP }, mid: { value: SKY_MID }, hor: { value: SKY_HOR }, sunDir: { value: SUN_DIR } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top, mid, hor, sunDir; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          float s = max(dot(vDir, sunDir), 0.0);
          // sfumatura verticale, più calda dalla parte del sole
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.15, 0.7, h));
          c = mix(c, hor * 1.1, pow(s, 6.0) * (1.0 - smoothstep(0.0, 0.5, h)));
          // il sole: disco + alone
          c += vec3(1.0, 0.75, 0.45) * (pow(s, 900.0) * 2.5 + pow(s, 40.0) * 0.35);
          // sotto l'orizzonte: lo stesso colore della nebbia
          c = mix(c, vec3(0.85, 0.6, 0.49), smoothstep(0.0, -0.08, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  // ---------------- COLLINE (le due creste) ----------------
  // altezza del terreno: 0 sul pianoro vicino alla rete, poi colline e montagne morbide
  const plateau = (x, d) => smoothstep(0, 1, Math.max((Math.abs(x) - 24) / 14, (d - 12) / 18)); // 0 = pianoro
  const heightAt = (x, z) => {
    const north = z <= L / 2;
    const d = north ? -z : z - L; // distanza dal bordo del burrone verso l'esterno
    if (d < 0) return 0;
    const n = north ? nNorth : nSouth;
    const hills = 4 + 14 * n(x * 0.018, d * 0.018) + 6 * n(x * 0.06 + 9, d * 0.06);
    const mountains = smoothstep(40, 160, d) * 70 * n(x * 0.006 + 3, d * 0.006 + 5, 3);
    const h = plateau(x, d) * (hills + mountains);
    if (!north) return h;
    // IL DOSSO DELL'ARRIVO: sulla cresta nord, dietro al pianoro, il terreno sale in un dosso
    // morbido (5 m, a 22 m dal bordo) e poi scende in una conca dove parte il viaggiatore
    // (START_D). Dalla conca il burrone e la rete non si vedono: si scoprono superando il dosso.
    const m = Math.exp(-((x / 20) ** 2)) * smoothstep(9, 14, d) * (1 - smoothstep(48, 64, d));
    const shape = 5.2 * Math.exp(-(((d - 22) / 5.5) ** 2)) + 3.0 * smoothstep(27, 34, d) + 0.12 * Math.max(0, d - 34);
    return h * (1 - m) + shape * m;
  };
  const GRASS = [new THREE.Color('#6a9e45'), new THREE.Color('#86b850'), new THREE.Color('#a9c45e')];
  const FOREST = new THREE.Color('#3f6a2e'), ROCK = new THREE.Color('#7d756a'), PATH = new THREE.Color('#9c8a6a');
  const colorTerrain = (geo, x0) => {
    geo.computeVertexNormals();
    const pos = geo.attributes.position, nor = geo.attributes.normal, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const n = nCol(x * 0.05, z * 0.05);
      c.copy(GRASS[0]).lerp(GRASS[1], n).lerp(GRASS[2], smoothstep(0.65, 0.9, nCol(x * 0.13 + 4, z * 0.13)));
      c.lerp(FOREST, smoothstep(0.55, 0.7, nCol(x * 0.03 + 7, z * 0.03 + 2)) * 0.8);   // macchie di bosco
      c.lerp(ROCK, smoothstep(0.62, 0.42, nor.getY(k)) * 0.8);                         // roccia solo dove è molto ripido
      if (y < 0.05 && Math.abs(x) < 6) c.lerp(PATH, 0.6);                              // sentiero verso la rete
      cols.set([c.r, c.g, c.b], k * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  };
  // colori per vertice + una normal map leggera ripetuta (gobbe dell'erba)
  const grassN = grassNormal(); grassN.repeat.set(900 / 5, 450 / 5);
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, normalMap: grassN, normalScale: new THREE.Vector2(0.4, 0.4) });
  const ridges = [];
  for (const north of [true, false]) {
    const SIZE_X = 900, DEPTH = 450, SX = 220, SZ = 120;
    const geo = new THREE.PlaneGeometry(SIZE_X, DEPTH, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      // distanza dal bordo del burrone verso l'esterno (0..DEPTH), senza specchiare la griglia
      // (specchiarla invertirebbe il verso dei triangoli e la faccia visibile finirebbe sotto)
      const x = pos.getX(k), z = north ? pos.getZ(k) - DEPTH / 2 : L + DEPTH / 2 + pos.getZ(k);
      pos.setXYZ(k, x, heightAt(x, z), z);
    }
    colorTerrain(geo);
    const mesh = new THREE.Mesh(geo, terrainMat);
    scene.add(mesh); ridges.push(mesh);
  }

  // ---------------- PARETI DEL BURRONE ----------------
  // Semplici ma leggibili: una parete liscia che si inclina un po' verso il centro
  // scendendo, con grandi "costoloni" verticali morbidi (come pieghe della roccia).
  // Il colore va dall'arenaria calda in alto (presa dal sole) al viola-grigio in basso,
  // con due o tre fasce appena accennate. Solo il bordo in alto è verde (l'erba che
  // sporge) e il piede della parete, dove inizia la valle.
  // I primi metri sotto il bordo restano dritti: lì sono legate le funi d'ancoraggio.
  const WALL_D = 90;
  const WALL_TOP = new THREE.Color('#d2a982'), WALL_MID = new THREE.Color('#b08670'), WALL_LOW = new THREE.Color('#6f6272');
  const GRASS_LIP = new THREE.Color('#6f9a48');
  const wallOffset = (x, d) => {
    const k = smoothstep(5, 16, d);
    const ribs = Math.sin(x * 0.22 + 3 * nWall(x * 0.02, 1.7)) * 1.4;     // costoloni verticali
    const bulge = (nWall(x * 0.012, d * 0.012 + 4) - 0.5) * 6;              // grandi rientranze e sporgenze
    return 0.07 * d + k * (ribs + bulge);
  };
  // rilievo della roccia: normal map ripetuta ogni 14 m (bozze e crepe lungo gli strati)
  const rockN = rockNormal(); rockN.repeat.set(900 / 14, WALL_D / 14);
  for (const north of [true, false]) {
    const geo = new THREE.PlaneGeometry(900, WALL_D, 220, 36); // stessa suddivisione in x delle colline: i bordi combaciano
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), d = WALL_D / 2 - pos.getY(k); // 0 in alto … WALL_D in basso
      const top = heightAt(x, north ? -0.01 : L + 0.01);
      const off = wallOffset(x, d);
      // la fila più alta coincide esattamente con il bordo della collina (stessa griglia in x): niente fessure
      pos.setXYZ(k, x, top - d, north ? off : L - off);
      const f = d / WALL_D;
      c.copy(WALL_TOP).lerp(WALL_MID, smoothstep(0.05, 0.45, f)).lerp(WALL_LOW, smoothstep(0.4, 0.95, f));
      c.multiplyScalar(1 + 0.07 * Math.sin(d * 0.35 + nWall(x * 0.01, 2) * 4));          // fasce appena accennate
      c.multiplyScalar(0.88 + 0.22 * (0.5 + 0.5 * Math.sin(x * 0.22 + 3 * nWall(x * 0.02, 1.7))));      // i costoloni prendono più luce
      c.lerp(GRASS_LIP, 1 - smoothstep(0.4, 1.6, d));                                     // l'erba sul bordo
      c.lerp(GRASS_LIP, smoothstep(WALL_D - 10, WALL_D - 2, d) * 0.7);                    // e al piede
      cols.set([c.r, c.g, c.b], k * 3);
    }
    if (!north) { // giro le facce verso il burrone
      const idx = geo.index.array;
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k]; idx[k] = idx[k + 2]; idx[k + 2] = t; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, normalMap: rockN })));
  }

  // ---------------- FONDO: valle, fiume, alberi ----------------
  const FLOOR_Y = -WALL_D + 4;
  const floorGeo = new THREE.PlaneGeometry(900, 40, 260, 20);
  floorGeo.rotateX(-Math.PI / 2);
  {
    const pos = floorGeo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k) + L / 2;
      const rz = L / 2 + Math.sin(x * 0.025) * 2.5;             // dove passa il fiume
      const bank = Math.min(1, Math.abs(z - rz) / 4);
      pos.setXYZ(k, x, FLOOR_Y + bank * 2.5 + nCol(x * 0.08, z * 0.08) * 2, z);
    }
    colorTerrain(floorGeo);
  }
  scene.add(new THREE.Mesh(floorGeo, terrainMat));
  // il fiume: un nastro che segue la curva, con una texture a increspature che scorre
  const waterTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#3f6f7a'; g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(255,${190 + Math.random() * 50},${140 + Math.random() * 60},${0.15 + Math.random() * 0.35})`; g.fillRect(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 18, 1.5); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  {
    const pts = [], W = 2.2, N = 260, verts = [], uvs = [], idx = [];
    for (let k = 0; k <= N; k++) { const x = -450 + (900 * k) / N; pts.push([x, L / 2 + Math.sin(x * 0.025) * 2.5]); }
    pts.forEach(([x, z], k) => {
      const [x2, z2] = pts[Math.min(N, k + 1)], [x1, z1] = pts[Math.max(0, k - 1)];
      const tx = x2 - x1, tz = z2 - z1, l = Math.hypot(tx, tz), nx = -tz / l, nz = tx / l;
      verts.push(x + nx * W, FLOOR_Y + 0.4, z + nz * W, x - nx * W, FLOOR_Y + 0.4, z - nz * W);
      uvs.push(k * 0.5, 0, k * 0.5, 1);
      if (k < N) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const river = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.25, metalness: 0.3, emissive: '#5a3a30', emissiveIntensity: 0.4, side: THREE.DoubleSide }));
    river.onBeforeRender = () => { waterTex.offset.x = -performance.now() * 0.00012; };
    scene.add(river);
  }

  // ---------------- ALBERI (istanziati) ----------------
  const trees = [];
  const addTree = (x, y, z, s) => trees.push([x, y, z, s]);
  let rs = 12345; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 1400 && trees.length < 650; k++) { // sulle creste, lontano dal pianoro
    const north = rnd() < 0.5, x = (rnd() - 0.5) * 500, d = 4 + rnd() * 180, z = north ? -d : L + d;
    if (Math.abs(x) < 30 && d < 22) continue;
    if (north && Math.abs(x) < 14 && d < 50) continue; // la conca e il dosso dell'arrivo restano sgombri
    if (nCol(x * 0.03 + 7, z * 0.03 + 2) < 0.5 && rnd() < 0.85) continue; // più fitti dove c'è il bosco
    addTree(x, heightAt(x, z), z, 1 + rnd() * 1.4);
  }
  for (let k = 0; k < 260; k++) { // sul fondo, lungo il fiume
    const x = (rnd() - 0.5) * 400, rz = L / 2 + Math.sin(x * 0.025) * 2.5, side = rnd() < 0.5 ? -1 : 1, z = rz + side * (3.5 + rnd() * 3.5);
    addTree(x, FLOOR_Y + 2.5, z, 1.2 + rnd() * 1.5);
  }
  const foliageGeo = new THREE.ConeGeometry(1.2, 3.6, 7); foliageGeo.translate(0, 3.2, 0);
  const roundGeo = new THREE.IcosahedronGeometry(1.5, 0); roundGeo.translate(0, 3.0, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.6, 5); trunkGeo.translate(0, 0.8, 0);
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const pines = new THREE.InstancedMesh(foliageGeo, leafMat, trees.length);
  const rounds = new THREE.InstancedMesh(roundGeo, leafMat, trees.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 1 }), trees.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  let np = 0, nr = 0;
  trees.forEach(([x, y, z, s], k) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6);
    m.compose(p.set(x, y - 0.2, z), q, sc.set(s, s * (0.9 + rnd() * 0.4), s));
    trunks.setMatrixAt(k, m);
    col.setHSL(0.24 + rnd() * 0.08, 0.45 + rnd() * 0.2, 0.22 + rnd() * 0.12);
    if (rnd() < 0.55) { pines.setMatrixAt(np, m); pines.setColorAt(np++, col); } else { rounds.setMatrixAt(nr, m); rounds.setColorAt(nr++, col.offsetHSL(0.02, 0, 0.04)); }
  });
  pines.count = np; rounds.count = nr;
  scene.add(pines, rounds, trunks);

  // ---------------- MASSI sul pianoro ----------------
  const boulderGeo = new THREE.IcosahedronGeometry(1, 1);
  const boulderMat = new THREE.MeshStandardMaterial({ color: '#8a8275', roughness: 1, flatShading: true });
  for (let k = 0; k < 14; k++) {
    const north = k % 2 === 0, x = (rnd() < 0.5 ? -1 : 1) * (netWidth / 2 + 3 + rnd() * 10), d = 4 + rnd() * 10;
    const s = 0.6 + rnd() * 1.8;
    const b = new THREE.Mesh(boulderGeo, boulderMat);
    b.scale.set(s * (1 + rnd() * 0.5), s * 0.7, s); b.rotation.set(rnd(), rnd() * 6, rnd());
    b.position.set(x, -0.35 * s, north ? -d : L + d);
    scene.add(b);
  }

  // ---------------- ORIZZONTE: montagne lontane ----------------
  {
    const N = 160, R = 620, verts = [], idx = [], cols = [];
    const nH = makeNoise(21), far = new THREE.Color('#7b6f9a'), farTop = new THREE.Color('#b08aa0');
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2, h = 30 + 110 * nH(k * 0.09, 0.5, 5);
      const x = Math.cos(a) * R, z = L / 2 + Math.sin(a) * R;
      verts.push(x, -60, z, x, h, z);
      cols.push(far.r, far.g, far.b, farTop.r, farTop.g, farTop.b);
      if (k < N) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })));
  }

  // Altezza del terreno sulle creste (per il personaggio): null = vuoto
  return {
    // il punto di partenza, nella conca dietro al dosso (vedi heightAt)
    startPoint: new THREE.Vector3(0, heightAt(0, -START_D), -START_D),
    groundHeightAt(x, z) {
      if (Math.abs(x) > 440) return null;
      if (z <= 0 && z > -440) return heightAt(x, z);
      if (z >= L && z < L + 440) return heightAt(x, z);
      return null;
    },
  };
}
