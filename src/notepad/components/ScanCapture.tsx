// src/notepad/components/ScanCapture.tsx
import { useEffect, useRef, useState } from 'react';
import { preprocessImage } from '../scan/image-preprocess';
import { uploadScan, transcribe, isAcceptedImage, MAX_IMAGE_BYTES } from '../scan/transcription-client';
import type { TranscriptionResult } from '../scan/types';

type Phase = 'idle' | 'camera' | 'cleaning' | 'transcribing' | 'error';

interface Props {
  userId: string;
  onResult: (result: TranscriptionResult) => void;
  onCancel: () => void;
}

export function ScanCapture({ userId, onResult, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setPhase('camera');
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch {
      fileRef.current?.click();
    }
  }

  async function captureFromVideo() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    stopCamera();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (blob) await process(blob);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAcceptedImage(file.type)) { setPhase('error'); setError('Please choose a JPG, PNG, or HEIC image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setPhase('error'); setError('Image is too large (max 10 MB).'); return; }
    await process(file);
  }

  async function process(blob: Blob) {
    try {
      setPhase('cleaning');
      const cleaned = await preprocessImage(blob);
      setPhase('transcribing');
      const key = await uploadScan(userId, cleaned);
      const result = await transcribe(userId, key);
      onResult(result);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="scan-capture" role="dialog" aria-label="Scan handwritten note">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />

      {phase === 'idle' && (
        <div className="scan-capture__choices">
          <button onClick={startCamera}>Take photo</button>
          <button onClick={() => fileRef.current?.click()}>Choose photo</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      )}

      {phase === 'camera' && (
        <div className="scan-capture__camera">
          <video ref={videoRef} playsInline muted aria-label="Camera preview" />
          <div className="scan-capture__camera-actions">
            <button onClick={captureFromVideo}>Capture</button>
            <button onClick={() => { stopCamera(); setPhase('idle'); }}>Back</button>
          </div>
        </div>
      )}

      {(phase === 'cleaning' || phase === 'transcribing') && (
        <div className="scan-capture__busy" aria-live="polite">
          {phase === 'cleaning' ? 'Cleaning up image…' : 'Reading your handwriting…'}
        </div>
      )}

      {phase === 'error' && (
        <div className="scan-capture__error" role="alert">
          <p>{error}</p>
          <button onClick={() => { setError(null); setPhase('idle'); }}>Try again</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}
