import { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { signedScanUrl, markTranscriptionSaved, discardScan } from '../scan/transcription-client';
import { buildNoteFromTranscription } from '../scan/build-note-from-transcription';
import { locateUncertainSpans, uncertainDecorationPlugin } from '../scan/uncertain-decoration';
import { linkNotesByVerses } from '../import/document-importer';
import type { TranscriptionResult } from '../scan/types';
import type { Note } from '../types';
import type { StorageAdapter } from '../storage/adapter';

interface Props {
  result: TranscriptionResult;
  folderId: string;
  adapter: StorageAdapter;
  onSaved: (note: Note) => void;
  onDiscarded: () => void;
}

export function TranscriptionReview({ result, folderId, adapter, onSaved, onDiscarded }: Props) {
  const [title, setTitle] = useState(`Scanned note · ${new Date().toLocaleDateString()}`);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const spans = useMemo(
    () => locateUncertainSpans(result.transcription, result.uncertainWords),
    [result.transcription, result.uncertainWords],
  );

  const editor = useEditor({
    extensions: [StarterKit],
    content: {
      type: 'doc',
      content: result.transcription.split(/\n\n+/).filter(Boolean).map((p) => ({
        type: 'paragraph', content: [{ type: 'text', text: p }],
      })),
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.registerPlugin(uncertainDecorationPlugin(spans));
  }, [editor, spans]);

  useEffect(() => {
    let active = true;
    signedScanUrl(result.imageKey).then((url) => { if (active) setImageUrl(url); });
    return () => { active = false; };
  }, [result.imageKey]);

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      const text = editor.getText();
      const note = buildNoteFromTranscription({ title, text, folderId, autoDetectVerses: true });
      const [linked] = linkNotesByVerses([note]);
      const saved = await adapter.importNote(linked ?? note);
      await markTranscriptionSaved(result.transcription_id, saved.id);
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    await discardScan(result.imageKey, result.transcription_id);
    onDiscarded();
  }

  return (
    <div className="transcription-review">
      <div className="transcription-review__panes">
        <figure className="transcription-review__image">
          {imageUrl
            ? <img src={imageUrl} alt="Your scanned note" />
            : <div aria-busy="true">Loading image…</div>}
        </figure>
        <div className="transcription-review__text">
          <input
            className="transcription-review__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Note title"
          />
          {result.confidence < 0.6 && (
            <p className="transcription-review__low-conf" role="note">
              This handwriting was hard to read — please check it against the image.
            </p>
          )}
          <EditorContent editor={editor} />
          {result.verseFlags.length > 0 && (
            <ul className="transcription-review__verse-flags">
              {result.verseFlags.map((f) => (
                <li key={f.ref} className={f.status === 'found' ? 'is-found' : 'is-missing'}>
                  {f.status === 'found'
                    ? <span title={f.canonicalText}>{f.ref} ✓</span>
                    : <span>{f.ref} — couldn't find this, check the photo</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="transcription-review__actions">
        <button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
        <button onClick={handleDiscard} disabled={saving}>Discard</button>
      </div>
    </div>
  );
}
