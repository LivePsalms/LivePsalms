// src/notepad-landing/three/garden/splashes.ts
import * as THREE from 'three';
import { inkMeshMaterial } from './ink-materials';

export function createInkSplash(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  count: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  for (let i = 0; i < count; i++) {
    const size = 0.02 + Math.random() * 0.06;
    const geom = new THREE.CircleGeometry(size, 6);
    const mat = inkMeshMaterial(0.1 + Math.random() * 0.15);
    const dot = new THREE.Mesh(geom, mat);
    dot.position.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 0.5,
    );
    dot.rotation.z = Math.random() * Math.PI;
    group.add(dot);
  }

  scene.add(group);
  return group;
}
