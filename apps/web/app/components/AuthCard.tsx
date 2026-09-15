import type { FormEvent, ReactElement, ReactNode } from 'react';

import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';

interface AuthCardProps {
  title: string;
  description: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer?: ReactNode;
}

// Shared shell for the login/signup block shapes (frame 04): centered
// card, alert banner, stacked fields, submit button, account-switch
// footer. LoginForm and SignupForm compose this instead of cloning it.
export function AuthCard({
  title,
  description,
  submitLabel,
  busy,
  error,
  onSubmit,
  children,
  footer,
}: AuthCardProps): ReactElement {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {children}
          <Button type="submit" disabled={busy}>
            {submitLabel}
          </Button>
        </form>
        {footer}
      </CardContent>
    </Card>
  );
}
