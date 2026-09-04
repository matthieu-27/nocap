export default function TermsRoute(): React.ReactElement {
  return (
    <article className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placeholder text — must be reviewed before the site is promoted.
      </p>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          NoCaP is a forum where the community votes on whether a claim is
          well-sourced. By posting, users license their posts and comments to
          other users to quote and discuss within the site.
        </p>
        <p>
          Vote on sourcing quality, never on agreement. Do not post personal
          information about others, harassment, or illegal content. Moderators
          may remove content and lock channels; every removal is logged with a
          reason.
        </p>
        <p>
          The service is provided as-is. See the{' '}
          <a className="underline" href="/privacy">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </article>
  );
}
