// src/notepad-landing/three/garden/particles.ts
import * as THREE from 'three';
import { inkMeshMaterial } from './ink-materials';

interface ParticleUserData {
  baseX: number;
  baseY: number;
  speed: number;
  phase: number;
  drift: number;
}

export function createFloatingParticles(scene: THREE.Scene, count = 60): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const size = 0.01 + Math.random() * 0.03;
    const geom = new THREE.CircleGeometry(size, 5);
    const mat = inkMeshMaterial(0.05 + Math.random() * 0.1);
    const p = new THREE.Mesh(geom, mat);
    p.position.set(
      (Math.random() - 0.5) * 30,
      Math.random() * 8,
      (Math.random() - 0.5) * 20 - 5,
    );
    const userData: ParticleUserData = {
      baseX: p.position.x,
      baseY: p.position.y,
      speed: 0.2 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      drift: 0.3 + Math.random() * 0.5,
    };
    p.userData = userData;
    scene.add(p);
    out.push(p);
  }
  return out;
}

export function animateParticle(p: THREE.Mesh, time: number): void {
  const d = p.userData as ParticleUserData;
  p.position.x = d.baseX + Math.sin(time * d.speed + d.phase) * d.drift;
  p.position.y = d.baseY + Math.cos(time * d.speed * 0.7 + d.phase) * 0.3;
  p.rotation.z = time * d.speed * 0.2;
}
