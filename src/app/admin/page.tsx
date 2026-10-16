import Link from "@/components/Link";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, classSessions, classTypes, payments, rooms, teachers, users, vouchers } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Stat } from "@/components/ui";
import { broadcastAction, syncTimetableAction, expireStaleVouchersAction } from "@/app/actions/admin";
import { getRecentChanges, getUpcomingSessions } from "@/lib/scheduling";
import { formatDateShort, formatDateTime, formatMoney, formatRange, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const today = todayISO();

  const count = async (query: Promise<{ count: number }[]>) => (await query)[0]?.count ?? 0;

  const [
    memberCount,
    sessionCount,
    bookingCount,
    creditsOutstanding,
    revenue,
  ] = await Promise.all([
    count(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, "member"))),
    count(
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(classSessions)
        .where(and(gte(classSessions.sessionDate, today), eq(classSessions.status, "scheduled"))),
    ),
    count(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(bookings)),
    db
      .select({ total: sql<number>`coalesce(sum(${vouchers.creditsRemaining}), 0)`.mapWith(Number) })
      .from(vouchers)
      .where(eq(vouchers.status, "active")),
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number) })
      .from(payments)
      .where(eq(payments.status, "paid")),
  ]);

  const [changes, upcoming, latestPayments, topClasses] = await Promise.all([
    getRecentChanges(10),
    getUpcomingSessions(8),
    db
      .select({
        id: payments.id,
        reference: payments.reference,
        amountCents: payments.amountCents,
        method: payments.method,
        createdAt: payments.createdAt,
        userName: users.name,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt))
      .limit(6),
    db
      .select({
        name: classTypes.name,
        slug: classTypes.slug,
        total: sql<number>`count(${bookings.id})`.mapWith(Number),
      })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .groupBy(classTypes.name, classTypes.slug)
      .orderBy(desc(sql`count(${bookings.id})`))
      .limit(5),
  ]);

  const [teacherCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(teachers);
  const [roomCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(rooms);
  void asc;

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={`${memberCount}`} hint={`${bookingCount} bookings all time`} />
        <Stat label="Scheduled classes ahead" value={`${sessionCount}`} hint="Next 5 weeks" />
        <Stat label="Credits outstanding" value={`${creditsOutstanding[0]?.total ?? 0}`} hint="On active vouchers" />
        <Stat label="Revenue collected" value={formatMoney(revenue[0]?.total ?? 0)} hint={`${teacherCount?.count ?? 0} teachers · ${roomCount?.count ?? 0} rooms`} />
      </div>

      <section className="card p-6">
        <h2 className="display text-2xl">Studio operations</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The weekly timetable repeats automatically. After editing a weekly slot, sync to push the
          change into upcoming dates. Booked classes are never silently rewritten — members are
          notified instead.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <form action={syncTimetableAction}>
            <button type="submit" className="btn btn-primary btn-sm">Sync timetable with weekly slots</button>
          </form>
          <Link href="/admin/timetable" className="btn btn-outline btn-sm">Edit weekly timetable</Link>
          <Link href="/admin/timetable#extra" className="btn btn-outline btn-sm">Add an extra class</Link>
          <form action={expireStaleVouchersAction}>
            <button type="submit" className="btn btn-outline btn-sm">Refresh voucher statuses</button>
          </form>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section>
          <h2 className="display text-2xl">Change log</h2>
          <p className="mt-1 text-sm text-ink-soft">Every time, teacher, room and cancellation change.</p>
          <div className="card mt-4 divide-y divide-ink/8">
            {changes.map((change) => (
              <div key={change.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={change.changeType === "cancellation" ? "clay" : "warn"}>{change.changeType}</Badge>
                  <span className="text-sm font-semibold">{change.className}</span>
                  <span className="text-xs text-ink-soft">
                    {formatDateShort(change.sessionDate)} · {formatRange(change.startTime, 60).split("–")[0]}
                  </span>
                  <span className="ml-auto text-xs text-ink-soft">{formatDateTime(change.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {change.oldValue ? `Was: ${change.oldValue}. ` : ""}
                  {change.newValue ? `Now: ${change.newValue}.` : ""}
                  {change.note ? ` ${change.note}` : ""} — {change.actorName}
                </p>
              </div>
            ))}
            {changes.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-soft">No changes recorded yet.</p>
            ) : null}
          </div>
        </section>

        <section className="space-y-6">
          <div className="card p-6">
            <h2 className="display text-xl">Send a notification</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Broadcast to all active members, or only to members booked on a specific class.
            </p>
            <ActionForm
              action={broadcastAction}
              submitLabel="Send notification"
              pendingLabel="Sending…"
              submitClassName="btn btn-primary btn-sm mt-1"
              className="mt-4 space-y-3"
            >
              <div>
                <label className="label" htmlFor="title">Title</label>
                <input id="title" name="title" className="field" placeholder="Studio closed on Friday evening" required />
              </div>
              <div>
                <label className="label" htmlFor="body">Message</label>
                <textarea id="body" name="body" rows={3} className="field" placeholder="Add the details members need." required />
              </div>
              <div>
                <label className="label" htmlFor="sessionId">Limit to a class (optional)</label>
                <select id="sessionId" name="sessionId" className="field" defaultValue="">
                  <option value="">All active members</option>
                  {upcoming.map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatDateShort(session.sessionDate)} {session.startTime} · {session.classTypeName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="actionHref">Link (optional)</label>
                <input id="actionHref" name="actionHref" className="field" placeholder="/timetable" />
              </div>
            </ActionForm>
          </div>

          <div className="card p-6">
            <h2 className="display text-xl">Most booked classes</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {topClasses.map((row) => (
                <li key={row.slug} className="flex items-center justify-between gap-3">
                  <Link href={`/classes/${row.slug}`} className="hover:text-clay">{row.name}</Link>
                  <span className="font-semibold">{row.total}</span>
                </li>
              ))}
              {topClasses.length === 0 ? <li className="text-ink-soft">No bookings yet.</li> : null}
            </ul>
          </div>
        </section>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="display text-xl">Next classes</h2>
          <ul className="mt-3 divide-y divide-ink/8 text-sm">
            {upcoming.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-28 text-xs font-bold text-ink-soft">{formatDateShort(session.sessionDate)}</span>
                <span className="font-medium">{session.classTypeName}</span>
                <span className="text-xs text-ink-soft">
                  {session.startTime} · {session.teacherName} · {session.roomName}
                </span>
                <span className="ml-auto text-xs font-semibold">
                  {session.booked}/{session.capacity}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="display text-xl">Recent voucher payments</h2>
          <ul className="mt-3 divide-y divide-ink/8 text-sm">
            {latestPayments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-mono text-xs">{payment.reference}</span>
                <span className="text-ink-soft">{payment.userName}</span>
                <span className="ml-auto font-semibold">{formatMoney(payment.amountCents)}</span>
                <span className="text-xs text-ink-soft">{payment.method.replace("_", " ")}</span>
              </li>
            ))}
            {latestPayments.length === 0 ? (
              <li className="text-ink-soft">No payments recorded yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
