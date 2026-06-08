export interface Vec3 { x: number; y: number; z: number; }
export interface SphereCamera { yaw: number; pitch: number; scale: number; }
export interface Projected { sx: number; sy: number; depth: number; }

/**
 * Rotate a point around the Y axis (yaw) then the X axis (pitch). Pure, allocation
 * is a single object. Length-preserving (orthonormal rotation).
 */
export function rotatePoint(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const y1 = p.y;
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const y2 = y1 * cx - z1 * sx;
  const z2 = y1 * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}

/**
 * Orthographic projection: rotate by the camera, scale, and offset to the viewport
 * centre (cx, cy). `depth` is the rotated z (larger = nearer the viewer).
 */
export function projectPoint(p: Vec3, cam: SphereCamera, cx: number, cy: number): Projected {
  const r = rotatePoint(p, cam.yaw, cam.pitch);
  return { sx: cx + r.x * cam.scale, sy: cy + r.y * cam.scale, depth: r.z };
}
