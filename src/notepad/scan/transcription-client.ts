import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/supabase';
import type { TranscriptionResult } from './types';

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function scanObjectKey(userId: string, id = uuidv4()): string {
  return `note-scans/${userId}/${id}.jpg`;
}

export function isAcceptedImage(mimeType: string): boolean {
  return ACCEPTED.has(mimeType);
}

/** Upload the cleaned image to the private bucket; returns the full object key. */
export async function uploadScan(userId: string, blob: Blob): Promise<string> {
  if (!supabase) throw new Error('supabase not configured');
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('image too large');
  const key = scanObjectKey(userId);
  const path = key.replace(/^note-scans\//, '');
  const { error } = await supabase.storage.from('note-scans').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return key;
}

/** Invoke the edge function; returns the structured result + the image key. */
export async function transcribe(userId: string, imageKey: string): Promise<TranscriptionResult> {
  if (!supabase) throw new Error('supabase not configured');
  const { data, error } = await supabase.functions.invoke('transcribe-note', {
    body: { user_id: userId, image_key: imageKey },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { ...(data as Omit<TranscriptionResult, 'imageKey'>), imageKey };
}

/** Short-lived signed URL for displaying the original in the review pane. */
export async function signedScanUrl(imageKey: string, expiresInSec = 600): Promise<string | null> {
  if (!supabase) return null;
  const path = imageKey.replace(/^note-scans\//, '');
  const { data, error } = await supabase.storage.from('note-scans').createSignedUrl(path, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Discard: delete the image object and the provenance row. */
export async function discardScan(imageKey: string, transcriptionId: string): Promise<void> {
  if (!supabase) return;
  const path = imageKey.replace(/^note-scans\//, '');
  await supabase.storage.from('note-scans').remove([path]);
  await supabase.from('note_transcriptions').delete().eq('id', transcriptionId);
}

/** On save: link the provenance row to the created note. */
export async function markTranscriptionSaved(transcriptionId: string, noteId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('note_transcriptions')
    .update({ note_id: noteId, status: 'saved', updated_at: new Date().toISOString() })
    .eq('id', transcriptionId);
}
