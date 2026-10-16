/**
 * Small stand-ins for the Next.js APIs the views and actions were written
 * against. Thrown errors are turned into responses by the router.
 */
import type { Child } from "hono/jsx";

export type ReactNode = Child;
export type Metadata = { title?: string; description?: string };

export class RedirectError extends Error {
  constructor(public readonly location: string) {
    super(`Redirect to ${location}`);
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("Not found");
  }
}

export function redirect(location: string): never {
  throw new RedirectError(location);
}

export function notFound(): never {
  throw new NotFoundError();
}

/** Every page is rendered per request, so there is no cache to revalidate. */
export function revalidatePath(_path: string, _type?: "layout" | "page"): void {}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
