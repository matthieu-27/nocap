import { useState } from 'react';
import { Link } from 'react-router';

import { useAuthSubmit } from '@/lib/use-auth-submit';

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
  const { error, busy, handleSubmit } = useAuthSubmit<LoginInput>({
    onSubmit,
    onSuccess,
    fallbackError: 'Login failed.',
  });

  return (
    <AuthCard
      title="Log in"
      description="Enter your email and password below"
      submitLabel="Log in"
      busy={busy}
      error={error}
      onSubmit={(event) => {
        void handleSubmit(event, { email, password });
      }}
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
