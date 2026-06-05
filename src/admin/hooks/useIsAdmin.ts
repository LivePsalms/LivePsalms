import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/auth/context/useAuthSession';

export interface UseIsAdminResult {
  isAdmin: boolean | null;
  loading: boolean;
}

export function useIsAdmin(): UseIsAdminResult {
  const { user } = useAuthSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let cancelled = false;
    if (!supabase) { setIsAdmin(false); return; }
    supabase.rpc('is_lamplight_admin').then(({ data, error }) => {
      if (cancelled) return;
      setIsAdmin(error ? false : Boolean(data));
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  return { isAdmin, loading: isAdmin === null };
}
