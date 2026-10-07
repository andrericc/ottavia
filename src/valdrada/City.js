// City.js
// ---------------------------------------------------------------
// VALDRADA: "Gli antichi costruirono Valdrada sulle rive d'un lago con case
// tutte verande una sopra l'altra e vie alte che affacciano sull'acqua i
// parapetti a balaustra." (Calvino)
//
// Un VILLAGGIO di legno in fila lungo una riva dritta. Le case (VillageHouse.js:
// la casa storta, la torre di verande, la casa lunga, in varianti diverse) stanno
// su palafitte sopra l'acqua; davanti corre la PASSERELLA con il parapetto sul
// lago; tra i piani alti di alcune case passano PONTICELLI di corda e tavole (le
// "vie alte"). Dietro: la riva con le canne e il bosco di abeti che sale ripido
// nella nebbia — nessuna casa sulla collina.
//
// Assi: x lungo la riva, z verso il lago (z > 0 è acqua aperta). Quota dell'acqua 0.
//   z  0 … 2,3   le facciate delle case (e i portici delle case lunghe)
//   z  2,45 … 4,35  la passerella (quota 1,0), parapetto a z = 4,5
//   x  0         il PONTILE, che entra nel lago fino a z = 17
//
// Per il viaggiatore la città espone groundHeightAt(x, z, y) e constrain(p, …).
// ---------------------------------------------------------------
import * as THREE from 'three';
import { makeHouseKit, Smoke, box } from './VillageHouse.js';
import { applyDetailMaps, rng } from '../hanging/textures.js';

export const BW_Y = 1.0;            // quota della passerella e dei piani terra
export const BW_Z0 = 2.45, BW_Z1 = 4.35, RAIL_Z = 4.5;
export const PIER_X = 0, PIER_END = 17, PIER_Y = 0.85;
export const HALF_L = 60;           // la passerella va da -60 a +60

// Le parti ferme sono centinaia di piccoli oggetti: per disegnarle in fretta (due
// volte a frame, per via del riflesso) le fondo in UNA geometria per materiale.
// Restano separate le cose che si muovono (userData.dynamic) e le InstancedMesh.
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(), done = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry.attributes.color) return;
    for (let p = o; p; p = p.parent) if (p.userData.dynamic) return;
    done.push(o);
  });
  for (const o of done) {
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    // una casa specchiata (scala x negativa) rovescia il verso dei triangoli: lo rimetto a posto
    if (o.matrixWorld.determinant() < 0) {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i += 3) for (const a of [p, n, u]) if (a) {
        const sz = a.itemSize;
        for (let c = 0; c < sz; c++) { const t = a.array[(i + 1) * sz + c]; a.array[(i + 1) * sz + c] = a.array[(i + 2) * sz + c]; a.array[(i + 2) * sz + c] = t; }
      }
    }
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(g);
    o.parent.remove(o);
  }
  for (const [mat, list] of groups) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let k = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, k * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, k * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, k * 2);
      k += g.attributes.position.count; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    root.add(new THREE.Mesh(geo, mat));
  }
}

