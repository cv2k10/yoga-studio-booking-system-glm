import { getContext } from "hono/context-storage";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import type { AppEnv } from "@/env";
import { redirect } from "@/lib/next";

const COOKIE_NAME = "sattva_session";
const SESSION_DAYS = 30;
// Workers caps PBKDF2 at 100k iterations.
const PBKDF2_ITERATIONS = 100_000;

function secret(c: Context<AppEnv>): string {
  const value = c.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured");
  return value;
}

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)?.map((b) => parseInt(b, 16)) ?? []);

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Stored as `pbkdf2$<iterations>$<salt hex>$<hash hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, rawIterations, salt, hash] = stored.split("$");
  const iterations = Number(rawIterations);
  if (scheme !== "pbkdf2" || !salt || !hash || !Number.isInteger(iterations)) return false;
  const derived = await derive(password, fromHex(salt), iterations);
  const expected = fromHex(hash);
  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i += 1) diff |= derived[i] ^ expected[i];
  return diff === 0;
}

export async function setSessionCookie(userId: number): Promise<void> {
  const c = getContext<AppEnv>();
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await setSignedCookie(c, COOKIE_NAME, `${userId}.${expires}`, secret(c), {
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  deleteCookie(getContext<AppEnv>(), COOKIE_NAME, { path: "/" });
}

/** Middleware helper: resolves the signed-in user once per request. */
export async function loadUser(c: Context<AppEnv>): Promise<User | null> {
  const token = await getSignedCookie(c, secret(c), COOKIE_NAME);
  if (!token) return null;
  const [rawId, rawExpires] = token.split(".");
  const id = Number(rawId);
  const expires = Number(rawExpires);
  if (!Number.isInteger(id) || !Number.isFinite(expires) || expires < Date.now()) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user && user.isActive ? user : null;
}

export async function getCurrentUser(): Promise<User | null> {
  return getContext<AppEnv>().var.user;
}

export async function requireUser(next = "/dashboard"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
