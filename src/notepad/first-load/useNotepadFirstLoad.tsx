import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useAccountProfile } from '@/auth/context/useAccountProfile';
import { localAdapter } from '@/notepad/storage/local-storage';
import {
  decideFirstLoadActions,
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
  const { profile, profileStatus } = useAccountProfile();
  const navigate = useNavigate();
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (profileStatus === 'loading') return;
    let cancelled = false;
    (async () => {
      const notes = await localAdapter.getNotes();
      if (cancelled) return;
      const today = todayDateString(new Date());
      const actions = decideFirstLoadActions({
        user,
        authLoading,
        profileLoading: false, // guarded above: profileStatus === 'loading' already returned
        hasBeenWelcomed: !!profile?.fullName?.trim(),
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
            toast.success(`Welcome back${action.firstName ? `, ${action.firstName}` : ''}!`);
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
  }, [user, authLoading, profile?.fullName, profileStatus, navigate]);

  return {
    showMigration,
    dismissMigration: () => setShowMigration(false),
  };
}
