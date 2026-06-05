export function makePencil(particleCount: number): Float32Array {
  const pos = new Float32Array(particleCount * 3);
  const scatter = 0.018;
  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    const angle = Math.random() * Math.PI * 2;
    let x: number, y: number, z: number;

    const S = 0.72;
    if (t < 0.07) {
      const tipT = t / 0.07;
      const radius = tipT * 0.045;
      y = (-1.85 + tipT * 0.25) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    } else if (t < 0.17) {
      const taperT = (t - 0.07) / 0.10;
      const radius = 0.045 + taperT * 0.075;
      y = (-1.6 + taperT * 0.45) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    } else if (t < 0.82) {
      const bodyT = (t - 0.17) / 0.65;
      const hexRadius = 0.12 / Math.cos(((angle % (Math.PI / 3)) - Math.PI / 6));
      const clampedHex = Math.min(hexRadius, 0.145);
      const facetRadius = clampedHex * (0.92 + 0.08 * Math.cos(angle * 6));
      y = (-1.15 + bodyT * 2.5) * S;
      x = Math.cos(angle) * facetRadius * S;
      z = Math.sin(angle) * facetRadius * S;
    } else if (t < 0.90) {
      const ferruleT = (t - 0.82) / 0.08;
      const radius = 0.135 + Math.sin(ferruleT * Math.PI) * 0.01;
      y = (1.35 + ferruleT * 0.18) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    } else {
      const eraserT = (t - 0.90) / 0.10;
      const radius = 0.13 * (1 - eraserT * 0.15);
      y = (1.53 + eraserT * 0.32) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    }

    pos[i * 3] = x + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * scatter;
  }
  return pos;
}
