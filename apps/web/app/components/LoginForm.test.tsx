// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm, type LoginInput } from './LoginForm';

describe('LoginForm', () => {
  it('submits email and password to onSubmit', async () => {
    // Param typed so mock.calls is a [LoginInput] tuple — an untyped mock
    // infers `[]` and `calls[0]?.[0]` fails to compile (TS2493).
    const onSubmit = vi.fn(async (_input: LoginInput) => ({ ok: true }));
    render(
      <MemoryRouter>
        <LoginForm onSubmit={onSubmit} onSuccess={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'trackfan@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-horse' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await vi.waitFor(() => onSubmit.mock.calls[0]?.[0])).toEqual({
      email: 'trackfan@example.com',
      password: 'correct-horse',
    });
  });

  it('rate-limited login shows the retry message from onSubmit', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: false,
      error: 'Too many attempts — try again in 15 minutes.',
    }));
    render(
      <MemoryRouter>
        <LoginForm onSubmit={onSubmit} onSuccess={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'trackfan@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-horse' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByText('Too many attempts — try again in 15 minutes.'),
    ).toBeInTheDocument();
  });
});
