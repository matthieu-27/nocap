import {
  type DomainDto,
  type PostDto,
  type ProviderId,
  SUPPORTED_PROVIDERS,
  toUrl,
} from '@nocap/shared';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ApiError, apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { apiJson } from '@/lib/browser-api';

import type { Route } from './+types/submit';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  link: 'Link',
};

const PROVIDER_HINTS: Record<ProviderId, string> = {
  youtube: 'Paste a YouTube link',
  tiktok: 'Paste a TikTok link',
  link: 'Paste any link — we fetch a preview',
};

const DEFAULT_URL_HINT = 'Paste a YouTube, TikTok, or any other link';

// Roadmap chips (frame 03): shown so the shape of v2 is visible, disabled
// because only SUPPORTED_PROVIDERS post today.
const V2_PROVIDERS = [
  { value: 'instagram', label: 'Instagram Reel' },
  { value: 'facebook', label: 'Facebook Reel' },
] as const;

// Mirrors the service (post.service.ts createPost) so bad input dies here
// instead of as a 400 round trip.
function titleProblem(raw: string): string | null {
  const length = raw.trim().length;
  if (length < 5 || length > 300) {
    return 'Title must be 5-300 characters';
  }
  return null;
}

function urlProblem(raw: string): string | null {
  const parsed = toUrl(raw.trim());
  if (
    parsed === null ||
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
  ) {
    return 'Source URL must be a valid http or https URL';
  }
  return null;
}

// Allowlist narrowing (same pattern as toSessionUser's ROLES): the chips emit
// strings, but only SUPPORTED_PROVIDERS ids may enter the hint state.
function toProviderId(value: string | undefined): ProviderId | null {
  return SUPPORTED_PROVIDERS.find((provider) => provider === value) ?? null;
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<{ domains: DomainDto[] }> {
  try {
    const domains = await apiFetch<DomainDto[]>(request, '/api/domains');
    return { domains };
  } catch (error) {
    console.error('domains fetch failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return { domains: [] };
  }
}

// All mutable form state lives here so SubmitRoute stays a thin composition.
function useSubmitForm(domains: DomainDto[]) {
  const navigate = useNavigate();

  const [domainSlug, setDomainSlug] = useState(domains[0]?.slug ?? '');
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<ProviderId | null>(null);
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextTitleError = titleProblem(title);
    const nextUrlError = urlProblem(url);
    setTitleError(nextTitleError);
    setUrlError(nextUrlError);
    setServerError(null);
    if (nextTitleError !== null || nextUrlError !== null) {
      return;
    }
    setPending(true);
    const trimmedBody = body.trim();
    try {
      const post = await apiJson<PostDto>('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          domainSlug,
          title: title.trim(),
          url: url.trim(),
          body: trimmedBody.length > 0 ? trimmedBody : undefined,
        }),
      });
      toast('Post created');
      navigate(`/p/${post.id}`);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Post failed — try again',
      );
    } finally {
      setPending(false);
    }
  }

  return {
    domainSlug,
    setDomainSlug,
    title,
    setTitle,
    sourceType,
    setSourceType,
    url,
    setUrl,
    body,
    setBody,
    titleError,
    urlError,
    serverError,
    pending,
    handleSubmit,
  };
}

type SubmitForm = ReturnType<typeof useSubmitForm>;

// Signed-out visitors get the login CTA (no redirect dance, same as the
// comment composer).
function SignedOutCallout(): ReactElement {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="flex w-full max-w-xl flex-col items-start gap-4">
        <h1 className="text-2xl font-bold">Submit a claim</h1>
        <p className="text-sm text-muted-foreground">
          Log in to post a claim for the crowd to check.
        </p>
        <Link to="/login" className={buttonVariants()}>
          Log in to post
        </Link>
      </div>
    </main>
  );
}

