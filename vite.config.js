import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Vite è solo una comodità per lavorare (ricarica automatica): il progetto gira anche
// aprendo index.html da un server statico qualsiasi, perché Three.js è incluso in libs/.
// base: './'  → percorsi relativi, così funziona anche in una sottocartella di GitHub Pages
// alias       → anche Vite usa la copia di Three.js inclusa nel repository
export default defineConfig({
  base: './',
  resolve: { alias: { three: fileURLToPath(new URL('./libs/three/three.module.js', import.meta.url)) } },
});
