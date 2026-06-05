// src/notepad-landing/three/garden/camera-stations.test.ts
import { describe, expect, it } from 'vitest';
import { CAMERA_STATIONS } from './camera-stations';

describe('CAMERA_STATIONS', () => {
  it('has length 7', () => {
    expect(CAMERA_STATIONS).toHaveLength(7);
  });

  it('every entry has finite pos and look (x,y,z)', () => {
    for (const s of CAMERA_STATIONS) {
      expect(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y) && Number.isFinite(s.pos.z)).toBe(true);
      expect(Number.isFinite(s.look.x) && Number.isFinite(s.look.y) && Number.isFinite(s.look.z)).toBe(true);
    }
  });

  it('stations 5 and 6 (list stations) have meaningfully different camera poses', () => {
    // Per spec §4.4 list stations hold the camera mid-station, but adjacent
    // stations should still be distinct compositions.
    const s5 = CAMERA_STATIONS[4];
    const s6 = CAMERA_STATIONS[5];
    const dist = Math.hypot(s5.pos.x - s6.pos.x, s5.pos.y - s6.pos.y, s5.pos.z - s6.pos.z);
    expect(dist).toBeGreaterThan(1);
  });
});
