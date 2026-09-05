import { SITE_NAME } from '@nocap/shared';
import { Link } from 'react-router';

export function Logo(): React.ReactElement {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-bold">
      {/* Replace the mark below with <img src="/logo.svg" ... /> once the
          logo exists in apps/web/public/. Wordmark stays either way. */}
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground"
      >
        N/
      </span>
      {SITE_NAME}
    </Link>
  );
}
