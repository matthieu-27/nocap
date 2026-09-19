import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';

import { LoadingOverlay, type LoadingPhase } from './LoadingOverlay';

export type OverlayPhase = 'hidden' | LoadingPhase;

/** Fast loader round-trips under this never flash the overlay. */
const SHOW_DELAY_MS = 200;
/** How long the saucer fly-away exit plays before unmounting. */
const EXIT_MS = 600;
/** Every full page load plays the saucer at least this long, cached or not. */
const SPLASH_MIN_MS = 1000;

/**
 * Overlay phase machine: hidden → loading (debounced) → exiting → hidden.
 * A load already pending at mount shows instantly — no debounce — so the
 * overlay is in the server-rendered HTML with no content flash first.
 */
export function useOverlayPhase(loading: boolean): OverlayPhase {
  const [phase, setPhase] = useState<OverlayPhase>(() =>
    loading ? 'loading' : 'hidden',
  );

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

/** Shows the saucer overlay while route loaders run, then flies it away.
 * Every full page load plays it once for at least SPLASH_MIN_MS. */
export function RouteLoadingOverlay(): React.ReactElement | null {
  const navigation = useNavigation();
  // this component mounts once per document load, so the splash timer
  // fires exactly once per refresh — cached loads included
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    const minPlay = setTimeout(() => setSplash(false), SPLASH_MIN_MS);
    return () => clearTimeout(minPlay);
  }, []);
  // 'loading' only — 'submitting' (form POSTs) keeps the form visible
  // under the user's cursor instead of a full-screen overlay
  const phase = useOverlayPhase(splash || navigation.state === 'loading');
  if (phase === 'hidden') return null;
  return <LoadingOverlay phase={phase} />;
}
