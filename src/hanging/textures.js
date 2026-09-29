// textures.js
// ---------------------------------------------------------------
// Texture PROCEDURALI: disegnate con il Canvas 2D del browser e
// usate come CanvasTexture. Niente file immagine da caricare.
// ---------------------------------------------------------------
import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Tessuto a righe per le amache
export function stripedFabric(colors = ['#b8412f', '#e8dcc0', '#2f5d7c', '#e8dcc0']) {
  return canvasTexture(128, 128, (g, w, h) => {
    const band = w / (colors.length * 2);
    for (let x = 0; x < w; x += band) {
      g.fillStyle = colors[Math.floor(x / band) % colors.length];
      g.fillRect(x, 0, band, h);
    }
    // trama del tessuto: righine orizzontali più scure
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  });
}

// Tela di sacco rattoppata per le case a sacco
export function burlap(seed = 1) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; // numeri casuali ripetibili
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#9c8358';
    g.fillRect(0, 0, w, h);
    // trama incrociata
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(60,40,20,0.10)' : 'rgba(255,240,200,0.08)';
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1);
    }
    // toppe di stoffe diverse, con le cuciture
    const patches = ['#7a5c3a', '#b39a6a', '#6d6a4e', '#8e4f3a', '#5c6b73'];
    for (let i = 0; i < 7; i++) {
      const pw = 30 + rnd() * 50, ph = 30 + rnd() * 50, px = rnd() * (w - pw), py = rnd() * (h - ph);
      g.fillStyle = patches[i % patches.length];
      g.fillRect(px, py, pw, ph);
      g.strokeStyle = 'rgba(30,20,10,0.7)';
      g.setLineDash([4, 3]);
      g.lineWidth = 1.5;
      g.strokeRect(px + 3, py + 3, pw - 6, ph - 6);
    }
  });
}
