import { type FormEvent, useState } from 'react';

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface UseAuthSubmitOptions<T> {
  onSubmit: (input: T) => Promise<AuthResult>;
  onSuccess: () => void;
  fallbackError: string;
  /** Returns the error message to show, or null when the input is valid. */
  validate?: (input: T) => string | null;
}

interface UseAuthSubmitResult<T> {
  error: string | null;
  busy: boolean;
  handleSubmit: (event: FormEvent<HTMLFormElement>, input: T) => Promise<void>;
}

// The busy/error dance shared by the auth forms (plan-2 clone family):
// clear the banner, run optional validation, submit, surface the server
// error or fall back, and hand off on success. Forms keep only their fields.
export function useAuthSubmit<T>({
  onSubmit,
  onSuccess,
  fallbackError,
  validate,
}: UseAuthSubmitOptions<T>): UseAuthSubmitResult<T> {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    input: T,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    const validationError = validate?.(input) ?? null;
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    setBusy(true);
    const result = await onSubmit(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? fallbackError);
      return;
    }
    onSuccess();
  }

  return { error, busy, handleSubmit };
}
