import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
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
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>Enter your email and password below</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3"
          noValidate
        >
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Log in
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account yet?{' '}
          <Link to="/signup" className="font-semibold underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
