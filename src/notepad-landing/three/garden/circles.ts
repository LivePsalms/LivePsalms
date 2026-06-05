// src/notepad-landing/three/garden/circles.ts
import * as THREE from 'three';
import { inkLineMaterial } from './ink-materials';

export function createInkCircle(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  radius: number,
  wobble: number,
  opacity = 0.2,
): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segments = 80;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * wobble;
    points.push(new THREE.Vector3(
      x + Math.cos(angle) * r,
      y + Math.sin(angle) * r,
      z,
    ));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geom, inkLineMaterial(opacity));
  scene.add(line);
  return line;
}

// Three concentric wobbly circles, decreasing radius. Used in station 7.
export function createStoneBasin(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
): THREE.Group {
  const group = new THREE.Group();
  [1.6, 1.2, 0.8].forEach((r, i) => {
    const line = createInkCircle(scene, x, y, z, r, 0.06 - i * 0.015, 0.18 + i * 0.04);
    scene.remove(line);
    group.add(line);
  });
  // Lay it flat so it reads as a basin on the ground
  group.rotation.x = -Math.PI / 2;
  group.position.set(x, y, z);
  scene.add(group);
  return group;
}
