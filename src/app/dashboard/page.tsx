import Link from "@/components/Link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, classSessions, classTypes, notifications, rooms, teachers, vouchers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Stat } from "@/components/ui";
import { cancelBookingAction } from "@/app/actions/booking";
import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import { formatDateTime, formatMoney, formatRange, formatDateShort, hoursUntil, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const today = todayISO();

  const rows = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      createdAt: bookings.createdAt,
      checkedInAt: bookings.checkedInAt,
      sessionId: classSessions.id,
      sessionDate: classSessions.sessionDate,
      startTime: classSessions.startTime,
      durationMinutes: classSessions.durationMinutes,
      sessionStatus: classSessions.status,
      isExtra: classSessions.isExtra,
      className: classTypes.name,
      classSlug: classTypes.slug,
      intensity: classTypes.intensity,
      teacherName: teachers.name,
      teacherSlug: teachers.slug,
      roomName: rooms.name,
      roomSlug: rooms.slug,
      roomView: rooms.viewName,
      voucherCode: vouchers.code,
      changeCount: sql<number>`(
        select count(*) from session_changes sc where sc.session_id = ${classSessions.id}
      )`.mapWith(Number),
    })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .innerJoin(teachers, eq(classSessions.teacherId, teachers.id))
    .innerJoin(rooms, eq(classSessions.roomId, rooms.id))
    .leftJoin(vouchers, eq(bookings.voucherId, vouchers.id))
    .where(eq(bookings.userId, user.id))
    .orderBy(desc(classSessions.sessionDate), desc(classSessions.startTime));

  const upcoming = rows.filter(
    (row) =>
      row.status === "confirmed" &&
      (row.sessionDate > today || (row.sessionDate === today && hoursUntil(row.sessionDate, row.startTime) > 0)),
  );
  const past = rows.filter(
    (row) =>
      row.status !== "confirmed" ||
      row.sessionDate < today ||
      (row.sessionDate === today && hoursUntil(row.sessionDate, row.startTime) <= 0),
  );

  const myVouchers = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.userId, user.id))
    .orderBy(desc(vouchers.purchasedAt));

  const activeCredits = myVouchers
    .filter((v) => v.status === "active" && v.expiresAt >= today)
    .reduce((sum, v) => sum + v.creditsRemaining, 0);

  const unreadRows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
  const unreadRow = unreadRows[0];

  const totalSpent = myVouchers.reduce((sum, v) => sum + v.priceCents, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-clay">Member area</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Hello, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Member since {formatDateTime(user.createdAt)} · {user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/timetable" className="btn btn-primary btn-sm">Book a class</Link>
          <Link href="/vouchers" className="btn btn-outline btn-sm">Buy credits</Link>
          {user.role === "admin" ? <Link href="/admin" className="btn btn-outline btn-sm">Studio admin</Link> : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Credits available" value={`${activeCredits}`} hint="Across all active vouchers" />
        <Stat label="Upcoming bookings" value={`${upcoming.length}`} hint="Show the QR at reception" />
        <Stat label="Classes attended" value={`${rows.filter((r) => r.status === "attended").length}`} hint="Lifetime at the studio" />
        <Stat
          label="Unread notifications"
          value={`${unreadRow?.count ?? 0}`}
          hint={<Link href="/notifications" className="link-underline">Open inbox</Link>}
        />
      </div>

      {/* Upcoming bookings */}
      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Upcoming bookings</h2>
            <p className="text-sm text-ink-soft">Proof of booking for each class — open it to show the QR code at the door.</p>
          </div>
          <Link href="/timetable" className="btn btn-outline btn-sm">Add another class</Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="display text-xl">No upcoming classes yet</p>
            <p className="mt-2 text-sm text-ink-soft">
              {activeCredits > 0
                ? "You have credits ready — pick a slot from the weekly timetable."
                : "Purchase a class voucher, then pick a slot from the weekly timetable."}
            </p>
            <Link href="/timetable" className="btn btn-primary btn-sm mt-4">Open timetable</Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {upcoming.map((row) => {
              const hours = hoursUntil(row.sessionDate, row.startTime);
              return (
                <article key={row.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                        {formatDateShort(row.sessionDate)}
                      </p>
                      <h3 className="display text-xl">{row.className}</h3>
                      <p className="text-sm text-ink-soft">
                        {formatRange(row.startTime, row.durationMinutes)} · {row.intensity}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {row.sessionStatus !== "scheduled" ? <Badge tone="clay">Class cancelled</Badge> : null}
                      {row.isExtra ? <Badge tone="clay">Extra class</Badge> : null}
                      {row.changeCount > 0 ? <Badge tone="warn">{row.changeCount} schedule change(s)</Badge> : null}
                      <Badge tone="sage">Confirmed</Badge>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-sand-deep/50 px-3 py-2">
                      <dt className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">Teacher</dt>
                      <dd className="font-semibold">{row.teacherName}</dd>
                    </div>
                    <div className="rounded-xl bg-sand-deep/50 px-3 py-2">
                      <dt className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">Studio room</dt>
                      <dd className="font-semibold">
                        {row.roomName} <span className="text-xs font-normal text-ink-soft">· {row.roomView}</span>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/bookings/${row.reference}`} className="btn btn-primary btn-sm">
                      Booking proof · {row.reference}
                    </Link>
                    {hours >= 4 ? (
                      <ActionForm
                        action={cancelBookingAction}
                        submitLabel="Cancel booking"
                        pendingLabel="Cancelling…"
                        submitClassName="btn btn-outline btn-sm"
                        confirmText="Cancel this booking? Your credit returns to your voucher."
                        className="inline"
                      >
                        <input type="hidden" name="bookingId" value={row.id} />
                      </ActionForm>
                    ) : (
                      <span className="pill bg-amber-100 text-amber-800">Cancellation closed (&lt;4h)</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Vouchers */}
      <section id="vouchers" className="mt-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl">My class vouchers</h2>
            <p className="text-sm text-ink-soft">Total value purchased {formatMoney(totalSpent)}</p>
          </div>
          <Link href="/vouchers" className="btn btn-primary btn-sm">Buy another pack</Link>
        </div>

        {myVouchers.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="display text-xl">No vouchers yet</p>
            <p className="mt-2 text-sm text-ink-soft">Buy credits to start booking classes.</p>
            <Link href="/vouchers" className="btn btn-primary btn-sm mt-4">View voucher packs</Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myVouchers.map((voucher) => {
              const used = voucher.creditsTotal - voucher.creditsRemaining;
              const pct = Math.round((used / Math.max(voucher.creditsTotal, 1)) * 100);
              const expired = voucher.expiresAt < today;
              return (
                <article key={voucher.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-bold">{voucher.code}</p>
                      <p className="text-xs text-ink-soft">{voucher.productName}</p>
                    </div>
                    <Badge tone={expired ? "muted" : voucher.creditsRemaining > 0 ? "sage" : "clay"}>
                      {expired ? "Expired" : voucher.creditsRemaining > 0 ? "Active" : "Depleted"}
                    </Badge>
                  </div>
                  <p className="mt-4 text-3xl">
                    {voucher.creditsRemaining}
                    <span className="text-base text-ink-soft">/{voucher.creditsTotal} credits</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/8">
                    <div className="h-full rounded-full bg-sage" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-ink-soft">
                    Valid until {voucher.expiresAt} · {formatMoney(voucher.priceCents)} · purchased{" "}
                    {formatDateTime(voucher.purchasedAt)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Booking history */}
      <section className="mt-12">
        <h2 className="display text-2xl">Booking history</h2>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-sand-deep/50 text-left text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Teacher / room</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {past.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateShort(row.sessionDate)}</td>
                  <td className="px-4 py-3">{row.className}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {row.teacherName} · {row.roomName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.reference}</td>
                  <td className="px-4 py-3">
                    {row.status === "attended" ? <Badge tone="sage">Attended</Badge> : null}
                    {row.status === "no_show" ? <Badge tone="clay">No show</Badge> : null}
                    {row.status === "cancelled" ? <Badge tone="muted">Cancelled</Badge> : null}
                    {row.status === "confirmed" ? <Badge tone="warn">Past</Badge> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/bookings/${row.reference}`} className="btn btn-ghost btn-sm">Receipt</Link>
                  </td>
                </tr>
              ))}
              {past.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">No past bookings yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Profile */}
      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="display text-xl">Profile</h2>
          <ActionForm action={updateProfileAction} submitLabel="Save profile" submitClassName="btn btn-primary btn-sm mt-1" className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" defaultValue={user.name} className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="phone">Mobile</label>
              <input id="phone" name="phone" defaultValue={user.phone ?? ""} className="field" />
            </div>
          </ActionForm>
        </div>
        <div className="card p-6">
          <h2 className="display text-xl">Password</h2>
          <ActionForm action={changePasswordAction} submitLabel="Change password" submitClassName="btn btn-outline btn-sm mt-1" className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="current">Current password</label>
              <input id="current" name="current" type="password" className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="next-pass">New password</label>
              <input id="next-pass" name="next" type="password" className="field" required minLength={6} />
            </div>
          </ActionForm>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-ink-soft">
        Bookings are held until 5 minutes before class. Arrive early — mats are first come, first seated.
      </p>
    </div>
  );
}
