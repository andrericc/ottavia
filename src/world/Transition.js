// Transition.js
// ---------------------------------------------------------------
// La DISSOLVENZA tra il sogno e Ottavia, con la camera ferma.
//
// Ogni frame della transizione disegno le due scene in due "render target"
// (immagini fuori schermo) e poi le fondo su un rettangolo che copre lo schermo,
// con uno shader: un rumore liscio decide quali pixel cambiano prima, così
// l'immagine nuova "affiora" a macchie, con un bordo caldo che si allarga.
//   t = 0 → solo la scena A (il sogno), t = 1 → solo la scena B (Ottavia).
// Il viaggiatore deve comparire in tutte e due: lo sposto da una scena all'altra
// prima di ogni disegno (un oggetto può avere un solo genitore).
// ---------------------------------------------------------------
import * as THREE from 'three';

export class Transition {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const opts = { type: THREE.HalfFloatType };
    this.rtA = new THREE.WebGLRenderTarget(size.x, size.y, opts);
    this.rtB = new THREE.WebGLRenderTarget(size.x, size.y, opts);
    this.material = new THREE.ShaderMaterial({
      uniforms: { tA: { value: this.rtA.texture }, tB: { value: this.rtB.texture }, t: { value: 0 }, time: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tA, tB; uniform float t, time; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
        void main(){
          float n = 0.55 * noise(vUv * 5.0 + time * 0.05) + 0.3 * noise(vUv * 13.0) + 0.15 * noise(vUv * 31.0);
          n = mix(n, 1.0 - distance(vUv, vec2(0.5)) * 1.2, 0.35);        // si apre un po' più dal centro
          float k = smoothstep(n - 0.08, n + 0.08, t * 1.25 - 0.12);
          vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv);
          vec3 c = mix(a.rgb, b.rgb, k);
          c += vec3(1.0, 0.82, 0.55) * k * (1.0 - k) * 1.2;               // il bordo caldo
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    addEventListener('resize', () => {
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      this.rtA.setSize(s.x, s.y); this.rtB.setSize(s.x, s.y);
    });
  }

  render(sceneA, sceneB, camera, t, shared = null, time = 0) {
    const r = this.renderer;
    if (shared) sceneA.add(shared);
    r.setRenderTarget(this.rtA); r.render(sceneA, camera);
    if (shared) sceneB.add(shared);
    r.setRenderTarget(this.rtB); r.render(sceneB, camera);
    r.setRenderTarget(null);
    this.material.uniforms.t.value = t;
    this.material.uniforms.time.value = time;
    r.render(this.quadScene, this.quadCam);
  }
}
