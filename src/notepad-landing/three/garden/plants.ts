// src/notepad-landing/three/garden/plants.ts
import * as THREE from 'three';
import { inkLineMaterial, inkMeshMaterial } from './ink-materials';

function createInkLeaf(position: THREE.Vector3, group: THREE.Group): void {
  const leafSize = 0.2 + Math.random() * 0.3;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(leafSize * 0.4, leafSize * 0.6, 0, leafSize);
  shape.quadraticCurveTo(-leafSize * 0.4, leafSize * 0.6, 0, 0);

  const geom = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geom, inkMeshMaterial(0.06 + Math.random() * 0.06));
  mesh.position.copy(position);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  group.add(mesh);

  // Hand-drawn leaf outline
  const outlinePoints: THREE.Vector3[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2;
    const r = leafSize * (0.5 + 0.5 * Math.sin(angle * 2)) * 0.5;
    outlinePoints.push(new THREE.Vector3(
      Math.cos(angle) * r,
      Math.sin(angle) * r * 1.5,
      0,
    ));
  }
  const outlineGeom = new THREE.BufferGeometry().setFromPoints(outlinePoints);
  const outlineLine = new THREE.Line(outlineGeom, inkLineMaterial(0.25));
  outlineLine.position.copy(position);
  outlineLine.rotation.copy(mesh.rotation);
  group.add(outlineLine);
}

function createBranch(
  startPoint: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  depth: number,
  group: THREE.Group,
): void {
  if (depth <= 0 || length < 0.1) return;

  const segments = 12;
  const points: THREE.Vector3[] = [];
  let current = startPoint.clone();
  const dir = direction.clone().normalize();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wobble = new THREE.Vector3(
      (Math.random() - 0.5) * 0.15 * length,
      (Math.random() - 0.5) * 0.08 * length,
      (Math.random() - 0.5) * 0.15 * length,
    );
    const pt = current
      .clone()
      .add(dir.clone().multiplyScalar((length * t) / segments * segments))
      .add(wobble.multiplyScalar(t));
    pt.y -= t * t * length * 0.05; // gravity droop
    points.push(pt);
    current = pt.clone();
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const geom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
  const line = new THREE.Line(geom, inkLineMaterial(0.3 + depth * 0.15));
  group.add(line);

  if (depth > 1) {
    const endPt = points[points.length - 1];
    const numBranches = Math.floor(Math.random() * 3) + 1;
    for (let b = 0; b < numBranches; b++) {
      const newDir = dir.clone();
      newDir.x += (Math.random() - 0.5) * 1.2;
      newDir.y += Math.random() * 0.4 - 0.1;
      newDir.z += (Math.random() - 0.5) * 1.2;
      createBranch(endPt, newDir, length * 0.6, depth - 1, group);
    }
  }

  if (depth <= 2) {
    createInkLeaf(points[points.length - 1], group);
  }
}

export function createPlantCluster(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale: number,
  complexity: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  for (let i = 0; i < complexity; i++) {
    const angle = (i / complexity) * Math.PI * 2 + Math.random() * 0.5;
    const dir = new THREE.Vector3(
      Math.sin(angle) * 0.3,
      0.8 + Math.random() * 0.3,
      Math.cos(angle) * 0.3,
    );
    const startJitter = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      0,
      (Math.random() - 0.5) * 0.3,
    );
    createBranch(startJitter, dir, 1.2 + Math.random() * 0.8, 3 + Math.floor(Math.random() * 2), group);
  }

  scene.add(group);
  return group;
}

// Variant: a single tall narrow stem with a wide flat tip-leaf.
// Used for the row of 7 in station 5 (Seven Papers).
export function createPaperStem(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  const dir = new THREE.Vector3(0, 1, 0);
  const startJitter = new THREE.Vector3(0, 0, 0);
  createBranch(startJitter, dir, 2.0 + Math.random() * 0.3, 2, group);

  // wider/flatter leaf at the tip suggests a paper sheet
  const tip = new THREE.Vector3(0, 2.0, 0);
  const leafSize = 0.55;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(leafSize * 0.8, leafSize * 0.2, leafSize * 1.4, 0);
  shape.quadraticCurveTo(leafSize * 0.8, -leafSize * 0.2, 0, 0);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), inkMeshMaterial(0.05));
  mesh.position.copy(tip);
  mesh.rotation.z = (Math.random() - 0.5) * 0.4;
  group.add(mesh);

  scene.add(group);
  return group;
}
