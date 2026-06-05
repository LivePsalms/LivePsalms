import { FALLBACK_OVERLAY_COLOR } from '@/data/projects';
import { dominantColorFromPixels } from './dominant-color';

const SAMPLE_SIZE = 50;

export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(FALLBACK_OVERLAY_COLOR);
        return;
      }
      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      resolve(dominantColorFromPixels(data));
    };

    img.onerror = () => resolve(FALLBACK_OVERLAY_COLOR);
    img.src = imageUrl;
  });
}
