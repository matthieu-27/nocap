import { Input } from './ui/input';

export function SearchBar(): React.ReactElement {
  return (
    <Input
      type="search"
      aria-label="Search"
      disabled
      placeholder="Search — coming soon"
      className="mx-auto w-full max-w-md rounded-full"
    />
  );
}
