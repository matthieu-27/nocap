import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { AuthCard } from './AuthCard';
import { AuthField } from './AuthField';

export interface LoginInput {
  email: string;
  password: string;
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

interface LoginFormProps {
  onSubmit: (input: LoginInput) => Promise<LoginResult>;
  onSuccess: () => void;
}

export function LoginForm({
  onSubmit,
  onSuccess,
}: LoginFormProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await onSubmit({ email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Login failed.');
      return;
    }
    onSuccess();
  }

  return (
    <AuthCard
      title="Log in"
      description="Enter your email and password below"
      submitLabel="Log in"
      busy={busy}
      error={error}
      onSubmit={handleSubmit}
      footer={
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account yet?{' '}
          <Link to="/signup" className="font-semibold underline">
            Sign up
          </Link>
        </p>
      }
    >
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
      />
    </AuthCard>
  );
}
