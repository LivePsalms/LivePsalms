/* eslint-disable @typescript-eslint/ban-ts-comment */
// three/webgpu, three/tsl and three/examples/jsm/* ship no .d.ts in v0.183.
// Suppression comments below are the narrowest available fix.
// @ts-ignore
import * as THREE from 'three/webgpu';
// @ts-ignore
import { Fn, instanceIndex, instancedArray, uniform, float, int, vec3, vec4, sin, cos, floor, fract, mix, step, smoothstep, dot, normalize, storage, attribute, Loop, pass, mrt, output, emissive } from 'three/tsl';
// @ts-ignore
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
/* eslint-enable @typescript-eslint/ban-ts-comment */

// --- Module-level constants ---
const LINE_COUNT = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ? 1024 : 4096;
const TRAIL_LENGTH = 64;
const TOTAL_POINTS = LINE_COUNT * TRAIL_LENGTH;
const BOUNDS = 6.0;
const NUM_SCHEMES = 5;

export async function mountCurlLinesScene(
  canvas: HTMLCanvasElement,
): Promise<{ dispose: () => void }> {

  // 1. Scene + camera + renderer
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x988F80);

  const initialRect = canvas.parentElement
    ? canvas.parentElement.getBoundingClientRect()
    : { width: window.innerWidth, height: window.innerHeight };

  const camera = new THREE.PerspectiveCamera(60, initialRect.width / initialRect.height, 0.1, 200);
  camera.position.set(0, 0, 14);

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setSize(initialRect.width, initialRect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 2. await renderer.init()
  await renderer.init();

  // 3. Storage buffers
  const particlePos = instancedArray(LINE_COUNT, 'vec3');
  const particleLife = instancedArray(LINE_COUNT, 'vec4'); // life, maxLife, speed, phase
  const trailPositions = instancedArray(TOTAL_POINTS, 'vec4'); // xyz + alpha

  // 4. Uniforms
  const uBounds = uniform(float(BOUNDS));
  const uTrailLength = uniform(float(TRAIL_LENGTH));
  const uNoiseScale = uniform(float(0.09));
  const uTimeSpeed = uniform(float(0.4));
  const uParticleSpeed = uniform(float(4.0));
  const uBrightness = uniform(float(1.2));
  const uCurlOctaves = uniform(float(2.0));
  const uSpawnRadius = uniform(float(1.0));
  const uTipIntensity = uniform(float(1.0));
  const uTime = uniform(float(0.0));
  const uDeltaTime = uniform(float(1.0 / 60.0));

  // --- Color Palette Uniforms ---
  // Each palette has 3 color pairs (6 vec3s): axisA_lo, axisA_hi, axisB_lo, axisB_hi, axisC_lo, axisC_hi
  const uPalALo = uniform(vec3(0.04, 0.06, 0.3));
  const uPalAHi = uniform(vec3(0.45, 0.08, 0.18));
  const uPalBLo = uniform(vec3(0.03, 0.2, 0.1));
  const uPalBHi = uniform(vec3(0.35, 0.22, 0.5));
  const uPalCLo = uniform(vec3(0.03, 0.25, 0.3));
  const uPalCHi = uniform(vec3(0.5, 0.25, 0.08));

  // 5. palettes object literal + seed Cosmic into uPal*
  const palettes = {
    Cosmic: {
      aLo: [0.04, 0.06, 0.3],  aHi: [0.45, 0.08, 0.18],
      bLo: [0.03, 0.2, 0.1],   bHi: [0.35, 0.22, 0.5],
      cLo: [0.03, 0.25, 0.3],  cHi: [0.5, 0.25, 0.08],
    },
    Ocean: {
      aLo: [0.01, 0.06, 0.18], aHi: [0.05, 0.25, 0.45],
      bLo: [0.0, 0.12, 0.22],  bHi: [0.12, 0.4, 0.35],
      cLo: [0.02, 0.08, 0.15], cHi: [0.18, 0.38, 0.5],
    },
    Fire: {
      aLo: [0.2, 0.02, 0.0],   aHi: [0.5, 0.35, 0.03],
      bLo: [0.25, 0.04, 0.0],  bHi: [0.5, 0.15, 0.02],
      cLo: [0.12, 0.0, 0.0],   cHi: [0.5, 0.25, 0.0],
    },
    Neon: {
      aLo: [0.35, 0.0, 0.22],  aHi: [0.0, 0.4, 0.15],
      bLo: [0.0, 0.07, 0.4],   bHi: [0.4, 0.4, 0.0],
      cLo: [0.22, 0.0, 0.4],   cHi: [0.0, 0.4, 0.4],
    },
    Aurora: {
      aLo: [0.0, 0.28, 0.1],   aHi: [0.12, 0.04, 0.38],
      bLo: [0.0, 0.18, 0.18],  bHi: [0.04, 0.38, 0.15],
      cLo: [0.02, 0.22, 0.25], cHi: [0.25, 0.08, 0.32],
    },
    Ember: {
      aLo: [0.06, 0.0, 0.0],   aHi: [0.4, 0.06, 0.0],
      bLo: [0.12, 0.02, 0.0],  bHi: [0.45, 0.2, 0.04],
      cLo: [0.04, 0.0, 0.0],   cHi: [0.3, 0.08, 0.02],
    },
  };

  // Seed Cosmic palette into uniforms
  (uPalALo.value as THREE.Vector3).set(...(palettes.Cosmic.aLo as [number, number, number]));
  (uPalAHi.value as THREE.Vector3).set(...(palettes.Cosmic.aHi as [number, number, number]));
  (uPalBLo.value as THREE.Vector3).set(...(palettes.Cosmic.bLo as [number, number, number]));
  (uPalBHi.value as THREE.Vector3).set(...(palettes.Cosmic.bHi as [number, number, number]));
  (uPalCLo.value as THREE.Vector3).set(...(palettes.Cosmic.cLo as [number, number, number]));
  (uPalCHi.value as THREE.Vector3).set(...(palettes.Cosmic.cHi as [number, number, number]));

  // 6. hash3 / quintic / smoothNoise3 / curlNoise Fn declarations

  // Hash function: lattice point -> vec3 in [-1, 1]
  const hash3 = Fn(([p_immutable]: [unknown]) => {
    const p = vec3(p_immutable as Parameters<typeof vec3>[0]).toVar();
    const px = fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
    const py = fract(sin(dot(p, vec3(269.5, 183.3, 246.1))).mul(22578.1459));
    const pz = fract(sin(dot(p, vec3(113.5, 271.9, 124.6))).mul(31572.2973));
    return vec3(px, py, pz).mul(2.0).sub(1.0);
  });

  // Quintic smoothstep for C2-continuous interpolation
  const quintic = Fn(([t_immutable]: [unknown]) => {
    const t = vec3(t_immutable as Parameters<typeof vec3>[0]).toVar();
    return t.mul(t).mul(t).mul(t.mul(t.mul(6.0).sub(15.0)).add(10.0));
  });

  // Smooth 3D noise: trilinear interpolation of hashed lattice values
  const smoothNoise3 = Fn(([p_immutable]: [unknown]) => {
    const p = vec3(p_immutable as Parameters<typeof vec3>[0]).toVar();
    const i = floor(p).toVar();
    const f = fract(p).toVar();
    const u = quintic(f);

    // 8 corners of the unit cube
    const c000 = hash3(i);
    const c100 = hash3(i.add(vec3(1, 0, 0)));
    const c010 = hash3(i.add(vec3(0, 1, 0)));
    const c110 = hash3(i.add(vec3(1, 1, 0)));
    const c001 = hash3(i.add(vec3(0, 0, 1)));
    const c101 = hash3(i.add(vec3(1, 0, 1)));
    const c011 = hash3(i.add(vec3(0, 1, 1)));
    const c111 = hash3(i.add(vec3(1, 1, 1)));

    // Trilinear interpolation
    const x0 = mix(c000, c100, u.x);
    const x1 = mix(c010, c110, u.x);
    const x2 = mix(c001, c101, u.x);
    const x3 = mix(c011, c111, u.x);
    const y0 = mix(x0, x1, u.y);
    const y1 = mix(x2, x3, u.y);
    return mix(y0, y1, u.z);
  });

  // Curl of the smooth noise field via finite differences
  const curlNoise = Fn(([p_immutable]: [unknown]) => {
    const p = vec3(p_immutable as Parameters<typeof vec3>[0]).toVar();
    const e = float(0.05);
    const dxp = smoothNoise3(p.add(vec3(e, 0, 0)));
    const dxn = smoothNoise3(p.sub(vec3(e, 0, 0)));
    const dyp = smoothNoise3(p.add(vec3(0, e, 0)));
    const dyn = smoothNoise3(p.sub(vec3(0, e, 0)));
    const dzp = smoothNoise3(p.add(vec3(0, 0, e)));
    const dzn = smoothNoise3(p.sub(vec3(0, 0, e)));
    const inv = float(1.0).div(e.mul(2.0));
    const x = dyp.z.sub(dyn.z).sub(dzp.y.sub(dzn.y)).mul(inv);
    const y = dzp.x.sub(dzn.x).sub(dxp.z.sub(dxn.z)).mul(inv);
    const z = dxp.y.sub(dxn.y).sub(dyp.x.sub(dyn.x)).mul(inv);
    const curl = vec3(x, y, z).toVar();
    const len = curl.length().max(0.0001);
    return curl.div(len);
  });

  // 7. initCompute + initTrails + shiftTrails + updateParticles Fn declarations

  // Init Compute: seed particles + trails
  const initCompute = Fn(() => {
    const i = instanceIndex;
    // Use widely spaced seeds per particle so positions are uncorrelated
    const fi = float(i);
    const s1 = fract(sin(fi.mul(127.1)).mul(43758.5453));
    const s2 = fract(sin(fi.mul(269.5)).mul(22578.1459));
    const s3 = fract(sin(fi.mul(419.2)).mul(31572.2973));
    // Uniform distribution inside a sphere using cube-root for radius
    const theta = s1.mul(6.283185);
    const phi = s2.mul(2.0).sub(1.0).acos();
    const r = s3.pow(float(1.0 / 3.0)).mul(uBounds.mul(uSpawnRadius));
    const sinPhi = sin(phi);
    const pos = vec3(
      r.mul(sinPhi).mul(cos(theta)),
      r.mul(sinPhi).mul(sin(theta)),
      r.mul(cos(phi))
    );
    particlePos.element(i).assign(pos);
    const phase = fract(sin(fi.mul(631.7)).mul(9758.1234)).mul(6.283);
    const speed = mix(float(0.5), float(2.0), fract(sin(fi.mul(347.3)).mul(15823.7891)));
    particleLife.element(i).assign(vec4(phase, speed, float(0.0), float(0.0)));
  })().compute(LINE_COUNT);

  const initTrails = Fn(() => {
    const idx = instanceIndex;
    const lineIdx = int(floor(float(idx).div(uTrailLength)));
    const pos = particlePos.element(lineIdx);
    trailPositions.element(idx).assign(vec4(pos, float(0.0)));
  })().compute(TOTAL_POINTS);

  // Shift trails: shift from tail toward head (reverse order avoids overwrite)
  const shiftTrails = Fn(() => {
    const lineIdx = instanceIndex;
    const tl = int(uTrailLength);
    const baseIdx = lineIdx.mul(tl);

    // Simply shift positions down the trail — copy xyz+w as-is
    Loop({ start: tl.sub(1), end: int(0), type: 'int', condition: '>' }, ({ i }: { i: ReturnType<typeof int> }) => {
      const dst = baseIdx.add(i);
      const src = baseIdx.add(i.sub(1));
      trailPositions.element(dst).assign(trailPositions.element(src));
    });
  })().compute(LINE_COUNT);

  // Update particles: move with curl noise, manage life
  const updateParticles = Fn(() => {
    const i = instanceIndex;
    const pos = particlePos.element(i).toVar();
    const lifeData = particleLife.element(i).toVar();
    const phase = lifeData.x;
    const speed = lifeData.y;

    const timeOffset = uTime.mul(uTimeSpeed).add(phase);
    const samplePos = pos.mul(uNoiseScale).add(vec3(timeOffset, float(0.0), timeOffset.mul(0.7)));

    // Layer multiple octaves of curl noise for richer flow
    const totalCurl = vec3(0.0, 0.0, 0.0).toVar();
    const amplitude = float(1.0).toVar();
    const freq = float(1.0).toVar();
    const ampSum = float(0.0).toVar();
    const octaves = int(uCurlOctaves);

    Loop({ start: int(0), end: octaves, type: 'int' }, () => {
      totalCurl.addAssign(curlNoise(samplePos.mul(freq)).mul(amplitude));
      ampSum.addAssign(amplitude);
      freq.mulAssign(2.1);
      amplitude.mulAssign(0.45);
    });
    totalCurl.divAssign(ampSum);

    const vel = totalCurl.mul(uParticleSpeed).mul(speed).mul(uDeltaTime);
    const newPos = pos.add(vel).toVar();

    // Random seed for respawn
    const s3Rand = fract(sin(float(i).mul(419.2).add(uTime.mul(0.1))).mul(31572.2973));

    // Soft wrap: spherical boundary — push particles back toward center when near radius
    const bounds = uBounds;
    const dist = newPos.length();

    // Respawn particles that escape far beyond bounds back into spawn radius
    const escaped = step(bounds.mul(1.2), dist);
    const respawnR = s3Rand.pow(float(1.0 / 3.0)).mul(uBounds.mul(uSpawnRadius));
    const respawnPos = normalize(newPos).mul(respawnR);
    newPos.assign(mix(newPos, respawnPos, escaped));

    const pushStrength = smoothstep(bounds.mul(0.6), bounds, dist).mul(uDeltaTime).mul(10.0);
    const pushDir = newPos.normalize().negate();
    newPos.addAssign(pushDir.mul(pushStrength));

    particlePos.element(i).assign(newPos);

    // Write head of trail — always full alpha (immortal particles)
    const baseIdx = i.mul(int(uTrailLength));
    trailPositions.element(baseIdx).assign(vec4(newPos, float(1.0)));
  })().compute(LINE_COUNT);

  // 8. Geometry typed arrays + StorageBufferAttribute + BufferGeometry setup
  const posArray = new Float32Array(TOTAL_POINTS * 3);
  const alphaArray = new Float32Array(TOTAL_POINTS);
  const posAttr = new THREE.StorageBufferAttribute(posArray, 3);
  const alphaAttr = new THREE.StorageBufferAttribute(alphaArray, 1);

  // Build index buffer: line segments connecting consecutive trail points
  const lineIndexArray = new Float32Array(TOTAL_POINTS);
  const indices: number[] = [];
  for (let l = 0; l < LINE_COUNT; l++) {
    const base = l * TRAIL_LENGTH;
    for (let p = 0; p < TRAIL_LENGTH - 1; p++) {
      indices.push(base + p, base + p + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('aAlpha', alphaAttr);
  geometry.setIndex(indices);

  // 9. posStorage + alphaStorage storage refs
  const posStorage = storage(posAttr, 'vec3', TOTAL_POINTS);
  const alphaStorage = storage(alphaAttr, 'float', TOTAL_POINTS);

  // 10. writeToGeometry Fn declaration
  const writeToGeometry = Fn(() => {
    const idx = instanceIndex;
    const data = trailPositions.element(idx);
    posStorage.element(idx).assign(data.xyz);

    // Compute linear fade along trail: head=1, tail=0, then multiply by head alpha
    const lineIdx = int(floor(float(idx).div(uTrailLength)));
    const localIdx = idx.sub(lineIdx.mul(int(uTrailLength)));
    const trailFade = float(1.0).sub(float(localIdx).div(uTrailLength.sub(1.0)));
    alphaStorage.element(idx).assign(data.w.mul(trailFade));
  })().compute(TOTAL_POINTS);

  // 11. uLineWidth + lineMaterial + lineIndexAttr + trailColor Fn + linesMesh

  const uLineWidth = uniform(float(3.0));
  const lineMaterial = new THREE.LineBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  lineMaterial.linewidthNode = uLineWidth;

  // Per-vertex line index attribute for color variation
  for (let l = 0; l < LINE_COUNT; l++) {
    const base = l * TRAIL_LENGTH;
    for (let p = 0; p < TRAIL_LENGTH; p++) {
      lineIndexArray[base + p] = l;
    }
  }
  const lineIndexAttr = new THREE.StorageBufferAttribute(lineIndexArray, 1);
  geometry.setAttribute('aLineIdx', lineIndexAttr);

  const trailColor = Fn(() => {
    const a = attribute('aAlpha', 'float');
    const lineIdx = attribute('aLineIdx', 'float');

    // Trail-based gradient: a=1 at head, a=0 at tail
    const t = a.pow(0.6);

    // Blend palette colors along the trail: head = hi colors, tail = lo colors
    const colA = mix(uPalALo, uPalAHi, t);
    const colB = mix(uPalBLo, uPalBHi, t);
    const colC = mix(uPalCLo, uPalCHi, t);

    // Mix the three palette channels together
    const baseCol = colA.mul(0.4).add(colB.mul(0.35)).add(colC.mul(0.25));

    // Per-line color variation using deterministic hash from line index
    // Generate 5 distinct scheme types based on line index
    const schemeHash = fract(sin(lineIdx.mul(127.1)).mul(43758.5453));
    const schemeId = floor(schemeHash.mul(float(NUM_SCHEMES)));

    // Scheme 0: original (no shift)
    // Scheme 1: warm — boost red/yellow, reduce blue
    // Scheme 2: cool — boost blue/cyan, reduce red
    // Scheme 3: gold — boost red+green, reduce blue
    // Scheme 4: mint — boost green+blue, reduce red

    const hueShift = fract(sin(lineIdx.mul(311.7)).mul(22578.1459)).mul(0.3).sub(0.15);

    // Rotate color channels based on scheme
    const r = baseCol.x.toVar();
    const g = baseCol.y.toVar();
    const b = baseCol.z.toVar();

    // Scheme 1: warm shift
    const isWarm = step(0.5, schemeId).mul(step(schemeId, float(1.5)));
    r.addAssign(isWarm.mul(0.12));
    g.addAssign(isWarm.mul(0.04));
    b.mulAssign(mix(float(1.0), float(0.5), isWarm));

    // Scheme 2: cool/cyan shift
    const isCool = step(1.5, schemeId).mul(step(schemeId, float(2.5)));
    r.mulAssign(mix(float(1.0), float(0.45), isCool));
    g.addAssign(isCool.mul(0.08));
    b.addAssign(isCool.mul(0.15));

    // Scheme 3: gold shift
    const isGold = step(2.5, schemeId).mul(step(schemeId, float(3.5)));
    r.addAssign(isGold.mul(0.15));
    g.addAssign(isGold.mul(0.1));
    b.mulAssign(mix(float(1.0), float(0.35), isGold));

    // Scheme 4: mint/teal shift
    const isMint = step(3.5, schemeId).mul(step(schemeId, float(4.5)));
    r.mulAssign(mix(float(1.0), float(0.4), isMint));
    g.addAssign(isMint.mul(0.12));
    b.addAssign(isMint.mul(0.08));

    // Apply subtle per-line hue variation on top
    r.addAssign(hueShift.mul(0.1));
    g.addAssign(hueShift.mul(0.05));

    const variedCol = vec3(r, g, b).max(vec3(0.0));

    // Brighten the tip
    const tipBoost = a.pow(0.3).mul(uTipIntensity).add(0.2);

    return variedCol.mul(a).mul(uBrightness).mul(tipBoost);
  });

  lineMaterial.colorNode = trailColor();
  // Emissive heavily weighted toward the tip for bloom punch
  lineMaterial.emissiveNode = trailColor().mul(0.9);

  lineMaterial.opacityNode = attribute('aAlpha', 'float');

  const linesMesh = new THREE.LineSegments(geometry, lineMaterial);
  linesMesh.frustumCulled = false;
  linesMesh.name = 'trailLines';
  scene.add(linesMesh);

  // 12. Fog (modified per Modify-list #2: color 0x988F80 matches taupe background)
  scene.fog = new THREE.FogExp2(0x988F80, 0.018);

  // 13. Post-processing chain
  const postProcessing = new THREE.PostProcessing(renderer);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));

  const scenePassColor = scenePass.getTextureNode('output');
  const scenePassEmissive = scenePass.getTextureNode('emissive');

  const bloomPass = bloom(scenePassEmissive, 2.2, 0.75, 0.15);

  postProcessing.outputNode = scenePassColor.add(bloomPass);

  // 14. Pre-warm (chunked async per Modify-list #3)
  await renderer.computeAsync(initCompute);
  await renderer.computeAsync(initTrails);

  const PREWARM_STEPS = 360;
  const PREWARM_DT = 1.0 / 60.0;
  const PREWARM_CHUNK = 20;
  uDeltaTime.value = PREWARM_DT;

  let prewarmStep = 0;
  await new Promise<void>((resolve) => {
    function runChunk() {
      const limit = Math.min(prewarmStep + PREWARM_CHUNK, PREWARM_STEPS);
      const promises: Promise<unknown>[] = [];
      for (let i = prewarmStep; i < limit; i++) {
        uTime.value = i * PREWARM_DT;
        promises.push(renderer.computeAsync(shiftTrails));
        promises.push(renderer.computeAsync(updateParticles));
      }
      Promise.all(promises).then(() => {
        prewarmStep = limit;
        if (prewarmStep >= PREWARM_STEPS) {
          resolve();
        } else {
          requestAnimationFrame(runChunk);
        }
      });
    }
    runChunk();
  });

  await renderer.computeAsync(writeToGeometry);

  // 15. Animation loop (stripped of controls + FPS per Modify-list #4)
  const clock = new THREE.Clock();
  function animate() {
    const dt = clock.getDelta();
    uTime.value += dt;
    uDeltaTime.value = dt;
    renderer.compute(shiftTrails);
    renderer.compute(updateParticles);
    renderer.compute(writeToGeometry);
    postProcessing.render();
  }
  renderer.setAnimationLoop(animate);

  // 16. ResizeObserver scoped to canvas's parent (per Modify-list #5)
  const target = canvas.parentElement ?? canvas;
  const resizeObserver = new ResizeObserver(() => {
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height);
  });
  resizeObserver.observe(target);

  // 17. Return dispose handle (per Modify-list #6)
  return {
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      geometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    },
  };
}
