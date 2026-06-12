import { FALLBACK_OVERLAY_COLOR } from '@/data/projects';
import { dominantColorFromPixels } from './dominant-color';

const SAMPLE_SIZE = 50;

export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    // No crossOrigin: a CORS-mode request can't share the HTTP cache entry
    // with the no-cors <img> tags that render the same thumbnails, so setting
    // it forced every image to be fetched twice. All callers pass same-origin
    // URLs, which never taint the canvas.
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(FALLBACK_OVERLAY_COLOR);
        return;
      }
      try {
        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        resolve(dominantColorFromPixels(data));
      } catch {
        // Cross-origin image would taint the canvas; fall back gracefully.
        resolve(FALLBACK_OVERLAY_COLOR);
      }
    };

    img.onerror = () => resolve(FALLBACK_OVERLAY_COLOR);
    img.src = imageUrl;
  });
}
