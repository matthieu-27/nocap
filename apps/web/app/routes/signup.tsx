import { useNavigate } from 'react-router';
import { SignupForm } from '@/components/SignupForm';
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
  if (error.code === 'USER_ALREADY_EXISTS') {
    return 'Username or email already taken.';
  }
  return error.message ?? 'Something went wrong.';
}

export default function SignupRoute(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <SignupForm
        onSuccess={() => navigate('/')}
        onSubmit={async (input) => {
          const { error } = await authClient.signUp.email({
            email: input.email,
            password: input.password,
            // Better Auth requires a display name; v1 uses the username for it.
            name: input.username,
            username: input.username,
          });
          if (error) {
            return { ok: false, error: toFormError(error) };
          }
          return { ok: true };
        }}
      />
    </main>
  );
}
