import { Hono, type Context } from "hono";
import type { FC } from "hono/jsx";
import { contextStorage } from "hono/context-storage";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sql } from "drizzle-orm";
import { createDb, db } from "@/db";
import type { AppEnv, Flash } from "@/env";
import type { ActionState } from "@/lib/actions";
import { loadUser } from "@/lib/auth";
import { NotFoundError, RedirectError, type ReactNode } from "@/lib/next";
import { ensureSessionHorizon } from "@/lib/scheduling";
import * as adminActions from "@/app/actions/admin";
import * as authActions from "@/app/actions/auth";
import * as bookingActions from "@/app/actions/booking";

import RootLayout from "@/app/layout";
import AdminLayout from "@/app/admin/layout";
import HomePage from "@/app/page";
import TimetablePage from "@/app/timetable/page";
import ClassesPage from "@/app/classes/page";
import ClassDetailPage from "@/app/classes/[slug]/page";
import TeachersPage from "@/app/teachers/page";
import TeacherProfilePage from "@/app/teachers/[slug]/page";
import RoomsPage from "@/app/rooms/page";
import RoomDetailPage from "@/app/rooms/[slug]/page";
import VouchersPage from "@/app/vouchers/page";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import DashboardPage from "@/app/dashboard/page";
import BookingProofPage from "@/app/dashboard/bookings/[reference]/page";
import NotificationsPage from "@/app/notifications/page";
import AdminOverviewPage from "@/app/admin/page";
import AdminTimetablePage from "@/app/admin/timetable/page";
import AdminCataloguePage from "@/app/admin/catalogue/page";
import AdminMembersPage from "@/app/admin/members/page";

type Action = (prev: ActionState, data: FormData) => Promise<ActionState | void>;

const ADMIN_ACTIONS = new Map<string, Action>(Object.entries(adminActions) as [string, Action][]);
const PUBLIC_ACTIONS = new Map<string, Action>(
  Object.entries({ ...authActions, ...bookingActions }) as [string, Action][],
);

const FLASH_COOKIE = "sattva_flash";

const app = new Hono<AppEnv>();

app.use(contextStorage());
app.use(async (c, next) => {
  c.set("db", createDb(c.env.DB));

  const rawFlash = getCookie(c, FLASH_COOKIE);
  let flash: Flash | null = null;
  if (rawFlash) {
    try {
      flash = JSON.parse(rawFlash) as Flash;
    } catch {
      flash = null;
    }
    deleteCookie(c, FLASH_COOKIE, { path: "/" });
  }
  c.set("flash", flash);

  c.set("user", await loadUser(c));
  await next();
});

/* ------------------------------ page rendering ----------------------------- */
type PageProps = {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
};
// Page modules type their own params/searchParams shapes.
type Page = (props: any) => unknown;

async function renderPage(
  c: Context<AppEnv>,
  body: ReactNode,
  title?: string,
  status = 200,
): Promise<Response> {
  try {
    const html = await (<RootLayout title={title}>{body}</RootLayout>).toString();
    return c.html(`<!DOCTYPE html>${html}`, status as 200);
  } catch (error) {
    if (error instanceof RedirectError) return c.redirect(error.location, 302);
    if (error instanceof NotFoundError) return renderNotFound(c);
    throw error;
  }
}

function renderNotFound(c: Context<AppEnv>): Promise<Response> {
  return renderPage(
    c,
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl">Page not found</h1>
      <p className="mt-3 text-sm text-ink-soft">That page isn't on the timetable.</p>
      <a href="/" className="btn btn-primary btn-sm mt-6">
        Back to the studio
      </a>
    </div>,
    "Not found · Sattva Studio",
    404,
  );
}

function page(path: string, Component: Page, options: { admin?: boolean; title?: string } = {}) {
  const View = Component as FC<PageProps>;
  app.get(path, (c) => {
    const user = c.get("user");
    if (options.admin) {
      if (!user) return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`, 302);
      if (user.role !== "admin") return c.redirect("/dashboard", 302);
    }
    const content = (
      <View
        params={Promise.resolve(c.req.param() as Record<string, string>)}
        searchParams={Promise.resolve(c.req.query())}
      />
    );
    const body = options.admin ? <AdminLayout>{content}</AdminLayout> : content;
    return renderPage(c, body, options.title);
  });
}

page("/", HomePage);
page("/timetable", TimetablePage);
page("/classes", ClassesPage, { title: "Class styles · Sattva Studio" });
page("/classes/:slug", ClassDetailPage);
page("/teachers", TeachersPage);
page("/teachers/:slug", TeacherProfilePage);
page("/rooms", RoomsPage);
page("/rooms/:slug", RoomDetailPage);
page("/vouchers", VouchersPage);
page("/login", LoginPage);
page("/register", RegisterPage);
page("/dashboard", DashboardPage);
page("/dashboard/bookings/:reference", BookingProofPage);
page("/notifications", NotificationsPage);
page("/admin", AdminOverviewPage, { admin: true });
page("/admin/timetable", AdminTimetablePage, { admin: true });
page("/admin/catalogue", AdminCataloguePage, { admin: true });
page("/admin/members", AdminMembersPage, { admin: true });

/* --------------------------------- actions -------------------------------- */
/** Same-origin page the form was posted from, so the result shows in context. */
function backTo(c: Context<AppEnv>): string {
  const referer = c.req.header("referer");
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    return url.origin === new URL(c.req.url).origin ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

app.post("/_action/:name", async (c) => {
  // Session cookies are SameSite=Lax; also reject cross-site posts outright.
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) return c.text("Forbidden", 403);

  const name = c.req.param("name");
  const user = c.get("user");
  let action = PUBLIC_ACTIONS.get(name);
  if (!action && ADMIN_ACTIONS.has(name)) {
    if (!user) return c.redirect(`/login?next=${encodeURIComponent(backTo(c))}`, 303);
    if (user.role !== "admin") return c.text("Forbidden", 403);
    action = ADMIN_ACTIONS.get(name);
  }
  if (!action) return c.notFound();

  try {
    const state = await action(null, await c.req.formData());
    if (state) {
      setCookie(c, FLASH_COOKIE, JSON.stringify(state), { path: "/", httpOnly: true, sameSite: "Lax" });
    }
  } catch (error) {
    if (error instanceof RedirectError) return c.redirect(error.location, 303);
    throw error;
  }
  return c.redirect(backTo(c), 303);
});

/* ---------------------------------- misc ---------------------------------- */
app.get("/api/health", async (c) => {
  try {
    await db.run(sql`select 1`);
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 500);
  }
});

/** Daily housekeeping, invoked by the cron trigger below. */
app.post("/__cron/daily", async (c) => {
  if (c.req.header("x-cron-secret") !== c.env.AUTH_SECRET) return c.text("Forbidden", 403);
  await ensureSessionHorizon();
  await adminActions.expireStaleVouchersAction();
  return c.json({ ok: true });
});

app.notFound((c) => renderNotFound(c));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: AppEnv["Bindings"], ctx: ExecutionContext) {
    const request = new Request("https://cron.internal/__cron/daily", {
      method: "POST",
      headers: { "x-cron-secret": env.AUTH_SECRET },
    });
    ctx.waitUntil(Promise.resolve(app.fetch(request, env, ctx)));
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