export function buildCity(scene) {
  const city = new THREE.Group(); scene.add(city);
  const surfaces = [], blockers = [], animated = [];
  const R = rng(19);
  const kit = makeHouseKit(7), M = kit.materials;
  const add = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const pole = (g, x, y0, y1, z, r = 0.11) => add(g, new THREE.CylinderGeometry(r * 0.85, r, y1 - y0, 6), M.post, x, (y0 + y1) / 2, z, (R() - 0.5) * 0.05, 0, (R() - 0.5) * 0.05);

  // =================== LE CASE IN FILA ===================
  // sequenza di tipi e varianti (mai due uguali di fila); al centro lo spazio per il
  // pontile e il campanile
  const variants = [
    () => kit.casaLunga({ w: 8.6, walls: M.grey, roof: M.rust }),
    () => kit.casaStorta({ low: M.grey, high: M.dark, roof: M.thatch }),
    () => kit.casaRotonda({ walls: M.weathered, roof: M.thatch, r: 2.5 }),
    () => kit.casaTorre({ wall: M.weathered, floors: 4 }),
    () => kit.casaPonte({ low: M.grey, high: M.weathered, roof: M.moss }),
    () => kit.casaStorta({ low: M.tar, high: M.weathered, roof: M.moss, shed: false }),
    () => kit.casaLunga({ w: 7.2, walls: M.weathered, roof: M.moss }),
    () => kit.casaRotonda({ walls: M.dark, roof: M.rust, r: 2.1 }),
    () => kit.casaTorre({ wall: M.dark, top: M.blue, floors: 3 }),
    () => kit.casaStorta({ low: M.weathered, high: M.grey, roof: M.thatch }),
    () => kit.casaPonte({ low: M.dark, high: M.tar, roof: M.thatch }),
    () => kit.casaLunga({ w: 9.4, walls: M.dark, roof: M.thatch }),
    () => kit.casaTorre({ wall: M.grey, floors: 5 }),
    () => kit.casaRotonda({ walls: M.grey, roof: M.moss, r: 2.8 }),
    () => kit.casaStorta({ low: M.dark, high: M.tar, roof: M.rust, shed: true }),
    () => kit.casaLunga({ w: 7.8, walls: M.grey, roof: M.moss }),
    () => kit.casaTorre({ wall: M.blue, floors: 4 }),
  ];
  const houses = [];
  const place = (H, x, mirror) => {
    const g = H.group; g.position.set(x, BW_Y, H.type === 'storta' || H.type === 'torre' ? 2.3 : 0);
    if (mirror) g.scale.x = -1;
    city.add(g);
    // ingombri nel mondo (specchiando, sinistra e destra si scambiano)
    const L = mirror ? -H.right : H.left, Rr = mirror ? -H.left : H.right;
    const UL = H.upLeft !== undefined ? (mirror ? -H.upRight : H.upLeft) : null, UR = H.upRight !== undefined ? (mirror ? -H.upLeft : H.upRight) : null;
    houses.push({ ...H, x, mirror, xl: x + L, xr: x + Rr, uxl: UL !== null ? x + UL : null, uxr: UR !== null ? x + UR : null, z: g.position.z });
  };
  // da sinistra fino al pontile, poi dal pontile verso destra
  {
    let vi = 0;
    // lato sinistro (x negativi): parto dal pontile e vado verso -HALF_L
    let edge = -4.0;
    while (true) {
      const H = variants[vi++ % variants.length](), mirror = R() < 0.4;
      const wR = mirror ? -H.left : H.right, wL = mirror ? -H.right : H.left; // estensioni dopo lo specchio
      const x = edge - wR;
      if (x + wL < -HALF_L + 1) break;
      place(H, x, mirror);
      edge = x + wL - (0.6 + R() * 1.6);
    }
    edge = 4.6;
    while (true) {
      const H = variants[vi++ % variants.length](), mirror = R() < 0.4;
      const wR = mirror ? -H.left : H.right, wL = mirror ? -H.right : H.left;
      const x = edge - wL;
      if (x + wR > HALF_L - 1) break;
      place(H, x, mirror);
      edge = x + wR + (0.6 + R() * 1.6);
    }
  }
  houses.sort((a, b) => a.x - b.x);

  // portici delle case lunghe: si cammina dal varco del parapetto
  for (const H of houses.filter((h) => h.type === 'lunga')) {
    surfaces.push({ x0: H.x - H.w / 2 + 0.3, x1: H.x + H.w / 2 - 0.3, z0: 0.25, z1: H.porch - 0.3, h: BW_Y });
    surfaces.push({ x0: H.x - 1.05, x1: H.x + 1.05, z0: H.porch - 0.4, z1: BW_Z0 + 0.05, h: BW_Y });
    for (const px of H.porchPosts) blockers.push({ cx: H.x + (H.mirror ? -px : px), cz: H.porch - 0.15, r: 0.12, y0: 0, y1: 4 });
  }

  // i pali della veranda a terra delle torri e le scale a pioli delle case storte stanno
  // sulla passerella: non si attraversano
  for (const H of houses) {
    const m = H.mirror ? -1 : 1;
    if (H.type === 'torre') for (const lx of [-1.7, 2.75]) blockers.push({ cx: H.x + m * lx, cz: H.z + 1.05, r: 0.1, y0: 0, y1: 4 });
    if (H.type === 'storta') blockers.push({ cx: H.x + m * 4.5, cz: H.z + 0.25, r: 0.3, y0: 0, y1: 4 });
    if (H.type === 'ponte') for (const [px, pz] of H.posts) if (pz < RAIL_Z) blockers.push({ cx: H.x + m * px, cz: pz, r: 0.16, y0: 0, y1: 4 });
  }

  // =================== LE VIE ALTE: ponticelli di corda tra le case ===================
  // tra due case vicine che hanno un piano alto (torre o casa storta): tavole su una
  // curva che si incurva appena, due corde come corrimano
  for (let i = 0; i < houses.length - 1; i++) {
    const A = houses[i], B = houses[i + 1];
    if (A.upY === undefined || B.upY === undefined) continue; // solo tra case con un piano alto
    const xa = A.uxr, xb = B.uxl, y = BW_Y + Math.min(A.upY, B.upY) + 0.1, z = 3.0 - 0.0;
    if (xb - xa < 0.6 || xb - xa > 4.5) continue;
    const zc = Math.min(A.z, B.z) - 1.2, n = Math.ceil((xb - xa) / 0.24), sag = 0.18 + (xb - xa) * 0.05;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = xa + (xb - xa) * t, yy = y - sag * 4 * t * (1 - t);
      add(city, box(0.2, 0.05, 1.0), M.deck, x, yy, zc);
    }
    for (const dz of [-0.5, 0.5]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(xa + (xb - xa) * t, y + 0.9 - sag * 0.7 * 4 * t * (1 - t), zc + dz)); }
      add(city, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 5), M.rope, 0, 0, 0);
      for (const x of [xa, xb]) add(city, box(0.1, 1.0, 0.1), M.post, x, y + 0.45, zc + dz);
    }
  }


  // =================== DETTAGLI DI VITA ===================
  // nei vicoli tra le case: piccoli pontili con botti, casse, remi, pesci a seccare, un altarino
  for (let i = 0; i < houses.length - 1; i++) {
    const A = houses[i], B = houses[i + 1], x0 = A.xr + 0.1, x1 = B.xl - 0.1, gw = x1 - x0;
    if (gw < 1.0) continue;
    const xc = (x0 + x1) / 2;
    add(city, box(gw, 0.12, 3.6), M.deck, xc, BW_Y - 0.06, 0.65);
    for (const x of [x0 + 0.15, x1 - 0.15]) for (const z of [-1.0, 2.3]) pole(city, x, -4, BW_Y - 0.1, z, 0.09);
    const r = R();
    if (gw > 2.2 && r < 0.35) kit.fishRack(city, xc, BW_Y, 0.4, Math.PI / 2 * (R() < 0.5 ? 1 : 0));
    else if (r < 0.65) { kit.barrel(city, xc - gw * 0.2, BW_Y, 0.2); kit.barrel(city, xc + gw * 0.15, BW_Y, -0.3); kit.crate(city, xc, BW_Y, 1.3, 0.55, R()); kit.crate(city, xc, BW_Y + 0.44, 1.3, 0.45, R()); }
    else if (r < 0.85) { kit.oars(city, xc, BW_Y, -0.4); kit.crate(city, xc + 0.3, BW_Y, 1.2, 0.6, 0.3); }
    else kit.shrine(city, xc, BW_Y, 1.4, 0);
  }
  // canne da pesca appoggiate al parapetto, qualche botte sulla passerella
  for (const x of [-47, -33, -19.5, -6, 8.5, 21, 36, 49]) kit.fishingRod(city, x + (R() - 0.5) * 2, RAIL_Z - 0.6, BW_Y);
  for (const x of [-44, -25, 17, 41]) {
    kit.barrel(city, x, BW_Y, RAIL_Z - 0.45); kit.crate(city, x + 0.7, BW_Y, RAIL_Z - 0.45, 0.5, 0.4);
    blockers.push({ cx: x, cz: RAIL_Z - 0.45, r: 0.3, y0: 0, y1: 3 }, { cx: x + 0.7, cz: RAIL_Z - 0.45, r: 0.28, y0: 0, y1: 3 });
  }
  // due TRABUCCHI che sporgono sul lago: la rete sale e scende piano
  // (davanti a una casa bassa — lunga o rotonda — così i pali non coprono balconi e passaggi)
  // la casa lunga più vicina al pontile è quella della LANTERNA (vedi Story.js): davanti a lei
  // il lago resta libero (niente trabucchi né barche), così il suo riflesso si legge bene
  const lanternHouse = houses.filter((h) => h.type === 'lunga').sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
  const lows = houses.filter((h) => (h.type === 'lunga' || h.type === 'rotonda') && Math.abs(h.x) > 12 && h !== lanternHouse);
  const spots = lows.length >= 2 ? [lows[0].x, lows[lows.length - 1].x] : [-30, 32];
  for (const tx of spots) {
    const T = kit.trabucco(); T.group.position.set(tx, BW_Y, RAIL_Z); city.add(T.group);
    animated.push({ type: 'trabucco', T, ph: R() * 6 });
  }

  // =================== LA PASSERELLA ===================
  add(city, box(HALF_L * 2, 0.14, BW_Z1 - BW_Z0 + 0.25), M.deck, 0, BW_Y - 0.07, (BW_Z0 + BW_Z1) / 2);
  for (let x = -HALF_L + 0.3; x <= HALF_L; x += 2.4) for (const z of [BW_Z0 + 0.05, RAIL_Z]) pole(city, x, -4, BW_Y - 0.1, z, 0.11);
  kit.railing(city, new THREE.Vector3(-HALF_L, BW_Y, RAIL_Z), new THREE.Vector3(PIER_X - 1.25, BW_Y, RAIL_Z));
  kit.railing(city, new THREE.Vector3(PIER_X + 1.25, BW_Y, RAIL_Z), new THREE.Vector3(HALF_L, BW_Y, RAIL_Z));
  for (const s of [-1, 1]) kit.railing(city, new THREE.Vector3(s * HALF_L, BW_Y, BW_Z0 - 0.2), new THREE.Vector3(s * HALF_L, BW_Y, RAIL_Z));
  surfaces.push({ x0: -HALF_L + 0.25, x1: HALF_L - 0.25, z0: BW_Z0, z1: BW_Z1, h: BW_Y });
  // lanterne su pali lungo il parapetto (alcune fanno luce davvero)
  let li = 0;
  const lampLights = []; // le luci vere delle lanterne (Story.js le spegne sopra e le accende nel lago)
  for (let x = -HALF_L + 6; x < HALF_L - 3; x += 9.5) {
    if (Math.abs(x - PIER_X) < 3) continue;
    const g = new THREE.Group(); g.position.set(x, BW_Y, RAIL_Z); city.add(g);
    pole(g, 0, 0, 2.7, 0, 0.07);
    add(g, box(0.06, 0.06, 0.7), M.post, 0, 2.62, 0.3);
    const lan = new THREE.Group(); lan.position.set(0, 2.58, 0.6); lan.userData.dynamic = true; g.add(lan);
    add(lan, new THREE.CylinderGeometry(0.13, 0.11, 0.32, 6), M.lamp, 0, -0.22, 0);
    add(lan, new THREE.ConeGeometry(0.18, 0.14, 6), M.metal, 0, -0.02, 0);
    if (li++ % 3 === 0) { const l = new THREE.PointLight('#ffb36b', 2.4, 11, 2); l.position.y = -0.25; lan.add(l); lampLights.push(l); }
    animated.push({ type: 'lantern', g: lan, ph: R() * 6 });
    blockers.push({ cx: x, cz: RAIL_Z, r: 0.12, y0: 0, y1: 4 });
  }

  // =================== IL CAMPANILE DI LEGNO (accanto al pontile) ===================
  // su una piccola piattaforma sull'acqua, collegata al pontile da una passerella di tavole.
  // La campana si suona tirando una corda appesa a una leva del giogo: tirando giù la
  // corda il giogo ruota e la campana oscilla (vedi Story.js).
  let bell;
  {
    const BX = PIER_X + 3.4, BZ = 6.0;
    const g = new THREE.Group(); g.position.set(BX, BW_Y, BZ); city.add(g);
    add(g, box(2.4, 0.14, 2.4), M.deck, 0, -0.07, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pole(g, sx * 1.05, -5, -0.1, sz * 1.05, 0.12);
    const H = 4.6, hw = 0.7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(g, box(0.16, H, 0.16), M.post, sx * hw, H / 2, sz * hw);
      blockers.push({ cx: BX + sx * hw, cz: BZ + sz * hw, r: 0.14, y0: 0, y1: 5 });
    }
    for (const y of [H - 0.2]) for (const s of [-1, 1]) {
      add(g, box(hw * 2 + 0.2, 0.12, 0.12), M.post, 0, y, s * hw);
      add(g, box(0.12, 0.12, hw * 2 + 0.2), M.post, s * hw, y, 0);
    }
    // la traversa bassa solo sui due lati che non si attraversano
    add(g, box(0.12, 0.12, hw * 2 + 0.2), M.post, hw, 1.0, 0);
    add(g, box(hw * 2 + 0.2, 0.12, 0.12), M.post, 0, 1.0, -hw);
    const roof = add(g, new THREE.ConeGeometry(1.25, 1.3, 4, 1, true), M.moss, 0, H + 0.6, 0, 0, Math.PI / 4, 0);
    const yoke = new THREE.Group(); yoke.position.set(0, H - 0.35, 0); yoke.userData.dynamic = true; g.add(yoke);
    const prof = [[0.04, 0], [0.22, -0.04], [0.28, -0.25], [0.33, -0.6], [0.44, -0.85], [0.45, -0.9], [0, -0.9]].map(([a, b]) => new THREE.Vector2(a, b));
    const bellM = add(yoke, new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ color: '#6f5f45', metalness: 0.75, roughness: 0.4, side: THREE.DoubleSide }), 0, 0, 0);
    const clapper = new THREE.Group(); clapper.position.y = -0.12; bellM.add(clapper);
    add(clapper, new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), M.metal, 0, -0.3, 0);
    add(clapper, new THREE.SphereGeometry(0.07, 8, 6), M.metal, 0, -0.62, 0);
    // la leva: una trave che sporge dal giogo verso il lago, con la corda in punta
    const LEVER = 0.62;
    add(yoke, box(0.08, 0.08, LEVER + 0.1), M.post, 0, 0.05, LEVER / 2);
    add(yoke, box(0.5, 0.1, 0.1), M.post, 0, 0.05, 0); // il ceppo del giogo
    // la corda non è qui: la disegna Story.js ogni frame, dalla punta della leva alle mani
    // di chi tira (o dritta giù, quando nessuno la tiene)
    // la passerella dal pontile alla piattaforma
    add(city, box(1.2, 0.1, 0.9), M.deck, PIER_X + 1.65, (PIER_Y + BW_Y) / 2 - 0.05, BZ);
    surfaces.push({ x0: PIER_X + 0.75, x1: BX - 1.0, z0: BZ - 0.4, z1: BZ + 0.4, h: (PIER_Y + BW_Y) / 2 });
    surfaces.push({ x0: BX - 1.1, x1: BX + 1.1, z0: BZ - 1.1, z1: BZ + 1.1, h: BW_Y });
    bell = { yoke, bell: bellM, clapper, lever: LEVER, group: g, base: g.position.clone() };
  }

  // =================== IL PONTILE ===================
  {
    const z0 = RAIL_Z - 0.1, z1 = PIER_END, wP = 2.2;
    add(city, box(wP, 0.14, z1 - z0), M.deck, PIER_X, PIER_Y - 0.07, (z0 + z1) / 2);
    for (let z = z0 + 1; z <= z1; z += 2.2) for (const sx of [-1, 1]) pole(city, PIER_X + sx * (wP / 2 - 0.08), -4, PIER_Y - 0.1, z, 0.1);
    for (const sx of [-1, 1]) pole(city, PIER_X + sx * 0.85, PIER_Y, PIER_Y + 1.0, z1 - 0.25, 0.12);
    surfaces.push({ x0: PIER_X - wP / 2 + 0.22, x1: PIER_X + wP / 2 - 0.22, z0: BW_Z1 - 0.1, z1: z1 - 0.15, h: PIER_Y });
  }

  // =================== BARCHE ===================
  {
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-2.2, 0); hullShape.quadraticCurveTo(-1.3, 0.5, 0, 0.55); hullShape.quadraticCurveTo(1.3, 0.5, 2.2, 0);
    hullShape.quadraticCurveTo(1.3, -0.5, 0, -0.55); hullShape.quadraticCurveTo(-1.3, -0.5, -2.2, 0);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    hullGeo.rotateX(Math.PI / 2); hullGeo.translate(0, 0.32, 0);
    const hullMats = ['#3e4a52', '#5a3f37', '#4b5546', '#6b6153'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    const boat = (x, z, rot) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; g.userData.dynamic = true; city.add(g);
      g.add(new THREE.Mesh(hullGeo, hullMats[Math.floor(R() * hullMats.length)]));
      add(g, new THREE.BoxGeometry(2.8, 0.05, 0.72), M.log, 0, 0.28, 0);
      add(g, new THREE.BoxGeometry(0.28, 0.05, 0.85), M.log, 0.4, 0.42, 0);
      const oarPivot = new THREE.Group(); oarPivot.position.set(0.3, 0.46, 0.45); g.add(oarPivot);
      add(oarPivot, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), M.post, -0.6, 0, 0, 0, 0.3, Math.PI / 2 - 0.2);
      animated.push({ type: 'boat', g, ph: R() * 6, oarPivot });
    };
    for (const x of [-52, -41, -22, -12, 13, 26, 44, 55]) {
      const bx = x + (R() - 0.5) * 3;
      if (lanternHouse && Math.abs(bx - lanternHouse.x) < 7) continue; // lago libero davanti alla lanterna
      boat(bx, 5.7 + R() * 0.6, (R() - 0.5) * 0.2);
    }
    boat(PIER_X + 2.4, 12.5, Math.PI / 2 + 0.05);
  }

  // =================== LA RIVA E IL BOSCO ===================
  const hAt = (x, z) => { // z negativo = verso terra
    const t = -z;
    const bank = THREE.MathUtils.lerp(-1.5, 1.2, THREE.MathUtils.smoothstep(t, 5, 9));
    const n = Math.sin(x * 0.07) * 2 + Math.sin(x * 0.19 + 1) * 1 + Math.sin(x * 0.031) * 4;
    return bank + 46 * THREE.MathUtils.smoothstep(t, 9, 80) + n * THREE.MathUtils.smoothstep(t, 12, 40);
  };
  {
    const W = 500, D = 170, NX = 140, NZ = 64, pos = [], col = [], idx = [], c = new THREE.Color();
    const G1 = new THREE.Color('#2f3a2c'), G2 = new THREE.Color('#3f4b3a'), MUD = new THREE.Color('#47463f');
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = -W / 2 + W * i / NX, z = -2 - D * Math.pow(j / NZ, 1.4), h = hAt(x, z);
      pos.push(x, h, z);
      c.copy(G1).lerp(G2, 0.5 + 0.5 * Math.sin(x * 0.3 + z * 0.2)).lerp(MUD, 1 - THREE.MathUtils.smoothstep(h, -0.5, 1.0));
      col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + NX + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    city.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    const Mt = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
    // abeti: due coni sovrapposti, fitti, che salgono nella nebbia
    const N = 1100, cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: '#33402f', roughness: 1, flatShading: true }), N * 2);
    for (let i = 0; i < N; i++) {
      const x = (R() - 0.5) * 360, z = -9 - Math.pow(R(), 1.3) * 120, h = hAt(x, z), s = 1.4 + R() * 1.2, hh = 6 + R() * 6;
      Mt.compose(P.set(x, h + hh * 0.45, z), Q.identity(), S.set(s, hh * 0.65, s)); cones.setMatrixAt(i * 2, Mt);
      Mt.compose(P.set(x, h + hh * 0.85, z), Q, S.set(s * 0.7, hh * 0.45, s * 0.7)); cones.setMatrixAt(i * 2 + 1, Mt);
      cones.setColorAt(i * 2, new THREE.Color().setHSL(0.3, 0.12 + R() * 0.06, 0.2 + R() * 0.06));
      cones.setColorAt(i * 2 + 1, new THREE.Color().setHSL(0.3, 0.12 + R() * 0.06, 0.21 + R() * 0.06));
    }
    city.add(cones);
    // canne lungo la riva (fuori dal villaggio e sotto la passerella) e ninfee
    const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 1, 4), new THREE.MeshStandardMaterial({ color: '#6c7552', roughness: 1 }), 900);
    for (let i = 0; i < 900; i++) {
      let x, z;
      if (i < 600) { x = (R() < 0.5 ? -1 : 1) * (HALF_L + 1 + R() * 60); z = -6 + R() * 9; }
      else { x = (R() - 0.5) * HALF_L * 2; z = RAIL_Z + 0.3 + R() * 1.2; if (Math.abs(x - PIER_X) < 2) continue; }
      const hh = 1 + R() * 1.5;
      Mt.compose(P.set(x, hh / 2 - 0.3, z), Q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3)), S.set(1, hh, 1)); reeds.setMatrixAt(i, Mt);
    }
    city.add(reeds);
    const pads = new THREE.InstancedMesh(new THREE.CircleGeometry(0.45, 10, 0.4, Math.PI * 1.85), new THREE.MeshStandardMaterial({ color: '#3f5539', roughness: 0.8, side: THREE.DoubleSide }), 160);
    for (let i = 0; i < 160; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (HALF_L - 6 + R() * 40), z = 2 + R() * 9;
      Mt.compose(P.set(x, 0.02, z), Q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, R() * 6.28)), S.setScalar(0.7 + R() * 0.8)); pads.setMatrixAt(i, Mt);
    }
    city.add(pads);
  }

  applyDetailMaps(city);
  // il fumo esce dai camini (calcolo le posizioni prima di fondere le geometrie)
  city.updateMatrixWorld(true);
  const smoke = new Smoke(scene);
  for (const H of houses) for (const c of H.chimneys) smoke.add(c.obj.localToWorld(c.p.clone()), 12);
  mergeStatic(city);

  // ---------------------------------------------------------------
  // Superfici (rettangoli allineati agli assi) e ostacoli (pali) per il viaggiatore
  // ---------------------------------------------------------------
  function groundHeightAt(x, z, y = Infinity) {
    let best = null;
    for (const s of surfaces) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.h <= y + 0.45 && (best === null || s.h > best)) best = s.h;
    return best;
  }
  const blocked = (x, z, y) => blockers.some((b) => y >= b.y0 && y <= b.y1 && Math.hypot(x - b.cx, z - b.cz) < b.r + 0.18);
  const ok = (x, z, y) => { const h = groundHeightAt(x, z, y); return h !== null && h > y - 0.6 && !blocked(x, z, y); };
  function constrain(p, x0, y0, z0) {
    if (ok(p.x, p.z, y0)) return;
    if (ok(p.x, z0, y0)) { p.z = z0; return; }   // scivolo lungo il bordo
    if (ok(x0, p.z, y0)) { p.x = x0; return; }
    p.x = x0; p.z = z0;
  }

  return {
    group: city, houses, bell, lanternHouse, lampLights, groundHeightAt, constrain, materials: M, kit,
    update(t, dt = 1 / 60) {
      smoke.update(dt);
      for (const b of animated) {
        if (b.type === 'boat') {
          b.g.position.y = Math.sin(t * 0.9 + b.ph) * 0.04;
          b.g.rotation.z = Math.sin(t * 0.7 + b.ph) * 0.03;
          b.g.rotation.x = Math.sin(t * 0.55 + b.ph * 1.3) * 0.02;
          b.oarPivot.rotation.y = Math.sin(t * 0.4 + b.ph) * 0.08;
        } else if (b.type === 'trabucco') {
          // la rete scende nell'acqua e risale, lentamente
          const y = 1.7 + 1.6 * Math.sin(t * 0.12 + b.ph), L = b.T.topY - y;
          b.T.net.position.y = y;
          for (const r of b.T.ropes) { r.scale.y = L; r.position.y = L / 2; }
        } else {
          b.g.rotation.z = Math.sin(t * 1.1 + b.ph) * 0.06;
          b.g.rotation.x = Math.sin(t * 0.8 + b.ph * 2) * 0.04;
        }
      }
    },
  };
}
