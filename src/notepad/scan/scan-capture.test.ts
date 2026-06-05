import { describe, it, expect, vi } from 'vitest';
import {
  ScanCapture,
  classifyScanError,
  SCAN_ERROR_MESSAGES,
  type ScanCaptureDeps,
} from './scan-capture';
import type { TranscriptionResult } from './types';

const RESULT: TranscriptionResult = {
  transcription: 'hello',
  confidence: 0.9,
  uncertainWords: [],
  verseFlags: [],
  transcription_id: 't1',
  imageKey: 'note-scans/u1/x.jpg',
};

function makeDeps(over: Partial<ScanCaptureDeps> = {}): ScanCaptureDeps {
  return {
    openCamera: vi.fn(async () => {}),
    captureFrame: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
    stopCamera: vi.fn(),
    requestFileFallback: vi.fn(),
    preprocess: vi.fn(async (b: Blob) => b),
    upload: vi.fn(async () => 'note-scans/u1/x.jpg'),
    transcribe: vi.fn(async () => RESULT),
    onResult: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
}

function fileOf(type: string, size: number): File {
  return { type, size } as File;
}

describe('classifyScanError', () => {
  it('maps each stage to its message', () => {
    expect(classifyScanError('wrong_type')).toBe(SCAN_ERROR_MESSAGES.wrong_type);
    expect(classifyScanError('too_large')).toBe(SCAN_ERROR_MESSAGES.too_large);
    expect(classifyScanError('preprocess')).toBe(SCAN_ERROR_MESSAGES.preprocess);
    expect(classifyScanError('upload')).toBe(SCAN_ERROR_MESSAGES.upload);
    expect(classifyScanError('transcribe')).toBe(SCAN_ERROR_MESSAGES.transcribe);
  });

  it('uses the exact legacy strings for validation stages', () => {
    expect(SCAN_ERROR_MESSAGES.wrong_type).toBe('Please choose a JPG, PNG, or HEIC image.');
    expect(SCAN_ERROR_MESSAGES.too_large).toBe('Image is too large (max 10 MB).');
  });
});

describe('ScanCapture initial state', () => {
  it('starts idle with no error', () => {
    const sc = new ScanCapture(makeDeps());
    expect(sc.getSnapshot()).toEqual({ phase: 'idle', error: null });
  });
});
