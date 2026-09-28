// World.js
// ---------------------------------------------------------------
// Ambiente "grey-box" della settimana 1: due creste di montagna,
// il fondo del burrone, luci e nebbia. Tutto verrà sostituito
// da modelli e texture veri nella fase "mondo e atmosfera".
// ---------------------------------------------------------------
import * as THREE from 'three';

export function buildWorld(scene, { netLength, netWidth }) {
  // Cielo e nebbia: la nebbia fa "sparire" il fondo del burrone → senso di vuoto
  scene.background = new THREE.Color('#9fb0bf');
  scene.fog = new THREE.FogExp2('#9fb0bf', 0.012);

  // Luci
  const hemi = new THREE.HemisphereLight('#dfe8f0', '#3a3530', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', 1.6);
  sun.position.set(40, 70, -25); // illumina la parete della cresta sud, quella che si vede camminando
  scene.add(sun);

  const rock = new THREE.MeshStandardMaterial({ color: '#6d6861', roughness: 0.95, flatShading: true });

  // Le due creste: la superficie superiore è a y = 0 (dove sono ancorate le funi)
  const cliffDepth = 30, cliffHeight = 200, cliffWidth = netWidth + 40;
  const cliffGeo = new THREE.BoxGeometry(cliffWidth, cliffHeight, cliffDepth);
  const north = new THREE.Mesh(cliffGeo, rock);
  north.position.set(0, -cliffHeight / 2, -cliffDepth / 2);
  const south = new THREE.Mesh(cliffGeo, rock);
  south.position.set(0, -cliffHeight / 2, netLength + cliffDepth / 2);
  scene.add(north, south);

  // Qualche roccia per spezzare la forma dei blocchi
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let k = 0; k < 40; k++) {
    const r = new THREE.Mesh(rockGeo, rock);
    const side = k % 2 === 0 ? -1 : 1;
    const s = 2 + Math.random() * 7;
    r.scale.set(s, s * (1 + Math.random()), s);
    r.position.set(
      (Math.random() - 0.5) * cliffWidth,
      Math.random() * 6 - 1,
      side < 0 ? -4 - Math.random() * 25 : netLength + 4 + Math.random() * 25,
    );
    // lasciamo libero il corridoio centrale di ingresso alla rete
    if (Math.abs(r.position.x) < netWidth / 2 + 2 && r.position.y > -1) r.position.x += Math.sign(r.position.x || 1) * (netWidth / 2 + 6);
    r.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(r);
  }

  // Fondo del burrone, molto in basso: si intravede appena nella nebbia
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: '#4c5a4a', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -180, netLength / 2);
  scene.add(floor);

  // Altezza del terreno sulle creste (per il personaggio): null = vuoto
  return {
    groundHeightAt(x, z) {
      if (Math.abs(x) > cliffWidth / 2) return null;
      if (z <= 0 && z > -cliffDepth) return 0;
      if (z >= netLength && z < netLength + cliffDepth) return 0;
      return null;
    },
  };
}
