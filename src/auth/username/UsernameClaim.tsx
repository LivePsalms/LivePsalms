import { useNavigate } from 'react-router-dom';
import { useAccountProfile } from '@/auth/context/useAccountProfile';
import { UsernameSetup } from './UsernameSetup';

/** Wires the presentational picker to AccountProfile + navigation. */
export function UsernameClaim() {
  const { account } = useAccountProfile();
  const navigate = useNavigate();
  return (
    <UsernameSetup
      checkAvailable={account.checkUsernameAvailable}
      claim={account.setUsername}
      onClaimed={(username) => navigate(`/notepad/u/${username}`, { replace: true })}
    />
  );
}
