// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReportDialog } from './ReportDialog';

describe('ReportDialog', () => {
  it('lists every report reason while open', async () => {
    const user = userEvent.setup();
    render(<ReportDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Report this claim')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox'));
    const labels = [
      'Spam',
      'Harassment',
      'Personal information',
      'Illegal content',
      'Off-domain content',
    ];
    for (const label of labels) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('submits the selected reason and closes', async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(
      screen.getByRole('option', { name: 'Personal information' }),
    );
    await user.click(screen.getByRole('button', { name: 'Report' }));
    expect(onSubmit).toHaveBeenCalledWith('personal_info');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
