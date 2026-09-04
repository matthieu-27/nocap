import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

export default function HomeRoute(): React.ReactElement {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold">The feed is next</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Posts, votes, and comments arrive with the content plan — the API
        endpoints they need are the next backend milestone. Meanwhile:
      </p>
      <Button asChild className="mt-4">
        <Link to="/signup">Create an account</Link>
      </Button>
    </section>
  );
}
