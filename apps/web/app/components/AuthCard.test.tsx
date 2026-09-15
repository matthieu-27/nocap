// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthCard } from './AuthCard';

function tree(props: {
  busy?: boolean;
  error?: string | null;
  footer?: React.ReactNode;
}): React.ReactElement {
  return (
    <AuthCard
      title="Test title"
      description="Test description"
      submitLabel="Send it"
      busy={props.busy ?? false}
      error={props.error ?? null}
      onSubmit={() => {}}
      footer={props.footer}
    >
      <label htmlFor="field">Field</label>
      <input id="field" />
    </AuthCard>
  );
}

describe('AuthCard', () => {
  it('submit button is disabled and silent while busy', async () => {
    const onSubmit = vi.fn((_event: React.FormEvent<HTMLFormElement>) => {});
    const user = userEvent.setup();
    render(
      <AuthCard
        title="Test title"
        description="Test description"
        submitLabel="Send it"
        busy
        error={null}
        onSubmit={onSubmit}
      >
        <label htmlFor="field">Field</label>
        <input id="field" />
      </AuthCard>,
    );

    const button = screen.getByRole('button', { name: 'Send it' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders title description and optional footer content', () => {
    render(
      tree({
        footer: <p>Footer note</p>,
      }),
    );

    expect(screen.getByText('Test title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Footer note')).toBeInTheDocument();
  });

  it('renders no error banner while error is null', () => {
    const { container } = render(tree({}));

    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
