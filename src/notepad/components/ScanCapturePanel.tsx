import '../scan/scan.css';
import { useScanCapture } from '../scan/useScanCapture';
import type { TranscriptionResult } from '../scan/types';

interface Props {
  userId: string;
  onResult: (result: TranscriptionResult) => void;
  onCancel: () => void;
}

export function ScanCapturePanel({ userId, onResult, onCancel }: Props) {
  const scan = useScanCapture({ userId, onResult, onCancel });
  const { phase, error } = scan.state;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void scan.submitFile(file);
  }

  return (
    <div className="scan-capture" role="dialog" aria-label="Scan handwritten note">
      <input
        ref={scan.fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />

      {phase === 'idle' && (
        <div className="scan-capture__choices">
          <button onClick={() => void scan.startCamera()}>Take photo</button>
          <button onClick={() => scan.fileRef.current?.click()}>Choose photo</button>
          <button onClick={scan.cancel}>Cancel</button>
        </div>
      )}

      {phase === 'camera' && (
        <div className="scan-capture__camera">
          <video ref={scan.videoRef} playsInline muted aria-label="Camera preview" />
          <div className="scan-capture__camera-actions">
            <button onClick={() => void scan.capture()}>Capture</button>
            <button onClick={scan.backToIdle}>Back</button>
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
          <button onClick={scan.reset}>Try again</button>
          <button onClick={scan.cancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}
