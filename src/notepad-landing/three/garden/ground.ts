// src/notepad-landing/three/garden/ground.ts
import * as THREE from 'three';
import { inkLineMaterial } from './ink-materials';

export function createCrosshatchGround(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const size = 60;
  const density = 80;

  for (let i = 0; i < density; i++) {
    const x1 = (Math.random() - 0.5) * size;
    const z1 = (Math.random() - 0.5) * size;
    const len = 0.5 + Math.random() * 2;
    const angle = Math.random() * Math.PI;
    const points = [
      new THREE.Vector3(x1, -0.01, z1),
      new THREE.Vector3(x1 + Math.cos(angle) * len, -0.01, z1 + Math.sin(angle) * len),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = inkLineMaterial(0.04 + Math.random() * 0.08);
    group.add(new THREE.Line(geom, mat));
  }

  scene.add(group);
  return group;
}
