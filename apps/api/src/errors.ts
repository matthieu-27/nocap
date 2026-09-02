import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ServiceError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
