// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SignupForm, type SignupInput } from './SignupForm';

function typeInto(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const validInput = {
  username: 'trackfan',
  email: 'trackfan@example.com',
  password: 'correct-horse',
};

describe('SignupForm', () => {
  it('valid signup input reaches onSubmit with username, email, and password', async () => {
    // Param typed so mock.calls is a [SignupInput] tuple — an untyped mock
    // infers `[]` and `calls[0]?.[0]` fails to compile (TS2493).
    const onSubmit = vi.fn(async (_input: SignupInput) => ({ ok: true }));
    render(
      <MemoryRouter>
        <SignupForm onSubmit={onSubmit} onSuccess={() => {}} />
      </MemoryRouter>,
    );

    typeInto('Username', validInput.username);
    typeInto('Email', validInput.email);
    typeInto('Password', validInput.password);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await vi.waitFor(() => onSubmit.mock.calls[0]?.[0])).toEqual(
      validInput,
    );
  });

  it('short password is rejected before onSubmit is called', () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(
      <MemoryRouter>
        <SignupForm onSubmit={onSubmit} onSuccess={() => {}} />
      </MemoryRouter>,
    );

    typeInto('Username', 'trackfan');
    typeInto('Email', 'trackfan@example.com');
    typeInto('Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(
      screen.getByText('Password must be at least 10 characters.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('failed signup shows the server error as an alert', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: false,
      error: 'Username or email already taken.',
    }));
    render(
      <MemoryRouter>
        <SignupForm onSubmit={onSubmit} onSuccess={() => {}} />
      </MemoryRouter>,
    );

    typeInto('Username', 'trackfan');
    typeInto('Email', 'trackfan@example.com');
    typeInto('Password', 'correct-horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(
      await screen.findByText('Username or email already taken.'),
    ).toBeInTheDocument();
  });

  it('successful signup calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(
      <MemoryRouter>
        <SignupForm onSubmit={onSubmit} onSuccess={onSuccess} />
      </MemoryRouter>,
    );

    typeInto('Username', 'trackfan');
    typeInto('Email', 'trackfan@example.com');
    typeInto('Password', 'correct-horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await vi.waitFor(() => onSuccess)).toHaveBeenCalled();
  });
});
