import { Navigate, useParams } from 'react-router-dom';
import { Notepad } from '@/components/sections/Notepad';
import { useUsernameGate } from './username-gate';
import { UsernameClaim } from './UsernameClaim';
import { normalizeUsername } from './username-rules';

function NotepadGateSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-mersi-dark/60">Loading…</p>
    </div>
  );
}

/** /notepad/notes — legacy entry. Signed-out users stay here (local mode). */
export function LegacyNotepadRoute() {
  const gate = useUsernameGate();
  switch (gate.kind) {
    case 'loading':
      return <NotepadGateSpinner />;
    case 'signed-out':
      return <Notepad />;
    case 'needs-username':
      return <UsernameClaim />;
    case 'ready':
      return <Navigate to={`/notepad/u/${gate.username}`} replace />;
  }
}

/** /notepad/u/:username — private vanity editor, owner-only. */
export function VanityNotepadRoute() {
  const gate = useUsernameGate();
  const { username: param } = useParams();
  switch (gate.kind) {
    case 'loading':
      return <NotepadGateSpinner />;
    case 'signed-out':
      return <Navigate to="/notepad/notes" replace />;
    case 'needs-username':
      return <UsernameClaim />;
    case 'ready':
      return normalizeUsername(param ?? '') === gate.username ? (
        <Notepad />
      ) : (
        <Navigate to={`/notepad/u/${gate.username}`} replace />
      );
  }
}
