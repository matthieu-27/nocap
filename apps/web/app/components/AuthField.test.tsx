// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthField } from './AuthField';

describe('AuthField', () => {
  it('input change calls onChange with the typed value', async () => {
    const onChange = vi.fn((_value: string) => {});
    const user = userEvent.setup();
    render(<AuthField id="email" label="Email" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('Email'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('renders the label association with text type and required defaults', () => {
    render(<AuthField id="email" label="Email" value="" onChange={() => {}} />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toBeRequired();
  });

  it('passes the custom type placeholder and required override through', () => {
    render(
      <AuthField
        id="email"
        label="Email"
        type="email"
        value=""
        onChange={() => {}}
        placeholder="you@example.com"
        required={false}
      />,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'you@example.com');
    expect(input).not.toBeRequired();
  });
});
