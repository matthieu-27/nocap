// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthSubmit } from './use-auth-submit';

interface Input {
  email: string;
}

function submitEvent(): React.FormEvent<HTMLFormElement> {
  // reason: handleSubmit only consumes preventDefault — a minimal stub
  // avoids rendering a whole form to exercise one call path
  return { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
}

describe('useAuthSubmit', () => {
  it('successful submit hands off to onSuccess with no error', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useAuthSubmit<Input>({ onSubmit, onSuccess, fallbackError: 'Failed.' }),
    );
    await act(async () => {
      await result.current.handleSubmit(submitEvent(), { email: 'a@b.c' });
    });
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.c' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('validation failure sets the error and never submits', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useAuthSubmit<Input>({
        onSubmit,
        onSuccess,
        fallbackError: 'Failed.',
        validate: () => 'Email is required.',
      }),
    );
    await act(async () => {
      await result.current.handleSubmit(submitEvent(), { email: '' });
    });
    expect(result.current.error).toBe('Email is required.');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('server failure surfaces the server message over the fallback', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: false,
      error: 'Invalid credentials.',
    }));
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useAuthSubmit<Input>({ onSubmit, onSuccess, fallbackError: 'Failed.' }),
    );
    await act(async () => {
      await result.current.handleSubmit(submitEvent(), { email: 'a@b.c' });
    });
    expect(result.current.error).toBe('Invalid credentials.');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });
});
