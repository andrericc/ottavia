// MirrorWater.js
// ---------------------------------------------------------------
// Il LAGO-SPECCHIO di Valdrada: un riflesso planare vero, scritto da noi.
//
// Ogni frame:
//  1. costruisco una "camera specchio": la camera del giocatore riflessa rispetto
//     al piano dell'acqua (posizione, direzione e vettore 'up' ribaltati);
//  2. le taglio via tutto ciò che sta SOTTO l'acqua con un piano di clipping obliquo
//     (tecnica di Lengyel: si modifica la matrice di proiezione in modo che il piano
//     vicino coincida con la superficie dell'acqua) — così i pali dei pontili non
//     "bucano" il riflesso;
//  3. disegno la scena da lì in un'immagine fuori schermo (render target);
//  4. lo shader dell'acqua proietta quell'immagine sulla superficie con una
//     "texture matrix" (bias · proiezione · vista della camera specchio) e la
//     deforma con due normal map che scorrono: l'acqua si increspa appena.
//     Un termine di Fresnel decide quanto si vede il riflesso e quanto il colore
//     del fondo: guardando radenti è quasi uno specchio, guardando giù si vede l'acqua.
//
// LAYER: la camera specchio vede il layer 0 (la città) e il layer 1 (le cose che
// esistono SOLO nel riflesso, come gli abitanti di Valdrada); non vede il layer 2,
// dove sta il viaggiatore — che a Valdrada non ha riflesso.
// ---------------------------------------------------------------
import * as THREE from 'three';

export const LAYER_REFLECTION_ONLY = 1;
export const LAYER_NO_REFLECTION = 2;

export class MirrorWater {
  constructor({ size = 800, height = 0, normalMap, color = '#2c3a48', resolution = 0.75 } = {}) {
    this.height = height;
    this.resolution = resolution;
    this.renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.mirrorCamera = new THREE.PerspectiveCamera();
    this.mirrorCamera.layers.enable(LAYER_REFLECTION_ONLY);
    this.textureMatrix = new THREE.Matrix4();

    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      tReflection: { value: null },
      tNormal: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      time: { value: 0 },
      waterColor: { value: new THREE.Color(color) },
      eye: { value: new THREE.Vector3() },
      distortion: { value: 0.018 },
      ripple: { value: 0 },          // increspatura extra (0 = specchio quasi fermo)
    }]);
    uniforms.tReflection.value = this.renderTarget.texture;
    uniforms.tNormal.value = normalMap;

    this.material = new THREE.ShaderMaterial({
      uniforms, fog: true,
      vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        varying vec4 vProj;
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          vProj = textureMatrix * world;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tReflection, tNormal;
        uniform float time, distortion, ripple;
        uniform vec3 waterColor, eye;
        varying vec4 vProj;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        vec3 waterNormal(vec2 p) {
          // due strati di increspature che scorrono in direzioni diverse
          vec3 a = texture2D(tNormal, p * 0.045 + vec2(time * 0.006, time * 0.004)).xyz * 2.0 - 1.0;
          vec3 b = texture2D(tNormal, p * 0.11 - vec2(time * 0.009, -time * 0.005)).xyz * 2.0 - 1.0;
          vec3 n = a + b * 0.6;
          return normalize(vec3(n.x, n.z * 1.6 + 1.0, n.y));
        }
        void main() {
          vec3 n = waterNormal(vWorld.xz);
          vec3 toEye = normalize(eye - vWorld);
          // Fresnel (approssimazione di Schlick): radente = specchio
          float cosT = clamp(dot(toEye, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
          // il lago di Valdrada è più specchio che acqua: anche guardando in giù il riflesso resta forte
          float fresnel = 0.62 + 0.38 * pow(1.0 - cosT, 3.0);
          // il riflesso, spostato dalle increspature
          vec2 uv = vProj.xy / vProj.w + n.xz * (distortion + ripple);
          vec3 refl = texture2D(tReflection, uv).rgb;
          vec3 col = mix(waterColor, refl, fresnel);
          // un velo chiaro sulle increspature, come la luce bassa che le sfiora
          col += vec3(0.85, 0.88, 0.92) * pow(max(0.0, n.x * 0.5 + n.z * 0.3), 3.0) * 0.08;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          // nebbia più leggera sull'acqua: il riflesso (che ha già la sua nebbia) resta nitido
          #ifdef USE_FOG
            #ifdef FOG_EXP2
              float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
            #else
              float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
            #endif
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor * 0.45);
          #endif
        }`,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = height;
    this.mesh.onBeforeRender = () => {}; // il riflesso si prepara a parte, in render()
  }

  // Prepara il riflesso per la camera di questo frame (da chiamare prima del render principale)
  render(renderer, scene, camera, time) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, Math.floor(size.x * this.resolution)), h = Math.max(1, Math.floor(size.y * this.resolution));
    if (this.renderTarget.width !== w || this.renderTarget.height !== h) this.renderTarget.setSize(w, h);

    const mc = this.mirrorCamera, N = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(0, this.height, 0);
    camera.updateMatrixWorld();
    // posizione riflessa
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y < this.height) return; // camera sott'acqua: niente riflesso
    const view = P.clone().sub(camPos).reflect(N).negate().add(P);
    view.x = camPos.x; view.z = camPos.z; view.y = 2 * this.height - camPos.y;
    // direzione riflessa
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = new THREE.Vector3(look.x, 2 * this.height - look.y, look.z);
    mc.position.copy(view);
    mc.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
    mc.lookAt(target);
    mc.near = camera.near; mc.far = camera.far;
    mc.fov = camera.fov; mc.aspect = camera.aspect;
    mc.updateProjectionMatrix();
    mc.updateMatrixWorld();

    // texture matrix: dallo spazio del mondo alle coordinate (0..1) dell'immagine riflessa
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    this.material.uniforms.textureMatrix.value.copy(this.textureMatrix);

    // clipping obliquo (Lengyel): il piano vicino della camera specchio = superficie dell'acqua
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(N, P).applyMatrix4(mc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = mc.projectionMatrix.elements, q = new THREE.Vector4(
      (Math.sign(clip.x) + pm[8]) / pm[0], (Math.sign(clip.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.0; pm[14] = clip.w;

    // disegno la scena riflessa (senza l'acqua stessa)
    this.mesh.visible = false;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.clear();
    if (this.onBefore) this.onBefore();   // es. la storia accende le finestre solo nel riflesso
    renderer.render(scene, mc);
    if (this.onAfter) this.onAfter();
    renderer.setRenderTarget(prevTarget);
    this.mesh.visible = true;

    this.material.uniforms.time.value = time;
    this.material.uniforms.eye.value.copy(camPos);
  }
}
