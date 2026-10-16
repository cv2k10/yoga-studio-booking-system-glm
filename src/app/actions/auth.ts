"use server";

import { eq } from "drizzle-orm";
import { redirect, revalidatePath, safeNext } from "@/lib/next";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  clearSessionCookie,
  getCurrentUser,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/actions";
import { notifyMany } from "@/lib/scheduling";

function str(data: FormData, key: string): string {
  return `${data.get(key) ?? ""}`.trim();
}

export async function registerAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const name = str(data, "name");
  const email = str(data, "email").toLowerCase();
  const phone = str(data, "phone");
  const password = str(data, "password");
  const next = safeNext(str(data, "next"), "/dashboard");

  if (name.length < 2) return fail("Please enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Please enter a valid email address.");
  if (password.length < 6) return fail("Password must be at least 6 characters.");

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return fail("That email is already registered. Try signing in instead.");

  const [created] = await db
    .insert(users)
    .values({ name, email, phone: phone || null, passwordHash: await hashPassword(password) })
    .returning();

  await setSessionCookie(created.id);
  await notifyMany([created.id], {
    type: "info",
    title: `Welcome to Sattva Studio, ${name.split(" ")[0]}`,
    body: "Your member account is ready. Browse the weekly timetable, pick a class and purchase a class voucher to start booking.",
    actionHref: "/timetable",
  });
  revalidatePath("/", "layout");
  redirect(next);
}

export async function loginAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const email = str(data, "email").toLowerCase();
  const password = str(data, "password");
  const next = str(data, "next");

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("Those credentials do not match our records.");
  }
  if (!user.isActive) return fail("This account has been deactivated. Please contact the studio.");

  await setSessionCookie(user.id);
  revalidatePath("/", "layout");
  redirect(safeNext(next, user.role === "admin" ? "/admin" : "/dashboard"));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfileAction(
  _prev: ActionState,
  data: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in first.");
  const name = str(data, "name");
  const phone = str(data, "phone");
  if (name.length < 2) return fail("Please enter your full name.");
  await db.update(users).set({ name, phone: phone || null }).where(eq(users.id, user.id));
  revalidatePath("/dashboard");
  return ok("Profile updated.");
}

export async function changePasswordAction(
  _prev: ActionState,
  data: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in first.");
  const current = str(data, "current");
  const next = str(data, "next");
  if (!(await verifyPassword(current, user.passwordHash))) return fail("Current password is incorrect.");
  if (next.length < 6) return fail("New password must be at least 6 characters.");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  return ok("Password changed.");
}
