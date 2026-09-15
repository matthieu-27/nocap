import { Plus } from 'lucide-react';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api';
import { apiJson } from '@/lib/browser-api';

import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Spinner } from './ui/spinner';
import { Textarea } from './ui/textarea';

const SLUG_RE = /^[a-z0-9-]{3,32}$/;

export function CreateChannelDialog(): ReactElement {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  const slugInvalid = slug !== '' && !SLUG_RE.test(slug);
  const nameInvalid = name !== '' && (name.length < 2 || name.length > 64);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!SLUG_RE.test(slug) || name.length < 2 || name.length > 64) {
      setError(
        'slug must be 3-32 lowercase letters, digits, or hyphens; name must be 2-64 characters',
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiJson('/api/domains', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          name,
          description: description.trim() === '' ? undefined : description,
        }),
      });
      setOpen(false);
      setSlug('');
      setName('');
      setDescription('');
      toast('Channel created');
      // Landing on the new channel refetches the shell loader — sidebar and
      // feed both see it without manual revalidation (and revalidator needs
      // a data router, which MemoryRouter-based tests do not provide).
      navigate(`/d/${slug}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Channel creation failed',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          />
        }
      >
        <Plus data-icon="inline-start" />
        Create channel
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels group claims by topic. Each account can create up to three.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={slugInvalid || undefined}>
              <FieldLabel htmlFor="channel-slug">Slug</FieldLabel>
              <Input
                id="channel-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                aria-invalid={slugInvalid}
                placeholder="sports"
              />
              <FieldDescription>
                3–32 lowercase letters, digits, or hyphens — becomes
                r/&lt;slug&gt;.
              </FieldDescription>
            </Field>
            <Field data-invalid={nameInvalid || undefined}>
              <FieldLabel htmlFor="channel-name">Name</FieldLabel>
              <Input
                id="channel-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={nameInvalid}
                placeholder="Sports"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="channel-description">
                Description (optional)
              </FieldLabel>
              <Textarea
                id="channel-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
              />
            </Field>
          </FieldGroup>
          {error !== null && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-end" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
