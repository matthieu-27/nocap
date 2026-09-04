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

export interface SignupInput {
  username: string;
  email: string;
  password: string;
}

export interface SignupResult {
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
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>Enter your info below</CardDescription>
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
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="3–32 letters, digits, _"
              required
            />
          </div>
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
              placeholder="min 10 characters"
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Sign up
          </Button>
        </form>
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
      </CardContent>
    </Card>
  );
}
