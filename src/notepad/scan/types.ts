export interface UncertainWord { text: string; context?: string }
export interface VerseFlag { ref: string; status: 'found' | 'not_found'; canonicalText?: string }
export interface TranscriptionResult {
  transcription: string;
  confidence: number;
  uncertainWords: UncertainWord[];
  verseFlags: VerseFlag[];
  transcription_id: string;
  imageKey: string;
}
