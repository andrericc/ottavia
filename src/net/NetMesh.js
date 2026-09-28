// NetMesh.js
// ---------------------------------------------------------------
// Disegna la VerletNet con Three.js come un insieme di segmenti.
// Ogni frame copia le posizioni dei nodi nella geometria e colora
// ogni fune in base a quanto è tesa (canapa → rosso).
// ---------------------------------------------------------------
import * as THREE from 'three';

const ROPE = new THREE.Color('#c9b48a');   // canapa
const STRAIN = new THREE.Color('#e0442e'); // fune al limite

export class NetMesh {
  constructor(net, { breakStress = 0.03 } = {}) {
    this.net = net;
    this.breakStress = breakStress; // allungamento che consideriamo "100% di tensione"

    const nSeg = net.rest.length;
    this.positions = new Float32Array(nSeg * 2 * 3);
    this.colors = new Float32Array(nSeg * 2 * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry = geo;

    const mat = new THREE.LineBasicMaterial({ vertexColors: true });
    this.object = new THREE.LineSegments(geo, mat);
    this.object.frustumCulled = false; // la rete si muove: evitiamo che sparisca per bounding box vecchie

    this.update();
  }

  update() {
    const { net, positions, colors } = this;
    const tmp = new THREE.Color();
    for (let c = 0; c < net.rest.length; c++) {
      const o = c * 6;
      if (net.broken[c]) {
        // fune rotta: segmento degenere (invisibile)
        positions.fill(0, o, o + 6);
        continue;
      }
      const ka = net.ca[c] * 3, kb = net.cb[c] * 3;
      positions[o] = net.pos[ka]; positions[o + 1] = net.pos[ka + 1]; positions[o + 2] = net.pos[ka + 2];
      positions[o + 3] = net.pos[kb]; positions[o + 4] = net.pos[kb + 1]; positions[o + 5] = net.pos[kb + 2];

      const t = Math.min(1, net.stress[c] / this.breakStress);
      tmp.copy(ROPE).lerp(STRAIN, t * t);
      colors[o] = colors[o + 3] = tmp.r;
      colors[o + 1] = colors[o + 4] = tmp.g;
      colors[o + 2] = colors[o + 5] = tmp.b;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  // Tensione complessiva 0..1 (per HUD, audio, ecc.)
  get tension() {
    return Math.min(1, this.net.maxStress / this.breakStress);
  }
}
