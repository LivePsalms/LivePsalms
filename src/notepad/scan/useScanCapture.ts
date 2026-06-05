import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ScanCapture, type ScanCaptureDeps, type ScanCaptureState } from './scan-capture';
import { preprocessImage } from './image-preprocess';
import { uploadScan, transcribe as transcribeNote } from './transcription-client';
import type { TranscriptionResult } from './types';

interface Options {
  userId: string;
  onResult: (result: TranscriptionResult) => void;
  onCancel: () => void;
}

export interface UseScanCapture {
  state: ScanCaptureState;
  startCamera: () => Promise<void>;
  capture: () => Promise<void>;
  submitFile: (file: File) => Promise<void>;
  backToIdle: () => void;
  reset: () => void;
  cancel: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
}

export function useScanCapture({ userId, onResult, onCancel }: Options): UseScanCapture {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep caller callbacks current without rebuilding the controller.
  const onResultRef = useRef(onResult);
  const onCancelRef = useRef(onCancel);
  onResultRef.current = onResult;
  onCancelRef.current = onCancel;

  const controller = useMemo(() => {
    const stopCamera = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const deps: ScanCaptureDeps = {
      openCamera: async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      },
      captureFrame: async () => {
        const video = videoRef.current;
        if (!video) throw new Error('no video element');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((r) =>
          canvas.toBlob(r, 'image/jpeg', 0.92),
        );
        if (!blob) throw new Error('capture failed');
        return blob;
      },
      stopCamera,
      requestFileFallback: () => fileRef.current?.click(),
      preprocess: (input) => preprocessImage(input),
      upload: (blob) => uploadScan(userId, blob),
      transcribe: (imageKey) => transcribeNote(userId, imageKey),
      onResult: (result) => onResultRef.current(result),
      onCancel: () => onCancelRef.current(),
    };

    return new ScanCapture(deps);
  }, [userId]);

  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => () => controller.dispose(), [controller]);

  return {
    state,
    startCamera: controller.startCamera,
    capture: controller.capture,
    submitFile: controller.submitFile,
    backToIdle: controller.backToIdle,
    reset: controller.reset,
    cancel: controller.cancel,
    videoRef,
    fileRef,
  };
}
