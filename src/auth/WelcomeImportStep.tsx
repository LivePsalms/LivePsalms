import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, FileText, X } from 'lucide-react';
import { filesToNotes } from '@/notepad/import/document-importer';
import type { StorageAdapter } from '@/notepad/storage/adapter';

export interface WelcomeImportStepProps {
  adapter: Pick<StorageAdapter, 'importNote'>;
  onDone: () => void;
  onSkip: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WelcomeImportStep({ adapter, onDone, onSkip }: WelcomeImportStepProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = async () => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    try {
      const notes = await filesToNotes(files, { folderId: 'root', autoDetectVerses: true });
      for (const note of notes) {
        await adapter.importNote(note);
      }
      toast.success(`Imported ${notes.length} note${notes.length === 1 ? '' : 's'}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import your notes.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className="flex flex-col items-center justify-center gap-2 rounded-lg px-6 py-8 cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${isDragActive ? 'var(--deep-umber)' : 'var(--pale-stone)'}`,
          background: isDragActive ? 'rgba(188, 179, 163, 0.1)' : 'transparent',
        }}
      >
        <input {...getInputProps()} />
        <Upload className="w-7 h-7" style={{ color: isDragActive ? 'var(--deep-umber)' : 'var(--silica)' }} />
        <p className="text-[13px] text-center" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
          {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          Supports .md, .txt, .pdf, .docx
        </p>
      </div>

      {files.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--pale-stone)' }}>
          {files.map((file, idx) => (
            <div
              key={file.name}
              className="flex items-center gap-2.5 px-3 py-2"
              style={{ borderTop: idx > 0 ? '1px solid var(--pale-stone)' : 'none', fontFamily: 'Outfit, sans-serif' }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--silica)' }} />
              <span className="text-[12px] flex-1 truncate min-w-0" style={{ color: 'var(--deep-umber)' }}>{file.name}</span>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--silica)' }}>{formatBytes(file.size)}</span>
              <button
                onClick={() => removeFile(file.name)}
                className="shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--silica)' }}
                type="button"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || busy}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
        style={{ background: 'var(--deep-umber)', color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
        type="button"
      >
        {busy ? 'Importing…' : 'Upload & Continue'}
      </button>
      <button
        onClick={onSkip}
        disabled={busy}
        className="w-full py-2 rounded-lg text-[13px] transition-opacity disabled:opacity-50"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', background: 'transparent' }}
        type="button"
      >
        Skip for now
      </button>
    </div>
  );
}
