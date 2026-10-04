// Transition.js
// ---------------------------------------------------------------
// Il PASSAGGIO tra il sogno e Ottavia, con la camera ferma: la NEBBIA CHE SI ALZA.
//
// Prima metà (t 0 → 0.5): la nebbia color crema del sogno si infittisce a sbuffi
// (un rumore che scorre lento verso l'alto) finché copre tutto lo schermo.
// A metà, dietro la nebbia, la scena cambia. Seconda metà (t 0.5 → 1): la nebbia
// si solleva dal basso verso l'alto e sotto compare Ottavia.
//   t = 0 → solo la scena A (il sogno), t = 1 → solo la scena B (Ottavia).
// Ogni frame disegno la scena visibile in un "render target" (un'immagine fuori
// schermo) e poi la ripasso su un rettangolo che copre lo schermo con lo shader
// della nebbia. Il viaggiatore deve stare in tutte e due le scene: lo sposto in
// quella che disegno (un oggetto può avere un solo genitore).
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
        float fbm(vec2 p){ return 0.5 * noise(p) + 0.3 * noise(p * 2.1) + 0.2 * noise(p * 4.3); }
        void main(){
          vec4 base = t < 0.5 ? texture2D(tA, vUv) : texture2D(tB, vUv);
          float thick = clamp(t * 2.0, 0.0, 1.0);          // quanto si è infittita
          float lift  = clamp(t * 2.0 - 1.0, 0.0, 1.0);    // quanto si è sollevata
          // sbuffi che salgono lenti
          float n = fbm(vUv * vec2(3.0, 2.0) + vec2(time * 0.02, -time * 0.07));
          // copertura: cresce con thick, poi si ritira dal basso verso l'alto con lift
          float c = thick * 1.25 - 0.3 - max(0.0, lift * 2.6 - vUv.y);
          float a = smoothstep(0.0, 0.55, c + (n - 0.5) * 0.6);
          a *= smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.9, 1.0, lift));
          vec3 fog = mix(vec3(0.93, 0.88, 0.82), vec3(1.0, 0.97, 0.92), n);   // crema del sogno, con luce
          gl_FragColor = vec4(mix(base.rgb, fog, a), 1.0);
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
    // dietro la nebbia serve una sola scena: il sogno nella prima metà, Ottavia nella seconda
    const sc = t < 0.5 ? sceneA : sceneB, rt = t < 0.5 ? this.rtA : this.rtB;
    if (shared) sc.add(shared);
    r.setRenderTarget(rt); r.render(sc, camera);
    r.setRenderTarget(null);
    this.material.uniforms.t.value = t;
    this.material.uniforms.time.value = time;
    r.render(this.quadScene, this.quadCam);
  }
}
