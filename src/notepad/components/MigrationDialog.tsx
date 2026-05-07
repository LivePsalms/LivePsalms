import { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { localAdapter } from '../storage/local-storage';
import { migrateAdapter } from '../storage/migration';
import type { StorageAdapter } from '../storage/adapter';

interface MigrationDialogProps {
  open: boolean;
  onClose: () => void;
  targetAdapter: StorageAdapter;
  onMigrationComplete: () => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'folders'; current: number; total: number }
  | { kind: 'notes'; current: number; total: number }
  | { kind: 'cleanup' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const phaseMessage = (p: Phase): string => {
  switch (p.kind) {
    case 'idle':    return '';
    case 'loading': return 'Reading your local notes…';
    case 'folders': return p.total === 1
      ? 'Syncing your folder…'
      : `Syncing folder ${p.current} of ${p.total}…`;
    case 'notes':   return p.total === 1
      ? 'Importing your note…'
      : `Importing note ${p.current} of ${p.total}…`;
    case 'cleanup': return 'Almost done — tidying up…';
    case 'done':    return 'All set. Your notes are now in your account.';
    case 'error':   return p.message;
  }
};

export function MigrationDialog({
  open,
  onClose,
  targetAdapter,
  onMigrationComplete,
}: MigrationDialogProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [noteCount, setNoteCount] = useState(0);

  // Read the current local note count when the dialog opens. Source-side
  // ownership stays inside LocalStorageAdapter — the dialog no longer knows
  // the storage keys.
  useEffect(() => {
    if (!open) return;
    localAdapter.getNotes().then((notes) => setNoteCount(notes.length));
  }, [open]);

  const inProgress =
    phase.kind === 'loading' ||
    phase.kind === 'folders' ||
    phase.kind === 'notes' ||
    phase.kind === 'cleanup';

  const handleImport = async () => {
    setPhase({ kind: 'loading' });
    try {
      const result = await migrateAdapter(localAdapter, targetAdapter, {
        onEvent: (e) => setPhase(e),
      });

      setPhase({ kind: 'cleanup' });
      localAdapter.clearAll();
      // Refresh the active adapter's view so the imported notes appear
      // under the user's account immediately.
      onMigrationComplete();

      setPhase({ kind: 'done' });
      toast.success(
        result.notes === 1
          ? '1 note imported to your account.'
          : `${result.notes} notes imported to your account.`
      );
      // Brief celebratory pause so the success state is perceptible.
      window.setTimeout(() => {
        setPhase({ kind: 'idle' });
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Migration failed:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong importing your notes. Your local copy was left untouched.';
      toast.error(message);
      setPhase({ kind: 'error', message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !inProgress) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm p-8"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
        }}
      >
        {inProgress || phase.kind === 'done' ? (
          <div className="flex flex-col items-center gap-4 py-2">
            {phase.kind === 'done' ? (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ border: '1.5px solid var(--deep-umber)' }}
              >
                <Check className="w-5 h-5" style={{ color: 'var(--deep-umber)' }} strokeWidth={2} />
              </div>
            ) : (
              <Loader2
                className="w-11 h-11 animate-spin"
                style={{ color: 'var(--deep-umber)' }}
                strokeWidth={1.25}
              />
            )}

            <DialogTitle
              className="text-base font-medium text-center"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              {phase.kind === 'done' ? 'Done' : 'Importing your notes'}
            </DialogTitle>

            <DialogDescription
              className="text-center text-xs px-2"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Outfit, sans-serif',
                minHeight: '2.4em',
                lineHeight: 1.5,
              }}
            >
              {phaseMessage(phase)}
            </DialogDescription>

            {(phase.kind === 'folders' || phase.kind === 'notes') && (
              <div
                className="w-full h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--pale-stone)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{
                    background: 'var(--deep-umber)',
                    width: `${(phase.current / Math.max(phase.total, 1)) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        ) : phase.kind === 'error' ? (
          <>
            <DialogTitle
              className="text-lg font-medium text-center"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              Something went wrong
            </DialogTitle>
            <DialogDescription
              className="text-center text-sm mt-2"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {phase.message}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setPhase({ kind: 'idle' });
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  border: '1px solid var(--pale-stone)',
                  color: 'var(--deep-umber)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setPhase({ kind: 'idle' });
                  handleImport();
                }}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity"
                style={{
                  background: 'var(--deep-umber)',
                  color: 'var(--plaster)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Try again
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle
              className="text-lg font-medium text-center"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              Import Local Notes?
            </DialogTitle>
            <DialogDescription
              className="text-center text-sm mt-2"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              You have {noteCount} {noteCount === 1 ? 'note' : 'notes'} saved locally.
              Would you like to import them to your account?
            </DialogDescription>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  border: '1px solid var(--pale-stone)',
                  color: 'var(--deep-umber)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                No Thanks
              </button>
              <button
                onClick={handleImport}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity"
                style={{
                  background: 'var(--deep-umber)',
                  color: 'var(--plaster)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Import Notes
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
