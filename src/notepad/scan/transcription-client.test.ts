import { describe, it, expect } from 'vitest';
import { scanObjectKey, isAcceptedImage } from './transcription-client';

describe('scanObjectKey', () => {
  it('namespaces by user id under note-scans', () => {
    const key = scanObjectKey('user-123', 'abc-uuid');
    expect(key).toBe('note-scans/user-123/abc-uuid.jpg');
  });
});

describe('isAcceptedImage', () => {
  it('accepts jpeg/png/webp/heic', () => {
    expect(isAcceptedImage('image/jpeg')).toBe(true);
    expect(isAcceptedImage('image/png')).toBe(true);
    expect(isAcceptedImage('image/webp')).toBe(true);
    expect(isAcceptedImage('image/heic')).toBe(true);
  });
  it('rejects pdf and empty', () => {
    expect(isAcceptedImage('application/pdf')).toBe(false);
    expect(isAcceptedImage('')).toBe(false);
  });
});
