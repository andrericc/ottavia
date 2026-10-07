// valdrada/Valdrada.js
// ---------------------------------------------------------------
// VALDRADA come modulo: costruisce la seconda città e restituisce un oggetto con
// scena, viaggiatore, storia e le funzioni per farla girare e disegnarla.
// La usano sia l'esperienza completa (src/main.js, dopo Ottavia e il sogno) sia la
// pagina di prova valdrada.html (src/valdrada/main.js).
//
// Renderer, camera, camera che segue e narratore arrivano da fuori: sono gli stessi
// di Ottavia, così il passaggio da una città all'altra è continuo.
//
// Ordine di disegno di ogni frame:
//   1. il lago prepara il RIFLESSO (camera specchio → immagine fuori schermo)
//   2. la scena vera, con il lago che mostra quell'immagine
// Il viaggiatore sta sul layer 2: la camera del giocatore lo vede, quella dello
// specchio no — a Valdrada lui non ha riflesso. Gli abitanti stanno sul layer 1:
// li vede solo lo specchio.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { buildAtmosphere } from './Atmosphere.js';
import { buildCity, BW_Y, RAIL_Z, PIER_X, PIER_END, PIER_Y } from './City.js';
import { MirrorWater, LAYER_NO_REFLECTION } from './MirrorWater.js';
import { Inhabitants } from './Inhabitants.js';
import { waterNormal } from './vtextures.js';
import { Player } from '../player/Player.js';
import { InteractionManager } from '../interaction/InteractionManager.js';
import { ValdradaStory } from './Story.js';

// si arriva in punta al pontile, davanti al villaggio e al suo riflesso:
// "il viaggiatore vede arrivando due città: una diritta sopra il lago e l'altra riflessa capovolta"
export const START = new THREE.Vector3(PIER_X, PIER_Y, PIER_END - 0.8);
export const START_FACING = Math.PI;

export function createValdrada({ renderer, camera, followCam, narrator }) {
  renderer.localClippingEnabled = true;         // serve al riflesso del viaggiatore, che compare a pezzi (vedi Story.js)
  camera.layers.enable(LAYER_NO_REFLECTION);    // la camera del giocatore vede il viaggiatore (layer 2)

  // --- clima, villaggio, lago
  const scene = new THREE.Scene();
  const atmosphere = buildAtmosphere(scene);
  const city = buildCity(scene);
  const water = new MirrorWater({ normalMap: waterNormal(), height: 0, color: '#203039' });
  scene.add(water.mesh);

  // --- il viaggiatore (riusa Player di Ottavia: qui non c'è rete, solo il villaggio)
  const noNet = { heightAt: () => null, cellIntact: () => false, applyLoad() {}, straining: false };
  const noWalkway = { plankUnder: () => null, nearestPlank: () => null };
  const player = new Player({ net: noNet, world: city, walkway: noWalkway, start: START });
  player.facing = START_FACING;
  player.object.traverse((o) => o.layers.set(LAYER_NO_REFLECTION));
  scene.add(player.object);

  // --- gli abitanti (solo nel riflesso): affacciati al parapetto, a passeggio, sulle verande
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const zr = RAIL_Z - 0.45, LAKE = 0; // guardare il lago = guardare verso +z
  const people = [
    { pos: V(PIER_X - 2.6, BW_Y, zr), facing: LAKE + 0.3, wave: true },         // ti saluta, accanto al pontile
    { pos: V(-9, BW_Y, zr), facing: LAKE }, { pos: V(-17.5, BW_Y, zr), facing: LAKE - 0.4 },
    { pos: V(7.5, BW_Y, zr), facing: LAKE }, { pos: V(15, BW_Y, zr), facing: LAKE + 0.3 },
    { pos: V(16.1, BW_Y, zr), facing: LAKE - 0.3, scale: 0.62 },                  // un bambino
    { pos: V(28, BW_Y, zr), facing: LAKE },
    { pos: V(-26, BW_Y, 3.4), path: [V(-46, BW_Y, 3.3), V(-12, BW_Y, 3.3)], speed: 0.8 },
    { pos: V(20, BW_Y, 3.2), path: [V(6, BW_Y, 3.2), V(30, BW_Y, 3.2)], speed: 0.7 },
    { pos: V(45, BW_Y, 3.6), path: [V(38, BW_Y, 3.6), V(56, BW_Y, 3.6)], speed: 0.6 },
  ];
  // sulle verande delle torri, sui balconi delle case storte, sotto i portici delle case lunghe
  for (const H of city.houses) {
    const m = H.mirror ? -1 : 1;
    if (H.type === 'torre') people.push({ pos: V(H.x + m * 0.4, BW_Y + 2.5 * 2 + 0.12, H.z + 0.6), facing: LAKE, wave: H.x > 20 });
    else if (H.type === 'storta' && Math.random() < 0.6) people.push({ pos: V(H.x + m * 4.3, BW_Y + 2.85, H.z - 1.4), facing: m * Math.PI / 2 });
    else if (H.type === 'lunga') people.push({ pos: V(H.x + m * 2.6, BW_Y, 1.3), facing: LAKE });
    else if (H.type === 'ponte') people.push({ pos: V(H.x + 0.3, BW_Y + 2.98, 5.35), facing: LAKE, wave: Math.random() < 0.5 }); // sul balconcino sopra l'acqua
    else if (H.type === 'rotonda') people.push({ pos: V(H.x + m * 2.6, BW_Y, 1.2), facing: LAKE + m * 0.6 });
  }
  const inhabitants = new Inhabitants(scene, people);

  // --- interazioni e storia (il narratore è condiviso con Ottavia)
  const interactions = new InteractionManager(scene, player, narrator);
  const story = new ValdradaStory({ scene, city, player, followCam, narrator, interactions, inhabitants, water });

  let time = 0;
  return {
    scene, city, water, player, inhabitants, interactions, story, atmosphere,

    // la camera alle spalle del viaggiatore, verso il villaggio
    placeCamera() {
      followCam.yaw = 0.1; followCam.pitch = 0.07; followCam.distance = 8;
    },

    reset() { player.reset(START); player.facing = START_FACING; },

    // un passo di simulazione (playing = false durante il sogno e la nebbia: il mondo
    // si anima ma il viaggiatore non si muove e la storia aspetta)
    update(dt, playing = true) {
      time += dt;
      player.update(dt, followCam.yaw);
      player.postPhysics();
      atmosphere.update(dt);
      city.update(time, dt);
      inhabitants.update(dt);
      if (playing) {
        interactions.update(dt);
        story.update(dt);
        player.frozen = narrator.busy || interactions.running;
      } else {
        player.frozen = true;
        interactions.hide?.();
      }
    },

    // prepara il riflesso: va chiamato prima di disegnare la scena (anche in un render target)
    prepare() { water.render(renderer, scene, camera, time); },

    render() {
      water.render(renderer, scene, camera, time);
      renderer.render(scene, camera);
    },
  };
}
