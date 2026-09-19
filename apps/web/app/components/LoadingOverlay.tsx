export type LoadingPhase = 'loading' | 'exiting';

interface LoadingOverlayProps {
  /** `loading` plays the hover loop; `exiting` flies the saucer up and fades. */
  phase: LoadingPhase;
  caption?: string;
}

/** Black full-screen frame with the saucer mark hovering over its beam. */
export function LoadingOverlay({
  phase,
  caption = 'abducting the receipts…',
}: LoadingOverlayProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[60] grid min-h-screen place-items-center overflow-hidden bg-[#0a0612] ${
        phase === 'exiting' ? 'nocap-exit' : ''
      }`}
    >
      <div className="relative flex h-72 w-72 items-start justify-center">
        {/* the saucer disc sits in the lower third of logo.svg, so the
            glow and beam anchor at ~75% of the mark's height */}
        <img
          src="/logo.svg"
          alt=""
          className="nocap-ship nocap-wobble size-24"
        />

        <div
          aria-hidden
          className="absolute left-1/2 top-[70px] -translate-x-1/2"
        >
          <div
            className="nocap-pulse h-9 w-44 rounded-[100%]"
            style={{
              background:
                'radial-gradient(closest-side, #9d80ff, #7c5cff 55%, transparent)',
              filter: 'blur(3px)',
            }}
          />
        </div>

        <div
          aria-hidden
          className="absolute left-1/2 top-[74px] -translate-x-1/2"
        >
          <div
            className="nocap-beam h-32 w-24"
            style={{
              background:
                'linear-gradient(to bottom, rgba(167, 139, 250, 0.55), rgba(124, 92, 255, 0.18) 60%, transparent)',
              clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
            }}
          />
        </div>

        <p className="absolute bottom-0 font-mono text-xs tracking-[0.3em] text-[#c4b5fd] uppercase">
          {caption}
        </p>
      </div>
    </div>
  );
}