// Source-type chips are guidance only — provider detection stays server-side,
// so the payload is exactly { domainSlug, title, body?, url }.
function SourceTypeChips({
  value,
  onChange,
}: {
  value: ProviderId | null;
  onChange: (next: ProviderId | null) => void;
}): ReactElement {
  return (
    <Field>
      <FieldLabel>Source type</FieldLabel>
      <ToggleGroup
        aria-label="Source type"
        value={value === null ? [] : [value]}
        onValueChange={(values) => onChange(toProviderId(values.at(-1)))}
      >
        {SUPPORTED_PROVIDERS.map((provider) => (
          <ToggleGroupItem key={provider} value={provider}>
            {PROVIDER_LABELS[provider]}
          </ToggleGroupItem>
        ))}
        {V2_PROVIDERS.map((provider) => (
          <ToggleGroupItem key={provider.value} value={provider.value} disabled>
            {provider.label}
            <Badge variant="secondary">v2</Badge>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FieldDescription>
        Detection is automatic — the chip only updates the hint below.
      </FieldDescription>
    </Field>
  );
}

function SubmitFormFields({
  form,
  domains,
}: {
  form: SubmitForm;
  domains: DomainDto[];
}): ReactElement {
  // Base UI's Select.Value renders the raw value unless Root gets an items
  // map — slug ≠ display name, so the map is required here.
  const channelItems = domains.map((domain) => ({
    label: domain.name,
    value: domain.slug,
  }));

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="submit-channel">Channel</FieldLabel>
        <Select
          value={form.domainSlug}
          onValueChange={(value) => form.setDomainSlug(value ?? '')}
          items={channelItems}
        >
          <SelectTrigger id="submit-channel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {domains.map((domain) => (
                <SelectItem key={domain.slug} value={domain.slug}>
                  {domain.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field data-invalid={form.titleError !== null || undefined}>
        <FieldLabel htmlFor="submit-title">Title</FieldLabel>
        <Input
          id="submit-title"
          value={form.title}
          onChange={(event) => form.setTitle(event.target.value)}
          aria-invalid={form.titleError !== null || undefined}
          placeholder="State the claim as a question"
        />
        {form.titleError !== null && <FieldError>{form.titleError}</FieldError>}
      </Field>

      <SourceTypeChips value={form.sourceType} onChange={form.setSourceType} />

      <Field data-invalid={form.urlError !== null || undefined}>
        <FieldLabel htmlFor="submit-url">Source URL</FieldLabel>
        <Input
          id="submit-url"
          value={form.url}
          onChange={(event) => form.setUrl(event.target.value)}
          aria-invalid={form.urlError !== null || undefined}
          placeholder="https://…"
        />
        <FieldDescription>
          {form.sourceType === null
            ? DEFAULT_URL_HINT
            : PROVIDER_HINTS[form.sourceType]}
        </FieldDescription>
        {form.urlError !== null && <FieldError>{form.urlError}</FieldError>}
      </Field>

      <Field>
        <FieldLabel htmlFor="submit-body">Body</FieldLabel>
        <Textarea
          id="submit-body"
          value={form.body}
          onChange={(event) => form.setBody(event.target.value)}
          placeholder="Optional context — what you already verified"
          rows={5}
        />
      </Field>
    </FieldGroup>
  );
}

// Frame 03 — a real route, not a dialog.
export default function SubmitRoute({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const { domains } = loaderData;
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const form = useSubmitForm(domains);

  if (session?.user == null) {
    return <SignedOutCallout />;
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Submit a claim</h1>
          <p className="text-sm text-muted-foreground">
            One claim per post — the crowd checks the receipts.
          </p>
        </div>

        {form.serverError !== null && (
          <Alert variant="destructive">
            <AlertDescription>{form.serverError}</AlertDescription>
          </Alert>
        )}

        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => void form.handleSubmit(event)}
        >
          <SubmitFormFields form={form} domains={domains} />
          <div className="flex gap-2">
            <Button type="submit" disabled={form.pending}>
              Post claim
              {form.pending && <Spinner data-icon="inline-end" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              Go back
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
