import { useNavigate } from 'react-router';
import { LoginForm } from '@/components/LoginForm';
import { authClient } from '@/lib/auth-client';

interface AuthClientError {
  code?: string;
  status?: number;
  message?: string;
}

function toFormError(error: AuthClientError): string {
  if (error.status === 429) {
    return 'Too many attempts — try again in 15 minutes.';
  }
  return error.message ?? 'Invalid email or password.';
}

export default function LoginRoute(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <LoginForm
        onSuccess={() => navigate('/')}
        onSubmit={async (input) => {
          const { error } = await authClient.signIn.email(input);
          if (error) {
            return { ok: false, error: toFormError(error) };
          }
          return { ok: true };
        }}
      />
    </main>
  );
}
