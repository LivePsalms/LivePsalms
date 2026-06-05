// src/notepad-landing/three/garden/ink-materials.ts
import * as THREE from 'three';

// Resolved from CSS token --np-ink (#432c29). Three.js needs numeric.
export const INK_COLOR = 0x432c29;
export const PAPER_COLOR = 0xf6f0e6;

export function inkLineMaterial(opacity = 1): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: INK_COLOR,
    transparent: true,
    opacity,
  });
}

export function inkMeshMaterial(opacity = 0.08): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: INK_COLOR,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}
