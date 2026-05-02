import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, X } from 'lucide-react';
import { useNotepad } from '../context/useNotepad';
import { extractVerseRefs } from '../extensions/bible-verse-utils';
import type { Note } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// A note draft before it gets an id/createdAt/updatedAt
type NoteDraft = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;

// ---------------------------------------------------------------------------
// File parser
// ---------------------------------------------------------------------------

async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'md' || ext === 'txt') {
    return file.text();
  }

  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(pageText);
    }
    return pages.join('\n\n');
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToMarkdown({ arrayBuffer: buffer });
    return result.value;
  }

  return '';
}

// ---------------------------------------------------------------------------
// Helper: build TipTap JSON content from plain text
// ---------------------------------------------------------------------------

function buildTipTapContent(text: string): string {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const doc = {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };

  return JSON.stringify(doc);
}

// ---------------------------------------------------------------------------
// Helper: extract plain text from a TipTap JSON draft
// ---------------------------------------------------------------------------

function extractTextRecursive(node: Record<string, unknown>): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractTextRecursive).join(' ');
  }
  return '';
}

function extractTextFromDraft(draft: NoteDraft): string {
  try {
    const doc = JSON.parse(draft.content) as Record<string, unknown>;
    return extractTextRecursive(doc);
  } catch {
    return draft.content;
  }
}

// ---------------------------------------------------------------------------
// Helper: append a "Related Notes" section to a draft's TipTap JSON
// ---------------------------------------------------------------------------

function appendRelatedLink(draft: NoteDraft, relatedTitles: string[]): NoteDraft {
  if (relatedTitles.length === 0) return draft;

  try {
    const doc = JSON.parse(draft.content) as { type: string; content: unknown[] };

    const headingNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Related Notes', marks: [{ type: 'bold' }] }],
    };

    const linkNodes = relatedTitles.map((title) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: `[[${title}]]` }],
    }));

    const updatedDoc = {
      ...doc,
      content: [...(doc.content ?? []), headingNode, ...linkNodes],
    };

    return { ...draft, content: JSON.stringify(updatedDoc) };
  } catch {
    return draft;
  }
}

// ---------------------------------------------------------------------------
// Format file size
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// UploadModal component
// ---------------------------------------------------------------------------

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const { folders, importNotes } = useNotepad();

  const [files, setFiles] = useState<File[]>([]);
  const [folderId, setFolderId] = useState<string>('root');
  const [autoDetectVerses, setAutoDetectVerses] = useState(true);
  const [autoCreateLinks, setAutoCreateLinks] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    noClick: false,
    noKeyboard: false,
  });

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleUpload = async () => {
    if (files.length === 0 || uploading) return;
    setUploading(true);

    try {
      // Parse all files to text
      const parsed = await Promise.all(
        files.map(async (file) => {
          const text = await parseFile(file);
          const title = file.name.replace(/\.[^.]+$/, '');
          return { title, text };
        }),
      );

      // Build drafts
      let drafts: NoteDraft[] = parsed.map(({ title, text }) => ({
        title,
        content: buildTipTapContent(text),
        folderId,
        type: 'devotion' as const,
        tags: autoDetectVerses
          ? extractVerseRefs(text).slice(0, 10)
          : [],
      }));

      // Auto-create cross-links between drafts that share verse refs
      if (autoCreateLinks && drafts.length > 1) {
        const draftRefs = drafts.map((d) =>
          new Set(extractVerseRefs(extractTextFromDraft(d))),
        );

        drafts = drafts.map((draft, i) => {
          const relatedTitles: string[] = [];
          draftRefs.forEach((refs, j) => {
            if (j === i) return;
            const shared = [...draftRefs[i]].some((r) => refs.has(r));
            if (shared) relatedTitles.push(drafts[j].title);
          });
          return appendRelatedLink(draft, relatedTitles);
        });
      }

      await importNotes(drafts);

      // Reset and close
      setFiles([]);
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (uploading) return;
    setFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 520 }}
        className="gap-0"
      >
        <DialogHeader className="pb-4">
          <DialogTitle
            style={{
              color: 'var(--deep-umber)',
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '1.25rem',
              fontWeight: 600,
            }}
          >
            Upload Notes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg px-6 py-8 cursor-pointer transition-colors"
            style={{
              border: `2px dashed ${isDragActive ? 'var(--deep-umber)' : 'var(--pale-stone)'}`,
              background: isDragActive ? 'rgba(188, 179, 163, 0.1)' : 'transparent',
            }}
          >
            <input {...getInputProps()} />
            <Upload
              className="w-8 h-8"
              style={{ color: isDragActive ? 'var(--deep-umber)' : 'var(--silica)' }}
            />
            <p
              className="text-[13px] text-center"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
            </p>
            <p
              className="text-[11px]"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Supports .md, .txt, .pdf, .docx
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            <label
              className="text-[10px] font-medium tracking-[0.15em]"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              OPTIONS
            </label>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="auto-detect"
                checked={autoDetectVerses}
                onCheckedChange={(checked) => setAutoDetectVerses(!!checked)}
              />
              <label
                htmlFor="auto-detect"
                className="text-[12px] cursor-pointer select-none"
                style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
              >
                Auto-detect verse references (add as tags)
              </label>
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="auto-links"
                checked={autoCreateLinks}
                onCheckedChange={(checked) => setAutoCreateLinks(!!checked)}
              />
              <label
                htmlFor="auto-links"
                className="text-[12px] cursor-pointer select-none"
                style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
              >
                Auto-create links between notes sharing verse refs
              </label>
            </div>
          </div>

          {/* Folder destination */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] font-medium tracking-[0.15em]"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              DESTINATION FOLDER
            </label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger
                style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--deep-umber)' }}
              >
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Root</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              <label
                className="text-[10px] font-medium tracking-[0.15em]"
                style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
              >
                SELECTED FILES ({files.length})
              </label>
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--pale-stone)' }}
              >
                {files.map((file, idx) => (
                  <div
                    key={file.name}
                    className="flex items-center gap-2.5 px-3 py-2"
                    style={{
                      borderTop: idx > 0 ? '1px solid var(--pale-stone)' : 'none',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    <FileText
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: 'var(--silica)' }}
                    />
                    <span
                      className="text-[12px] flex-1 truncate min-w-0"
                      style={{ color: 'var(--deep-umber)' }}
                    >
                      {file.name}
                    </span>
                    <span
                      className="text-[11px] shrink-0"
                      style={{ color: 'var(--silica)' }}
                    >
                      {formatBytes(file.size)}
                    </span>
                    <button
                      onClick={() => removeFile(file.name)}
                      className="shrink-0 hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--silica)' }}
                      type="button"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <button
            onClick={handleCancel}
            disabled={uploading}
            className="px-3 py-1.5 rounded text-[12px] disabled:opacity-50"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-1.5 rounded text-[12px] font-medium disabled:opacity-50 transition-opacity"
            style={{
              background: 'var(--deep-umber)',
              color: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
            type="button"
          >
            {uploading ? 'Processing…' : 'Upload & Process'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
