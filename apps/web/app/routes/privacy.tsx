export default function PrivacyRoute(): React.ReactElement {
  return (
    <article className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placeholder text — must be reviewed before the site is promoted.
      </p>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>Data we store about you:</p>
        <ul className="list-disc pl-6">
          <li>Email address</li>
          <li>Password hash (never the password)</li>
          <li>Username, posts, votes, and comments you create</li>
          <li>IP logs, kept 90 days, used for abuse handling only</li>
        </ul>
        <p>
          No ads, no trackers, no analytics. Embedded media loads only after you
          click (GDPR: no third-party request happens without it).
        </p>
      </div>
    </article>
  );
}
