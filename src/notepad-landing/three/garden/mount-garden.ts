// src/notepad-landing/three/garden/mount-garden.ts
import * as THREE from 'three';
import { PAPER_COLOR } from './ink-materials';
import { createCrosshatchGround } from './ground';
import { createPlantCluster, createPaperStem } from './plants';
import { createInkSplash } from './splashes';
import { createInkCircle, createStoneBasin } from './circles';
import { createDove, animateDove } from './doves';
import { createFloatingParticles, animateParticle } from './particles';
import { CAMERA_STATIONS } from './camera-stations';

export interface MountGardenOptions {
  scrollProgress: { current: number };
  onStationChange?: (index: number) => void;
}

export interface MountGardenReturn {
  cleanup: () => void;
}

const LAST = CAMERA_STATIONS.length - 1; // 6

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpVec3(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  return new THREE.Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}

export function mountGarden(
  canvas: HTMLCanvasElement,
  opts: MountGardenOptions,
): MountGardenReturn {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER_COLOR);
  scene.fog = new THREE.FogExp2(PAPER_COLOR, 0.012);

  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    200,
  );
  camera.position.set(0, 2, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NoToneMapping;

  // ── World composition ──
  const allGroups: THREE.Object3D[] = [];

  allGroups.push(createCrosshatchGround(scene));

  // 13 plant clusters scattered to support 7 stations
  allGroups.push(createPlantCluster(scene,  -5, 0,  -3, 1.2, 5));
  allGroups.push(createPlantCluster(scene,   6, 0,  -2, 0.8, 4));
  allGroups.push(createPlantCluster(scene,  -3, 0,   2, 0.6, 3));
  allGroups.push(createPlantCluster(scene,   4, 0,   3, 0.5, 3));
  allGroups.push(createPlantCluster(scene, -15, 0,  -5, 1.4, 6));
  allGroups.push(createPlantCluster(scene, -12, 0,   0, 1.0, 5));
  allGroups.push(createPlantCluster(scene, -18, 0,   2, 0.7, 3));
  allGroups.push(createPlantCluster(scene, -10, 0,  -8, 0.9, 4));
  allGroups.push(createPlantCluster(scene,  15, 0,  -4, 1.3, 5));
  allGroups.push(createPlantCluster(scene,  12, 0,   1, 1.1, 6));
  allGroups.push(createPlantCluster(scene,  18, 0,  -1, 0.6, 3));
  allGroups.push(createPlantCluster(scene,  -4, 0, -22, 0.9, 4));
  allGroups.push(createPlantCluster(scene,   5, 0, -20, 1.0, 5));

  // Station 5 — row of 7 paper stems centered on x=0
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 1.8; // -5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4
    allGroups.push(createPaperStem(scene, x, 0, 2, 0.9));
  }

  // Station 6 — 8 tier-post clusters along -Z
  for (let i = 0; i < 8; i++) {
    const z = -4 - i * 2.5; // -4, -6.5, -9 ... -21.5
    const x = (i % 2 === 0 ? -1 : 1) * 1.2;
    allGroups.push(createPlantCluster(scene, x, 0, z, 0.7, 2));
  }

  // Ink splashes
  createInkSplash(scene, -2, 0.5, -1, 20);
  createInkSplash(scene, 3, 1, -4, 15);
  createInkSplash(scene, -8, 0.3, -3, 25);
  createInkSplash(scene, 10, 0.8, -2, 18);
  createInkSplash(scene, -1, 0.2, -15, 30);

  // Decorative ink circles
  createInkCircle(scene, 0, 3, -5, 2.5, 0.15);
  createInkCircle(scene, -14, 2.5, -3, 1.8, 0.1);
  createInkCircle(scene, 14, 3.2, -2, 2.0, 0.12);
  createInkCircle(scene, 0, 2.8, -20, 3.0, 0.2);
  // Station 3 — the lamp itself (a single big halo high above)
  createInkCircle(scene, 0, 5.5, -3, 1.4, 0.08, 0.35);

  // Station 7 — stone basin near origin
  createStoneBasin(scene, 0, 0.02, -2);

  // Doves — 6 distributed
  const doves: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const d = createDove(
      scene,
      (Math.random() - 0.5) * 20,
      1.5 + Math.random() * 3,
      (Math.random() - 0.5) * 15 - 5,
    );
    doves.push(d);
  }

  // Floating particles
  const particles = createFloatingParticles(scene, 60);

  // ── Resize ──
  function onResize() {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }
  window.addEventListener('resize', onResize);

  // ── RAF loop ──
  let time = 0;
  let lastStation = -1;
  let rafId = 0;
  let stopped = false;

  function tick() {
    if (stopped) return;
    rafId = requestAnimationFrame(tick);
    time += 0.01;

    const p = opts.scrollProgress.current;
    const exact = p * LAST;
    const fromIdx = Math.floor(exact);
    const toIdx = Math.min(fromIdx + 1, LAST);
    const localT = smoothstep(exact - fromIdx);

    const camPos = lerpVec3(CAMERA_STATIONS[fromIdx].pos, CAMERA_STATIONS[toIdx].pos, localT);
    const camLook = lerpVec3(CAMERA_STATIONS[fromIdx].look, CAMERA_STATIONS[toIdx].look, localT);

    // Subtle breathing — reference's exact constants
    camPos.y += Math.sin(time * 0.5) * 0.08;
    camPos.x += Math.sin(time * 0.3) * 0.04;

    camera.position.lerp(camPos, 0.08);

    // Look-at low-pass — match reference
    const currentLook = new THREE.Vector3();
    camera.getWorldDirection(currentLook);
    const targetLook = camLook.clone().sub(camera.position).normalize();
    currentLook.lerp(targetLook, 0.06);
    camera.lookAt(camera.position.clone().add(currentLook.multiplyScalar(10)));

    // Station change emission
    const newStation = Math.round(p * LAST);
    if (newStation !== lastStation) {
      lastStation = newStation;
      opts.onStationChange?.(newStation);
    }

    // Per-frame animation
    particles.forEach((pt) => animateParticle(pt, time));
    doves.forEach((d) => animateDove(d, time));

    // Gentle plant sway — only non-dove groups
    allGroups.forEach((g, i) => {
      if (g.userData && (g.userData as { baseY?: number }).baseY !== undefined) return;
      g.rotation.z = Math.sin(time * 0.4 + i * 0.7) * 0.015;
      g.rotation.x = Math.cos(time * 0.3 + i * 0.5) * 0.01;
    });

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(tick);

  // ── Cleanup ──
  function cleanup() {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    scene.traverse((obj) => {
      const anyObj = obj as THREE.Mesh & THREE.Line;
      if (anyObj.geometry) anyObj.geometry.dispose();
      const mat = anyObj.material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    renderer.dispose();
  }

  return { cleanup };
}
