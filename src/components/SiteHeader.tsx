import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/timetable", label: "Timetable" },
  { href: "/classes", label: "Classes" },
  { href: "/teachers", label: "Teachers" },
  { href: "/rooms", label: "Studio rooms" },
  { href: "/vouchers", label: "Vouchers" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();

  let unread = 0;
  if (user) {
    const [row] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
    unread = row?.count ?? 0;
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink/8 bg-sand/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sand">
            <span className="display text-lg leading-none">S</span>
          </span>
          <span className="leading-tight">
            <span className="display block text-lg">Sattva Studio</span>
            <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Yoga · Pilates
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-white hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative rounded-full border border-ink/12 px-3 py-2 text-sm transition hover:border-ink/40"
                title="Notifications"
              >
                <span aria-hidden>🔔</span>
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-[0.6rem] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
              <Link
                href={user.role === "admin" ? "/admin" : "/dashboard"}
                className="btn btn-outline btn-sm hidden sm:inline-flex"
              >
                {user.role === "admin" ? "Studio admin" : "My account"}
              </Link>
              <form action={logoutAction} className="hidden sm:block">
                <button type="submit" className="btn btn-ghost btn-sm">
                  Sign out
                </button>
              </form>
              <details className="relative sm:hidden">
                <summary className="btn btn-outline btn-sm list-none">Menu</summary>
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-ink/10 bg-white p-2 shadow-lg">
                  <Link href="/dashboard" className="block rounded-xl px-3 py-2 text-sm hover:bg-sand">
                    My bookings
                  </Link>
                  <Link href="/notifications" className="block rounded-xl px-3 py-2 text-sm hover:bg-sand">
                    Notifications{unread > 0 ? ` (${unread})` : ""}
                  </Link>
                  {user.role === "admin" ? (
                    <Link href="/admin" className="block rounded-xl px-3 py-2 text-sm hover:bg-sand">
                      Studio admin
                    </Link>
                  ) : null}
                  <form action={logoutAction}>
                    <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-sand">
                      Sign out
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Join the studio
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-ink/8 lg:hidden">
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
