import { Navigate, useParams } from 'react-router-dom';
import { Notepad } from '@/components/sections/Notepad';
import { HeroLoadingOverlay } from '@/components/sections/HeroLoadingOverlay';
import { useUsernameGate } from './username-gate';
import { UsernameClaim } from './UsernameClaim';
import { normalizeUsername } from './username-rules';

/**
 * While the username gate resolves (e.g. after a full page refresh on the
 * notes route), show the app's heartbeat loading animation rather than a bare
 * "Loading…" text screen, matching the loading visuals used everywhere else.
 */
function NotepadGateSpinner() {
  return <HeroLoadingOverlay active />;
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
