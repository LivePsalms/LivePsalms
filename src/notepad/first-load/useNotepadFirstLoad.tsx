import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { localAdapter } from '@/notepad/storage/local-storage';
import {
  decideFirstLoadActions,
  hasBeenWelcomed,
  hasBeenGreetedToday,
  markGreetedToday,
  todayDateString,
} from './notepad-first-load';

interface UseNotepadFirstLoadResult {
  showMigration: boolean;
  dismissMigration: () => void;
}

export function useNotepadFirstLoad(): UseNotepadFirstLoadResult {
  const { user, loading: authLoading } = useAuthSession();
  const navigate = useNavigate();
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const notes = await localAdapter.getNotes();
      if (cancelled) return;
      const today = todayDateString(new Date());
      const actions = decideFirstLoadActions({
        user,
        authLoading,
        hasBeenWelcomed: hasBeenWelcomed(user.id, localStorage),
        hasBeenGreetedToday: hasBeenGreetedToday(user.id, today, sessionStorage),
        localNoteCount: notes.length,
      });
      for (const action of actions) {
        switch (action.kind) {
          case 'redirect-welcome':
            navigate('/welcome');
            break;
          case 'greet':
            markGreetedToday(user.id, today, sessionStorage);
            toast.success(`Welcome back, ${action.firstName}!`);
            break;
          case 'offer-migration':
            setShowMigration(true);
            break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  return {
    showMigration,
    dismissMigration: () => setShowMigration(false),
  };
}
