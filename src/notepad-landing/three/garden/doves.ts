// src/notepad-landing/three/garden/doves.ts
import * as THREE from 'three';
import { inkLineMaterial } from './ink-materials';

interface DoveUserData {
  baseY: number;
  baseX: number;
  phase: number;
  speed: number;
}

// Dove wing — narrower and pointed compared to the reference butterfly.
function wingShape(mirror: 1 | -1): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI;
    // 0.4 length, narrower aspect ratio than the butterfly
    const r = 0.4 * Math.sin(angle) * (1 + 0.15 * Math.sin(angle * 4));
    pts.push(new THREE.Vector3(
      mirror * r * Math.cos(angle) * 1.1,
      r * Math.sin(angle) * 0.5,
      0,
    ));
  }
  return pts;
}

export function createDove(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  ([-1, 1] as const).forEach((side) => {
    const pts = wingShape(side);
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const wing = new THREE.Line(geom, inkLineMaterial(0.4));
    group.add(wing);
  });

  const userData: DoveUserData = {
    baseY: y,
    baseX: x,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.5,
  };
  group.userData = userData;
  scene.add(group);
  return group;
}

export function animateDove(group: THREE.Group, time: number): void {
  const d = group.userData as DoveUserData;
  if (typeof d.baseY !== 'number') return;
  group.position.y = d.baseY + Math.sin(time * d.speed + d.phase) * 0.5;
  group.position.x = d.baseX + Math.sin(time * d.speed * 0.5 + d.phase) * 0.8;
  group.rotation.y = Math.sin(time * d.speed * 2) * 0.3;
  group.children.forEach((child, i) => {
    child.rotation.y = Math.sin(time * 6 + d.phase) * 0.5 * (i === 0 ? 1 : -1);
  });
}
