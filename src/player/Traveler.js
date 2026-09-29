// Traveler.js
// ---------------------------------------------------------------
// Il viaggiatore: MODELLO GERARCHICO.
//
// Ogni articolazione è un THREE.Group vuoto (un "perno") posizionato
// nel punto in cui ruota; le parti visibili sono figlie del perno,
// spostate in modo che il perno cada alla loro estremità.
// Ruotando un perno si muove tutto ciò che sta sotto di lui:
// ruoto la spalla → si muovono braccio, avambraccio e mano.
//
//  root (ai piedi, orientato verso dove guarda)
//   └ swing           perno alle mani: da appeso il corpo dondola attorno a lui
//      └ body
//         └ pelvis ─────────────────────────── (anca, a 0,90 m da terra)
//            ├ hipL → thigh · kneeL → shin · ankleL → foot
//            ├ hipR → thigh · kneeR → shin · ankleR → foot
//            └ spine → torso, coat
//               └ chest
//                  ├ neck → head → hat
//                  ├ shoulderL → upperArm · elbowL → forearm · wristL → hand
//                  ├ shoulderR → upperArm · elbowR → forearm · wristR → hand
//                  └ pack → bedroll · lanternPivot → lantern + luce
//
// Le rotazioni seguono una convenzione unica: rotation.x NEGATIVA porta
// braccia e gambe IN AVANTI (verso +Z locale, dove guarda il viaggiatore).
// ---------------------------------------------------------------
import * as THREE from 'three';

// Misure in metri
export const DIMS = {
  foot: 0.06,        // altezza del piede
  shin: 0.42,        // stinco
  thigh: 0.42,       // coscia
  hipWidth: 0.1,     // distanza dell'anca dal centro
  spine: 0.07,       // dal perno del bacino all'inizio della schiena
  torso: 0.42,       // dalla schiena alle spalle
  shoulderWidth: 0.22,
  upperArm: 0.3,
  forearm: 0.27,
  hand: 0.08,
};
DIMS.hipHeight = DIMS.foot + DIMS.shin + DIMS.thigh;                         // 0,90
DIMS.shoulderHeight = DIMS.hipHeight + DIMS.spine + DIMS.torso + 0.03;      // 1,42
DIMS.armLength = DIMS.upperArm + DIMS.forearm + DIMS.hand;                  // 0,65
DIMS.reach = DIMS.shoulderHeight + DIMS.armLength;                          // 2,07: piedi → mani alzate

