import { SITE_NAME } from '@nocap/shared';
import { Link } from 'react-router';

export function Logo(): React.ReactElement {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-bold">
      <img src="/logo.svg" alt="" className="size-7" />
      {SITE_NAME}
    </Link>
  );
}
