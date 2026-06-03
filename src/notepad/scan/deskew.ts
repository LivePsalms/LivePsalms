// src/notepad/scan/deskew.ts
//
// Lazy document deskew / perspective-flatten via jscanify (OpenCV.js). Imported
// dynamically by image-preprocess.ts so the multi-MB WASM never enters the main
// bundle. Mutates the given canvas in place when a confident page quad is found;
// otherwise leaves it untouched. Never throws fatally — callers treat any
// failure as "skip deskew".

let scannerPromise: Promise<unknown> | null = null;

async function getScanner(): Promise<{ extractPaper: Function; getCornerPoints?: Function } | null> {
  if (!scannerPromise) {
    scannerPromise = (async () => {
      const mod: any = await import('jscanify');
      const JscanifyCtor = mod.default ?? mod;
      // jscanify expects a global `cv` (OpenCV.js). Load it once from CDN.
      if (!(globalThis as any).cv) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://docs.opencv.org/4.10.0/opencv.js';
          s.async = true;
          s.onload = () => {
            const cv = (globalThis as any).cv;
            if (cv && typeof cv.then === 'function') cv.then(() => resolve());
            else if (cv && cv.Mat) resolve();
            else { (globalThis as any).cv = cv; cv['onRuntimeInitialized'] = () => resolve(); }
          };
          s.onerror = () => reject(new Error('opencv load failed'));
          document.head.appendChild(s);
        });
      }
      return new JscanifyCtor();
    })();
  }
  try { return (await scannerPromise) as any; } catch { scannerPromise = null; return null; }
}

/**
 * Detect the page edges and flatten/crop the canvas to the page. Returns true if
 * a deskew was applied, false if skipped. On any failure or low-confidence
 * detection, the canvas is left unchanged and false is returned.
 */
export async function deskewCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
  const scanner = await getScanner();
  if (!scanner || typeof scanner.extractPaper !== 'function') return false;
  try {
    const out: HTMLCanvasElement = scanner.extractPaper(canvas, canvas.width, canvas.height);
    if (!out || out.width === 0 || out.height === 0) return false;
    const ctx = canvas.getContext('2d')!;
    canvas.width = out.width;
    canvas.height = out.height;
    ctx.drawImage(out, 0, 0);
    return true;
  } catch {
    return false;
  }
}
