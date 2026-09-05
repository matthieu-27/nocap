export default function ContactRoute(): React.ReactElement {
  return (
    <article className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Contact</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placeholder text — must be reviewed before the site is promoted.
      </p>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          To report content or raise a legal notice (DSA), email{' '}
          <a className="underline" href="mailto:contact@nocap.example.org">
            contact@nocap.example.org
          </a>
          . Target response: 48 hours. Illegal content is removed on notice.
        </p>
      </div>
    </article>
  );
}