const MAT = {
  coat: new THREE.MeshStandardMaterial({ color: '#2e3f55', roughness: 0.85, flatShading: true }),
  trousers: new THREE.MeshStandardMaterial({ color: '#3b3530', roughness: 0.9, flatShading: true }),
  skin: new THREE.MeshStandardMaterial({ color: '#d9b99b', roughness: 0.7, flatShading: true }),
  leather: new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.8, flatShading: true }),
  hat: new THREE.MeshStandardMaterial({ color: '#4a3b2c', roughness: 0.9, flatShading: true }),
  scarf: new THREE.MeshStandardMaterial({ color: '#a8352c', roughness: 0.9, flatShading: true }),
  bedroll: new THREE.MeshStandardMaterial({ color: '#8c7b5a', roughness: 1, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.5, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffaa40', emissiveIntensity: 1.2 }),
};

// Un perno (articolazione) in posizione (x, y, z) rispetto al genitore
function joint(parent, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// Una parte visibile attaccata a un perno
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Un segmento di arto: capsula di lunghezza 'len' che pende verso -Y dal perno
function limb(parent, radius, len, material) {
  return part(parent, new THREE.CapsuleGeometry(radius, Math.max(0.01, len - radius * 2), 3, 8), material, 0, -len / 2, 0);
}

export class Traveler {
  constructor() {
    const D = DIMS;
    this.root = new THREE.Group();
    this.root.name = 'traveler';
    const j = (this.joints = {});

    // --- Perno di dondolo: sta all'altezza delle mani alzate. Il corpo è spostato
    // giù della stessa quantità, quindi a rotazione zero tutto è come se non ci fosse.
    j.swing = joint(this.root, 'swing', 0, D.reach, 0);
    j.body = joint(j.swing, 'body', 0, -D.reach, 0);

    // --- Bacino
    j.pelvis = joint(j.body, 'pelvis', 0, D.hipHeight, 0);
    part(j.pelvis, new THREE.BoxGeometry(0.3, 0.16, 0.2), MAT.trousers, 0, 0.02, 0);

    // --- Gambe
    for (const [s, side] of [['L', -1], ['R', 1]]) {
      j['hip' + s] = joint(j.pelvis, 'hip' + s, side * D.hipWidth, 0, 0);
      limb(j['hip' + s], 0.065, D.thigh, MAT.trousers);
      j['knee' + s] = joint(j['hip' + s], 'knee' + s, 0, -D.thigh, 0);
      limb(j['knee' + s], 0.055, D.shin, MAT.trousers);
      j['ankle' + s] = joint(j['knee' + s], 'ankle' + s, 0, -D.shin, 0);
      part(j['ankle' + s], new THREE.BoxGeometry(0.11, D.foot, 0.24), MAT.leather, 0, -D.foot / 2, 0.05);
    }

    // --- Busto: la giacca lunga scende sotto il bacino
    j.spine = joint(j.pelvis, 'spine', 0, D.spine, 0);
    part(j.spine, new THREE.CylinderGeometry(0.17, 0.21, D.torso + 0.02, 8), MAT.coat, 0, D.torso / 2, 0);
    part(j.spine, new THREE.CylinderGeometry(0.21, 0.25, 0.28, 8, 1, true), MAT.coat, 0, -0.1, 0).material.side = THREE.DoubleSide;
    part(j.spine, new THREE.CylinderGeometry(0.215, 0.215, 0.05, 8), MAT.leather, 0, 0.02, 0); // cintura

    j.chest = joint(j.spine, 'chest', 0, D.torso, 0);

    // --- Testa, cappello, sciarpa
    part(j.chest, new THREE.TorusGeometry(0.1, 0.045, 6, 10), MAT.scarf, 0, 0.02, 0).rotation.x = Math.PI / 2;
    j.neck = joint(j.chest, 'neck', 0, 0.06, 0);
    part(j.neck, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), MAT.skin, 0, 0.03, 0);
    j.head = joint(j.neck, 'head', 0, 0.08, 0);
    part(j.head, new THREE.IcosahedronGeometry(0.12, 1), MAT.skin, 0, 0.1, 0);
    part(j.head, new THREE.BoxGeometry(0.035, 0.05, 0.05), MAT.skin, 0, 0.09, 0.12); // naso
    part(j.head, new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12), MAT.hat, 0, 0.19, 0);  // tesa
    part(j.head, new THREE.CylinderGeometry(0.1, 0.13, 0.13, 10), MAT.hat, 0, 0.26, 0);   // cupola

    // --- Braccia
    for (const [s, side] of [['L', -1], ['R', 1]]) {
      j['shoulder' + s] = joint(j.chest, 'shoulder' + s, side * D.shoulderWidth, 0.02, 0);
      limb(j['shoulder' + s], 0.055, D.upperArm, MAT.coat);
      j['elbow' + s] = joint(j['shoulder' + s], 'elbow' + s, 0, -D.upperArm, 0);
      limb(j['elbow' + s], 0.047, D.forearm, MAT.coat);
      j['wrist' + s] = joint(j['elbow' + s], 'wrist' + s, 0, -D.forearm, 0);
      part(j['wrist' + s], new THREE.BoxGeometry(0.07, D.hand, 0.05), MAT.skin, 0, -D.hand / 2, 0);
    }

    // --- Zaino con coperta arrotolata e lanterna appesa
    j.pack = joint(j.chest, 'pack', 0, -0.2, -0.17);
    part(j.pack, new THREE.BoxGeometry(0.3, 0.36, 0.16), MAT.leather, 0, 0, -0.04);
    part(j.pack, new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8), MAT.bedroll, 0, 0.23, -0.04).rotation.z = Math.PI / 2;

    j.lanternPivot = joint(j.pack, 'lanternPivot', 0.17, -0.12, -0.08);
    part(j.lanternPivot, new THREE.CylinderGeometry(0.005, 0.005, 0.1, 4), MAT.metal, 0, -0.05, 0); // gancio
    const lantern = joint(j.lanternPivot, 'lantern', 0, -0.15, 0);
    part(lantern, new THREE.CylinderGeometry(0.04, 0.05, 0.1, 6), MAT.glass);
    part(lantern, new THREE.ConeGeometry(0.055, 0.04, 6), MAT.metal, 0, 0.07, 0);
    part(lantern, new THREE.CylinderGeometry(0.052, 0.052, 0.015, 6), MAT.metal, 0, -0.055, 0);
    // La lanterna fa luce davvero: una PointLight figlia della lanterna segue ogni suo movimento
    this.light = new THREE.PointLight('#ffb25c', 1.4, 7, 2);
    lantern.add(this.light);

    // Posa di riposo di ogni perno, per poterla ripristinare
    this.rest = {};
    for (const [name, g] of Object.entries(j)) this.rest[name] = g.position.clone();
  }
}
