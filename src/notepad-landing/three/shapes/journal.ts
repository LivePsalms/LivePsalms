export function makeJournal(particleCount: number): Float32Array {
  const pos = new Float32Array(particleCount * 3);
  const scatter = 0.015;
  const scale = 1.2;
  for (let i = 0; i < particleCount; i++) {
    const section = Math.random();
    let x: number, y: number, z: number;

    if (section < 0.35) {
      const px = Math.random() * 0.85;
      const py = (Math.random() - 0.5) * 1.2;
      const curvature = Math.sin(px * Math.PI * 0.5) * 0.15;
      x = -px - 0.02;
      y = py;
      z = curvature;
    } else if (section < 0.70) {
      const px = Math.random() * 0.85;
      const py = (Math.random() - 0.5) * 1.2;
      const curvature = Math.sin(px * Math.PI * 0.5) * 0.15;
      x = px + 0.02;
      y = py;
      z = curvature;
    } else if (section < 0.78) {
      const sy = (Math.random() - 0.5) * 1.2;
      const sz = (Math.random() - 0.5) * 0.18;
      x = (Math.random() - 0.5) * 0.04;
      y = sy;
      z = Math.abs(sz) * 0.8 + 0.01;
    } else if (section < 0.88) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const edgeX = side * 0.87;
      const ey = (Math.random() - 0.5) * 1.15;
      const layerDepth = Math.random() * 0.12;
      x = edgeX + (Math.random() - 0.5) * 0.02;
      y = ey;
      z = Math.sin(Math.abs(edgeX) * Math.PI * 0.5) * 0.15 - layerDepth;
    } else if (section < 0.94) {
      const lineIdx = Math.floor(Math.random() * 12);
      const lineY = 0.45 - lineIdx * 0.075;
      const lineX = -0.12 - Math.random() * 0.6;
      x = lineX;
      y = lineY + (Math.random() - 0.5) * 0.008;
      z = Math.sin(Math.abs(lineX) * Math.PI * 0.5) * 0.15 + 0.01;
    } else {
      const lineIdx = Math.floor(Math.random() * 12);
      const lineY = 0.45 - lineIdx * 0.075;
      const lineX = 0.12 + Math.random() * 0.6;
      x = lineX;
      y = lineY + (Math.random() - 0.5) * 0.008;
      z = Math.sin(Math.abs(lineX) * Math.PI * 0.5) * 0.15 + 0.01;
    }

    pos[i * 3] = x * scale + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 1] = y * scale + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 2] = z * scale + (Math.random() - 0.5) * scatter;
  }
  return pos;
}
