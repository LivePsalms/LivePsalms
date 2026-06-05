import { Observable } from '../collection/observable';
import { isAcceptedImage, MAX_IMAGE_BYTES } from './transcription-client';
import type { TranscriptionResult } from './types';

export type ScanPhase = 'idle' | 'camera' | 'cleaning' | 'transcribing' | 'error';

export type ScanErrorStage =
  | 'wrong_type'
  | 'too_large'
  | 'preprocess'
  | 'upload'
  | 'transcribe';

export interface ScanCaptureState {
  phase: ScanPhase;
  error: string | null;
}

export interface ScanCaptureDeps {
  /** Start the camera stream and attach it to the preview element. Throws on denial. */
  openCamera: () => Promise<void>;
  /** Grab the current video frame as a JPEG blob, then leave the camera as-is. */
  captureFrame: () => Promise<Blob>;
  /** Tear down the camera stream. Safe to call when no stream is active. */
  stopCamera: () => void;
  /** Fallback when the camera cannot start: open the OS file picker. */
  requestFileFallback: () => void;
  preprocess: (input: Blob) => Promise<Blob>;
  upload: (blob: Blob) => Promise<string>;
  transcribe: (imageKey: string) => Promise<TranscriptionResult>;
  onResult: (result: TranscriptionResult) => void;
  onCancel: () => void;
}

export const SCAN_ERROR_MESSAGES: Record<ScanErrorStage, string> = {
  wrong_type: 'Please choose a JPG, PNG, or HEIC image.',
  too_large: 'Image is too large (max 10 MB).',
  preprocess: 'We could not prepare that image. Please try another photo.',
  upload: 'Upload failed. Check your connection and try again.',
  transcribe: 'We could not read that note. Please try a clearer photo.',
};

export function classifyScanError(stage: ScanErrorStage): string {
  return SCAN_ERROR_MESSAGES[stage];
}

export class ScanCapture extends Observable<ScanCaptureState> {
  private readonly deps: ScanCaptureDeps;
  private generation = 0;

  constructor(deps: ScanCaptureDeps) {
    super({ phase: 'idle', error: null });
    this.deps = deps;
  }

  private set(next: ScanCaptureState): void {
    (this as unknown as { setState: (u: (prev: ScanCaptureState) => ScanCaptureState) => void })
      .setState(() => next);
  }

  submitFile = async (file: File): Promise<void> => {
    if (!isAcceptedImage(file.type)) {
      this.set({ phase: 'error', error: classifyScanError('wrong_type') });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.set({ phase: 'error', error: classifyScanError('too_large') });
      return;
    }
    await this.runPipeline(file);
  };

  startCamera = async (): Promise<void> => {
    try {
      await this.deps.openCamera();
      this.set({ phase: 'camera', error: null });
    } catch {
      this.deps.requestFileFallback();
    }
  };

  capture = async (): Promise<void> => {
    const blob = await this.deps.captureFrame();
    this.deps.stopCamera();
    await this.runPipeline(blob);
  };

  backToIdle = (): void => {
    this.deps.stopCamera();
    this.set({ phase: 'idle', error: null });
  };

  reset = (): void => {
    this.set({ phase: 'idle', error: null });
  };

  cancel = (): void => {
    this.generation++;
    this.deps.stopCamera();
    this.deps.onCancel();
  };

  dispose = (): void => {
    this.generation++;
    this.deps.stopCamera();
  };

  private async runPipeline(blob: Blob): Promise<void> {
    const gen = ++this.generation;

    let cleaned: Blob;
    try {
      this.set({ phase: 'cleaning', error: null });
      cleaned = await this.deps.preprocess(blob);
    } catch {
      this.fail(gen, 'preprocess');
      return;
    }
    if (gen !== this.generation) return;

    let key: string;
    try {
      this.set({ phase: 'transcribing', error: null });
      key = await this.deps.upload(cleaned);
    } catch {
      this.fail(gen, 'upload');
      return;
    }
    if (gen !== this.generation) return;

    let result: TranscriptionResult;
    try {
      result = await this.deps.transcribe(key);
    } catch {
      this.fail(gen, 'transcribe');
      return;
    }
    if (gen !== this.generation) return;

    this.set({ phase: 'idle', error: null });
    this.deps.onResult(result);
  }

  private fail(gen: number, stage: ScanErrorStage): void {
    if (gen !== this.generation) return;
    this.set({ phase: 'error', error: classifyScanError(stage) });
  }
}
