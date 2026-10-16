import Link from "@/components/Link";
import type { ReactNode } from "@/lib/next";
import { requireAdmin } from "@/lib/auth";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/timetable", label: "Timetable & classes" },
  { href: "/admin/catalogue", label: "Teachers, rooms & vouchers" },
  { href: "/admin/members", label: "Members & bookings" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-clay">Studio admin</p>
          <h1 className="mt-1 text-3xl">Sattva control room</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Signed in as {admin.name} · manage the weekly timetable, rooms, teachers, vouchers and
            member notifications.
          </p>
        </div>
        <Link href="/timetable" className="btn btn-outline btn-sm">View public timetable</Link>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-full border border-ink/12 bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-ink/40 hover:text-ink"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
