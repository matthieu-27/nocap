// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOverlayPhase } from './RouteLoadingOverlay';

afterEach(() => {
  vi.useRealTimers();
});

function renderPhase(initialLoading: boolean) {
  const utils = renderHook(
    ({ loading }: { loading: boolean }) => useOverlayPhase(loading),
    { initialProps: { loading: initialLoading } },
  );
  return utils;
}

describe('useOverlayPhase', () => {
  it('shows instantly when a load is already pending at mount', () => {
    vi.useFakeTimers();
    const { result } = renderPhase(true);
    expect(result.current).toBe('loading');
  });

  it('stays hidden through a load blip that starts while idle', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderPhase(false);

    rerender({ loading: true });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('hidden');
  });

  it('debounces a load that starts while idle, then shows it', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderPhase(false);

    rerender({ loading: true });
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe('hidden');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('loading');
  });

  it('plays the exit phase after loading ends, then hides', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderPhase(true);

    rerender({ loading: false });
    expect(result.current).toBe('exiting');

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe('hidden');
  });

  it('returns to loading when a new load starts during the exit', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderPhase(true);

    rerender({ loading: false });
    expect(result.current).toBe('exiting');

    rerender({ loading: true });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('loading');
  });
});
