export function makeHeart(particleCount: number): Float32Array {
  const pos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const t = Math.random() * Math.PI * 2;
    const s = Math.random() * Math.PI;
    const scatter = 0.03;
    const heartX = (16 * Math.pow(Math.sin(t), 3)) / 16;
    const heartY = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
    const depth = Math.sin(s) * 0.5;
    pos[i * 3] = heartX + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 1] = heartY + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 2] = depth + (Math.random() - 0.5) * scatter;
  }
  return pos;
}
