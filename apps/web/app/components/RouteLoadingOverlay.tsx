import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';

import { LoadingOverlay, type LoadingPhase } from './LoadingOverlay';

export type OverlayPhase = 'hidden' | LoadingPhase;

/** Fast loader round-trips under this never flash the overlay. */
const SHOW_DELAY_MS = 200;
/** How long the saucer fly-away exit plays before unmounting. */
const EXIT_MS = 600;

/** Overlay phase machine: hidden → loading (debounced) → exiting → hidden. */
export function useOverlayPhase(loading: boolean): OverlayPhase {
  const [phase, setPhase] = useState<OverlayPhase>('hidden');

  useEffect(() => {
    if (!loading) {
      // only an already-visible overlay exits; fast loads stay hidden
      setPhase((current) => (current === 'loading' ? 'exiting' : current));
      return;
    }
    const show = setTimeout(() => setPhase('loading'), SHOW_DELAY_MS);
    return () => clearTimeout(show);
  }, [loading]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const hide = setTimeout(() => setPhase('hidden'), EXIT_MS);
    return () => clearTimeout(hide);
  }, [phase]);

  return phase;
}

/** Shows the saucer overlay while route loaders run, then flies it away. */
export function RouteLoadingOverlay(): React.ReactElement | null {
  const navigation = useNavigation();
  // 'loading' only — 'submitting' (form POSTs) keeps the form visible
  // under the user's cursor instead of a full-screen overlay
  const phase = useOverlayPhase(navigation.state === 'loading');
  if (phase === 'hidden') return null;
  return <LoadingOverlay phase={phase} />;
}
