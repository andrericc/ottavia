// textures.js
// ---------------------------------------------------------------
// Texture PROCEDURALI: disegnate con il Canvas 2D del browser e
// usate come CanvasTexture. Niente file immagine da caricare.
// ---------------------------------------------------------------
import * as THREE from 'three';

export function canvasTexture(w, h, draw) {
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

// Assi di legno affiancate (per la navicella e, in futuro, per altri oggetti di legno).
// Le venature sono linee ondulate; ogni asse ha una tinta leggermente diversa.
export function woodPlanks(seed = 1, planks = 6) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return canvasTexture(256, 256, (g, w, h) => {
    const pw = w / planks;
    for (let k = 0; k < planks; k++) {
      const l = 30 + rnd() * 12;
      g.fillStyle = `hsl(28, 38%, ${l}%)`;
      g.fillRect(k * pw, 0, pw, h);
      // venature
      g.strokeStyle = 'rgba(40,22,10,0.35)';
      g.lineWidth = 1;
      for (let v = 0; v < 5; v++) {
        const x0 = k * pw + 4 + rnd() * (pw - 8), a = 1 + rnd() * 3, f = 0.02 + rnd() * 0.04;
        g.beginPath();
        for (let y = 0; y <= h; y += 8) g.lineTo(x0 + Math.sin(y * f + v) * a, y);
        g.stroke();
      }
      // fuga scura tra un'asse e l'altra, e due chiodi
      g.fillStyle = 'rgba(20,10,5,0.6)';
      g.fillRect(k * pw, 0, 2, h);
      g.fillStyle = 'rgba(30,30,30,0.8)';
      g.fillRect(k * pw + pw / 2 - 2, 10, 4, 4);
      g.fillRect(k * pw + pw / 2 - 2, h - 14, 4, 4);
    }
  });
}

// Legno DIPINTO e scrostato: assi parallele (lungo la X della texture) coperte di vernice,
// con scaglie mancanti da cui si vede il legno sotto. color = colore della vernice.
export function paintedWood(color = '#3f6f73', seed = 1, planks = 8) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return canvasTexture(256, 256, (g, w, h) => {
    const pw = w / planks;
    for (let k = 0; k < planks; k++) {
      // vernice, con una tinta leggermente diversa per ogni asse
      g.fillStyle = color;
      g.fillRect(k * pw, 0, pw, h);
      g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rnd() * 0.08})`;
      g.fillRect(k * pw, 0, pw, h);
      // scaglie di vernice saltata: si vede il legno
      for (let c = 0; c < 14; c++) {
        g.fillStyle = `hsl(28, 35%, ${32 + rnd() * 12}%)`;
        const cx = k * pw + rnd() * pw, cy = rnd() * h, r = 2 + rnd() * 7;
        g.beginPath();
        for (let a = 0; a < 7; a++) {
          const ang = (a / 7) * Math.PI * 2, rr = r * (0.5 + rnd() * 0.6);
          g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 1.8);
        }
        g.fill();
      }
      // fuga tra le assi
      g.fillStyle = 'rgba(15,10,5,0.55)';
      g.fillRect(k * pw, 0, 2, h);
    }
  });
}
