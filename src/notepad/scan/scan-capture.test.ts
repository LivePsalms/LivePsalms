import { describe, it, expect, vi } from 'vitest';
import {
  ScanCapture,
  classifyScanError,
  SCAN_ERROR_MESSAGES,
  type ScanCaptureDeps,
} from './scan-capture';
import type { TranscriptionResult } from './types';
import { MAX_IMAGE_BYTES } from './transcription-client';

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

describe('ScanCapture.submitFile validation', () => {
  it('rejects a wrong file type into the error phase and does not run the pipeline', async () => {
    const deps = makeDeps();
    const sc = new ScanCapture(deps);
    await sc.submitFile(fileOf('application/pdf', 100));
    expect(sc.getSnapshot()).toEqual({
      phase: 'error',
      error: SCAN_ERROR_MESSAGES.wrong_type,
    });
    expect(deps.preprocess).not.toHaveBeenCalled();
    expect(deps.upload).not.toHaveBeenCalled();
  });

  it('rejects an oversized file into the error phase', async () => {
    const deps = makeDeps();
    const sc = new ScanCapture(deps);
    await sc.submitFile(fileOf('image/jpeg', MAX_IMAGE_BYTES + 1));
    expect(sc.getSnapshot()).toEqual({
      phase: 'error',
      error: SCAN_ERROR_MESSAGES.too_large,
    });
    expect(deps.preprocess).not.toHaveBeenCalled();
  });
});

describe('ScanCapture pipeline (happy path)', () => {
  it('runs preprocess → upload → transcribe → onResult, ending idle', async () => {
    const deps = makeDeps();
    const sc = new ScanCapture(deps);
    await sc.submitFile(fileOf('image/jpeg', 1000));
    expect(deps.preprocess).toHaveBeenCalledTimes(1);
    expect(deps.upload).toHaveBeenCalledTimes(1);
    expect(deps.transcribe).toHaveBeenCalledWith('note-scans/u1/x.jpg');
    expect(deps.onResult).toHaveBeenCalledWith(RESULT);
    expect(sc.getSnapshot()).toEqual({ phase: 'idle', error: null });
  });

  it('maps a preprocess failure to the preprocess stage message', async () => {
    const deps = makeDeps({ preprocess: vi.fn(async () => { throw new Error('boom'); }) });
    const sc = new ScanCapture(deps);
    await sc.submitFile(fileOf('image/jpeg', 1000));
    expect(sc.getSnapshot()).toEqual({
      phase: 'error',
      error: SCAN_ERROR_MESSAGES.preprocess,
    });
    expect(deps.upload).not.toHaveBeenCalled();
  });

  it('maps an upload failure to the upload stage message', async () => {
    const deps = makeDeps({ upload: vi.fn(async () => { throw new Error('net'); }) });
    const sc = new ScanCapture(deps);
    await sc.submitFile(fileOf('image/jpeg', 1000));
    expect(sc.getSnapshot()).toEqual({
      phase: 'error',
      error: SCAN_ERROR_MESSAGES.upload,
    });
    expect(deps.transcribe).not.toHaveBeenCalled();
  });

  it('maps a transcribe failure to the transcribe stage message', async () => {
    const deps = makeDeps({ transcribe: vi.fn(async () => { throw new Error('ocr'); }) });
    const sc = new ScanCapture(deps);
    await sc.submitFile(fileOf('image/jpeg', 1000));
    expect(sc.getSnapshot()).toEqual({
      phase: 'error',
      error: SCAN_ERROR_MESSAGES.transcribe,
    });
    expect(deps.onResult).not.toHaveBeenCalled();
  });
});
