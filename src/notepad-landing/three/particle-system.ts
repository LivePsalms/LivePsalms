import * as THREE from 'three';
import { makePencil } from './shapes/pencil';
import { makeHeart } from './shapes/heart';
import { makeJournal } from './shapes/journal';

export interface MountOptions {
  prm: boolean;
  onShapeChange?: (index: number) => void;
}

interface MountReturn {
  setShape: (index: number) => void;
  cleanup: () => void;
}

const COLOR_LIGHT = new THREE.Color(0xf6f0e6); // Silence
const COLOR_MID = new THREE.Color(0xdfd3bf); // Seedpearl
const COLOR_WARM = new THREE.Color(0x7c6656); // Cocoa
const BG = new THREE.Color(0x0e0e0e);

function paintStaticJournal(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  const positions = makeJournal(2000);
  ctx.fillStyle = 'rgba(246, 240, 230, 0.8)';
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  const s = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.25;
  for (let i = 0; i < positions.length; i += 3) {
    const x = cx + positions[i] * s;
    const y = cy - positions[i + 1] * s;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

export function mountParticleSystem(canvas: HTMLCanvasElement, options: MountOptions): MountReturn {
  const { prm } = options;

  if (prm) {
    paintStaticJournal(canvas);
    return { setShape: () => {}, cleanup: () => {} };
  }

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const PARTICLE_COUNT = isMobile ? 10000 : 25000;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    console.warn('[notepad-landing] WebGL unavailable — falling back to static silhouette', err);
    paintStaticJournal(canvas);
    return { setShape: () => {}, cleanup: () => {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.5;

  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.FogExp2(0x0e0e0e, 0.02);

  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  const shapes = [makePencil(PARTICLE_COUNT), makeHeart(PARTICLE_COUNT), makeJournal(PARTICLE_COUNT)];

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  positions.set(shapes[0]);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const randoms = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const ratio = i / PARTICLE_COUNT;
    const color =
      ratio < 0.5
        ? COLOR_LIGHT.clone().lerp(COLOR_MID, ratio * 2)
        : COLOR_MID.clone().lerp(COLOR_WARM, (ratio - 0.5) * 2);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = 0.012 + Math.random() * 0.02;
    randoms[i] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMorph: { value: 0 },
      uMouse3D: { value: new THREE.Vector3(0, 0, 0) },
      uMouseActive: { value: 0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aRandom;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uMorph;
      uniform vec3 uMouse3D;
      uniform float uMouseActive;
      void main() {
        vColor = color;
        vec3 pos = position;
        float breath = sin(uTime * 0.5 + aRandom * 6.28) * 0.02;
        pos += normalize(pos + vec3(0.0001)) * breath;
        float scatter = sin(uMorph * 3.14159) * 0.3;
        pos += normalize(pos + vec3(0.001)) * scatter * aRandom;

        vec3 toParticle = pos - uMouse3D;
        float xyDist = length(toParticle.xy);
        float fullDist = length(toParticle);
        float mouseRadius = 1.4;
        float influence = 1.0 - smoothstep(0.0, mouseRadius, xyDist);
        influence = influence * influence * uMouseActive;
        if (influence > 0.001) {
          vec3 pushDir = fullDist > 0.001 ? normalize(toParticle) : vec3(0.0, 1.0, 0.0);
          pos += pushDir * (influence * 0.3);
          float swirlSpeed = uTime * 2.0 + aRandom * 6.28;
          vec2 radial = pos.xy - uMouse3D.xy;
          float angle = (influence * 0.25) * (1.0 + sin(swirlSpeed) * 0.3);
          float cosA = cos(angle);
          float sinA = sin(angle);
          vec2 rotated = vec2(radial.x * cosA - radial.y * sinA, radial.x * sinA + radial.y * cosA);
          pos.xy = uMouse3D.xy + rotated;
          pos.z += sin(swirlSpeed * 0.7 + aRandom * 3.14) * influence * 0.15;
        }

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * 500.0 / -mvPos.z;
        gl_PointSize = max(gl_PointSize, 1.5);
        gl_Position = projectionMatrix * mvPos;
        vAlpha = 0.85 + 0.15 * (1.0 - smoothstep(0.0, 10.0, -mvPos.z));
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
        vec3 brightColor = vColor * 2.2 + 0.15;
        gl_FragColor = vec4(brightColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  const ambient = new THREE.AmbientLight(0xffeedd, 3);
  scene.add(ambient);

  let currentShape = 0;
  let targetShape = 0;
  let morphStartTime = 0;
  let isMorphing = false;
  const morphDuration = 2.5;
  const clock = new THREE.Clock();

  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function startMorph(idx: number) {
    if (isMorphing || idx === currentShape) return;
    targetShape = idx;
    isMorphing = true;
    morphStartTime = clock.getElapsedTime();
  }

  let autoMorphTimer = window.setInterval(() => {
    const next = (currentShape + 1) % shapes.length;
    startMorph(next);
  }, 5000);

  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2(9999, 9999);
  const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersectPoint = new THREE.Vector3();
  const localMouse = new THREE.Vector3();
  const invMatrix = new THREE.Matrix4();
  let mouseOnScreen = false;
  let mouseActiveSmooth = 0;

  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mouseOnScreen = true;
  }
  function onMouseLeave() {
    mouseNDC.set(9999, 9999);
    mouseOnScreen = false;
  }

  if (!isTouch) {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
  }

  function onResize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  window.addEventListener('resize', onResize);

  let rafId = 0;
  let stopped = false;
  function animate() {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    material.uniforms.uTime.value = elapsed;
    mouseActiveSmooth += ((mouseOnScreen ? 1 : 0) - mouseActiveSmooth) * 0.08;
    material.uniforms.uMouseActive.value = mouseActiveSmooth;

    raycaster.setFromCamera(mouseNDC, camera);
    raycaster.ray.intersectPlane(mousePlane, intersectPoint);
    invMatrix.copy(particles.matrixWorld).invert();
    localMouse.copy(intersectPoint).applyMatrix4(invMatrix);
    material.uniforms.uMouse3D.value.copy(localMouse);

    if (isMorphing) {
      const rawProgress = Math.min((elapsed - morphStartTime) / morphDuration, 1);
      const morphProgress = easeInOutCubic(rawProgress);
      material.uniforms.uMorph.value = morphProgress;
      const src = shapes[currentShape];
      const tgt = shapes[targetShape];
      const posArr = geometry.attributes.position.array as Float32Array;
      const len = PARTICLE_COUNT * 3;
      for (let i = 0; i < len; i++) {
        posArr[i] = src[i] + (tgt[i] - src[i]) * morphProgress;
      }
      geometry.attributes.position.needsUpdate = true;
      if (rawProgress >= 1) {
        isMorphing = false;
        currentShape = targetShape;
        material.uniforms.uMorph.value = 0;
        options.onShapeChange?.(currentShape);
      } else if (rawProgress > 0.4 && rawProgress < 0.6) {
        options.onShapeChange?.(targetShape);
      }
    }

    particles.rotation.y = elapsed * 0.05;
    particles.position.y = Math.sin(elapsed * 0.3) * 0.05;
    renderer.render(scene, camera);
  }
  animate();

  return {
    setShape: (idx: number) => {
      window.clearInterval(autoMorphTimer);
      startMorph(idx);
      autoMorphTimer = window.setInterval(() => {
        const next = (currentShape + 1) % shapes.length;
        startMorph(next);
      }, 5000);
    },
    cleanup: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.clearInterval(autoMorphTimer);
      window.removeEventListener('resize', onResize);
      if (!isTouch) {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
