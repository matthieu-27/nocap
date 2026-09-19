// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOverlayPhase } from './RouteLoadingOverlay';

afterEach(() => {
  vi.useRealTimers();
});

describe('useOverlayPhase', () => {
  it('stays hidden while loading finishes under the debounce', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useOverlayPhase(loading),
      { initialProps: { loading: true } },
    );

    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('hidden');
  });

  it('shows the overlay after the debounce while loading continues', () => {
    vi.useFakeTimers();
    const { result } = renderHook(
      ({ loading }: { loading: boolean }) => useOverlayPhase(loading),
      { initialProps: { loading: true } },
    );

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
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useOverlayPhase(loading),
      { initialProps: { loading: true } },
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ loading: false });
    expect(result.current).toBe('exiting');

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe('hidden');
  });

  it('returns to loading when a new load starts during the exit', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useOverlayPhase(loading),
      { initialProps: { loading: true } },
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ loading: false });
    expect(result.current).toBe('exiting');

    rerender({ loading: true });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('loading');
  });
});
