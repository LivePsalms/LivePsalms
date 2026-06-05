import { useNavigate } from 'react-router-dom';
import { useAuthSession } from './context/useAuthSession';
import { AuthCard } from './AuthCard';

export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();

  // Redirect if already logged in
  if (user) {
    navigate('/notepad/notes');
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--app-bg)' }}
    >
      <AuthCard onAuthenticated={() => navigate('/notepad/notes')} />
    </div>
  );
}
