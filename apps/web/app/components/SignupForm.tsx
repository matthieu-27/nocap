import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { AuthCard } from './AuthCard';
import { AuthField } from './AuthField';

export interface SignupInput {
  username: string;
  email: string;
  password: string;
}

interface SignupResult {
  ok: boolean;
  error?: string;
}

interface SignupFormProps {
  onSubmit: (input: SignupInput) => Promise<SignupResult>;
  onSuccess: () => void;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

export function SignupForm({
  onSubmit,
  onSuccess,
}: SignupFormProps): React.ReactElement {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!USERNAME_RE.test(username)) {
      setError('Username must be 3-32 letters, digits, or underscores.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    setBusy(true);
    const result = await onSubmit({ username, email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Signup failed.');
      return;
    }
    onSuccess();
  }

  return (
    <AuthCard
      title="Create an account"
      description="Enter your info below"
      submitLabel="Sign up"
      busy={busy}
      error={error}
      onSubmit={handleSubmit}
      footer={
        <>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold underline">
              Login
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            By signing up you accept the{' '}
            <Link to="/terms" className="underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </>
      }
    >
      <AuthField
        id="username"
        label="Username"
        value={username}
        onChange={setUsername}
        placeholder="3–32 letters, digits, _"
      />
      <AuthField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
      />
      <AuthField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="min 10 characters"
      />
    </AuthCard>
  );
}
